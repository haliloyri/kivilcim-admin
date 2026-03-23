const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.each("SELECT name, sql FROM sqlite_master WHERE type='table';", (err, row) => {
    console.log(row.name + ': \n' + row.sql + '\n');
});
