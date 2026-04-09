import re
with open('pages/pruebas/SKIP.vue', 'r', encoding='utf-8') as f:
    text = f.read()
tables = set(re.findall(r"\.from\(['\"](.*?)['\"]\)", text))
with open('tables_found.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(tables))
