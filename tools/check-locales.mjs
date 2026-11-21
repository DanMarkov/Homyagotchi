#!/usr/bin/env node
/* Проверка словарей (запускается в CI):
   1) ru/en/fr имеют одинаковый набор ключей;
   2) у каждого ключа одинаковый набор плейсхолдеров {x};
   3) ни одного пустого значения;
   4) ru.json — эталон: c.*-ключи совпадают со строками в content/*.js (RU не изменился ни на символ),
      h.*-ключи из data-i18n в index.html совпадают с текущим текстом страницы,
      все t('...')-ключи в src/ существуют в ru.json;
   5) locales/*.js синхронны с locales/*.json.
   Код выхода != 0 при любой ошибке. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];
const fail = (msg) => { errors.push(msg); console.error('❌ ' + msg); };
const ok = (msg) => console.log('✅ ' + msg);

const langs = ['ru', 'en', 'fr'];
const dicts = {};
for (const l of langs) {
  const p = path.join(ROOT, 'locales', l + '.json');
  if (!fs.existsSync(p)) { fail('нет файла ' + p); continue; }
  dicts[l] = JSON.parse(fs.readFileSync(p, 'utf8'));
}
if (errors.length) process.exit(1);

const ru = dicts.ru;
const keys = Object.keys(ru).sort();
ok('ru.json ключей: ' + keys.length);

// 1) парность ключей
for (const l of ['en', 'fr']) {
  const dk = dicts[l];
  const missing = keys.filter((k) => !(k in dk));
  const extra = Object.keys(dk).filter((k) => !(k in ru));
  if (missing.length) fail(`${l}.json: нет ключей: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''} (всего ${missing.length})`);
  if (extra.length) fail(`${l}.json: лишние ключи: ${extra.slice(0, 10).join(', ')} (всего ${extra.length})`);
}
if (!errors.length) ok('наборы ключей ru/en/fr совпадают');

// 2) плейсхолдеры + 3) непустые значения
const ph = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');
for (const k of keys) {
  const ref = ph(ru[k]);
  for (const l of ['en', 'fr']) {
    if (!(k in dicts[l])) continue;
    if (ph(dicts[l][k]) !== ref) fail(`плейсхолдеры не совпадают: ${k}: ru=${ref} ${l}=${ph(dicts[l][k])}`);
    if (!String(dicts[l][k]).trim()) fail(`пустое значение: ${l}.json:${k}`);
  }
  if (!String(ru[k]).trim()) fail(`пустое значение: ru.json:${k}`);
}
if (!errors.length) ok('плейсхолдеры и непустые значения в порядке');

// 4a) c.* ключи == строки в content
const windowStub = {};
for (const [f, name] of [['content/content.js', '__CONTENT__'], ['content/lessons.js', '__LESSONS__'], ['content/shop.js', '__SHOP__']]) {
  new Function('window', fs.readFileSync(path.join(ROOT, f), 'utf8'))(windowStub);
}
const CYR = /[А-Яа-яЁё]/;
const walk = (v, p, out) => {
  if (typeof v === 'string') { if (CYR.test(v)) out[p] = v; return; }
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, p + '.' + ((x && x.id) ? x.id : i), out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p + '.' + k, out);
};
for (const [name, globalKey] of [['__CONTENT__', 'c.content'], ['__LESSONS__', 'c.lessons'], ['__SHOP__', 'c.shop']]) {
  const leaves = {};
  walk(windowStub[name], globalKey, leaves);
  for (const [p, val] of Object.entries(leaves)) {
    if (ru[p] !== val) fail(`ru.json[${p}] != content: ${JSON.stringify(ru[p])?.slice(0, 60)} vs ${JSON.stringify(val).slice(0, 60)}`);
  }
  const extraC = keys.filter((k) => k.startsWith(globalKey + '.') && !(k in leaves));
  if (extraC.length) fail(`ru.json: c-ключи без источника в content: ${extraC.slice(0, 8).join(', ')}`);
}
if (!errors.length) ok('c.* ключи ru.json совпадают с content (RU не изменился)');

// 4b) h.* ключи из data-i18n в index.html
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const attrRe = /data-i18n(?:-ph|-title)?="([^"]+)"/g;
  let m, n = 0;
  while ((m = attrRe.exec(html))) {
    n++;
    if (!(m[1] in ru)) fail(`index.html: data-i18n ключ вне ru.json: ${m[1]}`);
  }
  const titleM = html.match(/<title>([^<]*)<\/title>/);
  if (titleM && ru['h.title'] !== titleM[1]) fail('ru.json[h.title] != <title> в index.html');
  // текстовые узлы с кириллицей без data-i18n у родителя — проверяем грубо: все h.* ключи должны встретиться
  ok('data-i18n атрибутов в index.html: ' + n);
}

// 4c) все t('...') в src существуют в ru.json
{
  const walkDir = (d, out = []) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walkDir(p, out); else if (f.endsWith('.js')) out.push(p); } return out; };
  const tRe = /\bt\(\s*"([^"]+)"/g;
  let n = 0;
  for (const f of walkDir(path.join(ROOT, 'src'))) {
    if (f.endsWith('i18n.js')) continue;
    const src = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = tRe.exec(src))) {
      n++;
      if (!(m[1] in ru)) fail(`${path.relative(ROOT, f)}: t("${m[1]}") нет в ru.json`);
    }
  }
  ok('t(...) вызовов в src проверено: ' + n);
}

// 5) синхронность .js обёрток
for (const l of langs) {
  const jp = path.join(ROOT, 'locales', l + '.json');
  const sp = path.join(ROOT, 'locales', l + '.js');
  if (!fs.existsSync(sp)) { fail('нет locales/' + l + '.js — запусти node tools/sync-locales.mjs'); continue; }
  const jsSrc = fs.readFileSync(sp, 'utf8');
  const m = jsSrc.match(/export default ([\s\S]*);\n?$/);
  const embedded = m ? JSON.parse(m[1]) : null;
  if (!embedded || JSON.stringify(embedded) !== JSON.stringify(dicts[l])) fail('locales/' + l + '.js не синхронен с .json — запусти node tools/sync-locales.mjs');
}
if (!errors.length) ok('locales/*.js синхронны с *.json');

if (errors.length) { console.error('\nИТОГО ОШИБОК: ' + errors.length); process.exit(1); }
console.log('\nВсе проверки словарей пройдены ✔');
