import sqlite3

db = sqlite3.connect('kivilcim.db')
cur = db.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
with open('tables_out.txt', 'w', encoding='utf-8') as f:
    for row in cur.fetchall():
        f.write(row[0] + '\n')
db.close()
