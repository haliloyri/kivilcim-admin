const xlsx = require('xlsx');
const fs = require('fs');

try {
  const workbook1 = xlsx.readFile('c:\\Users\\Asaf Oyri\\Documents\\Halil\\AntiGravity\\kivilcim-admin\\kitap_listesi.xlsx');
  const data1 = xlsx.utils.sheet_to_json(workbook1.Sheets[workbook1.SheetNames[0]], { header: 1 });
  console.log('kitap_listesi.xlsx headers:', data1[0]);
} catch (e) {
  console.error(e.message);
}

try {
  const workbook2 = xlsx.readFile('c:\\Users\\Asaf Oyri\\Documents\\Halil\\AntiGravity\\kivilcim-admin\\yeni_kitap_listesi_101.xlsx');
  const data2 = xlsx.utils.sheet_to_json(workbook2.Sheets[workbook2.SheetNames[0]], { header: 1 });
  console.log('yeni_kitap_listesi_101.xlsx headers:', data2[0]);
} catch (e) {
  console.error(e.message);
}
