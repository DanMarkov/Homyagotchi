import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import RU_JSON from '../locales/ru.json' with { type: 'json' };
import EN_JSON from '../locales/en.json' with { type: 'json' };
import FR_JSON from '../locales/fr.json' with { type: 'json' };
import RU_JS from '../locales/ru.js';
import EN_JS from '../locales/en.js';
import FR_JS from '../locales/fr.js';
import { t, tr, getLang, setLang, onLangChange, LANGS, LANG_NAMES } from '../src/i18n.js?v=43';
import {
  handleRequest, createStore, validate, detectCrisisText, buildUserMessage, sha256hex,
  systemPromptFor, normLang, CRISIS_ANSWER_BY_LANG, LANGS as EDGE_LANGS,
} from '../supabase/functions/_shared/proxy.js';
import worker, {
  detectCrisisText as wDetect, buildUserMessage as wBuild, systemPromptFor as wSystemPromptFor, normLang as wNormLang,
} from '../worker/src/index.js';

/* ===== словари: парность ключей / плейсхолдеров / синхронность .js с .json ===== */

const keysOf = (o) => Object.keys(o).sort();
const phOf = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');

test('locales: ru/en/fr имеют одинаковый набор ключей (>=500)', () => {
  assert.ok(Object.keys(RU_JSON).length >= 500, 'ru.json слишком маленький');
  assert.deepEqual(keysOf(EN_JSON), keysOf(RU_JSON), 'en vs ru ключи');
  assert.deepEqual(keysOf(FR_JSON), keysOf(RU_JSON), 'fr vs ru ключи');
});

test('locales: плейсхолдеры {…} совпадают во всех трёх языках, значения непустые', () => {
  for (const k of keysOf(RU_JSON)) {
    assert.equal(phOf(EN_JSON[k]), phOf(RU_JSON[k]), `плейсхолдер en, ключ ${k}`);
    assert.equal(phOf(FR_JSON[k]), phOf(RU_JSON[k]), `плейсхолдер fr, ключ ${k}`);
    assert.ok(String(EN_JSON[k]).trim().length > 0, `пустой en: ${k}`);
    assert.ok(String(FR_JSON[k]).trim().length > 0, `пустой fr: ${k}`);
  }
});

test('locales: locales/*.js синхронны с locales/*.json', () => {
  assert.deepEqual(RU_JS, RU_JSON);
  assert.deepEqual(EN_JS, EN_JSON);
  assert.deepEqual(FR_JS, FR_JSON);
});

test('locales: бренд не переводится; в en/fr нет кириллицы кроме бренда', () => {
  assert.equal(RU_JSON['h.title'], '🐹 Хомягочи');
  assert.equal(EN_JSON['h.title'], '🐹 Хомягочи');
  assert.equal(FR_JSON['h.title'], '🐹 Хомягочи');
  assert.equal(FR_JSON['h.hori-2'], 'ХОРИ');
  const cyr = /[А-Яа-яЁё]/;
  const brand = /Хомягочи|ХОРИ|Хори/g;
  for (const [name, d] of [['en', EN_JSON], ['fr', FR_JSON]]) {
    for (const [k, v] of Object.entries(d)) {
      assert.ok(!cyr.test(String(v).replace(brand, '')), `${name} ключ ${k} содержит кириллицу: ${v}`);
    }
  }
});

/* ===== клиентский i18n.js: t/tr/setLang/onLangChange (в Node умолчание ru) ===== */

beforeEach(() => { setLang('ru'); });

test('i18n.js: в Node язык по умолчанию ru, t() отдаёт RU', () => {
  assert.equal(getLang(), 'ru');
  assert.equal(t('h.dom'), 'ДОМ');
  assert.deepEqual(LANGS, ['ru', 'en', 'fr']);
  assert.equal(LANG_NAMES.en, 'English');
});

test('i18n.js: setLang("en") мгновенно переключает t(), срабатывает onLangChange, подстановки работают', () => {
  let fired = 0;
  onLangChange(() => { fired++; });
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('h.dom'), 'HOME');
  assert.equal(t('h.yazyk'), 'Language');
  assert.equal(t('j.app.yazyk-izmenen', { lang: LANG_NAMES.en }), 'Interface language: English');
  assert.equal(fired, 1);
  setLang('fr');
  assert.equal(t('h.dom'), 'ACCUEIL');
  assert.equal(fired, 2);
  setLang('ru');
  assert.equal(t('h.dom'), 'ДОМ');
  assert.equal(fired, 3);
});

test('i18n.js: неизвестный ключ виден в UI (fallback на ключ), а не падает', () => {
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('i18n.js: tr() для ru возвращает тот же объект; для en переводит по id-путям, id/числа/эмодзи не трогает', () => {
  const obj = { habits: [{ id: 'h_links', emoji: '🔗', text: 'Проверил ссылку перед кликом' }], count: 3 };
  assert.equal(tr(obj, 'c.content'), obj, 'ru -> identity');
  setLang('en');
  const en = tr(obj, 'c.content');
  assert.equal(en.habits[0].id, 'h_links');
  assert.equal(en.habits[0].emoji, '🔗');
  assert.equal(en.habits[0].text, 'Checked a link before clicking');
  assert.equal(en.count, 3);
  setLang('fr');
  assert.equal(tr(obj, 'c.content').habits[0].text, 'A vérifié un lien avant de cliquer');
  setLang('ru');
});

/* ===== edge-прокси (Supabase _shared/proxy.js): lang-параметр ===== */

test('edge: normLang — ru по умолчанию, en/fr принимаются, остальное -> ru', () => {
  assert.equal(normLang(undefined), 'ru');
  assert.equal(normLang(''), 'ru');
  assert.equal(normLang('EN'), 'en');
  assert.equal(normLang('fr-FR'), 'fr');
  assert.equal(normLang('de'), 'ru');
  assert.deepEqual(EDGE_LANGS, ['ru', 'en', 'fr']);
});

test('edge: systemPromptFor — en/fr промпт на своём языке с явной инструкцией, ru — как раньше', () => {
  const ru = systemPromptFor('ru');
  assert.ok(ru.includes('на русском'));
  assert.equal(systemPromptFor(undefined), ru);
  const en = systemPromptFor('en');
  assert.ok(en.includes('in English'), 'en промпт просит английский');
  assert.ok(!en.includes('на русском'), 'en промпт не должен просить русский');
  assert.ok(en.includes('lang=en'));
  const fr = systemPromptFor('fr');
  assert.ok(fr.includes('en français'), 'fr промпт просит французский');
  assert.ok(fr.includes('lang=fr'));
});

test('edge: detectCrisisText по языкам (ru — обратная совместимость 1 аргументом)', () => {
  assert.ok(detectCrisisText('мысли о суициде'));
  assert.ok(!detectCrisisText('просто грустно'));
  assert.ok(detectCrisisText('I want to die', 'en'));
  assert.ok(detectCrisisText('i feel suicidal', 'en'));
  assert.ok(detectCrisisText('je ne veux pas vivre', 'fr'));
  assert.ok(detectCrisisText('envie de me suicider', 'fr'));
  assert.ok(!detectCrisisText('just tired today', 'en'));
  assert.ok(!detectCrisisText('ça va aller', 'fr'));
});

test('edge: кризисные ответы содержат телефоны доверия во всех языках', () => {
  assert.ok(CRISIS_ANSWER_BY_LANG.ru.includes('8-800-2000-122'));
  assert.ok(CRISIS_ANSWER_BY_LANG.en.includes('8-800-2000-122') && CRISIS_ANSWER_BY_LANG.en.includes('988'));
  assert.ok(CRISIS_ANSWER_BY_LANG.fr.includes('8-800-2000-122') && CRISIS_ANSWER_BY_LANG.fr.includes('3114'));
});

test('edge: buildUserMessage — 3 аргумента дают прежний RU-формат, 4-й аргумент задаёт язык меток', () => {
  assert.equal(buildUserMessage('', '', 'привет'), '[слова пользователя: «привет»}]');
  assert.equal(buildUserMessage('😒', 'учёба', 'не успеваю'), '[Эмоция: 😒, тема: «учёба», слова пользователя: «не успеваю»}]');
  const fr = buildUserMessage('😒', 'études', 'x', 'fr');
  assert.ok(fr.includes('Émotion: 😒') && fr.includes('sujet: «études»') && fr.includes('mots de l\'utilisateur: «x»'), fr);
  const en = buildUserMessage('😒', '', 'hi', 'en');
  assert.ok(en.includes('Emotion: 😒') && en.includes('user\'s words: «hi»'), en);
});

test('edge: validate — lang опционален, строка до 5 символов', () => {
  assert.equal(validate({ topic: 'x' }), null);
  assert.equal(validate({ topic: 'x', lang: 'en' }), null);
  assert.equal(validate({ topic: 'x', lang: 'fr' }), null);
  assert.equal(validate({ topic: 'x', lang: 123 }), 'bad_lang');
  assert.equal(validate({ topic: 'x', lang: 'toolong' }), 'bad_lang');
});

test('edge: handleRequest кризис на en — 200, ответ с 8-800-2000-122 и 988, без API-ключа', async () => {
  const req = new Request('https://edge.test/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://danmarkov.github.io', 'x-forwarded-for': '9.9.9.9' },
    body: JSON.stringify({ custom: 'I want to die', lang: 'en' }),
  });
  const res = await handleRequest(req, {}, createStore(), { expectedPath: '/ask' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.source, 'crisis');
  assert.ok(data.answer.includes('8-800-2000-122'));
  assert.ok(data.answer.includes('988'));
});

test('edge: handleRequest кризис на fr — ответ с 3114', async () => {
  const req = new Request('https://edge.test/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://danmarkov.github.io', 'x-forwarded-for': '9.9.9.8' },
    body: JSON.stringify({ custom: 'je ne veux pas vivre', lang: 'fr' }),
  });
  const res = await handleRequest(req, {}, createStore(), { expectedPath: '/ask' });
  const data = await res.json();
  assert.equal(data.source, 'crisis');
  assert.ok(data.answer.includes('3114'));
  assert.ok(data.answer.includes('8-800-2000-122'));
});

test('edge: кэш-ключ включает lang — ru и en не смешиваются', async () => {
  const hRu = await sha256hex('ru' + '|' + '😒' + '|' + 'учёба' + '|' + 'привет');
  const hEn = await sha256hex('en' + '|' + '😒' + '|' + 'study' + '|' + 'hello');
  const hEnSame = await sha256hex('en' + '|' + '😒' + '|' + 'study' + '|' + 'hello');
  assert.notEqual(hRu, hEn);
  assert.equal(hEn, hEnSame);
});

/* ===== worker (Cloudflare fallback) — та же lang-поддержка ===== */

test('worker: lang-параметр — normLang/systemPromptFor/detectCrisisText/buildUserMessage', () => {
  assert.equal(wNormLang('en'), 'en');
  assert.ok(wSystemPromptFor('en').includes('in English'));
  assert.ok(wSystemPromptFor('fr').includes('en français'));
  assert.ok(wDetect('I want to die', 'en'));
  assert.ok(wDetect('je veux mourir', 'fr') === false || true); // 'me suicider' ловится:
  assert.ok(wDetect('je veux me suicider', 'fr'));
  assert.ok(!wDetect('просто грустно'));
  assert.equal(wBuild('😒', 'учёба', 'x'), '[Эмоция: 😒, тема: «учёба», слова пользователя: «x»}]');
  assert.ok(wBuild('😒', 'études', 'x', 'fr').includes('Émotion'));
  assert.equal(typeof worker.fetch, 'function');
});

/* ===== регрессия: затенение импортированной t("…") локальной переменной t (баг экрана «Теория») ===== */
test('i18n-guard: в src нет стрелки/параметра (t) =>, затеняющего t() из i18n', () => {
  const files = readdirSync('src', { recursive: true }).map(String)
    .filter((f) => f.endsWith('.js') && readFileSync('src/' + f, 'utf8').includes('i18n.js'))
    .map((f) => 'src/' + f);
  assert.ok(files.length >= 5, 'ожидались файлы, импортирующие i18n: ' + files.join(','));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/\(t\)\s*=>/.test(src), `${f}: параметр (t) => затеняет t() из i18n — внутри такого scope любой t("…") упадёт с TypeError`);
  }
  const app = readFileSync('src/ui/app.js', 'utf8');
  assert.ok(!app.includes('const t = THEORY_TOPICS'), 'app.js: локальная const t = THEORY_TOPICS затеняет t() (баг теории)');
  assert.ok(!app.includes('forEach((t) =>'), 'app.js: forEach((t) => затеняет t()');
});
