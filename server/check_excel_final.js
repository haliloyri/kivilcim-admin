const xlsx = require('xlsx');
const workbook = xlsx.readFile('../kitap_listesi.xlsx');

['Kitap Listesi', 'Hikayeler'].forEach(name => {
  const sheet = workbook.Sheets[name];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\nSheet: ${name}`);
  console.log('Row 0 (Headers):', data[0]);
  console.log('Row 1 (Data Example):', data[1]);
});
