import { test } from 'node:test';
import assert from 'node:assert';
import { gainXP, buy, owns, toggleHabit, answerEvent, dailyGoalProgress, moodAvg, logMood, dayCheck, accuracy, securityRank, eventsForAudience, petAlert, useItem, isWifiEvent, itemCount, wifiBuffActive, coldBuffLeft, activeBuffs } from '../src/core/game.js';
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

test('answerEvent records answers for the security rating', () => {
  const s = freshState();
  answerEvent(s, { ok: 1, xp: 5 }, 1);
  answerEvent(s, { ok: 1, xp: 5 }, 0);
  assert.deepEqual(s.stats, { correct: 1, total: 2 });
  assert.equal(accuracy(s), 50);
});

test('securityRank: empty -> Новичок, thresholds and max rank', () => {
  const s = freshState();
  let r = securityRank(s);
  assert.equal(r.pct, null);
  assert.equal(r.title, 'Новичок');
  s.stats = { correct: 6, total: 10 };
  r = securityRank(s);
  assert.equal(r.pct, 60);
  assert.equal(r.title, 'Любитель');
  assert.equal(r.next, 75);
  assert.equal(r.nextTitle, 'Знаток');
  s.stats = { correct: 95, total: 100 };
  r = securityRank(s);
  assert.equal(r.pct, 95);
  assert.equal(r.title, 'Мастер киберзащиты');
  assert.equal(r.next, null);
  assert.equal(r.progress, 100);
});

test('eventsForAudience filters by audience tag with fallback to all', () => {
  const evs = [
    { id: 'a', aud: ['school'] },
    { id: 'b', aud: ['student', 'worker'] },
    { id: 'c' }
  ];
  assert.deepEqual(eventsForAudience(evs, 'school').map((e) => e.id), ['a', 'c']);
  assert.deepEqual(eventsForAudience(evs, 'worker').map((e) => e.id), ['b', 'c']);
  assert.deepEqual(eventsForAudience(evs, 'student').map((e) => e.id), ['b', 'c']);
  assert.equal(eventsForAudience([{ id: 'x', aud: ['school'] }], 'worker').length, 1);
  assert.equal(eventsForAudience(null, 'school').length, 0);
});

test('petAlert fires on sick / low health / low security / low mood only', () => {
  const s = freshState();
  assert.equal(petAlert(s, 'idle'), null);
  s.health = 10;
  assert.ok(petAlert(s, 'idle').title.indexOf('чувствует') !== -1);
  s.health = 80; s.sec = 10;
  assert.ok(petAlert(s, 'idle').title.indexOf('опасности') !== -1);
  s.sec = 60; s.mood = 10;
  assert.ok(petAlert(s, 'idle').title.indexOf('скучает') !== -1);
  s.mood = 70;
  assert.ok(petAlert(s, 'sick').title.indexOf('чувствует') !== -1);
});

/* ============ ITEMS / БУФФЫ ============ */
test('buy item: списывает монеты и кладёт в инвентарь; отказ при нехватке', () => {
  const s = freshState();
  const it = { id: 'item_hint', key: 'hint', price: 20 };
  const r1 = buy(s, it, 'item');
  assert.equal(r1.ok, true);
  assert.equal(r1.action, 'item');
  assert.equal(s.coins, 30 - 20);
  assert.equal(itemCount(s, 'hint'), 1);
  s.coins = 5;
  const r2 = buy(s, it, 'item');
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'poor');
  assert.equal(itemCount(s, 'hint'), 1);
});

test('useItem wifi даёт бафф на 24ч, cold — на 3 сценария; пустой инвентарь отклоняется', () => {
  const s = freshState();
  s.items.wifi = 1; s.items.cold = 1;
  const now = 1000000000000;
  const r1 = useItem(s, 'wifi', now);
  assert.equal(r1.ok, true);
  assert.equal(s.items.wifi, 0);
  assert.equal(wifiBuffActive(s, now), true);
  assert.equal(wifiBuffActive(s, now + 24 * 3600 * 1000), false);
  assert.equal(wifiBuffActive(s, now + 23 * 3600 * 1000), true);
  const r2 = useItem(s, 'cold', now);
  assert.equal(r2.ok, true);
  assert.equal(coldBuffLeft(s), 3);
  const r3 = useItem(s, 'wifi', now);
  assert.equal(r3.ok, false);
});

test('isWifiEvent находит Wi-Fi/публичные сети по id/cat/q', () => {
  assert.equal(isWifiEvent({ id: 'ev_public_wifi', cat: 'shield SECURITY', q: 'Публичный Wi-Fi в кафе' }), true);
  assert.equal(isWifiEvent({ id: 'ev_sms', cat: 'shield SECURITY', q: 'SMS от банка' }), false);
});

test('activeBuffs отдаёт wifi-часы, cold-счётчик и key-счётчик для HUD', () => {
  const s = freshState();
  const now = 1000000000000;
  assert.deepEqual(activeBuffs(s, now), []);
  s.items.key = 1;
  s.items.cold = 1;
  s.items.wifi = 1;
  useItem(s, 'cold', now);
  useItem(s, 'wifi', now + 3600 * 1000); // осталось ~23ч
  const list = activeBuffs(s, now + 3600 * 1000);
  const byKey = Object.fromEntries(list.map((b) => [b.key, b]));
  assert.ok(byKey.wifi && byKey.wifi.sprite === 'wifi_icon' && /ч/.test(byKey.wifi.label));
  assert.equal(byKey.cold.label, '×3');
  assert.equal(byKey.key.label, '×1');
});
