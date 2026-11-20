// help-ask — edge-прокси раздела «Помощь» (Supabase Edge Functions, рантайм Deno — open source).
// Клиент (GitHub Pages) -> https://<project-ref>.supabase.co/functions/v1/help-ask -> Mistral API.
// API-ключ только в секрете: supabase secrets set MISTRAL_API_KEY=...
// Деплой: supabase functions deploy help-ask --no-verify-jwt
//   (без --no-verify-jwt функция требует anon-JWT; наша защита — CORS + rate limit в _shared/proxy.js)
import { handleRequest, createStore } from '../_shared/proxy.js';

const store = createStore(); // in-memory кэш/rate-limit на isolate

Deno.serve((req: Request) =>
  handleRequest(
    req,
    {
      MISTRAL_API_KEY: Deno.env.get('MISTRAL_API_KEY') ?? '',
      ALLOWED_DEV_ORIGIN: Deno.env.get('ALLOWED_DEV_ORIGIN') ?? '', // например, http://localhost:5500
      MISTRAL_TIMEOUT_MS: Deno.env.get('MISTRAL_TIMEOUT_MS') ?? '',
    },
    store,
    { expectedPath: null }, // Supabase сам маршрутизирует на /functions/v1/help-ask
  ),
);
