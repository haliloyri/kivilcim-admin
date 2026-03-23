const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const translate = require('google-translate-api-x');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const delay = ms => new Promise(res => setTimeout(res, ms));

async function runTranslation() {
  console.log('Veritabanına bağlanılıyor...');

  // 'tr' dilindeki tüm hikayeleri çek
  db.all(`SELECT * FROM story_translations WHERE lang_code = 'tr' AND content != ''`, async (err, trStories) => {
    if (err) {
      console.error('Hikayeler çekilirken hata:', err);
      return;
    }

    console.log(`Toplam ${trStories.length} adet Türkçe hikaye bulundu. Çeviri başlıyor...`);

    for (let i = 0; i < trStories.length; i++) {
      const story = trStories[i];
      console.log(`\nHikaye işleniyor: ID ${story.story_id} - ${story.title}`);

      for (const targetLang of ['en', 'de']) {
        try {
          // Önce bu dilde zaten çeviri var mı kontrol edelim
          const existing = await new Promise((resolve, reject) => {
            db.get(
              `SELECT id FROM story_translations WHERE story_id = ? AND lang_code = ? AND content != ''`,
              [story.story_id, targetLang],
              (err, row) => {
                if (err) reject(err);
                resolve(row);
              }
            );
          });

          if (existing) {
            console.log(`- ${targetLang} çevirisi zaten var, atlanıyor.`);
            continue;
          }

          console.log(`- ${targetLang} diline çevriliyor...`);
          
          let translatedTitle = '';
          let translatedDesc = '';
          let translatedContent = '';

          // API Limiti yememek için küçük beklemeler ekliyoruz
          if (story.title) {
            const resTitle = await translate(story.title, { from: 'tr', to: targetLang });
            translatedTitle = resTitle.text;
            await delay(500);
          }

          if (story.description) {
            const resDesc = await translate(story.description, { from: 'tr', to: targetLang });
            translatedDesc = resDesc.text;
            await delay(500);
          }

          if (story.content) {
            const resContent = await translate(story.content, { from: 'tr', to: targetLang });
            translatedContent = resContent.text;
            await delay(1000); // İçerik uzun olduğu için daha fazla bekle
          }

          // Veritabanını güncelle
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

          console.log(`  > Başarıyla kaydedildi: ${targetLang}`);

        } catch (error) {
          console.error(`! ${targetLang} Çeviri hatası:`, error.message);
        }
      }
    }

    console.log('\nTüm çeviri işlemleri tamamlandı!');
    db.close();
  });
}

runTranslation();
