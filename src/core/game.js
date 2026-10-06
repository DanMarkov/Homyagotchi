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

export function answerEvent(state, ev, idx) {
  const correct = idx === ev.ok;
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
