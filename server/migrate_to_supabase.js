/**
 * migrate_to_supabase.js
 *
 * SQLite veritabanındaki hikayeleri Supabase'deki mevcut `stories` tablosuna
 * düzleştirilmiş (denormalized) formatta aktarır.
 *
 * Çalıştırmak için:
 *   node migrate_to_supabase.js
 *
 * İsteğe bağlı parametreler:
 *   --dry-run       : Supabase'e yazmadan sadece log gösterir
 *   --batch=50      : Batch boyutunu değiştirir (default: 50)
 *   --lang=tr,en    : Sadece belirtilen dilleri aktarır (default: tümü)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ─── Config ──────────────────────────────────────────────────────────────────
const DB_PATH = path.resolve(__dirname, 'database.sqlite');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BATCH_SIZE = parseInt((process.argv.find(a => a.startsWith('--batch=')) || '--batch=50').split('=')[1]);
const DRY_RUN = process.argv.includes('--dry-run');
const LANG_FILTER = (process.argv.find(a => a.startsWith('--lang=')) || '').split('=')[1]?.split(',').filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL ve SUPABASE_KEY .env dosyasında tanımlı olmalı.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const db = new sqlite3.Database(DB_PATH);

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function getExistingPairs() {
  // Supabase'deki mevcut (story_id, lang) çiftlerini çek
  let allPairs = new Set();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('stories')
      .select('story_id, lang')
      .not('story_id', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error('Mevcut kayıtlar alınamadı: ' + error.message);
    if (!data || data.length === 0) break;
    data.forEach(r => allPairs.add(`${r.story_id}:${r.lang}`));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allPairs;
}

async function migrate() {
  console.log('🚀 Migrasyon başlatıldı...');
  if (DRY_RUN) console.log('⚠️  DRY RUN modu — Supabase\'e yazılmayacak');
  if (LANG_FILTER?.length) console.log(`🌐 Dil filtresi: ${LANG_FILTER.join(', ')}`);
  console.log(`📦 Batch boyutu: ${BATCH_SIZE}`);
  console.log('');

  // 1. SQLite'dan tüm verileri çek (JOIN ile düzleştirilmiş)
  const langCondition = LANG_FILTER?.length
    ? `AND st.lang_code IN (${LANG_FILTER.map(() => '?').join(',')})`
    : '';
  const langParams = LANG_FILTER?.length ? LANG_FILTER : [];

  const sql = `
    SELECT
      st.id          AS translation_id,
      st.story_id    AS story_id,
      st.lang_code   AS lang,
      st.title       AS title,
      st.description AS description,
      st.content     AS content,
      st.hook        AS hook,
      s.book_no      AS book_no,
      b.id           AS book_id,
      b.author       AS author,
      b.publish_year AS publish_year,
      bt.title       AS source_book,
      sc.name_tr     AS sub_category_name,
      sc.name_en     AS sub_category_name_en,
      mc.id          AS parent_cat_id,
      mc.name_tr     AS parent_cat,
      sc.id          AS category_id
    FROM story_translations st
    JOIN stories s ON st.story_id = s.id
    LEFT JOIN books b ON s.book_no = b.list_no
    LEFT JOIN book_translations bt ON b.id = bt.book_id AND bt.lang_code = st.lang_code
    LEFT JOIN sub_categories sc ON b.sub_category_id = sc.id
    LEFT JOIN main_categories mc ON sc.main_category_id = mc.id
    WHERE st.title IS NOT NULL AND st.title != ''
      AND st.content IS NOT NULL AND st.content != ''
    ${langCondition}
    ORDER BY st.story_id ASC, st.lang_code ASC
  `;

  console.log('📖 SQLite\'dan veriler okunuyor...');
  const rows = await queryAll(sql, langParams);
  console.log(`✅ ${rows.length} satır SQLite'dan okundu.`);

  // 2. Zaten Supabase'de olan story_id'leri çek
  console.log('Supabase mevcut kayitlar kontrol ediliyor...');
  const existingPairs = await getExistingPairs();
  console.log(`Supabase'de ${existingPairs.size} (story_id, lang) cifti mevcut.`);

  // 3. Yeni satırları filtrele (story_id bazında değil, translation_id bazında — tam esneklik için)
  const newRows = rows.filter(r => !existingPairs.has(`${r.story_id}:${r.lang}`));
  const skippedCount = rows.length - newRows.length;
  console.log(`⏭️  ${skippedCount} satır zaten mevcut, atlandı.`);
  console.log(`📝 ${newRows.length} yeni satır aktarılacak.`);
  console.log('');

  if (newRows.length === 0) {
    console.log('✅ Aktarılacak yeni kayıt yok. İşlem tamamlandı.');
    db.close();
    return;
  }

  // 4. Supabase formatına dönüştür
  const mapped = newRows.map(r => {
    const yearRaw = r.publish_year;
    const yearMatch = yearRaw ? String(yearRaw).match(/\d{4}/) : null;
    const publish_year = yearMatch ? parseInt(yearMatch[0]) : null;

    return {
      story_id:     r.story_id,
      lang:         r.lang,
      title:        r.title || '',
      description:  r.description || '',
      content:      r.content || '',
      hook:         r.hook || null,
      book_id:      r.book_id || null,
      author:       r.author || null,
      publish_year: publish_year,
      source_book:  r.source_book || null,
      category_id:  r.category_id || null,
      category_name: r.sub_category_name || null,
      parent_cat_id: r.parent_cat_id || null,
      parent_cat:   r.parent_cat || null,
      is_active:    true,
      is_premium:   false,
    };
  });

  // 5. Batch halinde Supabase'e ekle
  const batches = chunkArray(mapped, BATCH_SIZE);
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const progress = `[${i + 1}/${batches.length}]`;

    if (DRY_RUN) {
      console.log(`${progress} DRY RUN: ${batch.length} satır yazılırdı.`);
      totalInserted += batch.length;
      continue;
    }

    const { data, error } = await supabase.from('stories').insert(batch);
    if (error) {
      console.error(`${progress} ❌ Hata: ${error.message}`);
      totalErrors += batch.length;
    } else {
      totalInserted += batch.length;
      process.stdout.write(`${progress} ✅ ${totalInserted}/${mapped.length} satır eklendi\r`);
    }

    // Rate limit'e takılmamak için kısa bekleme
    if (!DRY_RUN) await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n');
  console.log('─────────────────────────────────────');
  console.log(`✅ Başarıyla eklenen: ${totalInserted}`);
  if (totalErrors > 0) console.log(`❌ Hata olan:         ${totalErrors}`);
  console.log('─────────────────────────────────────');
  console.log('🎉 Migrasyon tamamlandı!');
  db.close();
}

migrate().catch(err => {
  console.error('❌ Beklenmeyen hata:', err.message);
  db.close();
  process.exit(1);
});
