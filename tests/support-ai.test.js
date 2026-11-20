import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { askHelpAI, aiLeft, setLastMoodEmoji } from '../src/ui/support.js?v=38';

/* Стабы браузерного окружения: localStorage/sessionStorage/fetch */
function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

let fetchCalls;
let fetchBehavior;

beforeEach(() => {
  globalThis.localStorage = makeStorage();
  globalThis.sessionStorage = makeStorage();
  fetchCalls = [];
  fetchBehavior = 'ok';
  globalThis.fetch = async (url, opts) => {
    fetchCalls.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (fetchBehavior === 'ok') {
      return new Response(JSON.stringify({ answer: 'Всё наладится, сделай глубокий вдох 🌬️', cached: false, source: 'mistral' }), { status: 200 });
    }
    if (fetchBehavior === 'fallback503') return new Response(JSON.stringify({ fallback: true }), { status: 503 });
    if (fetchBehavior === 'rate429') return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 });
    if (fetchBehavior === 'empty') return new Response(JSON.stringify({ choices: [] }), { status: 200 });
    if (fetchBehavior === 'network') throw new TypeError('fetch failed');
    return new Response('{}', { status: 200 });
  };
});

test('200: возвращает {text, source}, уходит в сеть на URL прокси (не на api.mistral)', async () => {
  const r = await askHelpAI('😒', 'стресс и учёба', 'не успеваю ничего');
  assert.equal(r.text, 'Всё наладится, сделай глубокий вдох 🌬️');
  assert.equal(r.source, 'mistral');
  assert.equal(fetchCalls.length, 1);
  assert.ok(fetchCalls[0].url.startsWith('https://'), 'прокси по https');
  assert.ok(!fetchCalls[0].url.includes('mistral'), 'в URL запроса нет api.mistral');
  assert.deepEqual(fetchCalls[0].body, { emotion: '😒', topic: 'стресс и учёба', custom: 'не успеваю ничего' });
});

test('503 {fallback:true} -> {fallback:true}, лимит НЕ тратится', async () => {
  fetchBehavior = 'fallback503';
  const r = await askHelpAI('😒', 'тревога', 'всё плохо');
  assert.deepEqual(r, { fallback: true });
  assert.equal(aiLeft(), 3);
});

test('429 -> {fallback:true, rateLimited:true} (клиент покажет «отдохни немного»)', async () => {
  fetchBehavior = 'rate429';
  const r = await askHelpAI('😞', 'грустно', '');
  assert.equal(r.fallback, true);
  assert.equal(r.rateLimited, true);
});

test('200 без поля answer -> fallback', async () => {
  fetchBehavior = 'empty';
  const r = await askHelpAI('🙂', 'мне хорошо 👋', '');
  assert.equal(r.fallback, true);
});

test('сеть недоступна (fetch бросает) -> {fallback:true}, без исключений', async () => {
  fetchBehavior = 'network';
  const r = await askHelpAI('😶', 'сон', 'не спится');
  assert.deepEqual(r, { fallback: true });
});

test('лимит 3 генеративных ответа за сессию, потом fallback без вызова сети', async () => {
  assert.equal(aiLeft(), 3);
  for (let i = 0; i < 3; i++) {
    const r = await askHelpAI('😒', 'учёба', 'запрос ' + i);
    assert.ok(r.text, 'ответ ' + i + ' сгенерирован');
    assert.equal(aiLeft(), 3 - (i + 1));
  }
  const r4 = await askHelpAI('😒', 'учёба', 'четвёртый');
  assert.equal(r4.fallback, true);
  assert.equal(r4.noLimit, true);
  assert.equal(fetchCalls.length, 3, 'сверх лимита сеть не дёргаем');
});

test('новая сессия (другой sid) сбрасывает лимит', async () => {
  for (let i = 0; i < 3; i++) await askHelpAI('😆', 'мне хорошо 👋', 'x' + i);
  assert.equal(aiLeft(), 0);
  sessionStorage.setItem('khomyagochi_sid', 'new-session');
  assert.equal(aiLeft(), 3);
});

test('setLastMoodEmoji влияет на тело запроса', async () => {
  setLastMoodEmoji('😆');
  await askHelpAI('😆', 'мне хорошо 👋', '');
  assert.equal(fetchCalls[0].body.emotion, '😆');
  setLastMoodEmoji('🙂'); // вернуть дефолт для других тестов
});

test('в клиентском коде страницы НЕТ api.mistral и MISTRAL_API_KEY (ключ только в воркере)', () => {
  const files = ['index.html', 'src/ui/support.js', 'src/ui/app.js', 'src/core/game.js', 'src/core/store.js', 'content/shop.js'];
  for (const f of files) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.ok(!src.includes('api.mistral'), f + ' не должен содержать api.mistral');
    assert.ok(!src.includes('MISTRAL_API_KEY'), f + ' не должен содержать MISTRAL_API_KEY');
    assert.ok(!src.includes('Bearer '), f + ' не должен содержать Bearer');
  }
});
