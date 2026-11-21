#!/usr/bin/env node
/* i18n-gen: извлекает все RU-строки из index.html / src / content, строит locales/ru.json,
   патчит index.html (data-i18n*) и src/*.js (t('key')), переносит TOPICS в content.json.
   Запуск: node tools/i18n-gen.mjs   (идемпотентно по ru.json: ключи стабильны по slug+счётчику) */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CYR = /[А-Яа-яЁё]/;
const V = '?v=42';

const TRANSLIT = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
function slug(text, maxWords = 4) {
  const words = text.toLowerCase().replace(/[ё]/g, 'е').split(/[^а-яa-z0-9]+/i).filter(Boolean);
  let s = words.slice(0, maxWords).map(w => w.split('').map(c => TRANSLIT[c] || c).join('')).join('-');
  s = s.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (s || 'str').slice(0, 48);
}
const usedKeys = new Set();
function uniqKey(base) {
  let k = base, i = 2;
  while (usedKeys.has(k)) k = base + '-' + i++;
  usedKeys.add(k);
  return k;
}

const dict = {};      // key -> ru text
const plan = [];      // {key, file, line, kind, text}
function addDict(key, text, meta) {
  if (dict[key] !== undefined && dict[key] !== text) throw new Error('key collision: ' + key);
  dict[key] = text;
  plan.push({ key, text, ...meta });
}

/* ---------- comment mask for JS ---------- */
function commentMask(src) {
  const mask = new Array(src.length).fill(false);
  let i = 0, state = null; // null | 'line' | 'block' | 'str' with quote
  let quote = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (state === 'line') { mask[i] = true; if (c === '\n') state = null; i++; continue; }
    if (state === 'block') { mask[i] = true; if (c === '*' && n === '/') { mask[i + 1] = true; i += 2; state = null; continue; } i++; continue; }
    if (state === 'str') {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) state = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { state = 'line'; mask[i] = mask[i + 1] = true; i += 2; continue; }
    if (c === '/' && n === '*') { state = 'block'; mask[i] = mask[i + 1] = true; i += 2; continue; }
    if (c === "'" || c === '"' || c === '`') { state = 'str'; quote = c; i++; continue; }
    i++;
  }
  return mask;
}

/* ---------- JS literal extraction with spans ---------- */
function extractJsLiterals(file) {
  const src = fs.readFileSync(file, 'utf8');
  const mask = commentMask(src);
  const out = [];
  const re = /('((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/gs;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index, end = m.index + m[0].length;
    if (mask[start]) continue;
    const quote = m[0][0];
    const raw = m[2] ?? m[3] ?? m[4] ?? '';
    // decode value
    let val = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
                 .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\(.)/g, '$1');
    if (!CYR.test(val)) continue;
    // object-key heuristic: {... 'key': ...}
    let j = start - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    let k = end;
    while (k < src.length && /\s/.test(src[k])) k++;
    if ((src[j] === '{' || src[j] === ',') && src[k] === ':') continue;
    const line = src.slice(0, start).split('\n').length;
    out.push({ start, end, quote, raw, val, line, hasInterp: raw.includes('${'), hasHtml: raw.includes('<') });
  }
  return { src, items: out };
}

/* ---------- patch JS file: literals -> t('key') ---------- */
function patchJsFile(rel, src, items) {
  const base = path.basename(rel, '.js');
  // сортируем по убыванию start, чтобы спаны не съезжали
  const sorted = [...items].sort((a, b) => b.start - a.start);
  let out = src;
  for (const it of sorted) {
    const key = uniqKey('j.' + base + '.' + slug(it.val));
    let replacement;
    if (it.hasHtml) {
      // шаблон с HTML: патчим внутренние текстовые узлы и атрибуты на ${t(...)} / data-i18n-*
      let inner = it.raw;
      inner = inner.replace(/>([^<>{}]*[А-Яа-яЁё][^<>{}]*?)</g, (whole, text) => {
        const k = uniqKey('h.' + slug(text.replace(/\s+/g, ' ').trim()));
        addDict(k, text.replace(/\s+/g, ' ').trim(), { file: rel, line: it.line, kind: 'js-html-text' });
        return '>${t(' + JSON.stringify(k) + ')}<';
      });
      inner = inner.replace(/(placeholder|title)="([^"]*[А-Яа-яЁё][^"]*)"/g, (whole, attr, text) => {
        const k = uniqKey('h.' + slug(text));
        addDict(k, text, { file: rel, line: it.line, kind: 'js-html-' + attr });
        return attr + '="" data-i18n-' + (attr === 'placeholder' ? 'ph' : 'title') + '=' + JSON.stringify(k);
      });
      replacement = '`' + inner + '`';
    } else if (it.hasInterp) {
      // шаблон с ${...}: параметры p1..pn
      const params = [];
      let val = it.raw;
      val = val.replace(/\$\{([^{}]+)\}/g, (_, expr) => {
        params.push(expr.trim());
        return '{p' + params.length + '}';
      });
      const k = uniqKey('j.' + base + '.' + slug(val));
      addDict(k, val, { file: rel, line: it.line, kind: 'js-tpl', params });
      const args = params.map((p, i) => 'p' + (i + 1) + ': (' + p + ')').join(', ');
      replacement = 't(' + JSON.stringify(k) + ', { ' + args + ' })';
    } else {
      const k = uniqKey('j.' + base + '.' + slug(it.val));
      addDict(k, it.val, { file: rel, line: it.line, kind: 'js' });
      replacement = 't(' + JSON.stringify(k) + ')';
    }
    out = out.slice(0, it.start) + replacement + out.slice(it.end);
  }
  return out;
}

/* ---------- content deep-walk ---------- */
function walkContent(obj, prefix, globalName) {
  if (typeof obj === 'string') {
    if (CYR.test(obj)) {
      const k = uniqKey(prefix);
      addDict(k, obj, { file: 'content', kind: 'content', path: prefix });
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const seg = (v && typeof v === 'object' && v.id) ? String(v.id) : String(i);
      walkContent(v, prefix + '.' + seg, globalName);
    });
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) walkContent(v, prefix + '.' + k, globalName);
  }
}


/* позция вставки атрибута: сразу после имени тега */
function tagInsertPos(src, tagStart) {
  const m = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(src.slice(tagStart));
  return tagStart + 1 + (m ? m[1].length : 0);
}
/* старт открывающего тега — родителя текстового узла в позиции pos */
function findParentTagStart(src, pos) {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const tags = [];
  let m;
  while ((m = tagRe.exec(src)) && m.index < pos) tags.push({ i: m.index, close: m[1] === '/', name: m[2].toLowerCase() });
  const VOID = new Set(['br','img','input','meta','link','hr','source','wbr']);
  let depth = 0;
  for (let i = tags.length - 1; i >= 0; i--) {
    const tg = tags[i];
    if (tg.close) { depth++; continue; }
    if (VOID.has(tg.name)) continue;
    if (depth > 0) { depth--; continue; }
    return tg.i;
  }
  return null;
}

/* ---------- HTML patch ---------- */
function patchHtml(rel) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  // регионы, которые не трогаем: <style>...</style>, <script>...</script>, <!-- ... -->
  const skip = [];
  for (const re of [/<style>[\s\S]*?<\/style>/g, /<script[\s\S]*?<\/script>/g, /<!--[\s\S]*?-->/g, /<title>[\s\S]*?<\/title>/g]) {
    let m; while ((m = re.exec(src))) skip.push([m.index, m.index + m[0].length]);
  }
  const inSkip = (i) => skip.some(([a, b]) => i >= a && i < b);

  // 1) атрибуты placeholder/title
  let out = src;
  const attrRe = /(placeholder|title)="([^"]*[А-Яа-яЁё][^"]*)"/g;
  let m, edits = [];
  while ((m = attrRe.exec(src))) {
    if (inSkip(m.index)) continue;
    const attr = m[1], text = m[2];
    const k = uniqKey('h.' + slug(text));
    addDict(k, text, { file: rel, line: src.slice(0, m.index).split('\n').length, kind: 'html-' + attr });
    // вставляем data-i18n-атрибут в открывающий тег: ищем '<' назад
    let t = src.lastIndexOf('<', m.index);
    const ins = tagInsertPos(src, t);
    edits.push({ at: ins, attr: 'data-i18n-' + (attr === 'placeholder' ? 'ph' : 'title') + '=' + JSON.stringify(k), drop: m[0], insertAt: m.index, dropLen: m[0].length, repl: attr + '=""' });
  }
  // 2) текстовые узлы >TEXT<
  const textRe = />(\s*[^<>{}]*[А-Яа-яЁё][^<>{}]*?)\s*</g;
  while ((m = textRe.exec(src))) {
    if (inSkip(m.index)) continue;
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const t = findParentTagStart(src, m.index);
    if (t == null || inSkip(t)) continue;
    const k = uniqKey('h.' + slug(text));
    addDict(k, text, { file: rel, line: src.slice(0, m.index).split('\n').length, kind: 'html-text' });
    edits.push({ at: tagInsertPos(src, t), attr: 'data-i18n=' + JSON.stringify(k) });
  }
  // <title>
  const tm = src.match(/<title>([^<]*)<\/title>/);
  if (tm && CYR.test(tm[1])) {
    addDict(uniqKey('h.title'), tm[1], { file: rel, line: 1, kind: 'html-title' });
  }
  // применяем правки с конца
  edits.sort((a, b) => (b.insertAt ?? b.at) - (a.insertAt ?? a.at));
  for (const e of edits) {
    if (e.drop !== undefined) {
      out = out.slice(0, e.insertAt) + e.repl + out.slice(e.insertAt + e.dropLen);
      out = out.slice(0, e.at) + ' ' + e.attr + out.slice(e.at);
    } else {
      out = out.slice(0, e.at) + ' ' + e.attr + out.slice(e.at);
    }
  }
  return out;
}

/* ---------- MAIN ---------- */
const localesDir = path.join(ROOT, 'locales');
fs.mkdirSync(localesDir, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });

// 1) content globals
const windowStub = {};
globalThis.window = windowStub;
for (const [f, name] of [['content/content.js', '__CONTENT__'], ['content/lessons.js', '__LESSONS__'], ['content/shop.js', '__SHOP__']]) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  new Function('window', code)(windowStub);
  walkContent(windowStub[name], 'c.' + name.replace(/__/g, '').toLowerCase(), name);
}

// 2) TOPICS из support.js переносим в content.json
const supportPath = path.join(ROOT, 'src/ui/support.js');
let supportSrc = fs.readFileSync(supportPath, 'utf8');
const tStart = supportSrc.indexOf('const TOPICS = [');
if (tStart >= 0) {
  const arrStart = supportSrc.indexOf('[', tStart);
  let depth = 0, i = arrStart;
  for (; i < supportSrc.length; i++) {
    if (supportSrc[i] === '[') depth++;
    else if (supportSrc[i] === ']') { depth--; if (depth === 0) break; }
  }
  const topicsArrSrc = supportSrc.slice(arrStart, i + 1);
  const topics = new Function('return ' + topicsArrSrc)();
  const contentJsonPath = path.join(ROOT, 'content/content.json');
  const contentJson = JSON.parse(fs.readFileSync(contentJsonPath, 'utf8'));
  contentJson.topics = topics;
  fs.writeFileSync(contentJsonPath, JSON.stringify(contentJson, null, 2) + '\n');
  // регенерируем content.js
  const { execSync } = await import('node:child_process');
  execSync('node tools/build-content.js', { cwd: ROOT, stdio: 'inherit' });
  // walk новых topics (после перегенерации window.__CONTENT__ освежим)
  new Function('window', fs.readFileSync(path.join(ROOT, 'content/content.js'), 'utf8'))(windowStub);
  walkContent(windowStub['__CONTENT__'].topics, 'c.content.topics', '__CONTENT__');
  // вырезаем TOPICS из support.js
  const endSemi = supportSrc.indexOf(';', i);
  supportSrc = supportSrc.slice(0, tStart) + 'const TOPICS_RAW = (window.__CONTENT__ && window.__CONTENT__.topics) || [];\nfunction topics() { return tr(TOPICS_RAW, \'c.content.topics\'); }' + supportSrc.slice(endSemi + 1);
  fs.writeFileSync(supportPath, supportSrc);
  console.log('TOPICS moved to content.json, support.js patched');
}

// 3) JS-файлы src (кроме i18n.js)
const jsFiles = [];
(function walkDir(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walkDir(p);
    else if (f.endsWith('.js') && f !== 'i18n.js') jsFiles.push(p);
  }
})(path.join(ROOT, 'src'));

for (const f of jsFiles) {
  const rel = path.relative(ROOT, f);
  const { src, items } = extractJsLiterals(f);
  if (!items.length) continue;
  let patched = patchJsFile(rel, src, items);
  // добавляем импорт t (и tr если нужен) в начало файла
  const needsTr = patched.includes('tr(');
  const imp = "import { t" + (needsTr ? ', tr' : '') + " } from '../i18n.js" + V + "';\n";
  if (!patched.startsWith('import')) patched = imp + patched;
  else patched = imp + patched;
  fs.writeFileSync(f, patched);
  console.log('patched', rel, items.length, 'literals');
}

// 4) index.html
const htmlPatched = patchHtml('index.html');
fs.writeFileSync(path.join(ROOT, 'index.html'), htmlPatched);
console.log('patched index.html');

// 5) ru.json (отсортированные ключи)
const sorted = {};
for (const k of Object.keys(dict).sort()) sorted[k] = dict[k];
fs.writeFileSync(path.join(localesDir, 'ru.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log('ru.json keys:', Object.keys(dict).length);

// 6) план + инвентарь
fs.writeFileSync(path.join(ROOT, 'tools/i18n-plan.json'), JSON.stringify(plan, null, 1));
let md = '# Инвентаризация строк i18n (ШАГ-0)\n\nВсего ключей: **' + Object.keys(dict).length + '**\n\n| ключ | файл:строка | тип | текст |\n|---|---|---|---|\n';
for (const p of plan.sort((a, b) => a.key.localeCompare(b.key))) {
  md += `| ${p.key} | ${p.file}:${p.line ?? ''} | ${p.kind} | ${String(p.text).replace(/\|/g, '\\|').replace(/\n/g, '\\n').slice(0, 200)} |\n`;
}
fs.writeFileSync(path.join(ROOT, 'docs/i18n-inventory.md'), md);
console.log('plan + docs/i18n-inventory.md written');
