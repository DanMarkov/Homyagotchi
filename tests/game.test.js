import { test } from 'node:test';
import assert from 'node:assert';
import { gainXP, buy, owns, toggleHabit, answerEvent, dailyGoalProgress, moodAvg, logMood, dayCheck } from '../src/core/game.js';
import { freshState } from '../src/core/store.js';

test('gainXP levels up and awards coins', () => {
  const s = freshState();
  const ups = gainXP(s, 10);
  assert.deepEqual(ups, [2]);
  assert.equal(s.lvl, 2);
  assert.equal(s.xp, 0);
  assert.equal(s.coins, 50);
});

test('buy food consumes coins; insufficient funds rejected', () => {
  const s = freshState();
  const r1 = buy(s, { id: 'food_seeds', price: 5 }, 'food');
  assert.equal(r1.ok, true);
  assert.equal(s.coins, 25);
  s.coins = 1;
  const r2 = buy(s, { id: 'food_seeds', price: 5 }, 'food');
  assert.equal(r2.ok, false);
  assert.equal(s.coins, 1);
});

test('buy hat: purchase then equip for free', () => {
  const s = freshState();
  const hat = { id: 'hat_cap', price: 30 };
  const r1 = buy(s, hat, 'hat');
  assert.equal(r1.action, 'buy');
  assert.equal(s.coins, 0);
  assert.ok(owns(s, 'hat_cap'));
  s.coins = 0;
  const r2 = buy(s, hat, 'hat');
  assert.equal(r2.action, 'equip');
  assert.equal(s.coins, 0);
  assert.equal(s.equipped.hat, 'hat_cap');
});

test('toggleHabit grants xp/coins on check, reverts on uncheck', () => {
  const s = freshState();
  const r = toggleHabit(s, 'h_water', true);
  assert.equal(r.xp, 2);
  assert.equal(r.coins, 3);
  assert.equal(s.xp, 2);
  assert.equal(s.coins, 33);
  toggleHabit(s, 'h_water', false);
  assert.equal(s.habitState.h_water.streak, 0);
});

test('answerEvent rewards correct, punishes wrong', () => {
  const s = freshState();
  const ev = { ok: 1, xp: 5 };
  const good = answerEvent(s, ev, 1);
  assert.equal(good, true);
  assert.equal(s.coins, 40);
  assert.equal(s.xp, 5);
  const bad = answerEvent(s, ev, 0);
  assert.equal(bad, false);
  assert.equal(s.sec, Math.max(0, 70 - 12));
});

test('dailyGoalProgress resets on new day', () => {
  const s = freshState();
  gainXP(s, 5);
  assert.equal(dailyGoalProgress(s, 10), 50);
  s.dailyXpDay = 'old day';
  assert.equal(dailyGoalProgress(s, 10), 0);
});

test('moodAvg averages last days', () => {
  const s = freshState();
  logMood(s, 5);
  logMood(s, 3);
  assert.equal(moodAvg(s.moodLog, 7), 4);
});

test('dayCheck increments streak once per day', () => {
  const s = freshState();
  dayCheck(s);
  assert.equal(s.streak, 1);
  dayCheck(s);
  assert.equal(s.streak, 1);
});
