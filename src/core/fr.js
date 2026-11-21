/* ===== Модуль «Французский»: SRS (Leitner) + прогресс уроков + валидация контента.
   Чистое ядро без DOM — покрывается tests/fr.test.js.
   Контент: content/fr/words.json + content/fr/units.json (id стабильные, языконезависимые).
   Прогресс хранится в state.fr = { boxes: { wordId: { box: 1..5, nextReview: ms } }, lessons: { lessonId: { done, mistakes, at } } } */
import { addCoins, gainXP, applyFood } from './game.js?v=43';

export const DAY_MS = 24 * 3600 * 1000;
export const BOX_INTERVALS_DAYS = [1, 3, 7, 14, 30]; // box 1..5: правильный ответ → box+1, интервал по box
export const REVIEW_LIMIT = 10; // карточек за сессию повторения
export const LESSON_HEARTS = 3; // 3 ошибки = урок сначала

export function frState(state) {
  if (!state.fr || typeof state.fr !== 'object') state.fr = { boxes: {}, lessons: {} };
  if (!state.fr.boxes) state.fr.boxes = {};
  if (!state.fr.lessons) state.fr.lessons = {};
  return state.fr;
}

export function boxOf(state, wordId) {
  const b = frState(state).boxes[wordId];
  return b && b.box ? b.box : 0;
}

export function nextReviewOf(state, wordId) {
  const b = frState(state).boxes[wordId];
  return b && b.nextReview ? b.nextReview : 0;
}

/* Результат по слову: верно → box+1 (макс 5), интервал 1/3/7/14/30 дней; неверно → box=1, завтра. */
export function recordResult(state, wordId, correct, now = Date.now()) {
  const fr = frState(state);
  const prev = fr.boxes[wordId] || { box: 0, nextReview: 0 };
  const box = correct ? Math.min(5, (prev.box || 0) + 1) : 1;
  const days = correct ? BOX_INTERVALS_DAYS[box - 1] : 1;
  fr.boxes[wordId] = { box, nextReview: now + days * DAY_MS };
  return fr.boxes[wordId];
}

/* Слова с истёкшим nextReview, по давности, не более limit (по умолчанию 10 за сессию). */
export function dueWords(state, wordIds, now = Date.now(), limit = REVIEW_LIMIT) {
  return wordIds
    .map((id) => ({ id, nextReview: nextReviewOf(state, id) }))
    .filter((w) => w.nextReview > 0 && w.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview)
    .slice(0, limit)
    .map((w) => w.id);
}

export function lessonDone(state, lessonId) {
  const l = frState(state).lessons[lessonId];
  return !!(l && l.done);
}

export function markLessonDone(state, lessonId, mistakes, now = Date.now()) {
  frState(state).lessons[lessonId] = { done: true, mistakes, at: now };
}

/* Урок открыт, если открыт предыдущий в том же юните (первый всегда открыт).
   Принимает и массив юнитов, и обёртку { units: [...] } из units.json. */
export function lessonUnlocked(units, unitIdx, lessonIdx, state) {
  const list = Array.isArray(units) ? units : (units.units || []);
  if (lessonIdx <= 0) return true;
  const prev = list[unitIdx] && list[unitIdx].lessons[lessonIdx - 1];
  return prev ? lessonDone(state, prev.id) : true;
}

/* Награда за урок: без ошибок +15 монет и +1 KP, с ошибками +8 монет. Хомяк: +10 сытости, +5 радости, анимация еды. */
export function lessonReward(mistakes) {
  return { coins: mistakes > 0 ? 8 : 15, kp: mistakes > 0 ? 0 : 1 };
}

export function applyLessonReward(state, mistakes) {
  const r = lessonReward(mistakes);
  addCoins(state, r.coins);
  if (r.kp > 0) gainXP(state, r.kp);
  applyFood(state, { satiety: 10, mood: 5 }); // _eating=8 → анимация «хомяк ест» на главном экране
  return r;
}

/* ===== Контент: словарь и валидация (стабильные id, ссылки резолвятся, không кириллицы в fr-полях) ===== */

export function wordMap(words) {
  const m = {};
  (words.words || []).forEach((w) => { m[w.id] = w; });
  return m;
}

const CYR = /[А-Яа-яЁё]/;

/* Все id слов, которые участвуют в упражнениях (для SRS-очереди повторения). */
export function exerciseWordIds(units) {
  const set = new Set();
  (units.units || []).forEach((u) => (u.lessons || []).forEach((l) => (l.exercises || []).forEach((ex) => {
    if (ex.prompt) set.add(ex.prompt);
    (ex.options || []).forEach((o) => set.add(o));
    (ex.ids || []).forEach((o) => set.add(o));
    (ex.chips || []).forEach((o) => set.add(o));
  })));
  return [...set];
}

/* Полная валидация content/fr: ссылки на слова, состав фраз, fr-поля без кириллицы, 6–8 упражнений на урок. Возвращает массив ошибок (пустой = ок). */
export function validateFrContent(words, units) {
  const errs = [];
  const map = wordMap(words);
  const ids = Object.keys(map);
  if (new Set(ids).size !== ids.length) errs.push('words.json: дублирующиеся id');
  (words.words || []).forEach((w) => {
    if (!w.id || !w.fr || !w.ru) errs.push('words.json: у записи нет id/fr/ru: ' + JSON.stringify(w.id));
    if (w.fr && CYR.test(w.fr)) errs.push('words.json: кириллица во fr-поле у ' + w.id);
    if (w.kind === 'phrase') {
      if (!Array.isArray(w.words) || !w.words.length) errs.push('phrase без words: ' + w.id);
      (w.words || []).forEach((wid) => { if (!map[wid]) errs.push('phrase ' + w.id + ' ссылается на несуществующее слово ' + wid); });
    }
  });
  (units.units || []).forEach((u, ui) => {
    (u.lessons || []).forEach((l, li) => {
      const exs = l.exercises || [];
      if (exs.length < 6 || exs.length > 8) errs.push(`unit ${u.id} lesson ${l.id}: упражнений ${exs.length} (нужно 6–8)`);
      exs.forEach((ex, ei) => {
        const at = `unit ${u.id}/${l.id} ex#${ei} (${ex.type})`;
        if (ex.type === 'match') {
          if (ex.ids.length !== 5) errs.push(at + ': match ждёт ровно 5 слов');
          ex.ids.forEach((o) => { if (!map[o]) errs.push(at + ': нет слова ' + o); });
          return;
        }
        if (!map[ex.prompt]) { errs.push(at + ': нет prompt-слова ' + ex.prompt); return; }
        if (ex.type === 'choice') {
          if (ex.options.length !== 4 || !ex.options.includes(ex.prompt)) errs.push(at + ': options должны содержать 4 id включая prompt');
          ex.options.forEach((o) => { if (!map[o]) errs.push(at + ': нет слова-опции ' + o); });
          if (ex.dir !== 'fr2ru' && ex.dir !== 'ru2fr') errs.push(at + ': dir должен быть fr2ru|ru2fr');
        } else if (ex.type === 'listen') {
          if (ex.options.length !== 3 || !ex.options.includes(ex.prompt)) errs.push(at + ': options должны содержать 3 id включая prompt');
          ex.options.forEach((o) => { if (!map[o]) errs.push(at + ': нет слова-опции ' + o); });
        } else if (ex.type === 'build') {
          const ph = map[ex.prompt];
          if (!ph || ph.kind !== 'phrase') { errs.push(at + ': prompt должен быть phrase'); return; }
          ex.chips.forEach((c) => { if (!map[c]) errs.push(at + ': нет chip-слова ' + c); });
          ph.words.forEach((w) => { if (!ex.chips.includes(w)) errs.push(at + ': все слова фразы должны быть среди chips (' + w + ')'); });
        } else {
          errs.push(at + ': неизвестный type ' + ex.type);
        }
      });
    });
  });
  return errs;
}
