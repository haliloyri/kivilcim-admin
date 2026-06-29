require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getTableData(table) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function run() {
  try {
    console.log("🚀 Starting Categories & Books migration...");

    // 1. main_categories
    let mc = await getTableData('main_categories');
    if (mc.length > 0) {
      console.log(`📦 Found ${mc.length} main_categories. Upserting...`);
      const { error } = await supabase.from('main_categories').upsert(mc);
      if (error) throw error;
      console.log('✅ main_categories done.');
    }

    // 2. sub_categories (from local 'categories' table)
    let sc = await getTableData('categories');
    if (sc.length > 0) {
      console.log(`📦 Found ${sc.length} categories. Upserting to sub_categories...`);
      // SQLite 'categories' has: id, category_name, order. Map 'order' to 'order' in Supabase.
      const mappedSc = sc.map(row => ({
        id: row.id,
        category_name: row.category_name,
        "order": row.order
      }));
      const { error } = await supabase.from('sub_categories').upsert(mappedSc);
      if (error) throw error;
      console.log('✅ sub_categories done.');
    }

    // 3. sub_category_translations (from local 'categories_translations')
    let sct = await getTableData('categories_translations');
    if (sct.length > 0) {
      console.log(`📦 Found ${sct.length} categories_translations. Upserting...`);
      const { error } = await supabase.from('sub_category_translations').upsert(sct);
      if (error) throw error;
      console.log('✅ sub_category_translations done.');
    }

    // 4. books
    let books = await getTableData('books');
    if (books.length > 0) {
      console.log(`📦 Found ${books.length} books. Upserting...`);
      const { error } = await supabase.from('books').upsert(books);
      if (error) throw error;
      console.log('✅ books done.');
    }

    // 5. book_translations
    let bt = await getTableData('book_translations');
    if (bt.length > 0) {
      console.log(`📦 Found ${bt.length} book_translations. Upserting...`);
      const { error } = await supabase.from('book_translations').upsert(bt);
      if (error) throw error;
      console.log('✅ book_translations done.');
    }

    console.log("🎉 Migration fully complete!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

run();
