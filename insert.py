import sqlite3

data = [
    ("💰 Finance", ["Finans", "İş & Girişim", "Pazarlama", "Satış", "Kariyer"]),
    ("🧠 Psychology", ["Psikoloji", "Nörobilim", "Farkındalık", "Duygular", "Mutluluk"]),
    ("🏴 Leadership", ["Liderlik", "Strateji", "Yönetim", "Başarı", "Hedefler"]),
    ("💪 Health", ["Sağlık", "Alışkanlıklar"]),
    ("📈 Growth", ["Kişisel Gelişim", "Motivasyon", "Değişim", "Dayanıklılık", "İlham"]),
    ("🔬 Science", ["Bilim", "Teknoloji", "Ürün", "Gelecek"]),
    ("🍃 Philosophy", ["Felsefe", "Düşünme", "Öğrenme", "Yaşam", "Sosyoloji", "Toplum"]),
    ("💬 Communication", ["İletişim", "İlişkiler", "Müzakere"]),
    ("🚀 Productivity", ["Verimlilik", "Girişimcilik", "İş Dünyası", "Tasarım", "Yaratıcılık"]),
    ("⏳ History", ["Tarih", "Güncel", "Güvenlik"])
]

db = sqlite3.connect('kivilcim.db')
cur = db.cursor()

# create categories_translations table since user requested it
cur.execute('''
CREATE TABLE IF NOT EXISTS categories_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    language TEXT,
    translation TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id)
)
''')

cur.execute("DELETE FROM subcategories")
cur.execute("DELETE FROM categories_translations")
cur.execute("DELETE FROM categories")

order = 1
for cat, subcats in data:
    cur.execute("INSERT INTO categories (category_name, [order]) VALUES (?, ?)", (cat, order))
    cat_id = cur.lastrowid
    
    # insert a default translation for english, and turkish? The emojis and names are mixed.
    # usually "Finance" -> translation "Finans"? But the user has subcategories in Turkish.
    # Let's just insert English string into translation and maybe Turkish string if we can figure it out.
    # Let's just insert 'tr' as language and the name for now.
    cur.execute("INSERT INTO categories_translations (category_id, language, translation) VALUES (?, ?, ?)", (cat_id, 'en', cat))
    
    for sub in subcats:
        cur.execute("INSERT INTO subcategories (categori_id, subcategory_name) VALUES (?, ?)", (cat_id, sub.strip()))
    
    order += 1

db.commit()
print("Data inserted successfully into categories, categories_translations, and subcategories.")
db.close()
