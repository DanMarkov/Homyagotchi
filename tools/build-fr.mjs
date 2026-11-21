#!/usr/bin/env node
/* Генерирует content/fr/*.js из content/fr/*.json (window.__FR_WORDS__ / window.__FR_UNITS__),
   чтобы контент грузился <script src> как остальной контент игры (никаких fetch).
   Запуск: node tools/build-fr.mjs   (после правки content/fr/*.json — и закоммитить оба файла) */
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pairs = [
  ['content/fr/words.json', 'content/fr/words.js', '__FR_WORDS__'],
  ['content/fr/units.json', 'content/fr/units.js', '__FR_UNITS__']
];
for (const [src, dst, key] of pairs) {
  const data = JSON.parse(fs.readFileSync(path.join(root, src), 'utf8'));
  fs.writeFileSync(path.join(root, dst), 'window.' + key + ' = ' + JSON.stringify(data, null, 2) + ';\n');
  console.log(src, '->', dst);
}
