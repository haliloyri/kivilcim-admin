const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'yeni_kitap_listesi_101.xlsx');
const outputPath = path.join(__dirname, '..', 'kitaplar.json');

try {
  const workbook = xlsx.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const outputData = [];

  data.forEach((row, index) => {
    // Sometimes row keys might have trailing/leading spaces in excel, but usually it translates cleanly if defined properly.
    const trName = row['Türkçe Adı'] ? row['Türkçe Adı'].toString().trim() : '';
    const enName = row['İngilizce Adı'] ? row['İngilizce Adı'].toString().trim() : '';
    const author = row['Yazar'] ? row['Yazar'].toString().trim() : '';

    if (trName || enName || author) {
      // e.g. "Sefiller (Les Misérables) ve Victor Hugo"
      let formattedName = trName;
      if (enName) {
        formattedName += ` (${enName})`;
      }
      if (author) {
        formattedName += ` ve ${author}`;
      }
      
      outputData.push({ isim: formattedName });
    }
  });

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`Successfully generated ${outputPath} with ${outputData.length} records.`);
  
  // Show a preview of the first 3 items
  console.log('Preview:', outputData.slice(0, 3));

} catch (error) {
  console.error("Error generating JSON:", error.message);
}
