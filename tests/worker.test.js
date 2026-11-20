import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import worker, { detectCrisisText, buildUserMessage, sha256hex } from '../worker/src/index.js';
import SEEDS from '../worker/src/seeds.json' with { type: 'json' };

/* Стабы Cloudflare-окружения: caches (Cache API) и fetch (Mistral) */
function makeCaches() {
  const store = new Map();
  return {
    default: {
      async match(req) {
        const e = store.get(req.url);
        if (!e) return undefined;
        if (e.exp && Date.now() > e.exp) { store.delete(req.url); return undefined; }
        return new Response(e.body, { headers: e.headers });
      },
      async put(req, resp) {
        const cc = resp.headers.get('Cache-Control') || '';
        const m = /max-age=(\d+)/.exec(cc);
        store.set(req.url, { body: await resp.text(), headers: { 'Content-Type': 'application/json' }, exp: m ? Date.now() + Number(m[1]) * 1000 : 0 });
      },
    },
  };
}

let mistralCalls;
let mistralBehavior;

function ask(body, { ip = '1.2.3.4', origin = 'https://danmarkov.github.io', method = 'POST' } = {}) {
  const req = new Request('https://proxy.test/ask', {
    method,
    headers: { 'Content-Type': 'application/json', 'Origin': origin, 'CF-Connecting-IP': ip },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  return worker.fetch(req, { MISTRAL_API_KEY: 'test-key', MISTRAL_TIMEOUT_MS: 60 }, { waitUntil() {} });
}

beforeEach(() => {
  globalThis.caches = makeCaches();
  mistralCalls = 0;
  mistralBehavior = 'ok';
  globalThis.fetch = async (url, opts) => {
    mistralCalls++;
    assert.ok(String(url).includes('mistral'), 'воркер ходит только в Mistral, ключ в заголовке, не в URL');
    assert.ok(opts.headers.Authorization === 'Bearer test-key');
    if (mistralBehavior === 'ok') {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Всё будет хорошо! Сделай глубокий вдох. 🌬️' } }] }), { status: 200 });
    }
    if (mistralBehavior === 'varied') {
      // ответ зависит от user-сообщения, чтобы на разные custom приходили разные формулировки
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

test('PUT/DELETE отклоняются (только POST/GET/OPTIONS)', async () => {
  const r = await ask(null, { method: 'PUT' });
  assert.equal(r.status, 405);
});

test('CORS: свой домен пропускается, чужой — нет (никогда не *)', async () => {
  const ok = await ask({ emotion: '😒', topic: 'тревога' }, { origin: 'https://danmarkov.github.io' });
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://danmarkov.github.io');
  const evil = await ask({ emotion: '😒', topic: 'тревога' }, { origin: 'https://evil.example' });
  assert.equal(evil.headers.get('Access-Control-Allow-Origin'), 'https://danmarkov.github.io');
  assert.notEqual(evil.headers.get('Access-Control-Allow-Origin'), '*');
});

test('валидация: битый вход -> 400 без вызова Mistral', async () => {
  for (const body of [null, {}, { emotion: '', topic: 'x' }, { emotion: '😒' }, { emotion: '😒', topic: 'x', custom: 'a'.repeat(501) }, { emotion: '😒', topic: 5 }]) {
    const r = await ask(body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal(mistralCalls, 0);
});

test('200: генерация из Mistral, схема ответа {answer, cached:false, source}', async () => {
  const r = await ask({ emotion: '😒', topic: 'учёба', custom: 'не успеваю ничего' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.answer.includes('вдох'));
  assert.equal(d.cached, false);
  assert.equal(d.source, 'mistral');
  assert.equal(mistralCalls, 1);
  // user-сообщение собрано из входных данных
  assert.ok(buildUserMessage('😒', 'учёба', 'не успеваю').includes('не успеваю'));
});

test('кэш: повторный идентичный запрос -> cached:true, Mistral НЕ дёргается', async () => {
  const b = { emotion: '😒', topic: 'учёба', custom: 'не успеваю' };
  await ask(b);
  const r2 = await ask(b);
  const d = await r2.json();
  assert.equal(d.cached, true);
  assert.equal(mistralCalls, 1, 'второй запрос ушёл из кэша');
  // другой custom -> другой хэш -> снова Mistral
  await ask({ ...b, custom: 'другое' });
  assert.equal(mistralCalls, 2);
});

test('seed-слой: стандартная пара при Math.random()<0.5 отдаёт seed без Mistral', async () => {
  const origRandom = Math.random;
  Math.random = () => 0; // форсируем ветку seed
  try {
    const key = Object.keys(SEEDS)[0];
    const [emotion, topic] = key.split('|');
    const r = await ask({ emotion, topic, custom: 'мой текст' });
    const d = await r.json();
    assert.equal(r.status, 200);
    assert.equal(d.source, 'seed');
    assert.equal(d.answer, SEEDS[key]);
    assert.equal(mistralCalls, 0);
  } finally { Math.random = origRandom; }
});

test('429: после 10 запросов/час с одного IP — лимит', async () => {
  mistralBehavior = 'ok';
  let last;
  for (let i = 0; i < 10; i++) last = await ask({ emotion: '😆', topic: 'другая тема ' + i }, { ip: '9.9.9.9' });
  assert.equal(last.status, 200);
  const r11 = await ask({ emotion: '😆', topic: 'ещё одна' }, { ip: '9.9.9.9' });
  assert.equal(r11.status, 429);
  const d = await r11.json();
  assert.equal(d.error, 'rate_limited');
  // другой IP — не тронут
  const other = await ask({ emotion: '😆', topic: 'тема' }, { ip: '8.8.8.8' });
  assert.equal(other.status, 200);
});

test('таймаут Mistral (abort) -> 503 {fallback:true}', async () => {
  mistralBehavior = 'hang';
  const r = await ask({ emotion: '😶', topic: 'сон', custom: 'не спится' });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { fallback: true });
});

test('Mistral вернул пустоту/ошибку -> 503 {fallback:true}', async () => {
  mistralBehavior = 'empty';
  assert.equal((await ask({ emotion: '😶', topic: 'сон' })).status, 503);
  mistralBehavior = 'error';
  assert.equal((await ask({ emotion: '😶', topic: 'сон', custom: 'x2' })).status, 503);
});

test('без MISTRAL_API_KEY -> 503 {fallback:true}', async () => {
  const req = new Request('https://proxy.test/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emotion: '🙂', topic: 'хорошо' }) });
  const r = await worker.fetch(req, {}, { waitUntil() {} });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { fallback: true, reason: 'no_key' });
});

test('кризис: телефон доверия ОБЯЗАТЕЛЬНО в ответе, Mistral не вызывается', async () => {
  const r = await ask({ emotion: '😞', topic: 'грустно', custom: 'хочу убить себя, не вижу смысла' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.answer.includes('8-800-2000-122'), 'hotline обязателен');
  assert.equal(d.source, 'crisis');
  assert.equal(mistralCalls, 0);
  assert.ok(detectCrisisText('мысли о суициде'));
  assert.ok(!detectCrisisText('просто грустно'));
});

test('sha256 стабильный, hex 64 символа', async () => {
  const h = await sha256hex('😒|тревога|привет');
  assert.equal(h.length, 64);
  assert.equal(h, await sha256hex('😒|тревога|привет'));
});

test('seeds.json покрывает все 5 эмоций × 6 тем из UI', () => {
  const emojis = ['😞', '😒', '😶', '🙂', '😆'];
  const topics = ['тревога', 'стресс и учёба', 'грустно', 'одиноко', 'злюсь', 'мне хорошо 👋'];
  assert.equal(Object.keys(SEEDS).length, 30);
  for (const e of emojis) for (const t of topics) assert.ok(SEEDS[e + '|' + t], 'seed для ' + e + '|' + t);
});

test('модуль 6: 20 запросов с разным custom — все 200, ответы варьируются', async () => {
  mistralBehavior = 'varied';
  const answers = new Set();
  for (let i = 0; i < 20; i++) {
    // разные IP, чтобы не поймать 429 (лимит 10/час/IP)
    const r = await ask({ emotion: '😒', topic: 'учёба', custom: 'не успеваю, вариант номер ' + i }, { ip: '10.1.0.' + i });
    assert.equal(r.status, 200, 'запрос #' + i);
    const d = await r.json();
    assert.ok(d.answer && d.answer.length > 10);
    answers.add(d.answer);
  }
  assert.equal(answers.size, 20, 'на разные custom — разные ответы, уникальных: ' + answers.size + '/20');
});

test('модуль 6: 8 одинаковых запросов подряд — Mistral вызван ровно 1 раз (сработал кэш)', async () => {
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
  assert.equal(mistralCalls, 1, 'Mistral дёрнут только на первый запрос');
});

test('модуль 6: 15 быстрых запросов с одного IP — после 10-го срабатывает лимит 429', async () => {
  mistralBehavior = 'varied';
  let ok = 0, limited = 0;
  for (let i = 0; i < 15; i++) {
    const r = await ask({ emotion: '😆', topic: 'другая тема ' + i, custom: 'спам ' + i }, { ip: '6.6.6.6' });
    if (r.status === 200) ok++; else if (r.status === 429) limited++;
  }
  assert.equal(ok, 10);
  assert.equal(limited, 5);
});
