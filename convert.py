# convert.py
# Abra o prompt de comando na pasta do arquivo e execute: python convert.py

input_file = 'backup_usuarios.json'
output_file = 'backup_usuarios-utf8.json'

with open(input_file, 'r', encoding='cp1252') as infile:
    content = infile.read()

with open(output_file, 'w', encoding='utf-8') as outfile:
    outfile.write(content)

print(f"Arquivo convertido e salvo como {output_file}")
