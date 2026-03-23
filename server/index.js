const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.resolve(__dirname, 'database.sqlite');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.6-subcategories-update' });
});

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else {
    console.log('Connected to the SQLite database.');
    seedCategories();
  }
});

function seedCategories() {
  db.serialize(() => {
    // Drop existing category setup if necessary? Better just create new tables.
    db.run(`CREATE TABLE IF NOT EXISTS main_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_tr TEXT UNIQUE,
      name_en TEXT,
      name_de TEXT,
      name_es TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sub_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      main_category_id INTEGER,
      name_tr TEXT UNIQUE,
      name_en TEXT,
      name_de TEXT,
      name_es TEXT,
      FOREIGN KEY(main_category_id) REFERENCES main_categories(id)
    )`);

    // Main tables
    db.run(`CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_no INTEGER UNIQUE,
      author TEXT,
      publish_year TEXT,
      sub_category_id INTEGER,
      FOREIGN KEY(sub_category_id) REFERENCES sub_categories(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS book_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      lang_code TEXT,
      title TEXT,
      category_name TEXT,
      FOREIGN KEY(book_id) REFERENCES books(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_no INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS story_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER,
      lang_code TEXT,
      title TEXT,
      description TEXT,
      content TEXT,
      FOREIGN KEY(story_id) REFERENCES stories(id)
    )`);

    // Migration for existing databases
    db.run(`ALTER TABLE books ADD COLUMN sub_category_id INTEGER REFERENCES sub_categories(id)`, (err) => {
      // Ignore error if column already exists
    });

    const MAIN_CATEGORIES = [
      { tr: 'Psikoloji', en: 'Psychology' },
      { tr: 'İş Dünyası', en: 'Business' },
      { tr: 'Kişisel Gelişim', en: 'Personal Growth' },
      { tr: 'Liderlik', en: 'Leadership' },
      { tr: 'Bilim', en: 'Science' },
      { tr: 'Sağlık', en: 'Health' },
      { tr: 'Felsefe', en: 'Philosophy' },
      { tr: 'Toplum', en: 'Society' },
      { tr: 'Verimlilik', en: 'Productivity' },
      { tr: 'İletişim', en: 'Communication' },
      { tr: 'Diğer', en: 'Other' }
    ];

    const SUB_CATEGORY_MAPPING = {
      'Psikoloji': ['Zihinsel modeller', 'Mindfulness', 'Duygular', 'Nörobilim', 'Mental sağlık', 'Psikoloji'],
      'İş Dünyası': ['Finans', 'Girişimcilik', 'Kariyer', 'Pazarlama', 'Ekonomi', 'İş Dünyası'],
      'Kişisel Gelişim': ['Motivasyon', 'İrade', 'Alışkanlıklar', 'Dayanıklılık', 'Kişisel Gelişim', 'Gelişim'],
      'Liderlik': ['Yönetim', 'Strateji', 'Karar verme', 'Vizyon', 'Başarı', 'Liderlik'],
      'Bilim': ['Teknoloji', 'Gelecek trendleri', 'İnovasyon', 'Yapay zeka', 'Evren', 'Bilim'],
      'Sağlık': ['Beslenme', 'Beyin sağlığı', 'Uyku', 'Fiziksel zindelik', 'Uzun yaşam', 'Sağlık'],
      'Felsefe': ['Düşünce sanatları', 'Yaşam amacı', 'Stoacılık', 'Mantık', 'Felsefe'],
      'Toplum': ['Sosyoloji', 'Tarih', 'Kültür', 'Topluluk bilinci', 'Toplum', 'Siyaset'],
      'Verimlilik': ['Odaklanma', 'Zaman yönetimi', 'Yaratıcılık', 'Derin çalışma', 'Verimlilik'],
      'İletişim': ['İlişkiler', 'Müzakere', 'Empati', 'Sosyal beceriler', 'İnsan doğası', 'İletişim']
    };

    const stmtMain = db.prepare('INSERT OR IGNORE INTO main_categories (name_tr, name_en) VALUES (?, ?)');
    MAIN_CATEGORIES.forEach(mc => {
      stmtMain.run(mc.tr, mc.en);
    });
    stmtMain.finalize((err) => {
      if (err) return;
      const stmtSub = db.prepare('INSERT OR IGNORE INTO sub_categories (main_category_id, name_tr) SELECT id, ? FROM main_categories WHERE name_tr = ?');
      Object.keys(SUB_CATEGORY_MAPPING).forEach(mainCat => {
        SUB_CATEGORY_MAPPING[mainCat].forEach(subCat => {
          stmtSub.run(subCat, mainCat);
        });
      });
      stmtSub.finalize();
    });
  });
}

const upload = multer({ dest: 'uploads/' });

const LANGUAGES = ['tr', 'en', 'de', 'es'];

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const dataBooks = xlsx.utils.sheet_to_json(workbook.Sheets['Kitap Listesi'] || workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    const dataStories = workbook.Sheets['Hikayeler'] ? xlsx.utils.sheet_to_json(workbook.Sheets['Hikayeler'], { header: 1 }) : [];

    // Process sub categories directly before reading books
    const excelSubCats = new Set();
    for (let i = 1; i < dataBooks.length; i++) {
      if (dataBooks[i] && dataBooks[i][5]) excelSubCats.add(dataBooks[i][5].toString().trim());
    }

    db.get('SELECT id FROM main_categories WHERE name_tr = "Diğer"', [], (err, defaultMainCat) => {
      const defaultMainCatId = defaultMainCat ? defaultMainCat.id : null;

      db.serialize(() => {
        const stmtInsSub = db.prepare('INSERT OR IGNORE INTO sub_categories (main_category_id, name_tr) VALUES (?, ?)');
        excelSubCats.forEach(sc => stmtInsSub.run(defaultMainCatId, sc));
        stmtInsSub.finalize();

        // fetch fresh Sub Categories Map
        db.all('SELECT id, name_tr FROM sub_categories', [], (err, sysSubRows) => {
          const subCatMap = new Map();
          if (sysSubRows) sysSubRows.forEach(r => subCatMap.set(r.name_tr.toLowerCase(), r.id));

          // Get existing books with stories to implement the guard
          db.all('SELECT DISTINCT book_no FROM stories', [], (err, rows) => {
            if (err) throw err;
            const booksWithStories = new Set(rows.map(r => r.book_no));

            db.serialize(() => {
              db.run('BEGIN TRANSACTION');

              const stmtBook = db.prepare('INSERT OR REPLACE INTO books (list_no, author, publish_year, sub_category_id) VALUES (?, ?, ?, ?)');
              const stmtBookTrans = db.prepare('INSERT INTO book_translations (book_id, lang_code, title, category_name) VALUES (?, ?, ?, ?)');

              let countBooksAdded = 0;
              for (let i = 1; i < dataBooks.length; i++) {
                const row = dataBooks[i];
                if (!row || row.length === 0 || !row[0]) continue;

                const list_no = row[0];
                const author = row[3] || '';
                const publish_year = row[4] || '';
                const subCatStr = row[5] ? row[5].toString().trim() : '';
                const subCatId = subCatMap.get(subCatStr.toLowerCase()) || null;

                stmtBook.run(list_no, author, publish_year, subCatId, function (err) {
                  if (err) return;
                  // Handle translations insertion if needed:
                  const bookId = this.lastID;
                  countBooksAdded++;
                  // clean old translations for REPLACE trick to avoid dups safely since we replace
                  db.run('DELETE FROM book_translations WHERE book_id = ?', [bookId], () => {
                    LANGUAGES.forEach(lang => {
                      let title = '';
                      let category = '';
                      if (lang === 'tr') { title = row[1] || ''; category = row[5] || ''; }
                      else if (lang === 'en') { title = row[2] || ''; category = row[5] || ''; }
                      stmtBookTrans.run(bookId, lang, title, category);
                    });
                  });
                });
              }

              // Process Stories
              const stmtStory = db.prepare('INSERT INTO stories (book_no) VALUES (?)');
              const stmtStoryTrans = db.prepare('INSERT INTO story_translations (story_id, lang_code, title, description, content) VALUES (?, ?, ?, ?, ?)');

              let countStoriesAdded = 0;
              let countStoriesSkipped = 0;

              for (let i = 1; i < dataStories.length; i++) {
                const row = dataStories[i];
                if (!row || row.length === 0 || !row[0]) continue;

                const book_no = row[0];

                if (booksWithStories.has(book_no)) {
                  countStoriesSkipped++;
                  continue;
                }

                stmtStory.run(book_no, function (err) {
                  if (err) return;
                  const storyId = this.lastID;
                  countStoriesAdded++;

                  LANGUAGES.forEach(lang => {
                    let title = '';
                    let description = '';
                    let content = '';
                    if (lang === 'tr') {
                      title = row[2] || '';
                      description = row[3] || '';
                      content = row[4] || '';
                    }
                    stmtStoryTrans.run(storyId, lang, title, description, content);
                  });
                });
              }

              db.run('COMMIT', (err) => {
                if (err) {
                  console.error(err);
                  return res.status(500).json({ error: 'Database error' });
                }
                fs.unlinkSync(req.file.path);
                res.json({
                  message: `Aktarım tamamlandı. ${countBooksAdded} yeni kitap işlendi. ${countStoriesAdded} yeni hikaye eklendi. ${countStoriesSkipped} hikaye (sistemde zaten olduğu için) atlandı.`
                });
              });
            });
          });
        });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books', (req, res) => {
  const lang = req.query.lang || 'tr';

  let query = `
    SELECT b.*,
           bt.title,
           sc.subcategory_name AS category,
           sc.subcategory_name AS sub_category,
           COALESCE(ct.translation, c.category_name) AS main_category,
           (SELECT COUNT(*) FROM stories s WHERE s.book_no = b.list_no) AS story_count
    FROM books b
    LEFT JOIN book_translations bt ON b.id = bt.book_id AND bt.lang_code = ?
    LEFT JOIN subcategories sc ON sc.id = b.category_id
    LEFT JOIN categories c ON c.id = sc.categori_id
    LEFT JOIN categories_translations ct ON ct.category_id = c.id AND ct.language = ?
    WHERE 1=1
  `;
  const params = [lang, lang];

  if (req.query.author) {
    query += ' AND b.author = ?';
    params.push(req.query.author);
  }
  if (req.query.category) {
    query += ' AND sc.subcategory_name = ?';
    params.push(req.query.category);
  }
  if (req.query.main_category) {
    query += ' AND c.id = ?';
    params.push(req.query.main_category);
  }
  if (req.query.book_no) {
    query += ' AND b.list_no = ?';
    params.push(req.query.book_no);
  }

  query += ' ORDER BY b.id DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/categories', (req, res) => {
  const lang = req.query.lang || 'tr';

  db.all(`
    SELECT
      c.id          AS cat_id,
      c.category_name AS cat_name_en,
      COALESCE(ct.translation, c.category_name) AS cat_name,
      sc.id         AS sub_id,
      sc.subcategory_name AS sub_name,
      COUNT(DISTINCT b.id) AS book_count
    FROM categories c
    LEFT JOIN categories_translations ct
      ON ct.category_id = c.id AND ct.language = ?
    LEFT JOIN subcategories sc
      ON sc.categori_id = c.id
    LEFT JOIN books b
      ON b.category_id = sc.id
    GROUP BY c.id, sc.id
    ORDER BY c."order" ASC, sc.subcategory_name ASC
  `, [lang], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const result = [];
    const map = new Map();

    rows.forEach(r => {
      if (!map.has(r.cat_id)) {
        const newCat = {
          id: r.cat_id,
          name: r.cat_name,
          name_en: r.cat_name_en,
          book_count: 0,
          sub_count: 0,
          sub_categories: []
        };
        map.set(r.cat_id, newCat);
        result.push(newCat);
      }
      const cat = map.get(r.cat_id);
      if (r.sub_id) {
        cat.sub_categories.push({
          id: r.sub_id,
          name: r.sub_name,
          book_count: r.book_count || 0
        });
        cat.book_count += (r.book_count || 0);
        cat.sub_count += 1;
      }
    });

    res.json(result);
  });
});

app.get('/api/authors', (req, res) => {
  db.all('SELECT author, COUNT(*) as book_count FROM books GROUP BY author ORDER BY author ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/stories', (req, res) => {
  const lang = req.query.lang || 'tr';
  let query = `
    SELECT s.*, st.title, st.description, st.content, b.id as book_id, bt.title as book_title
    FROM stories s
    LEFT JOIN story_translations st ON s.id = st.story_id AND st.lang_code = ?
    LEFT JOIN books b ON s.book_no = b.list_no
    LEFT JOIN book_translations bt ON b.id = bt.book_id AND bt.lang_code = ?
    WHERE 1=1
  `;
  const params = [lang, lang];

  if (req.query.book_no) {
    query += ' AND s.book_no = ?';
    params.push(req.query.book_no);
  }

  query += ' ORDER BY s.id DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/stories/:id/translations', (req, res) => {
  const storyId = req.params.id;
  db.all('SELECT lang_code, title, description, content FROM story_translations WHERE story_id = ?', [storyId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const translations = {};
    rows.forEach(row => {
      translations[row.lang_code] = row;
    });
    res.json(translations);
  });
});

app.post('/api/clear', (req, res) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM story_translations');
    db.run('DELETE FROM stories');
    db.run('DELETE FROM book_translations');
    db.run('DELETE FROM books');
    // We intentionally do not delete categories, as they are seeded.
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Tüm kitap ve hikaye verileri başarıyla sıfırlandı. Ana kategoriler korundu.' });
    });
  });
});

const translateService = require('./translate_service');

app.get('/api/translate-stats', async (req, res) => {
  try {
    const stats = await translateService.getTranslationStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/translate-batch', async (req, res) => {
  try {
    const { limit } = req.body;
    const result = await translateService.translateBatch(null, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/translate-books-batch', async (req, res) => {
  try {
    const { limit } = req.body;
    const result = await translateService.translateBooksBatch(null, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/translate-categories-batch', async (req, res) => {
  try {
    const { limit } = req.body;
    const result = await translateService.translateCategoriesBatch(null, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
