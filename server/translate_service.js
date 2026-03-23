const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const translate = require('google-translate-api-x');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const delay = ms => new Promise(res => setTimeout(res, ms));

async function getTranslationStats() {
  return new Promise(async (resolve, reject) => {
    try {
      const getStatsTranslations = (table, column) => new Promise((res, rej) => {
        db.all(`SELECT lang_code, COUNT(id) as count FROM ${table} WHERE ${column} != '' GROUP BY lang_code`, (err, rows) => {
          if (err) return rej(err);
          const stats = { tr: 0, en: 0, de: 0, es: 0 };
          let total = 0;
          rows.forEach(r => {
            if (r.lang_code) {
              stats[r.lang_code] = r.count;
              if (r.lang_code === 'tr') total = r.count;
            }
          });
          res({ total, translated: stats });
        });
      });

      const getStatsCategories = () => new Promise((res, rej) => {
        db.get(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN name_tr IS NOT NULL AND name_tr != '' THEN 1 END) as tr,
            COUNT(CASE WHEN name_en IS NOT NULL AND name_en != '' THEN 1 END) as en,
            COUNT(CASE WHEN name_de IS NOT NULL AND name_de != '' THEN 1 END) as de,
            COUNT(CASE WHEN name_es IS NOT NULL AND name_es != '' THEN 1 END) as es
          FROM sub_categories
        `, [], (err, row) => {
          if (err) return rej(err);
          const stats = { tr: row.tr, en: row.en, de: row.de, es: row.es };
          res({ total: row.total, translated: stats });
        });
      });

      const stories = await getStatsTranslations('story_translations', 'content');
      const books = await getStatsTranslations('book_translations', 'title');
      const categories = await getStatsCategories();
      
      resolve({ stories, books, categories });
    } catch (e) {
      reject(e);
    }
  });
}

async function translateFieldBatch(column, limit = 20) {
  const items = await new Promise((resolve, reject) => {
    db.all(
      `SELECT bt.book_id, bt.${column} as textToTranslate
       FROM book_translations bt
       WHERE bt.lang_code = 'tr' AND bt.${column} != ''
       AND (
         EXISTS (SELECT 1 FROM book_translations bt2 WHERE bt2.book_id = bt.book_id AND bt2.lang_code = 'en' AND bt2.${column} = '') OR
         EXISTS (SELECT 1 FROM book_translations bt2 WHERE bt2.book_id = bt.book_id AND bt2.lang_code = 'de' AND bt2.${column} = '') OR
         EXISTS (SELECT 1 FROM book_translations bt2 WHERE bt2.book_id = bt.book_id AND bt2.lang_code = 'es' AND bt2.${column} = '')
       )
       LIMIT ?`, 
      [limit], 
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });

  if (items.length === 0) return { success: true, message: `Çevrilecek kayıt kalmadı!`, processed: 0 };

  let processedCount = 0;
  for (const item of items) {
    for (const targetLang of ['en', 'de', 'es']) {
      const isMissing = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM book_translations WHERE book_id = ? AND lang_code = ? AND ${column} = ''`, [item.book_id, targetLang], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (!isMissing) continue;

      try {
        const res = await translate(item.textToTranslate, { from: 'tr', to: targetLang });
        await delay(1000); 
        await new Promise((resolve, reject) => {
          db.run(`UPDATE book_translations SET ${column} = ? WHERE book_id = ? AND lang_code = ?`,
            [res.text, item.book_id, targetLang], err => err ? reject(err) : resolve()
          );
        });
      } catch (e) {
        console.error(`Error translating ${column} for book ${item.book_id} to ${targetLang}:`, e.message);
      }
    }
    processedCount++;
  }
  return { success: true, processed: processedCount, message: `${processedCount} kayıt Google API ile çevrildi.` };
}

async function translateBooksBatch(apiKey, limit = 20) { return translateFieldBatch('title', limit); }

async function translateCategoriesBatch(apiKey, limit = 20) {
  const items = await new Promise((resolve, reject) => {
    db.all(
      `SELECT id, name_tr as textToTranslate
       FROM sub_categories
       WHERE name_tr != '' AND name_tr IS NOT NULL
       AND (
         name_en IS NULL OR name_en = '' OR
         name_de IS NULL OR name_de = '' OR
         name_es IS NULL OR name_es = ''
       )
       LIMIT ?`, 
      [limit], 
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });

  if (items.length === 0) return { success: true, message: `Çevrilecek kategori kalmadı!`, processed: 0 };

  let processedCount = 0;
  for (const item of items) {
    for (const targetLang of ['en', 'de', 'es']) {
      const isMissing = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM sub_categories WHERE id = ? AND (name_${targetLang} IS NULL OR name_${targetLang} = '')`, [item.id], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (!isMissing) continue;

      try {
        const res = await translate(item.textToTranslate, { from: 'tr', to: targetLang });
        await delay(1000); 
        await new Promise((resolve, reject) => {
          db.run(`UPDATE sub_categories SET name_${targetLang} = ? WHERE id = ?`,
            [res.text, item.id], err => err ? reject(err) : resolve()
          );
        });
      } catch (e) {
        console.error(`Error translating category ${item.id} to ${targetLang}:`, e.message);
      }
    }
    processedCount++;
  }
  return { success: true, processed: processedCount, message: `${processedCount} kategori Google API ile çevrildi.` };
}

async function translateBatch(apiKey, limit = 5) {
  const storiesToTranslate = await new Promise((resolve, reject) => {
    db.all(
      `SELECT st.story_id, st.title, st.description, st.content 
       FROM story_translations st
       WHERE st.lang_code = 'tr' 
       AND (
         NOT EXISTS (SELECT 1 FROM story_translations st2 WHERE st2.story_id = st.story_id AND st2.lang_code = 'en' AND st2.content != '') OR
         NOT EXISTS (SELECT 1 FROM story_translations st2 WHERE st2.story_id = st.story_id AND st2.lang_code = 'de' AND st2.content != '') OR
         NOT EXISTS (SELECT 1 FROM story_translations st2 WHERE st2.story_id = st.story_id AND st2.lang_code = 'es' AND st2.content != '')
       )
       LIMIT ?`, 
      [limit], 
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });

  if (storiesToTranslate.length === 0) {
    return { success: true, message: 'Çevrilecek hikaye kalmadı!', processed: 0 };
  }

  let processedCount = 0;

  for (const story of storiesToTranslate) {
    for (const targetLang of ['en', 'de', 'es']) {
      const isMissing = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM story_translations WHERE story_id = ? AND lang_code = ? AND content != ''`, [story.story_id, targetLang], (err, row) => {
          if (err) reject(err);
          resolve(!row);
        });
      });

      if (!isMissing) continue;

      try {
        let translatedTitle = '';
        let translatedDesc = '';
        let translatedContent = '';

          if (story.title) {
            const resTitle = await translate(story.title, { from: 'tr', to: targetLang });
            translatedTitle = resTitle.text;
            await delay(1500);
          }

          if (story.description) {
            const resDesc = await translate(story.description, { from: 'tr', to: targetLang });
            translatedDesc = resDesc.text;
            await delay(1500);
          }

          if (story.content) {
            const resContent = await translate(story.content, { from: 'tr', to: targetLang });
            translatedContent = resContent.text;
            await delay(4000);
          }

        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE story_translations 
             SET title = ?, description = ?, content = ? 
             WHERE story_id = ? AND lang_code = ?`,
            [translatedTitle, translatedDesc, translatedContent, story.story_id, targetLang],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });

      } catch (error) {
        console.error(`Error translating story ${story.story_id} to ${targetLang}:`, error.message);
      }
    }
    processedCount++;
  }

  return { success: true, processed: processedCount, message: `${processedCount} hikaye başarıyla Google API ile çevrildi.` };
}

module.exports = { getTranslationStats, translateBatch, translateBooksBatch, translateCategoriesBatch };
