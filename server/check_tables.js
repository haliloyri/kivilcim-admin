const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, 'database.sqlite'));

// Check categories_translations
db.all("PRAGMA table_info(categories_translations)", (err, cols) => {
  console.log('cat_trans cols:', cols ? cols.map(c => c.name).join('|') : 'none');
  db.all("SELECT * FROM categories_translations LIMIT 5", (err2, rows) => {
    if (err2) console.log('cat_trans err:', err2.message);
    else rows.forEach(r => console.log('TRANS:', JSON.stringify(r)));
    
    // Count subcategories per category
    db.all("SELECT categori_id, COUNT(*) as cnt FROM subcategories GROUP BY categori_id", (err3, rows3) => {
      if (err3) console.log('err3:', err3.message);
      else rows3.forEach(r => console.log('SUBCAT_CNT:', JSON.stringify(r)));
      
      // Count books per subcategory
      db.all("SELECT category_id, COUNT(*) as cnt FROM books GROUP BY category_id LIMIT 10", (err4, rows4) => {
        if (err4) console.log('err4:', err4.message);
        else rows4.forEach(r => console.log('BOOK_BY_SUBCAT:', JSON.stringify(r)));
        db.close();
      });
    });
  });
});
