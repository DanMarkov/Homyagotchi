const SAVE_KEY = 'khomyagochi_pixel';
const SAVE_VERSION = 2;

const DEFAULT_STATE = () => ({
  version: SAVE_VERSION,
  health: 80, sec: 60, mood: 70,
  coins: 30, lvl: 1, xp: 0, streak: 0,
  lastDay: '',
  frozenStreak: 0,
  dailyXp: 0, dailyXpDay: '',
  habits: [], habitState: {},
  moodLog: [],
  lessons: {},
  owned: ['hat_none', 'wall_rose'],
  equipped: { hat: 'hat_none', wall: 'wall_rose' }
});

const MIGRATIONS = {
  1: (s) => {
    s.version = 2;
    if (!s.frozenStreak) s.frozenStreak = 0;
    if (s.dailyXp === undefined) { s.dailyXp = 0; s.dailyXpDay = ''; }
    if (!s.lessons) s.lessons = {};
    return s;
  }
};

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE();
  let s = Object.assign(DEFAULT_STATE(), raw);
  const v = raw.version || 1;
  let cur = v;
  while (cur < SAVE_VERSION) {
    s = (MIGRATIONS[cur] || ((x) => x))(s);
    cur = s.version;
  }
  return s;
}

export function load() {
  try {
    const d = localStorage.getItem(SAVE_KEY);
    return d ? migrate(JSON.parse(d)) : DEFAULT_STATE();
  } catch (e) {
    return DEFAULT_STATE();
  }
}

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}

export function freshState() { return DEFAULT_STATE(); }
export { SAVE_VERSION, SAVE_KEY, migrate, DEFAULT_STATE, MIGRATIONS };
