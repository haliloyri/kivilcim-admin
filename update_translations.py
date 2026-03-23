import sqlite3

translations = {
    "💰 Finance": {"tr": "Finans", "de": "Finanzen", "es": "Finanzas"},
    "🧠 Psychology": {"tr": "Psikoloji", "de": "Psychologie", "es": "Psicología"},
    "🏴 Leadership": {"tr": "Liderlik", "de": "Führung", "es": "Liderazgo"},
    "💪 Health": {"tr": "Sağlık", "de": "Gesundheit", "es": "Salud"},
    "📈 Growth": {"tr": "Büyüme", "de": "Wachstum", "es": "Crecimiento"},
    "🔬 Science": {"tr": "Bilim", "de": "Wissenschaft", "es": "Ciencia"},
    "🍃 Philosophy": {"tr": "Felsefe", "de": "Philosophie", "es": "Filosofía"},
    "💬 Communication": {"tr": "İletişim", "de": "Kommunikation", "es": "Comunicación"},
    "🚀 Productivity": {"tr": "Verimlilik", "de": "Produktivität", "es": "Productividad"},
    "⏳ History": {"tr": "Tarih", "de": "Geschichte", "es": "Historia"}
}

db = sqlite3.connect('kivilcim.db')
cur = db.cursor()

cur.execute("SELECT id, category_name FROM categories")
rows = cur.fetchall()

for row in rows:
    cat_id, cat_name = row
    if cat_name in translations:
        # Delete existing english or any old ones if user wants, but I'll just add
        # actually let's just insert tr, de, es
        for lang, trans_text in translations[cat_name].items():
            cur.execute("INSERT INTO categories_translations (category_id, language, translation) VALUES (?, ?, ?)", (cat_id, lang, trans_text))

db.commit()
db.close()
print("Translations added successfully!")
