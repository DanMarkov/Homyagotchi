import { test } from 'node:test';
import assert from 'node:assert';
import { lessonProgress, saveLessonProgress, courseProgress, totalProgress, lessonKey } from '../src/core/lessons.js';
import { freshState } from '../src/core/store.js';

const COURSE = {
  id: 'sec_basics',
  lessons: [
    { id: 'phishing', scenes: [{ text: 'a', xp: 2 }, { q: 'b' }, { text: 'c', xp: 3 }] },
    { id: 'passwords', scenes: [{ text: 'a', xp: 2 }] }
  ]
};

test('lesson progress tracked per lesson', () => {
  const s = freshState();
  const key = lessonKey('sec_basics', 'phishing');
  assert.equal(lessonProgress(s, key), 0);
  saveLessonProgress(s, key, 0, 3, 2, () => {});
  assert.equal(lessonProgress(s, key), 1);
  assert.equal(courseProgress(s, COURSE).done, 0);
});

test('completing all scenes marks lesson done once, grants xp once', () => {
  const s = freshState();
  const key = lessonKey('sec_basics', 'passwords');
  const r1 = saveLessonProgress(s, key, 0, 1, 2, (st, n) => { st.xp += n; });
  assert.deepEqual(r1, { completed: true, firstTime: true });
  assert.equal(s.xp, 2);
  const r2 = saveLessonProgress(s, key, 0, 1, 2, (st, n) => { st.xp += n; });
  assert.deepEqual(r2, { completed: true, firstTime: false });
  assert.equal(s.xp, 2);
  assert.equal(courseProgress(s, COURSE).done, 1);
  assert.equal(courseProgress(s, COURSE).pct, 50);
});

test('totalProgress across courses', () => {
  const s = freshState();
  const tp = totalProgress(s, [COURSE]);
  assert.equal(tp.total, 2);
  assert.equal(tp.pct, 0);
});
