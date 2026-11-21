import SEEDS from './seeds.json' with { type: 'json' };

/* ============================================================
   help-ask — общий обработчик edge-прокси «Помощь» в Хомягочи
   (чистый Web Fetch API: Request/Response/fetch/crypto.subtle).
   Основной хост: Supabase Edge Function (supabase/functions/help-ask/index.ts,
   рантайм Deno — open source, Apache-2.0). Тот же код лежит в Cloudflare Worker (worker/).
   Клиент (GitHub Pages) -> этот прокси -> Mistral API.
   API-ключ ТОЛЬКО в секрете платформы: supabase secrets set MISTRAL_API_KEY
   (для Cloudflare — wrangler secret put MISTRAL_API_KEY). В репозитории ключа нет.
   ============================================================ */

export const MODEL = 'mistral-small-latest'; // если мало интеллекта — поменяй на mistral-medium-latest
export const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
export const PROD_ORIGIN = 'https://danmarkov.github.io';
export const RATE_LIMIT = 10;          // запросов в час на IP
export const RATE_WINDOW_S = 3600;
export const CACHE_TTL_S = 86400;      // слой 1: Cache API на сутки
export const DEFAULT_MISTRAL_TIMEOUT_MS = 10000;

export const SYSTEM_PROMPT = `Ты — заботливый компаньон хомяка из игры «Хомягочи». Пользователь — подросток или взрослый, который учится цифровой безопасности и заботится о виртуальном питомце. Он выбрал эмоцию и, возможно, тему. Твоя задача — коротко поддержать.

ПРАВИЛА:
- Отвечай на русском, ровно 2–4 предложения.
- Тон: тёплый, дружеский, на равных, немного игривый, но без панибратства. Никакого канцелярита, никаких «Я понимаю, как тебе тяжело» шаблонов.
- НИКОГДА не ставь диагноз, не давай медицинских советов, не упоминай лекарства.
- Если пользователь пишет о серьёзном кризисе (самоповреждение, суицидальные мысли, насилие, травля) — отвечай мягко, но ОБЯЗАТЕЛЬНО добавь в конец: «Пожалуйста, поговори с кем-то из взрослых, которым доверяешь, или позвони на телефон доверия: 8-800-2000-122 (бесплатно, анонимно, для детей и подростков)». Это правило без исключений.
- Если пользователь просит код, коммерцию, политику, что-то не связанное с поддержкой — мягко возвращай его к игре («Я тут в основном за тем, чтобы тебе было легче...»).
- Не упоминай, что ты ИИ или что используешь конкретную модель.`;

// Детерминированная подстраховка кризисного правила (модель тоже инструктирована, но телефон доверия добавляем сами — без исключений)
export const CRISIS_WORDS = ['суицид', 'покончить', 'убить себя', 'не хочу жить', 'умереть', 'покончить с собой', 'сделать с собой', 'всё безнадёжно', 'всё бессмысленно', 'самоубийство', 'режу себя', 'порезы', 'самоубийц', 'травля', 'издеваются', 'бьют меня', 'насилие'];
export const CRISIS_ANSWER = 'Мне очень жаль, что тебе сейчас так тяжело. Ты не один(а) — пожалуйста, поговори с кем-то из взрослых, которым доверяешь, или позвони на телефон доверия: 8-800-2000-122 (бесплатно, анонимно, для детей и подростков). Там тебя выслушают и помогут. 💜';

/* ===== i18n (RU/EN/FR): клиент передаёт lang в теле запроса; по умолчанию ru ===== */
export const LANGS = ['ru', 'en', 'fr'];
export function normLang(l) {
  const s = String(l || '').slice(0, 2).toLowerCase();
  return LANGS.includes(s) ? s : 'ru';
}
const LANG_LINE = {
  ru: 'на русском, ровно 2–4 предложения.',
  en: 'in English, exactly 2–4 sentences.',
  fr: 'en français, exactement 2 à 4 phrases.',
};
export function systemPromptFor(lang) {
  const l = normLang(lang);
  if (l === 'ru') return SYSTEM_PROMPT;
  const base = SYSTEM_PROMPT.replace(LANG_LINE.ru, LANG_LINE[l]);
  const extra = l === 'en'
    ? "\nIMPORTANT: the user's interface language is English (lang=en) — your reply MUST be in English, never switch to another language."
    : "\nIMPORTANT : la langue de l'interface de l'utilisateur est le français (lang=fr) — ta réponse DOIT être en français, ne passe jamais à une autre langue.";
  return base + extra;
}
export const CRISIS_WORDS_BY_LANG = {
  ru: CRISIS_WORDS,
  en: ['suicide', 'kill myself', 'end my life', "i don't want to live", 'want to die', 'self-harm', 'self harm', 'hurt myself', 'no reason to live', 'everything is over', 'better off dead', 'suicidal'],
  fr: ['suicide', 'me suicider', 'mettre fin à mes jours', 'je ne veux pas vivre', 'envie de mourir', 'me faire du mal', 'automutilation', 'plus envie de vivre', 'tout est fini pour toujours', 'suicidaire', 'pensées suicidaires'],
};
export const CRISIS_ANSWER_BY_LANG = {
  ru: CRISIS_ANSWER,
  en: "I'm really glad you told me this. You are not alone — please talk to an adult you trust, or call a helpline: 8-800-2000-122 (Russia, free, anonymous, for kids and teens) or 988 Suicide & Crisis Lifeline (24/7). I'm right here with you. 💜",
  fr: "Merci beaucoup de me l'avoir dit. Tu n'es pas seul(e) — parle à un adulte de confiance, ou appelle un numéro d'écoute : 8-800-2000-122 (Russie, gratuit, anonyme, pour enfants et ados) ou le 3114, numéro national de prévention du suicide (24h/24, gratuit). Je reste avec toi. 💜",
};
const MSG_LABELS = {
  ru: { emotion: 'Эмоция', topic: 'тема', custom: 'слова пользователя' },
  en: { emotion: 'Emotion', topic: 'topic', custom: "user's words" },
  fr: { emotion: 'Émotion', topic: 'sujet', custom: "mots de l'utilisateur" },
};

export function detectCrisisText(text, lang = 'ru') {
  const t = String(text || '').toLowerCase();
  const words = CRISIS_WORDS_BY_LANG[normLang(lang)] || CRISIS_WORDS;
  return words.some((w) => t.includes(w));
}

export function buildUserMessage(emotion, topic, custom, lang = 'ru') {
  const L = MSG_LABELS[normLang(lang)] || MSG_LABELS.ru;
  const e = String(emotion || '').trim();
  const tp = String(topic || '').trim();
  const c = String(custom || '').trim().slice(0, 500);
  const parts = [];
  if (e) parts.push(L.emotion + ': ' + e);
  if (tp) parts.push(L.topic + ': «' + tp + '»');
  if (c) parts.push(L.custom + ': «' + c + '»');
  return '[' + parts.join(', ') + '}]'; // напр. [Эмоция: 😒, тема: «учёба», слова пользователя: «...»}] или только [слова пользователя: «...»}]
}

export async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function corsHeaders(request, env) {
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

export function validate(body) {
  if (!body || typeof body !== 'object') return 'bad_body';
  const { emotion, topic, custom } = body;
  // emotion/topic опциональны; обязателен topic (кнопка-категория) ИЛИ custom (свободный текст)
  if (emotion !== undefined && emotion !== null && (typeof emotion !== 'string' || emotion.length > 30)) return 'bad_emotion';
  if (topic !== undefined && topic !== null && (typeof topic !== 'string' || topic.length > 100)) return 'bad_topic';
  if (custom !== undefined && custom !== null && (typeof custom !== 'string' || custom.length > 500)) return 'bad_custom';
  if (body.lang !== undefined && body.lang !== null && (typeof body.lang !== 'string' || body.lang.length > 5)) return 'bad_lang';
  const hasTopic = typeof topic === 'string' && !!topic.trim();
  const hasCustom = typeof custom === 'string' && !!custom.trim();
  if (!hasTopic && !hasCustom) return 'bad_request';
  return null;
}

export async function callMistral(env, userMsg, timeoutMs, lang = 'ru') {
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
          { role: 'system', content: systemPromptFor(lang) },
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

/* In-memory хранилище (кэш ответов + rate limit) на один isolate edge-функции.
   Для масштаба игры достаточно; при холодном старте isolate кэш просто пустой. */
export function createStore(now = () => Date.now()) {
  const cache = new Map(); // hash -> { payload, exp }
  const rl = new Map();    // ip -> { n, exp }
  return {
    cacheGet(hash) {
      const e = cache.get(hash);
      if (!e) return null;
      if (now() > e.exp) { cache.delete(hash); return null; }
      return e.payload;
    },
    cachePut(hash, payload) { cache.set(hash, { payload, exp: now() + CACHE_TTL_S * 1000 }); },
    rlCheck(ip) {
      const t = now();
      const e = rl.get(ip);
      if (e && t < e.exp) {
        if (e.n >= RATE_LIMIT) return { ok: false, retryAfter: Math.ceil((e.exp - t) / 1000) };
        e.n += 1;
        return { ok: true };
      }
      rl.set(ip, { n: 1, exp: t + RATE_WINDOW_S * 1000 });
      return { ok: true };
    },
  };
}

function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for'); // Supabase edge
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('CF-Connecting-IP') || 'unknown'; // Cloudflare
}

/* req: Request; env: { MISTRAL_API_KEY?, ALLOWED_DEV_ORIGIN?, MISTRAL_TIMEOUT_MS? } (plain object);
   store: createStore(); opts.expectedPath: '/ask' по умолчанию, null — не проверять путь
   (Supabase сам маршрутизирует на /functions/v1/<name>). */
export async function handleRequest(request, env = {}, store = createStore(), opts = {}) {
  const cors = corsHeaders(request, env);
  const expectedPath = opts.expectedPath === undefined ? '/ask' : opts.expectedPath;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method === 'GET') {
    return json({ status: 'ok' }, 200, cors); // health check без деталей
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, cors);
  }

  if (expectedPath) {
    const url = new URL(request.url);
    if (url.pathname !== expectedPath) {
      return json({ error: 'not_found' }, 404, cors);
    }
  }

  // анти-абьюз: 10 запросов/час на IP
  const rl = store.rlCheck(clientIp(request));
  if (!rl.ok) {
    return json({ error: 'rate_limited', retryAfter: rl.retryAfter }, 429, { ...cors, 'Retry-After': String(rl.retryAfter) });
  }

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400, cors); }
  const err = validate(body);
  if (err) return json({ error: err }, 400, cors); // 400 без вызова API

  const emotion = (body.emotion || '').trim();
  const topic = (body.topic || '').trim();
  const custom = (body.custom || '').trim();
  const lang = normLang(body.lang);

  // кризис — детерминированно, без вызова модели
  if (detectCrisisText(custom, lang) || detectCrisisText(topic, lang)) {
    return json({ answer: CRISIS_ANSWER_BY_LANG[lang] || CRISIS_ANSWER, cached: false, source: 'crisis' }, 200, cors);
  }

  if (!env.MISTRAL_API_KEY) {
    return json({ fallback: true, reason: 'no_key' }, 503, cors);
  }

  // слой 1: кэш по sha256(emotion|topic|lower(custom)), сутки
  const hash = await sha256hex(lang + '|' + emotion + '|' + topic + '|' + custom.toLowerCase()); // lang в ключе: ru/en/fr не смешиваем
  const cached = store.cacheGet(hash);
  if (cached) {
    return json({ answer: cached.answer, cached: true, source: cached.source || 'cache' }, 200, cors);
  }

  // слой 2: seed-ответы для стандартных пар (эмоция × тема из UI) — 50% на промахе кэша
  const seed = SEEDS[emotion + '|' + topic];
  if (seed && Math.random() < 0.5) {
    store.cachePut(hash, { answer: seed, source: 'seed' });
    return json({ answer: seed, cached: false, source: 'seed' }, 200, cors);
  }

  // слой 3: Mistral API, таймаут 10с
  const userMsg = buildUserMessage(emotion, topic, custom, lang);
  const timeoutMs = Number(env.MISTRAL_TIMEOUT_MS) > 0 ? Number(env.MISTRAL_TIMEOUT_MS) : DEFAULT_MISTRAL_TIMEOUT_MS;
  const answer = await callMistral(env, userMsg, timeoutMs, lang);
  if (!answer) {
    return json({ fallback: true }, 503, cors);
  }
  store.cachePut(hash, { answer, source: 'mistral' });
  return json({ answer, cached: false, source: 'mistral' }, 200, cors);
}
