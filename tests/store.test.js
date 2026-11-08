import { test } from 'node:test';
import assert from 'node:assert';
import { migrate, freshState, SAVE_VERSION } from '../src/core/store.js';

test('fresh state has version and defaults', () => {
  const s = freshState();
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.health, 80);
  assert.deepEqual(s.owned, ['hat_none', 'wall_rose']);
});

test('migrates v1 save (no version) to v2 with new fields', () => {
  const v1 = { health: 50, coins: 99, lastDay: 'x', habits: [{ id: 'a' }] };
  const s = migrate(v1);
  assert.equal(s.version, 2);
  assert.equal(s.health, 50);
  assert.equal(s.coins, 99);
  assert.equal(s.frozenStreak, 0);
  assert.equal(s.dailyXp, 0);
  assert.deepEqual(s.lessons, {});
  assert.equal(s.mood, 70);
});

test('corrupt save falls back to defaults', () => {
  const s = migrate(undefined);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.coins, 30);
});

test('fresh state has article-alignment defaults (audience, rating stats, notifications)', () => {
  const s = freshState();
  assert.equal(s.audience, 'student');
  assert.deepEqual(s.stats, { correct: 0, total: 0 });
  assert.equal(s.notifications, false);
  assert.equal(s.onboarded, false);
});

test('old v2 save migrates with new default fields filled', () => {
  const s = migrate({ version: 2, health: 50 });
  assert.equal(s.audience, 'student');
  assert.deepEqual(s.stats, { correct: 0, total: 0 });
  assert.equal(s.notifications, false);
});
