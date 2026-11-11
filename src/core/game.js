export function todayStr() { return new Date().toDateString(); }

export function gainXP(state, n) {
  state.xp += n;
  const today = todayStr();
  if (state.dailyXpDay !== today) { state.dailyXp = 0; state.dailyXpDay = today; }
  state.dailyXp = (state.dailyXp || 0) + n;
  const ups = [];
  while (state.xp >= 10) {
    state.xp -= 10; state.lvl++; state.coins += 20;
    ups.push(state.lvl);
  }
  return ups;
}

export function dayCheck(state, log) {
  const today = todayStr();
  if (state.lastDay !== today) {
    state.streak = state.lastDay ? state.streak + 1 : 1;
    state.lastDay = today;
    state.dailyXp = 0; state.dailyXpDay = today;
    if (log) log('📅 день ' + state.streak + ' серии!');
  }
  return state;
}

export function addCoins(state, n) { state.coins = Math.max(0, state.coins + n); }

export function owns(state, id) { return state.owned.indexOf(id) !== -1; }

export function buy(state, item, type) {
  if (type === 'item') {
    if (state.coins < item.price) return { ok: false, reason: 'poor' };
    state.coins -= item.price;
    if (!state.items) state.items = { wifi: 0, cold: 0, key: 0, hint: 0 };
    state.items[item.key] = (state.items[item.key] || 0) + 1;
    return { ok: true, action: 'item', item };
  }
  if (type === 'food') {
    if (state.coins < item.price) return { ok: false, reason: 'poor' };
    state.coins -= item.price;
    return { ok: true, action: 'consume', item };
  }
  if (owns(state, item.id)) {
    state.equipped[type] = item.id;
    return { ok: true, action: 'equip' };
  }
  if (state.coins < item.price) return { ok: false, reason: 'poor' };
  state.coins -= item.price;
  state.owned.push(item.id);
  state.equipped[type] = item.id;
  return { ok: true, action: 'buy' };
}

export function habitDone(state, id) {
  const st = state.habitState[id];
  return !!(st && st.lastDay === todayStr());
}

export function toggleHabit(state, id, checked) {
  if (!state.habitState[id]) state.habitState[id] = { streak: 0, lastDay: '' };
  const st = state.habitState[id];
  const res = { xp: 0, coins: 0 };
  if (checked) {
    st.lastDay = todayStr(); st.streak++;
    res.xp = 2; res.coins = 3;
    state.mood = Math.min(100, state.mood + 4);
    gainXP(state, res.xp); addCoins(state, res.coins);
  } else {
    st.lastDay = ''; st.streak = Math.max(0, st.streak - 1);
  }
  return res;
}

export function logMood(state, m) {
  state.moodLog.push({ d: todayStr(), m });
  if (state.moodLog.length > 60) state.moodLog.shift();
}

/* ============ RATING (рейтинг кибербезопасности, см. статью: компоненты «очки, уровни, аватары, рейтинги») ============ */

export function recordAnswer(state, correct) {
  if (!state.stats) state.stats = { correct: 0, total: 0 };
  state.stats.total++;
  if (correct) state.stats.correct++;
  return state.stats;
}

export const RANKS = [
  { min: 0, title: 'Новичок', icon: '🌱' },
  { min: 60, title: 'Любитель', icon: '🔍' },
  { min: 75, title: 'Знаток', icon: '🛡️' },
  { min: 90, title: 'Эксперт', icon: '🏅' },
  { min: 95, title: 'Мастер киберзащиты', icon: '👑' }
];

export function accuracy(state) {
  const st = state.stats || { correct: 0, total: 0 };
  if (!st.total) return null;
  return Math.round((st.correct / st.total) * 100);
}

export function securityRank(state) {
  const pct = accuracy(state);
  if (pct === null) {
    return { pct: null, title: RANKS[0].title, icon: RANKS[0].icon, next: RANKS[1].min, nextTitle: RANKS[1].title, progress: 0 };
  }
  let cur = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (pct >= RANKS[i].min) cur = RANKS[i];
    else { next = RANKS[i]; break; }
  }
  const progress = next ? Math.min(100, Math.round(((pct - cur.min) / (next.min - cur.min)) * 100)) : 100;
  return { pct, title: cur.title, icon: cur.icon, next: next ? next.min : null, nextTitle: next ? next.title : null, progress };
}

/* ============ AUDIENCE PERSONALIZATION (статья: сценарии персонализируются под школьников, студентов и старшее поколение) ============ */

export function eventsForAudience(events, audience) {
  const all = events || [];
  const pool = all.filter((e) => !e.aud || !e.aud.length || e.aud.indexOf(audience) !== -1);
  return pool.length ? pool : all;
}

/* ============ PUSH-АЛЕРТЫ О СОСТОЯНИИ ПИТОМЦА (статья: push-уведомления о состоянии питомца) ============ */

export function petAlert(state, ps) {
  if (ps === 'sick' || (state.health || 0) < 30) {
    return { title: 'Хори плохо себя чувствует! 🤒', body: 'Здоровье на исходе — поиграй с ним в разделе «Играть» и пройди урок!' };
  }
  if ((state.sec || 0) < 30) {
    return { title: 'Хори в опасности! ⚠️', body: 'Низкий уровень безопасности: пройди задание против мошенников в «Игре».' };
  }
  if ((state.mood || 0) < 30) {
    return { title: 'Хори скучает... 💜', body: 'Отметь привычки и загляни в «Помощь» — он будет рад!' };
  }
  return null;
}

/* ============ ITEMS / БУФФЫ (айтемы магазина, применяются в игре) ============ */

export const WIFI_RE = /wi-?fi|публичн|общедоступн|open\s*wi-?fi/i;

export function isWifiEvent(ev) {
  const text = ((ev.id || '') + ' ' + (ev.cat || '') + ' ' + (ev.q || ''));
  return WIFI_RE.test(text);
}

export function itemCount(state, key) {
  return (state.items && state.items[key]) || 0;
}

/* Использовать 1 шт. aitема из инвентаря; now — ms. Возвращает { ok, key } */
export function useItem(state, key, now = Date.now()) {
  if (!state.items || !state.items[key]) return { ok: false, reason: 'none' };
  state.items[key]--;
  if (!state.buffs) state.buffs = { wifiUntil: 0, coldLeft: 0 };
  if (key === 'wifi') state.buffs.wifiUntil = now + 24 * 3600 * 1000; // 24 ч
  if (key === 'cold') state.buffs.coldLeft = 3; // 3 следующих сценария
  return { ok: true, key };
}

export function wifiBuffActive(state, now = Date.now()) {
  return !!(state.buffs && state.buffs.wifiUntil && state.buffs.wifiUntil > now);
}

export function coldBuffLeft(state) {
  return (state.buffs && state.buffs.coldLeft) || 0;
}

/* Активные эффекты для HUD: [{ key, sprite, label }] */
export function activeBuffs(state, now = Date.now()) {
  const out = [];
  if (wifiBuffActive(state, now)) {
    const ms = state.buffs.wifiUntil - now;
    const h = Math.floor(ms / 3600000);
    const m = Math.ceil((ms % 3600000) / 60000);
    out.push({ key: 'wifi', sprite: 'wifi_icon', label: (h > 0 ? h + 'ч' : '') + (m > 0 ? (h > 0 ? ' ' : '') + m + 'м' : '') || '24ч' });
  }
  const cold = coldBuffLeft(state);
  if (cold > 0) out.push({ key: 'cold', sprite: 'cold_icon', label: '×' + cold });
  const keys = itemCount(state, 'key');
  if (keys > 0) out.push({ key: 'key', sprite: 'key_icon', label: '×' + keys });
  return out;
}

export function answerEvent(state, ev, idx) {
  const correct = idx === ev.ok;
  recordAnswer(state, correct);
  if (correct) {
    state.sec = Math.min(100, state.sec + 10);
    state.mood = Math.min(100, state.mood + 5);
    addCoins(state, 10);
    gainXP(state, ev.xp || 5);
  } else {
    state.sec = Math.max(0, state.sec - 12);
    state.health = Math.max(0, state.health - 5);
  }
  return correct;
}

export function moodAvg(log, n = 7) {
  const days = {};
  log.slice(-60).forEach((e) => {
    if (!days[e.d]) days[e.d] = [];
    days[e.d].push(e.m);
  });
  const dayMeans = Object.values(days)
    .map((vals) => vals.reduce((a, b) => a + b, 0) / vals.length)
    .slice(-n);
  if (!dayMeans.length) return null;
  return dayMeans.reduce((a, b) => a + b, 0) / dayMeans.length;
}

export function dailyGoalProgress(state, goalXp) {
  if (state.dailyXpDay !== todayStr()) return 0;
  return Math.min(100, Math.round((state.dailyXp || 0) / goalXp * 100));
}
