#!/usr/bin/env node
/* Генерирует locales/{ru,en,fr}.js из locales/{ru,en,fr}.json (ES-обёртки для синхронного импорта).
   Запуск: node tools/sync-locales.mjs   (CI гоняет check-locales.mjs, который вызывает эту синхронизацию в check-режиме) */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../locales');
for (const lang of ['ru', 'en', 'fr']) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, lang + '.json'), 'utf8'));
  const js = '/* СГЕНЕРИРОВАНО tools/sync-locales.mjs из locales/' + lang + '.json — не править руками. */\nexport default ' + JSON.stringify(json, null, 1) + ';\n';
  fs.writeFileSync(path.join(dir, lang + '.js'), js);
  console.log('locales/' + lang + '.js:', Object.keys(json).length, 'keys');
}
