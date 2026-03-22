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
  res.json({ status: 'ok', version: '2.5-incremental-upload-guard' });
});

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to the SQLite database.');
});

db.serialize(() => {
  // Main tables
  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_no INTEGER UNIQUE,
    author TEXT,
    publish_year TEXT
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
});

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
    
    // Get existing books with stories to implement the guard
    db.all('SELECT DISTINCT book_no FROM stories', [], (err, rows) => {
      if (err) throw err;
      const booksWithStories = new Set(rows.map(r => r.book_no));

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Note: We are NO LONGER deleting all data. 
        // This is now an Incremental/Smart upload.

        // Process Books
        const stmtBook = db.prepare('INSERT OR IGNORE INTO books (list_no, author, publish_year) VALUES (?, ?, ?)');
        const stmtBookTrans = db.prepare('INSERT INTO book_translations (book_id, lang_code, title, category_name) VALUES (?, ?, ?, ?)');
        
        let countBooksAdded = 0;
        for (let i = 1; i < dataBooks.length; i++) {
          const row = dataBooks[i];
          if (!row || row.length === 0 || !row[0]) continue;
          
          const list_no = row[0];
          const author = row[3] || '';
          const publish_year = row[4] || '';
          
          stmtBook.run(list_no, author, publish_year, function(err) {
            if (err) return;
            // changes > 0 means a new row was inserted (not ignored)
            if (this.changes > 0) {
              const bookId = this.lastID;
              countBooksAdded++;
              
              LANGUAGES.forEach(lang => {
                let title = '';
                let category = '';
                if (lang === 'tr') { title = row[1] || ''; category = row[5] || ''; }
                else if (lang === 'en') { title = row[2] || ''; category = row[5] || ''; }
                stmtBookTrans.run(bookId, lang, title, category);
              });
            }
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
          
          // GUARD: If book ID already has stories, SKIP the whole excel entry for this book
          if (booksWithStories.has(book_no)) {
            countStoriesSkipped++;
            continue;
          }
          
          stmtStory.run(book_no, function(err) {
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
            message: `Aktarım tamamlandı. ${countBooksAdded} yeni kitap eklendi. ${countStoriesAdded} yeni hikaye eklendi. ${countStoriesSkipped} hikaye (sistemde zaten olduğu için) atlandı.` 
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
    SELECT b.*, bt.title, bt.category_name as category,
           (SELECT COUNT(*) FROM stories s WHERE s.book_no = b.list_no) as story_count
    FROM books b
    LEFT JOIN book_translations bt ON b.id = bt.book_id AND bt.lang_code = ?
    WHERE 1=1
  `;
  const params = [lang];

  if (req.query.author) {
    query += ' AND b.author = ?';
    params.push(req.query.author);
  }
  if (req.query.category) {
    query += ' AND bt.category_name = ?';
    params.push(req.query.category);
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
    SELECT category_name as name, COUNT(DISTINCT b.id) as book_count 
    FROM book_translations bt
    JOIN books b ON b.id = bt.book_id
    WHERE bt.lang_code = ? AND bt.category_name != ''
    GROUP BY bt.category_name 
    ORDER BY bt.category_name ASC
  `, [lang], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
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

app.post('/api/clear', (req, res) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM story_translations');
    db.run('DELETE FROM stories');
    db.run('DELETE FROM book_translations');
    db.run('DELETE FROM books');
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Tüm veritabanı başarıyla sıfırlandı.' });
    });
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
