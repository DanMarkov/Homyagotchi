import { SAVE_VERSION, migrate } from './store.js';

const KEY_URL = 'SUPABASE_URL';
const KEY_ANON = 'SUPABASE_ANON_KEY';

export function isCloudConfigured() {
  return !!(window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__);
}

function headers(anonKey, token) {
  const h = {
    'Content-Type': 'application/json',
    'apikey': anonKey
  };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function api(path, opts) {
  const url = window.__SUPABASE_URL__ + '/rest/v1/' + path;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error('Supabase ' + res.status);
  return res;
}

let session = null;

export async function initAuth() {
  if (!isCloudConfigured()) return null;
  const res = await fetch(window.__SUPABASE_URL__ + '/auth/v1/user', {
    headers: headers(window.__SUPABASE_ANON_KEY__, session?.access_token)
  });
  if (res.ok) {
    session = await res.json();
    return session;
  }
  return null;
}

export async function signIn(email, password) {
  const res = await fetch(window.__SUPABASE_URL__ + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: headers(window.__SUPABASE_ANON_KEY__),
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('Неверный email или пароль');
  session = await res.json();
  return session;
}

export async function signUp(email, password) {
  const res = await fetch(window.__SUPABASE_URL__ + '/auth/v1/signup', {
    method: 'POST',
    headers: headers(window.__SUPABASE_ANON_KEY__),
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.msg || 'Не удалось зарегистрироваться');
  }
  session = await res.json();
  return session;
}

export async function signOut() {
  if (session?.access_token) {
    await fetch(window.__SUPABASE_URL__ + '/auth/v1/logout', {
      method: 'POST',
      headers: headers(window.__SUPABASE_ANON_KEY__, session.access_token)
    }).catch(() => {});
  }
  session = null;
}

export async function cloudSave(state) {
  if (!session?.access_token) throw new Error('not signed in');
  const payload = { data: sanitize(state), version: SAVE_VERSION };
  await api('saves', {
    method: 'POST',
    headers: headers(window.__SUPABASE_ANON_KEY__, session.access_token),
    body: JSON.stringify(payload),
    prefer: 'resolution=merge-duplicates'
  });
  return true;
}

export async function cloudLoad() {
  if (!session?.access_token) throw new Error('not signed in');
  const res = await api('saves?select=data,version&limit=1', {
    headers: headers(window.__SUPABASE_ANON_KEY__, session.access_token)
  });
  const rows = await res.json();
  if (!rows.length) return null;
  return migrate(rows[0].data);
}

export function getSession() { return session; }

function sanitize(state) {
  const copy = Object.assign({}, state);
  delete copy._sleepingOverride;
  delete copy._jumping;
  delete copy._eating;
  return copy;
}
