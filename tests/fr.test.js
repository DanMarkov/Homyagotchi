import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DAY_MS, BOX_INTERVALS_DAYS, REVIEW_LIMIT,
  frState, boxOf, nextReviewOf, recordResult, dueWords,
  lessonDone, markLessonDone, lessonUnlocked, lessonReward, applyLessonReward,
  wordMap, exerciseWordIds, validateFrContent
} from '../src/core/fr.js';
import { freshState, migrate } from '../src/core/store.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORDS = JSON.parse(readFileSync(path.join(ROOT, 'content/fr/words.json'), 'utf8'));
const UNITS = JSON.parse(readFileSync(path.join(ROOT, 'content/fr/units.json'), 'utf8'));

/* ---- контент: статические файлы валидны, .js-сборка синхронна с .json ---- */

test('fr content: words.json + units.json валидны (id стабильные, ссылки резолвятся, 6–8 упражнений)', () => {
  const errs = validateFrContent(WORDS, UNITS);
  assert.deepEqual(errs, []);
});

test('fr content: MVP-объём — 15–20 слов и 3 урока в первом юните', () => {
  const words = WORDS.words.filter((w) => w.kind !== 'phrase');
  assert.ok(words.length >= 15 && words.length <= 20, 'слов: ' + words.length);
  assert.equal(UNITS.units.length >= 1, true);
  assert.equal(UNITS.units[0].lessons.length, 3);
  UNITS.units[0].lessons.forEach((l) => {
    assert.ok(l.exercises.length >= 6 && l.exercises.length <= 8, l.id + ': ' + l.exercises.length);
  });
});

test('fr content: собранные content/fr/*.js синхронны с .json', () => {
  const wjs = readFileSync(path.join(ROOT, 'content/fr/words.js'), 'utf8');
  const ujs = readFileSync(path.join(ROOT, 'content/fr/units.js'), 'utf8');
  const win = {};
  new Function('window', wjs)(win);
  new Function('window', ujs)(win);
  assert.deepEqual(win.__FR_WORDS__, WORDS);
  assert.deepEqual(win.__FR_UNITS__, UNITS);
});

test('fr content: все id в упражнениях существуют и входят в SRS-множество', () => {
  const map = wordMap(WORDS);
  const ids = exerciseWordIds(UNITS);
  ids.forEach((id) => assert.ok(map[id], 'нет слова ' + id));
  assert.ok(ids.length >= 15);
});

/* ---- SRS ---- */

test('SRS: верный ответ растит box 1→2→3… с интервалами 1/3/7/14/30 дней', () => {
  const s = freshState();
  const now = 1_000_000_000_000;
  let b = recordResult(s, 'w_bonjour', true, now);
  assert.equal(b.box, 1);
  assert.equal(b.nextReview, now + 1 * DAY_MS);
  b = recordResult(s, 'w_bonjour', true, now);
  assert.equal(b.box, 2);
  assert.equal(b.nextReview, now + 3 * DAY_MS);
  b = recordResult(s, 'w_bonjour', true, now);
  assert.equal(b.box, 3);
  assert.equal(b.nextReview, now + 7 * DAY_MS);
  b = recordResult(s, 'w_bonjour', true, now);
  assert.equal(b.box, 4);
  assert.equal(b.nextReview, now + 14 * DAY_MS);
  b = recordResult(s, 'w_bonjour', true, now);
  assert.equal(b.box, 5);
  assert.equal(b.nextReview, now + 30 * DAY_MS);
  b = recordResult(s, 'w_bonjour', true, now); // box не выше 5
  assert.equal(b.box, 5);
  assert.equal(b.nextReview, now + 30 * DAY_MS);
  assert.deepEqual(BOX_INTERVALS_DAYS, [1, 3, 7, 14, 30]);
});

test('SRS: ошибка → box=1 и nextReview = завтра', () => {
  const s = freshState();
  const now = 1_000_000_000_000;
  recordResult(s, 'w_merci', true, now);
  recordResult(s, 'w_merci', true, now);
  assert.equal(boxOf(s, 'w_merci'), 2);
  const b = recordResult(s, 'w_merci', false, now);
  assert.equal(b.box, 1);
  assert.equal(b.nextReview, now + DAY_MS);
  assert.equal(boxOf(s, 'w_merci'), 1);
});

test('SRS: dueWords — только истёкшие, по давности, лимит 10 за сессию', () => {
  const s = freshState();
  const now = 1_000_000_000_000;
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']; // 12 слов
  ids.forEach((id, i) => { s.fr.boxes[id] = { box: 1, nextReview: now - (12 - i) * 1000 }; }); // все истекли, a — давнее всех
  s.fr.boxes.notDue = { box: 1, nextReview: now + DAY_MS };
  s.fr.boxes.neverSeen = undefined;
  const due = dueWords(s, [...ids, 'notDue'], now);
  assert.equal(due.length, REVIEW_LIMIT);
  assert.equal(due[0], 'a');
  assert.ok(!due.includes('notDue'));
  const all = dueWords(s, [...ids, 'notDue'], now, 999);
  assert.equal(all.length, 12);
});

test('SRS: слово, отвеченное верно, пропадает из очереди до следующей даты', () => {
  const s = freshState();
  const now = 1_000_000_000_000;
  recordResult(s, 'w_salut', false, now - 2 * DAY_MS); // box=1, истекло вчера
  assert.deepEqual(dueWords(s, ['w_salut'], now), ['w_salut']);
  recordResult(s, 'w_salut', true, now); // box 1→2, следующая дата через 3 дня
  assert.deepEqual(dueWords(s, ['w_salut'], now), []);
  assert.deepEqual(dueWords(s, ['w_salut'], now + 2 * DAY_MS), []);
  assert.deepEqual(dueWords(s, ['w_salut'], now + 3 * DAY_MS), ['w_salut']);
});

/* ---- уроки: открытость, награда один раз ---- */

test('lessons: первый урок открыт, следующие — после предыдущего; награда один раз', () => {
  const s = freshState();
  assert.equal(lessonUnlocked(UNITS, 0, 0, s), true);
  assert.equal(lessonUnlocked(UNITS, 0, 1, s), false);
  assert.equal(lessonDone(s, 'l1_salutations'), false);
  markLessonDone(s, 'l1_salutations', 2);
  assert.equal(lessonDone(s, 'l1_salutations'), true);
  assert.equal(lessonUnlocked(UNITS, 0, 1, s), true);
  assert.equal(lessonUnlocked(UNITS, 0, 2, s), false);
});

test('reward: без ошибок +15 монет +1 KP, с ошибками +8 монет; хомяк: +10 сытости +5 радости + _eating', () => {
  assert.deepEqual(lessonReward(0), { coins: 15, kp: 1 });
  assert.deepEqual(lessonReward(3), { coins: 8, kp: 0 });
  const s = freshState();
  s.coins = 100; s.satiety = 50; s.mood = 50;
  const r = applyLessonReward(s, 0);
  assert.equal(r.coins, 15);
  assert.equal(s.coins, 115);
  assert.equal(s.satiety, 60);
  assert.equal(s.mood, 55);
  assert.equal(s._eating, 8);
  assert.ok(s.xp >= 1 || s.lvl >= 2); // +1 KP ушёл в XP/level
  const s2 = freshState();
  s2.coins = 100; s2.satiety = 95;
  const r2 = applyLessonReward(s2, 2);
  assert.equal(r2.coins, 8);
  assert.equal(s2.coins, 108);
  assert.equal(s2.satiety, 100); // cap 100
});

/* ---- миграция: старый сейв получает state.fr ---- */

test('migrate: v3 → v4 добавляет fr без потерь', () => {
  const s = migrate({ version: 3, coins: 7 });
  assert.equal(s.version, 4);
  assert.deepEqual(s.fr, { boxes: {}, lessons: {} });
  assert.equal(s.coins, 7);
  assert.ok(frState(s).boxes);
});
