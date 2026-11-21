import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  handleRequest, createStore, detectCrisisText, buildUserMessage, sha256hex, PROD_ORIGIN,
} from '../supabase/functions/_shared/proxy.js';
import SEEDS_EDGE from '../supabase/functions/_shared/seeds.json' with { type: 'json' };
import SEEDS_WORKER from '../worker/src/seeds.json' with { type: 'json' };

/* Стаб Mistral: fetch считает вызовы, поведение переключается */
let mistralCalls;
let mistralBehavior;
let store;

function ask(body, { ip = '1.2.3.4', origin = 'https://danmarkov.github.io', method = 'POST', path = '/functions/v1/help-ask', expectedPath = null, env } = {}) {
  const headers = { 'Content-Type': 'application/json', 'Origin': origin };
  if (ip) headers['x-forwarded-for'] = ip; // Supabase edge отдаёт IP так
  const req = new Request('https://edge.test' + path, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  return handleRequest(req, env || { MISTRAL_API_KEY: 'test-key', MISTRAL_TIMEOUT_MS: 60 }, store, { expectedPath });
}

beforeEach(() => {
  store = createStore();
  mistralCalls = 0;
  mistralBehavior = 'ok';
  globalThis.fetch = async (url, opts) => {
    mistralCalls++;
    assert.ok(String(url).includes('mistral'), 'прокси ходит только в Mistral, ключ в заголовке, не в URL');
    assert.ok(opts.headers.Authorization === 'Bearer test-key');
    if (mistralBehavior === 'ok') {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Всё будет хорошо! Сделай глубокий вдох. 🌬️' } }] }), { status: 200 });
    }
    if (mistralBehavior === 'varied') {
      const parsed = JSON.parse(opts.body);
      const user = parsed.messages[parsed.messages.length - 1].content;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Я слышу тебя: «' + user.slice(-80) + '». Держись 🌱' } }] }), { status: 200 });
    }
    if (mistralBehavior === 'empty') return new Response(JSON.stringify({ choices: [{ message: { content: '  ' } }] }), { status: 200 });
    if (mistralBehavior === 'error') return new Response('err', { status: 500 });
    if (mistralBehavior === 'hang') return new Promise((_, rej) => { // как настоящий fetch: падает по signal.abort
      if (opts.signal.aborted) return rej(new DOMException('The operation was aborted.', 'AbortError'));
      opts.signal.addEventListener('abort', () => rej(new DOMException('The operation was aborted.', 'AbortError')));
    });
    return new Response('{}', { status: 200 });
  };
});

test('GET — health check {status:ok}, без деталей', async () => {
  const r = await ask(null, { method: 'GET' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'ok' });
});

test('PUT → 405 (только POST/GET/OPTIONS)', async () => {
  assert.equal((await ask(null, { method: 'PUT' })).status, 405);
});

test('OPTIONS → 204 с CORS-заголовками', async () => {
  const r = await ask(null, { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), PROD_ORIGIN);
});

test('path check: expectedPath="/ask", чужой путь → 404', async () => {
  const r = await ask({ emotion: '🙂', topic: 'сон' }, { path: '/other', expectedPath: '/ask' });
  assert.equal(r.status, 404);
});

test('CORS: свой домен пропускается, чужой — нет (никогда не *)', async () => {
  const ok = await ask({ emotion: '😒', topic: 'тревога' }, { origin: 'https://danmarkov.github.io' });
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://danmarkov.github.io');
  const evil = await ask({ emotion: '😒', topic: 'тревога', custom: 'x' }, { origin: 'https://evil.example' });
  assert.equal(evil.headers.get('Access-Control-Allow-Origin'), PROD_ORIGIN);
  assert.notEqual(evil.headers.get('Access-Control-Allow-Origin'), '*');
});

test('CORS: ALLOWED_DEV_ORIGIN пропускает локалку', async () => {
  const r = await ask({ emotion: '😒', topic: 'тревога', custom: 'dev' }, { origin: 'http://localhost:5500', env: { MISTRAL_API_KEY: 'test-key', ALLOWED_DEV_ORIGIN: 'http://localhost:5500', MISTRAL_TIMEOUT_MS: 60 } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5500');
});

test('валидация: битый вход → 400 без вызова Mistral', async () => {
  // emotion/topic опциональны, но нужен topic ИЛИ custom; custom ≤500
  for (const body of [null, {}, { emotion: '😒' }, { emotion: '😒', custom: '' }, { emotion: '😒', topic: 'x', custom: 'a'.repeat(501) }, { emotion: '😒', topic: 5 }, { topic: 'x', custom: 5 }, { emotion: 'x'.repeat(31), topic: 't' }]) {
    const r = await ask(body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal(mistralCalls, 0);
});

test('свободный текст (custom без topic) -> 200 генерация, user-сообщение содержит custom', async () => {
  mistralBehavior = 'varied';
  const r = await ask({ emotion: '🙂', topic: '', custom: 'готовлюсь к экзамену, всё валится из рук' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.answer.includes('готовлюсь к экзамену'), 'ответ построен на custom-тексте');
  assert.equal(d.source, 'mistral');
  assert.equal(mistralCalls, 1);
  assert.equal(buildUserMessage('', '', 'привет'), '[слова пользователя: «привет»}]');
  assert.equal(buildUserMessage('🙂', '', 'привет'), '[Эмоция: 🙂, слова пользователя: «привет»}]');
  assert.equal(buildUserMessage('😒', 'учёба', 'не успеваю'), '[Эмоция: 😒, тема: «учёба», слова пользователя: «не успеваю»}]');
});

test('кэш различает свободные тексты: разные custom -> разные ответы и 2 вызова, повтор -> кэш', async () => {
  mistralBehavior = 'varied';
  const d1 = await (await ask({ emotion: '🙂', topic: '', custom: 'готовлюсь к экзамену, всё валится' })).json();
  const d2 = await (await ask({ emotion: '🙂', topic: '', custom: 'одиноко, все друзья разъехались' })).json();
  assert.notEqual(d1.answer, d2.answer, 'ключ кэша включает custom');
  assert.equal(mistralCalls, 2);
  const d1b = await (await ask({ emotion: '🙂', topic: '', custom: 'готовлюсь к экзамену, всё валится' })).json();
  assert.equal(d1b.cached, true);
  assert.equal(d1b.answer, d1.answer);
  assert.equal(mistralCalls, 2);
});

test('кризис в свободном тексте (custom, без topic) -> hotline, без вызова модели', async () => {
  const r = await ask({ emotion: '😞', topic: '', custom: 'не хочу жить' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.answer.includes('8-800-2000-122'));
  assert.equal(d.source, 'crisis');
  assert.equal(mistralCalls, 0);
});

test('custom 600 символов -> 400 bad_custom (не 500)', async () => {
  const r = await ask({ emotion: '🙂', topic: '', custom: 'а'.repeat(600) });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'bad_custom');
});

test('200: генерация из Mistral, схема {answer, cached:false, source}, user-сообщение собрано', async () => {
  const r = await ask({ emotion: '😒', topic: 'учёба', custom: 'не успеваю ничего' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.answer.includes('вдох'));
  assert.equal(d.cached, false);
  assert.equal(d.source, 'mistral');
  assert.equal(mistralCalls, 1);
  assert.ok(buildUserMessage('😒', 'учёба', 'не успеваю').includes('не успеваю'));
});

test('кэш: повторный идентичный запрос → cached:true, Mistral НЕ дёргается; другой custom → новый вызов', async () => {
  const b = { emotion: '😒', topic: 'учёба', custom: 'не успеваю' };
  await ask(b);
  const d2 = await (await ask(b)).json();
  assert.equal(d2.cached, true);
  assert.equal(mistralCalls, 1);
  await ask({ ...b, custom: 'другое' });
  assert.equal(mistralCalls, 2);
});

test('seed-слой: стандартная пара при Math.random()<0.5 отдаёт seed без Mistral', async () => {
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const key = Object.keys(SEEDS_EDGE)[0];
    const [emotion, topic] = key.split('|');
    const r = await ask({ emotion, topic, custom: 'мой текст' });
    const d = await r.json();
    assert.equal(r.status, 200);
    assert.equal(d.source, 'seed');
    assert.equal(d.answer, SEEDS_EDGE[key]);
    assert.equal(mistralCalls, 0);
  } finally { Math.random = origRandom; }
});

test('429: после 10 запросов/час с одного IP (x-forwarded-for) — лимит, другой IP не тронут', async () => {
  let last;
  for (let i = 0; i < 10; i++) last = await ask({ emotion: '😆', topic: 'тема ' + i }, { ip: '9.9.9.9' });
  assert.equal(last.status, 200);
  const r11 = await ask({ emotion: '😆', topic: 'ещё одна' }, { ip: '9.9.9.9' });
  assert.equal(r11.status, 429);
  assert.equal((await r11.json()).error, 'rate_limited');
  assert.ok(r11.headers.get('Retry-After'));
  const other = await ask({ emotion: '😆', topic: 'тема' }, { ip: '8.8.8.8' });
  assert.equal(other.status, 200);
});

test('таймаут Mistral (abort) → 503 {fallback:true}', async () => {
  mistralBehavior = 'hang';
  const r = await ask({ emotion: '😴', topic: 'сон', custom: 'не спится' });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { fallback: true });
});

test('Mistral вернул пустоту/ошибку → 503 {fallback:true}', async () => {
  mistralBehavior = 'empty';
  assert.equal((await ask({ emotion: '😴', topic: 'сон' })).status, 503);
  mistralBehavior = 'error';
  assert.equal((await ask({ emotion: '😴', topic: 'сон', custom: 'x2' })).status, 503);
});

test('без MISTRAL_API_KEY → 503 {fallback:true, reason:"no_key"}', async () => {
  const r = await ask({ emotion: '🙂', topic: 'хорошо' }, { env: {} });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { fallback: true, reason: 'no_key' });
});

test('кризис: телефон доверия ОБЯЗАТЕЛЬНО в ответе, Mistral не вызывается', async () => {
  const r = await ask({ emotion: '😞', topic: 'грустно', custom: 'хочу убить себя, не вижу смысла' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.answer.includes('8-800-2000-122'));
  assert.equal(d.source, 'crisis');
  assert.equal(mistralCalls, 0);
  assert.ok(detectCrisisText('мысли о суициде'));
  assert.ok(!detectCrisisText('просто грустно'));
});

test('sha256 стабилен, hex 64 символа', async () => {
  const h = await sha256hex('😒|тревога|привет');
  assert.equal(h.length, 64);
  assert.equal(h, await sha256hex('😒|тревога|привет'));
});

test('20 запросов с разным custom — все 200, ответы варьируются', async () => {
  mistralBehavior = 'varied';
  const answers = new Set();
  for (let i = 0; i < 20; i++) {
    const r = await ask({ emotion: '😒', topic: 'учёба', custom: 'не успеваю, вариант номер ' + i }, { ip: '10.2.0.' + i });
    assert.equal(r.status, 200, 'запрос #' + i);
    const d = await r.json();
    assert.ok(d.answer && d.answer.length > 10);
    answers.add(d.answer);
  }
  assert.equal(answers.size, 20, 'уникальных ответов: ' + answers.size + '/20');
});

test('8 одинаковых запросов подряд — Mistral вызван ровно 1 раз (кэш)', async () => {
  mistralBehavior = 'varied';
  const b = { emotion: '😒', topic: 'учёба', custom: 'один и тот же текст' };
  let first;
  for (let i = 0; i < 8; i++) {
    const r = await ask(b, { ip: '7.7.7.7' });
    assert.equal(r.status, 200);
    const d = await r.json();
    if (i === 0) first = d; else assert.equal(d.cached, true, 'повтор #' + i + ' из кэша');
  }
  assert.equal(first.cached, false);
  assert.equal(mistralCalls, 1);
});

test('15 быстрых запросов с одного IP — 10×200, потом 5×429', async () => {
  mistralBehavior = 'varied';
  let ok = 0, limited = 0;
  for (let i = 0; i < 15; i++) {
    const r = await ask({ emotion: '😆', topic: 'другая тема ' + i, custom: 'спам ' + i }, { ip: '6.6.6.6' });
    if (r.status === 200) ok++; else if (r.status === 429) limited++;
  }
  assert.equal(ok, 10);
  assert.equal(limited, 5);
});

test('seeds.json идентичен в supabase/functions/_shared и worker/src (паритет)', () => {
  assert.deepEqual(SEEDS_EDGE, SEEDS_WORKER);
  assert.equal(Object.keys(SEEDS_EDGE).length, 30);
});

test('свободный текст в ambas ветках: topic="" уходит как есть, custom обязателен', async () => {
  mistralBehavior = 'varied';
  const r = await ask({ emotion: '🙂', topic: '', custom: 'свободный ввод пользователя' });
  assert.equal(r.status, 200);
  assert.equal(mistralCalls, 1);
});
