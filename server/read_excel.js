const xlsx = require('xlsx');

const workbook = xlsx.readFile('../kitap_listesi.xlsx');
console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nHeaders for ${name}:`);
    console.log(data[0]);
});
