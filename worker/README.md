# homyag-help-proxy — Cloudflare Worker (прокси для раздела «Помощь»)

> Основной open-source хост прокси — Supabase Edge Function (`supabase/functions/help-ask`, см. раздел «Помощь» в основном README). Этот Cloudflare Worker — запасной вариант того же обработчика.


Принимает `POST /ask` от статического сайта (GitHub Pages) и проксирует запросы в Mistral API.
**API-ключ и системный промпт живут только здесь** — в клиентском коде игры их нет.

> Раздел помощи использует генеративную модель Mistral (открытые веса) через собственный прокси; при недоступности — офлайн-заготовки.

## Деплой

```bash
cd worker
npm install -g wrangler        # если ещё не установлен
wrangler login
wrangler secret put MISTRAL_API_KEY   # ключ из console.mistral.ai, НЕ коммитится
wrangler deploy                        # → https://homyag-help-proxy.<subdomain>.workers.dev
```

После деплоя пропиши полученный URL в `HELP_AI_URL` в `../src/ui/support.js`
(сейчас там placeholder `https://homyag-help-proxy.workers.dev/ask`).

Для локальной разработки воркер разрешит дополнительный origin через секрет:

```bash
wrangler secret put ALLOWED_DEV_ORIGIN   # например, http://localhost:5500
```

## Поведение

- `GET /` → `200 {"status":"ok"}` (health check); любой метод кроме POST/GET/OPTIONS → 405; не `/ask` → 404.
- `POST /ask` принимает `{emotion, topic, custom?}`; невалидный вход → 400 без вызова API (`custom` ≤ 500 символов).
- Rate limit: 10 запросов/час на IP (Cache API) → `429 {"error":"rate_limited"}` + `Retry-After`.
- CORS: `Access-Control-Allow-Origin` строго `https://danmarkov.github.io` (или `ALLOWED_DEV_ORIGIN`), никогда `*`.
- Таймаут запроса к Mistral — 10 с (abort) → `503 {"fallback":true}`; пустой ответ/ошибка API → тоже 503; нет ключа → `503 {"fallback":true, reason:"no_key"}`.
- Кризисный текст (суицид/самоповреждение/насилие) → детерминированный ответ с телефоном доверия **8-800-2000-122** без вызова модели (`source:"crisis"`).
- Кэш: `sha256(emotion|topic|lower(custom))` в Cache API (max-age 86400) → `cached:true`; для стандартных пар «эмоция × тема» из `src/seeds.json` — 50 % на промахе кэша отдаётся seed (`source:"seed"`), остальное — `source:"mistral"`.
- Модель: `mistral-small-latest`, `POST https://api.mistral.ai/v1/chat/completions`, `temperature: 0.7`, `max_tokens: 200`; системный промпт — в `src/index.js`.

## Локальные тесты

```bash
node --test tests/worker.test.js   # из корня репозитория, со стабами caches/fetch
```
