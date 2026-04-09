import re
with open('pages/pruebas/SKIP.vue', 'r', encoding='utf-8') as f:
    text = f.read()
tables = re.findall(r"\.from\(['\"](.*?)['\"]\)", text)
print("Tables found:", set(tables))
