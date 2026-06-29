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

async function run() {
  console.log("🚀 Starting conversation fields migration...");
  
  db.all('SELECT * FROM story_conversation_variants', async (err, rows) => {
    if (err) {
      console.error("Error reading from SQLite:", err);
      process.exit(1);
    }
    
    console.log(`📦 Found ${rows.length} conversation variants in SQLite.`);
    
    let updatedCount = 0;
    
    // Process sequentially or in small chunks to avoid rate limiting
    for (const row of rows) {
      const { story_id, lang_code, punchline, thirty_sec, question, key_contrast } = row;
      
      const { data, error } = await supabase
        .from('stories')
        .update({
          conv_punchline: punchline,
          conv_thirty_sec: thirty_sec,
          conv_question: question,
          conv_key_contrast: key_contrast
        })
        .eq('story_id', story_id)
        .eq('lang', lang_code);
        
      if (error) {
        console.error(`❌ Error updating story_id ${story_id} lang ${lang_code}:`, error.message);
      } else {
        updatedCount++;
        if (updatedCount % 50 === 0) {
          console.log(`✅ Updated ${updatedCount}/${rows.length} records...`);
        }
      }
    }
    
    console.log(`🎉 Migration complete! Successfully updated ${updatedCount} records.`);
    process.exit(0);
  });
}

run();
