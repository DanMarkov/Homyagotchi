import { test } from 'node:test';
import assert from 'node:assert';
import { migrate, freshState, SAVE_VERSION, load, save, wipe, SAVE_KEY, BACKUP_KEY } from '../src/core/store.js';

test('fresh state has version and defaults', () => {
  const s = freshState();
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.health, 80);
  assert.deepEqual(s.owned, ['hat_none', 'wall_sky']);
  assert.equal(s.equipped.wall, 'wall_sky');
  assert.equal(s.satiety, 80);
});

test('migrates v1 save (no version) to v3 with new fields', () => {
  const v1 = { health: 50, coins: 99, lastDay: 'x', habits: [{ id: 'a' }] };
  const s = migrate(v1);
  assert.equal(s.version, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 3);
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

test('migrates v2 save to v3: satiety init + wall_rose→wall_sky default', () => {
  const v2 = { version: 2, health: 50, coins: 10, owned: ['hat_none', 'wall_rose'], equipped: { hat: 'hat_none', wall: 'wall_rose' } };
  const s = migrate(v2);
  assert.equal(s.version, 3);
  assert.equal(s.satiety, 80);
  assert.ok(s.satietyAt > 0);
  assert.ok(s.owned.includes('wall_sky'));
  assert.equal(s.equipped.wall, 'wall_sky');
  // если wall_sky уже куплены — не дублируем и не трогаем выбор
  const v2b = { version: 2, owned: ['hat_none', 'wall_rose', 'wall_mint'], equipped: { hat: 'hat_cap', wall: 'wall_mint' } };
  const s2 = migrate(v2b);
  assert.equal(s2.equipped.wall, 'wall_mint');
  assert.equal(s2.equipped.hat, 'hat_cap');
  assert.ok(!s2.owned.includes('wall_sky'));
});

test('save writes main + backup; load falls back to backup when main is corrupt', () => {
  const mem = {};
  global.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
  try {
    const s = freshState();
    s.coins = 77;
    save(s);
    assert.ok(mem[SAVE_KEY], 'main key written');
    assert.ok(mem[BACKUP_KEY], 'backup key written');
    // портим основной ключ — load должен взять бэкап и сохранить прогресс
    mem[SAVE_KEY] = '{broken json!!!';
    const loaded = load();
    assert.equal(loaded.coins, 77);
    assert.equal(loaded.version, SAVE_VERSION);
    // wipe чистит оба ключа
    wipe();
    assert.equal(mem[SAVE_KEY], undefined);
    assert.equal(mem[BACKUP_KEY], undefined);
  } finally {
    delete global.localStorage;
  }
});
