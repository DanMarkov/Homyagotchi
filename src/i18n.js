/* ===== i18n: статические словари RU/EN/FR, никакого машинного перевода в рантайме =====
   Словари-источники: /locales/{ru,en,fr}.json (парность ключей проверяет tools/check-locales.mjs в CI).
   /locales/{ru,en,fr}.js — сгенерированные ES-обёртки (tools/sync-locales.mjs), чтобы словарь
   грузился синхронно и переключение языка работало мгновенно и офлайн. */
import RU from '../locales/ru.js?v=42';
import EN from '../locales/en.js?v=42';
import FR from '../locales/fr.js?v=42';

export const LANGS = ['ru', 'en', 'fr'];
export const LANG_NAMES = { ru: 'Русский', en: 'English', fr: 'Français' };
const DICTS = { ru: RU, en: EN, fr: FR };
const LS_KEY = 'khomyagochi_lang';

function detectLang() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch { /* нет localStorage */ }
  // В Node (тесты) navigator.language = 'en-US' — умолчание строго 'ru'; автоопределение только в настоящем браузере (window.document)
  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  const nav = (isBrowser && typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'ru').slice(0, 2).toLowerCase();
  return DICTS[nav] ? nav : 'ru';
}

let lang = detectLang();
let dict = DICTS[lang] || RU;
const listeners = [];

/* t("ключ", { name: значение }) — подстановки вида {name}; неизвестный ключ возвращаем как есть (видно в UI при правке) */
export function t(key, params) {
  let s = dict[key];
  if (s === undefined) s = RU[key];
  if (s === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(String(v));
  }
  return s;
}

export function getLang() { return lang; }

export function setLang(l) {
  if (!DICTS[l] || l === lang) { if (DICTS[l]) applyStatic(); return; }
  lang = l;
  dict = DICTS[l];
  try { localStorage.setItem(LS_KEY, l); } catch { /* приватный режим */ }
  applyStatic();
  listeners.forEach((f) => { try { f(l); } catch (e) { console.error('lang listener', e); } });
}

export function onLangChange(fn) { listeners.push(fn); }

/* Применить словарь к статическому DOM: data-i18n (textContent), data-i18n-ph (placeholder), data-i18n-title (title) */
export function applyStatic(root) {
  if (typeof document === 'undefined') return; // Node (тесты)
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  r.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  r.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
  if (r === document && document.title) document.title = t('h.title');
}

/* Глубокий перевод структуры контента (window.__CONTENT__ и т.п.) по ключам вида prefix + путь.
   Путь: имена свойств; в массивах — item.id, если есть, иначе индекс. Для ru возвращаем объект как есть
   (Russian — эталон, не трогаем ни на символ). */
export function tr(obj, prefix) {
  if (lang === 'ru') return obj;
  const walk = (v, path) => {
    if (typeof v === 'string') {
      const val = dict[path];
      return val !== undefined ? val : v;
    }
    if (Array.isArray(v)) {
      return v.map((item, i) => {
        const seg = item && typeof item === 'object' && item.id ? String(item.id) : String(i);
        return walk(item, path + '.' + seg);
      });
    }
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, val] of Object.entries(v)) o[k] = walk(val, path + '.' + k);
      return o;
    }
    return v;
  };
  return walk(obj, prefix);
}

export function initI18n() {
  applyStatic(document);
  return lang;
}
