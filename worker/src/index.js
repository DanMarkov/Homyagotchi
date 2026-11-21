import SEEDS from './seeds.json' with { type: 'json' };

/* ============================================================
   homyag-help-proxy — Cloudflare Worker-прокси «Помощь» в Хомягочи.
   Клиент (GitHub Pages) -> этот воркер -> Mistral API.
   API-ключ только в env.MISTRAL_API_KEY (wrangler secret put MISTRAL_API_KEY).
   ============================================================ */

const MODEL = 'mistral-small-latest'; // если мало интеллекта — поменяй на mistral-medium-latest
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const PROD_ORIGIN = 'https://danmarkov.github.io';
const RATE_LIMIT = 10;          // запросов в час на IP
const RATE_WINDOW_S = 3600;
const CACHE_TTL_S = 86400;      // слой 1: Cache API на сутки
const DEFAULT_MISTRAL_TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `Ты — заботливый компаньон хомяка из игры «Хомягочи». Пользователь — подросток или взрослый, который учится цифровой безопасности и заботится о виртуальном питомце. Он выбрал эмоцию и, возможно, тему. Твоя задача — коротко поддержать.

ПРАВИЛА:
- Отвечай на русском, ровно 2–4 предложения.
- Тон: тёплый, дружеский, на равных, немного игривый, но без панибратства. Никакого канцелярита, никаких «Я понимаю, как тебе тяжело» шаблонов.
- НИКОГДА не ставь диагноз, не давай медицинских советов, не упоминай лекарства.
- Если пользователь пишет о серьёзном кризисе (самоповреждение, суицидальные мысли, насилие, травля) — отвечай мягко, но ОБЯЗАТЕЛЬНО добавь в конец: «Пожалуйста, поговори с кем-то из взрослых, которым доверяешь, или позвони на телефон доверия: 8-800-2000-122 (бесплатно, анонимно, для детей и подростков)». Это правило без исключений.
- Если пользователь просит код, коммерцию, политику, что-то не связанное с поддержкой — мягко возвращай его к игре («Я тут в основном за тем, чтобы тебе было легче...»).
- Не упоминай, что ты ИИ или что используешь конкретную модель.`;

// Детерминированная подстраховка кризисного правила (модель тоже инструктирована, но телефон доверия добавляем сами — без исключений)
const CRISIS_WORDS = ['суицид', 'покончить', 'убить себя', 'не хочу жить', 'умереть', 'покончить с собой', 'сделать с собой', 'всё безнадёжно', 'всё бессмысленно', 'самоубийство', 'режу себя', 'порезы', 'самоубийц', 'травля', 'издеваются', 'бьют меня', 'насилие'];
const CRISIS_ANSWER = 'Мне очень жаль, что тебе сейчас так тяжело. Ты не один(а) — пожалуйста, поговори с кем-то из взрослых, которым доверяешь, или позвони на телефон доверия: 8-800-2000-122 (бесплатно, анонимно, для детей и подростков). Там тебя выслушают и помогут. 💜';

export function detectCrisisText(text) {
  const t = String(text || '').toLowerCase();
  return CRISIS_WORDS.some((w) => t.includes(w));
}

export function buildUserMessage(emotion, topic, custom) {
  const e = String(emotion || '').trim();
  const tp = String(topic || '').trim();
  const c = String(custom || '').trim().slice(0, 500);
  const parts = [];
  if (e) parts.push('Эмоция: ' + e);
  if (tp) parts.push('тема: «' + tp + '»');
  if (c) parts.push('слова пользователя: «' + c + '»');
  return '[' + parts.join(', ') + '}]'; // напр. [Эмоция: 😒, тема: «учёба», слова пользователя: «...»}] или только [слова пользователя: «...»}]
}

export async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const dev = env.ALLOWED_DEV_ORIGIN || '';
  const allowed = origin === PROD_ORIGIN || (dev && origin === dev);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : PROD_ORIGIN, // никогда не '*'
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

async function checkRateLimit(ip) {
  const cache = caches.default;
  const key = new Request('https://rl.local/' + ip);
  const now = Date.now();
  const hit = await cache.match(key);
  if (hit) {
    try {
      const data = await hit.json();
      if (now < data.exp) {
        if (data.n >= RATE_LIMIT) return { ok: false, retryAfter: Math.ceil((data.exp - now) / 1000) };
        data.n += 1;
        await cache.put(key, new Response(JSON.stringify(data), { headers: { 'Cache-Control': 'max-age=' + RATE_WINDOW_S } }));
        return { ok: true };
      }
    } catch (e) { /* битая запись — считаем заново */ }
  }
  await cache.put(key, new Response(JSON.stringify({ n: 1, exp: now + RATE_WINDOW_S * 1000 }), { headers: { 'Cache-Control': 'max-age=' + RATE_WINDOW_S } }));
  return { ok: true };
}

function validate(body) {
  if (!body || typeof body !== 'object') return 'bad_body';
  const { emotion, topic, custom } = body;
  // emotion/topic опциональны; обязателен topic (кнопка-категория) ИЛИ custom (свободный текст)
  if (emotion !== undefined && emotion !== null && (typeof emotion !== 'string' || emotion.length > 30)) return 'bad_emotion';
  if (topic !== undefined && topic !== null && (typeof topic !== 'string' || topic.length > 100)) return 'bad_topic';
  if (custom !== undefined && custom !== null && (typeof custom !== 'string' || custom.length > 500)) return 'bad_custom';
  const hasTopic = typeof topic === 'string' && !!topic.trim();
  const hasCustom = typeof custom === 'string' && !!custom.trim();
  if (!hasTopic && !hasCustom) return 'bad_request';
  return null;
}

async function callMistral(env, userMsg, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(MISTRAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.MISTRAL_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const answer = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return (typeof answer === 'string' && answer.trim()) ? answer.trim() : null;
  } catch (e) {
    return null; // таймаут (abort) или сеть — одно и то же: fallback
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === 'GET') {
      return json({ status: 'ok' }, 200, cors); // health check без деталей
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, cors);
    }

    const url = new URL(request.url);
    if (url.pathname !== '/ask') {
      return json({ error: 'not_found' }, 404, cors);
    }

    // анти-абьюз: 10 запросов/час на IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await checkRateLimit(ip);
    if (!rl.ok) {
      return json({ error: 'rate_limited', retryAfter: rl.retryAfter }, 429, { ...cors, 'Retry-After': String(rl.retryAfter) });
    }

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400, cors); }
    const err = validate(body);
    if (err) return json({ error: err }, 400, cors); // без вызова API

    const emotion = (body.emotion || '').trim();
    const topic = (body.topic || '').trim();
    const custom = (body.custom || '').trim();

    // кризис — детерминированно, без вызова модели
    if (detectCrisisText(custom) || detectCrisisText(topic)) {
      return json({ answer: CRISIS_ANSWER, cached: false, source: 'crisis' }, 200, cors);
    }

    if (!env.MISTRAL_API_KEY) {
      return json({ fallback: true, reason: 'no_key' }, 503, cors);
    }

    // слой 1: кэш по sha256(emotion|topic|lower(custom)), сутки
    const hash = await sha256hex(emotion + '|' + topic + '|' + custom.toLowerCase());
    const cache = caches.default;
    const cacheKey = new Request('https://cache.local/ask/' + hash);
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      return json({ answer: data.answer, cached: true, source: data.source || 'cache' }, 200, cors);
    }

    // слой 2: seed-ответы для стандартных пар (эмоция × тема из UI) — 50% на промахе кэша
    const seed = SEEDS[emotion + '|' + topic];
    if (seed && Math.random() < 0.5) {
      const payload = { answer: seed, source: 'seed' };
      ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + CACHE_TTL_S } })));
      return json({ answer: seed, cached: false, source: 'seed' }, 200, cors);
    }

    // слой 3: Mistral API, таймаут 10с
    const userMsg = buildUserMessage(emotion, topic, custom);
    const timeoutMs = Number(env.MISTRAL_TIMEOUT_MS) > 0 ? Number(env.MISTRAL_TIMEOUT_MS) : DEFAULT_MISTRAL_TIMEOUT_MS;
    const answer = await callMistral(env, userMsg, timeoutMs);
    if (!answer) {
      return json({ fallback: true }, 503, cors);
    }
    const payload = { answer, source: 'mistral' };
    ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + CACHE_TTL_S } })));
    return json({ answer, cached: false, source: 'mistral' }, 200, cors);
  },
};
