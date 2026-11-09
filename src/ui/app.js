import { load, save } from '../core/store.js?v=25';
import { tick, petState } from '../core/pet.js?v=25';
import { gainXP, dayCheck, owns, buy, habitDone, toggleHabit, logMood, answerEvent, moodAvg, eventsForAudience, securityRank, petAlert } from '../core/game.js?v=25';
import { sfx } from './audio.js?v=25';
import { renderMoodChart, ChatUI } from './support.js?v=25';
import { createSprite } from '../render/pixel-sprites.js?v=25';

const CONTENT = window.__CONTENT__;
const LESSONS = window.__LESSONS__;
const SHOP = window.__SHOP__;

const S = load();
const dailyGoal = CONTENT.dailyGoalXp || 10;
if (!S.habits || !S.habits.length) S.habits = CONTENT.habits.slice();

const els = (id) => document.getElementById(id);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let toastTimer = null;
function toast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3000);
}

function persist() { save(S); renderTopbar(); }

/* ============ PIXEL SPRITE HELPERS ============ */
function mountSprite(containerId, spriteName, ...args) {
  const container = els(containerId);
  if (!container) return;
  container.querySelectorAll('canvas').forEach(c => { if (c._stopAnimation) c._stopAnimation(); });
  container.innerHTML = '';
  const sprite = createSprite(spriteName, ...args);
  if (sprite) container.appendChild(sprite);
}

function mountDecorSprites() {
  // Слева: растение в горшке
  const left = els('roomDecorLeft');
  if (left) {
    left.innerHTML = '';
    ['plant'].forEach((name) => {
      const wrap = document.createElement('div');
      wrap.className = 'decor-item';
      const sprite = createSprite(name);
      if (sprite) wrap.appendChild(sprite);
      left.appendChild(wrap);
    });
  }
  // Справа в глубине: тумбочка с жёлтой лампой + кровать
  const right = els('roomDecorRight');
  if (right) {
    right.innerHTML = '';
    ['lamp', 'bed'].forEach((name) => {
      const wrap = document.createElement('div');
      wrap.className = 'decor-item';
      const sprite = createSprite(name);
      if (sprite) wrap.appendChild(sprite);
      right.appendChild(wrap);
    });
  }
}

function renderPetSprite() {
  // Главный экран: пиксель-арт «Хори за столом с ноутбуком» (синяя бабочка), как на эталоне
  mountSprite('petSpriteWrap', 'hori_desk');
}

/* Короткое подпрыгивание персонажа при клике по любой кнопке навигации */
function petJump() {
  const wrap = els('petSpriteWrap');
  // Jump/breathe only the hamster layer (.sprite-hori-top); the desk base layer stays perfectly still.
  const child = wrap ? (wrap.querySelector('.sprite-hori-top') || wrap.firstElementChild) : null;
  if (!child) return;
  child.classList.remove('pet-jump');
  void child.offsetWidth;
  child.classList.add('pet-jump');
}

function renderRoomIcons() {
  mountSprite('roomPlayIcon', 'play_icon', 3);
  mountSprite('roomStatsIcon', 'trophy_icon', 3);
  mountSprite('roomHabitsIcon', 'doc_icon', 3);
  mountSprite('roomShopIcon', 'cup_icon', 3);
  mountSprite('roomSupportIcon', 'book_icon', 3);
  mountSprite('roomTheoryIcon', 'book_icon', 2);
  mountSprite('roomSettingsIcon', 'gear_icon', 2);
  mountSprite('roomRug', 'rug', 4);
}

/* Плашка «новый раздел теории» — пока есть непройденные уроки */
function updateRoomNote() {
  const el = els('roomNote');
  if (!el) return;
  let total = 0;
  (LESSONS.courses || []).forEach((c) => (c.lessons || []).forEach(() => { total++; }));
  const seen = Object.keys(S.lessons || {}).length;
  el.classList.toggle('hidden', total === 0 || seen >= total);
}

function renderGameTools() {
  const tools = els('gameTools');
  if (!tools) return;
  tools.innerHTML = '';
  const defs = [
    { key: 'shield', sprite: 'shield', label: 'ЗАЩИТА<br>WI-FI', bg: 'var(--blue-soft)' },
    { key: 'cold', sprite: 'snowflake', label: 'ХОЛОДНЫЙ<br>РАЗУМ', bg: '#d4f0fa' },
    { key: 'key', sprite: 'key', label: 'ЗАЩИТНЫЙ<br>КЛЮЧ', bg: 'var(--yellow)' },
    { key: 'hint', sprite: 'question', label: 'ПОДСКАЗКА', bg: 'var(--purple)' }
  ];
  defs.forEach((d) => {
    const btn = document.createElement('button');
    btn.className = 'game-tool';
    btn.dataset.tool = d.key;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'gt-icon';
    iconWrap.style.background = d.bg;
    const sprite = createSprite(d.sprite);
    if (sprite) iconWrap.appendChild(sprite);
    const label = document.createElement('span');
    label.className = 'gt-label';
    label.innerHTML = d.label;
    btn.appendChild(iconWrap);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      const labels = { shield: '🛡️ Защитник Wi-Fi', cold: '❄️ Холодный разум', key: '🔑 Защитный ключ', hint: '❓ Подсказка' };
      toast(labels[d.key] + ' активирован!');
      sfx.click();
      if (d.key === 'hint' && currentEvent) {
        const fb = els('gameFeedback');
        fb.innerHTML = '<div class="lesson-feedback ok">💡 Подсказка: ' + currentEvent.tip + '</div>';
      }
    });
    tools.appendChild(btn);
  });
}

function renderTopbarSprites() {
  const heartsContainer = els('topHearts');
  if (heartsContainer) {
    heartsContainer.innerHTML = '';
    const count = Math.max(1, Math.ceil(S.health / 34));
    for (let i = 0; i < Math.min(count, 5); i++) {
      const h = createSprite('heart', 2);
      if (h) heartsContainer.appendChild(h);
    }
  }
  mountSprite('topCoinsIcon', 'coin', 2);
  mountSprite('topKpIcon', 'trophy_icon', 2);
  mountSprite('topLvlIcon', 'star', 2);
  mountSprite('gameKpIcon', 'trophy_icon', 2);
  mountSprite('gameClockIcon', 'clock_icon', 2);
  mountSprite('gameCoinsIcon', 'coin', 2);
  renderGameHearts();
}

/* ============ NAVIGATION ============ */
const SCREENS = ['audience', 'home', 'stats', 'habits', 'theory', 'game', 'shop', 'support', 'settings'];
const NAV_MAP = { home: 'home', habits: 'habits', theory: 'theory', game: 'game', shop: 'shop', support: 'support', stats: 'stats', settings: 'settings' };

function gotoScreen(name) {
  if (name === 'audience') return showAudience();
  document.body.classList.toggle('on-home', name === 'home');
  document.body.classList.toggle('on-game', name === 'game');
  updateRoomNote();
  SCREENS.forEach((s) => {
    const el = els('screen-' + s);
    if (el) el.classList.toggle('active', s === name);
  });
  $$('.bottom-nav .nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.goto === name);
  });
  if (name === 'stats') renderStats();
  if (name === 'habits') renderHabits();
  if (name === 'theory') renderTheory();
  if (name === 'game') startGame();
  if (name === 'shop') renderShop();
  if (name === 'support') {
    renderMoodChart(S, els('moodChart'));
    if (!chatUI) initChat();
  }
  if (name === 'home') { renderPetBubble(); renderPetSprite(); mountDecorSprites(); }
}

$$('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    sfx.click();
    petJump();
    gotoScreen(btn.dataset.goto);
  });
});

/* ============ TOP BAR ============ */
function renderTopbar() {
  els('topCoins').textContent = S.coins;
  els('topKp').textContent = S.lvl * 10 + S.xp;
  els('topLvl').textContent = S.lvl;
  els('gameKp').textContent = S.lvl * 10 + S.xp;
  const gc = els('gameCoins'); if (gc) gc.textContent = S.coins;
  renderTopbarSprites();
}

/* ============ AUDIENCE ============ */
function showAudience() {
  document.body.classList.remove('on-home');
  SCREENS.forEach((s) => {
    const el = els('screen-' + s);
    if (el) el.classList.toggle('active', s === 'audience');
  });
  $$('.bottom-nav .nav-item').forEach((b) => b.classList.remove('active'));
}

$$('.audience-card').forEach((card) => {
  card.addEventListener('click', () => {
    $$('.audience-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    S.audience = card.dataset.audience;
    sfx.click();
  });
});

els('btnStartGame').addEventListener('click', () => {
  const sel = $('.audience-card.selected');
  S.audience = sel ? sel.dataset.audience : 'student';
  S.onboarded = true;
  sfx.correct();
  persist();
  toast('Добро пожаловать, Хомя! 🐹');
  gotoScreen('home');
});

els('btnChangeAudience').addEventListener('click', () => {
  showAudience();
});

/* ============ PET BUBBLE ============ */
function petBubbleText() {
  const ps = petState(S);
  const msgs = {
    idle: ['Привет! Давай учиться! 👋', 'Готов к новым урокам? 📚', 'Не забудь про привычки! ✅'],
    eating: ['Ням-ням! Вкусно! 😋', 'Спасибо за заботу! ❤️'],
    jumping: ['Ура! Весело! 🎉', 'Ещё! Ещё! 🚀'],
    sleeping: ['Сладких снов... 💤', 'Хррр... не буди 😴'],
    sick: ['Мне плохо... 🤒', 'Покорми меня, пожалуйста!'],
    happy: ['Я счастлив! 😍', 'Лучший день! ✨']
  };
  const arr = msgs[ps] || msgs.idle;
  return arr[Math.floor(Math.random() * arr.length)];
}

function renderPetBubble() {
  const el = els('petBubble');
  if (el) el.textContent = petBubbleText();
}

/* ============ STATS ============ */
const ACHIEVEMENTS = [
  { id: 'first_lesson', icon: '🎓', name: 'Первый урок', check: (s) => Object.keys(s.lessons || {}).length > 0 },
  { id: 'streak3', icon: '🔥', name: '3 дня подряд', check: (s) => s.streak >= 3 },
  { id: 'lvl5', icon: '⭐', name: '5 уровень', check: (s) => s.lvl >= 5 },
  { id: 'habits10', icon: '✅', name: '10 привычек выполнено', check: (s) => Object.values(s.habitState || {}).reduce((a, h) => a + (h.streak || 0), 0) >= 10 },
  { id: 'coins100', icon: '🪙', name: '100 монет', check: (s) => s.coins >= 100 },
  { id: 'mood5', icon: '💜', name: '5+ записей настроения', check: (s) => (s.moodLog || []).length >= 5 },
  { id: 'wifi', icon: '🛡️', name: 'Защити Wi-Fi', check: (s) => s.sec >= 80 },
  { id: 'master', icon: '👑', name: 'Мастер безопасности', check: (s) => s.sec >= 100 && s.lvl >= 3 }
];

function renderStats() {
  const list = els('achievementList');
  list.innerHTML = '';
  ACHIEVEMENTS.forEach((a) => {
    const done = a.check(S);
    const div = document.createElement('div');
    div.className = 'achievement';
    div.innerHTML =
      '<span class="ach-icon ' + (done ? 'done' : 'locked') + '">' + (done ? '✓' : a.icon) + '</span>' +
      '<span class="ach-text">' + a.name + '</span>' +
      '<span class="ach-kp">+' + (done ? '10' : '??') + ' KP</span>';
    list.appendChild(div);
  });
  const items = els('itemsRow');
  items.innerHTML = '';
  (S.owned || []).forEach((id) => {
    const chip = document.createElement('div');
    chip.className = 'item-chip';
    const found = [...(SHOP.hats || []), ...(SHOP.walls || []), ...(SHOP.food || [])].find((i) => i.id === id);
    chip.textContent = found ? found.icon : '🎁';
    items.appendChild(chip);
  });
  const totalKp = S.lvl * 10 + S.xp;
  const pct = Math.min(100, totalKp);
  els('statsProgress').style.width = pct + '%';
  els('statsProgressText').textContent = totalKp + '/100 KP';
  els('statsStreak').textContent = '🔥 ' + (S.streak || 0) + ' ДНЕЙ';
  const r = securityRank(S);
  const rb = els('ratingBlock');
  if (rb) {
    const nextTxt = r.pct === null
      ? 'Ответь на задания в «Игре», чтобы получить рейтинг (метрика MVP: рост верных ответов 60→90%)'
      : (r.next === null ? 'Максимальное звание! 👑' : 'До звания «' + r.nextTitle + '» (' + r.next + '% верных): осталось ' + (r.next - r.pct) + ' п.п.');
    rb.innerHTML =
      '<div class="rank-head"><span class="rank-icon">' + r.icon + '</span>' +
      '<span class="rank-title">' + r.title + '</span>' +
      '<span class="rank-pct">' + (r.pct === null ? '—' : r.pct + '%') + '</span></div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + (r.pct === null ? 0 : r.progress) + '%"></div></div>' +
      '<div class="rank-next">' + nextTxt + '</div>';
    // иконка ранга 🏆 — единый пиксельный кубок (тот же trophy_icon, что в HUD и на кнопке Статистика)
    const rankIcon = rb.querySelector('.rank-icon');
    if (rankIcon && r.icon === '🏆') {
      rankIcon.textContent = '';
      const t = createSprite('trophy_icon', 2);
      if (t) rankIcon.appendChild(t);
    }
  }
  mountSprite('statsPet', 'hori_body', 3);
}

/* ============ HABITS / TODO ============ */
function renderHabits() {
  const list = els('todoList');
  list.innerHTML = '';
  S.habits.forEach((h) => {
    const done = habitDone(S, h.id);
    const div = document.createElement('div');
    div.className = 'todo-item' + (done ? ' done' : '');
    const cb = document.createElement('div');
    cb.className = 'todo-checkbox' + (done ? ' checked' : '');
    cb.textContent = done ? '✓' : '';
    cb.addEventListener('click', () => {
      toggleHabit(S, h.id, !done);
      if (!done) { sfx.correct(); toast('+2 XP +3 монеты'); }
      renderHabits();
      persist();
    });
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = h.emoji + ' ' + h.text;
    const reward = document.createElement('span');
    reward.className = 'todo-reward';
    reward.textContent = '+10 KP';
    div.appendChild(cb);
    div.appendChild(text);
    div.appendChild(reward);
    list.appendChild(div);
  });
  mountSprite('todoPet', 'hori_body', 3);
}

els('btnAddHabit').addEventListener('click', () => {
  const inp = els('newHabitInput');
  const txt = inp.value.trim();
  if (!txt) return;
  S.habits.push({ id: 'h_' + Date.now(), emoji: '⭐', text: txt });
  inp.value = '';
  renderHabits();
  save(S);
});

/* ============ THEORY ============ */
const THEORY_TOPICS = [
  { id: 'fingerprint', icon: '🔍', name: 'Цифровой отпечаток', danger: false, text: 'Сайты собирают уникальные данные о твоём браузере: версию, разрешение экрана, шрифты, плагины. Эта комбинация — как отпечаток пальца — позволяет идентифицировать и отслеживать тебя в интернете, даже без cookies. Используй режим инкогнито и ограничивай доступ к данным.' },
  { id: 'phishing', icon: '🛡️', name: 'Фишинг и мошенничество', danger: false, text: 'Фишинг — когда мошенники притворяются известным сервисом, чтобы украсть твои данные. Проверяй адрес сайта, не переходи по подозрительным ссылкам из писем и SMS. Банки никогда не просят коды из SMS.' },
  { id: 'scripts', icon: '⚠️', name: 'Вредоносные скрипты', danger: true, text: 'Вредоносные скрипты могут красть пароли, майнить криптовалюту на твоём устройстве или перенаправлять на фишинговые сайты. Устанавливай расширения только из официальных магазинов и держи браузер обновлённым.' },
  { id: 'exploits', icon: '➕', name: 'Эксплойты', danger: false, text: 'Эксплойты — это использование уязвимостей в программах для взлома. Регулярно обновляй ОС, браузер и приложения — большинство атак нацелены на известные, уже исправленные дыры.' },
  { id: 'dns', icon: '🌐', name: 'DNS и WebRTC', danger: false, text: 'DNS-запросы и WebRTC могут раскрывать твой реальный IP даже при использовании VPN. Отключи WebRTC в настройках браузера и используй надёжные DNS-серверы с шифрованием (DoH).' }
];

function renderTheory() {
  const topics = els('theoryTopics');
  topics.innerHTML = '';
  THEORY_TOPICS.forEach((t) => {
    const div = document.createElement('div');
    div.className = 'theory-topic' + (t.danger ? ' danger' : '');
    div.innerHTML =
      '<span class="tt-icon">' + t.icon + '</span>' +
      '<span>' + t.name + '</span>';
    div.addEventListener('click', () => {
      $$('.theory-topic').forEach((x) => x.classList.remove('active'));
      div.classList.add('active');
      const content = els('theoryContent');
      content.innerHTML = '<h3>' + t.icon + ' ' + t.name + '</h3><p>' + t.text + '</p>' +
        '<button class="btn btn-blue" style="margin-top:8px" data-start-lesson="' + t.id + '">▶ Пройти урок</button>';
      const btn = content.querySelector('[data-start-lesson]');
      btn.addEventListener('click', () => startLessonByTopic(t.id));
    });
    topics.appendChild(div);
  });
  if (!topics.querySelector('.active')) {
    topics.firstChild && topics.firstChild.classList.add('active');
    const t = THEORY_TOPICS[0];
    els('theoryContent').innerHTML = '<h3>' + t.icon + ' ' + t.name + '</h3><p>' + t.text + '</p>' +
      '<button class="btn btn-blue" style="margin-top:8px" data-start-lesson="' + t.id + '">▶ Пройти урок</button>';
    els('theoryContent').querySelector('[data-start-lesson]').addEventListener('click', () => startLessonByTopic(t.id));
  }
  mountSprite('theoryPet', 'hori_body', 3);
}

function startLessonByTopic(topicId) {
  els('theoryBrowse').classList.add('hidden');
  els('theoryRunner').classList.remove('hidden');
  const course = LESSONS.courses[0];
  const lessonMap = { fingerprint: 'phishing', phishing: 'phishing', scripts: 'social', exploits: 'passwords', dns: 'passwords' };
  const lessonId = lessonMap[topicId] || 'phishing';
  const lesson = course.lessons.find((l) => l.id === lessonId) || course.lessons[0];
  lessonUI.start(course, lesson, els('lessonRunner'));
}

/* ============ LESSON RUNNER ============ */
class LessonRunnerUI {
  constructor(lessons, state, { onSave, onToast }) {
    this.courses = lessons.courses;
    this.state = state;
    this.onSave = onSave;
    this.onToast = onToast;
    this.active = null;
  }

  start(course, lesson, container) {
    this.active = { course, lesson, idx: this.state.lessons[course.id + ':' + lesson.id] || 0, container };
    this.showScene();
  }

  showScene() {
    const { course, lesson, idx, container } = this.active;
    if (idx >= lesson.scenes.length) { this.finish(); return; }
    const sc = lesson.scenes[idx];
    container.innerHTML = '';
    const head = document.createElement('h4');
    head.textContent = course.emoji + ' ' + lesson.title + ' — сцена ' + (idx + 1) + '/' + lesson.scenes.length;
    container.appendChild(head);
    if (sc.text) {
      const p = document.createElement('p');
      p.className = 'l-text';
      p.textContent = sc.text;
      container.appendChild(p);
      const next = document.createElement('button');
      next.className = 'btn btn-blue btn-block';
      next.textContent = 'ДАЛЕЕ →';
      next.onclick = () => this.advance();
      container.appendChild(next);
    } else if (sc.q) {
      const q = document.createElement('p');
      q.className = 'l-q';
      q.textContent = sc.q;
      container.appendChild(q);
      const answers = document.createElement('div');
      answers.className = 'lesson-answers';
      const keys = ['A', 'B', 'C', 'D'];
      sc.a.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'lesson-answer';
        b.innerHTML = '<span class="la-key">' + keys[i] + '</span><span>' + opt + '</span>';
        b.onclick = () => {
          $$('.lesson-answer').forEach((c, j) => {
            c.disabled = true;
            if (j === sc.ok) c.classList.add('correct');
            else if (j === i) c.classList.add('wrong');
          });
          const fb = document.createElement('div');
          fb.className = 'lesson-feedback ' + (i === sc.ok ? 'ok' : 'bad');
          fb.textContent = (i === sc.ok ? '✅ Верно! ' : '❌ Ой! ') + (sc.tip || '');
          container.appendChild(fb);
          if (i === sc.ok) { sfx.correct(); this.onToast('+5 XP'); }
          else sfx.wrong();
          const next = document.createElement('button');
          next.className = 'btn btn-green btn-block';
          next.textContent = 'ДАЛЕЕ →';
          next.onclick = () => this.advance();
          container.appendChild(next);
        };
        answers.appendChild(b);
      });
      container.appendChild(answers);
    }
  }

  advance() {
    const { course, lesson, idx } = this.active;
    const sc = lesson.scenes[idx];
    if (sc.xp) gainXP(this.state, sc.xp);
    this.state.lessons = this.state.lessons || {};
    this.state.lessons[course.id + ':' + lesson.id] = idx + 1;
    this.onSave();
    this.active.idx++;
    this.showScene();
  }

  finish() {
    this.onToast('🎓 Урок пройден! +10 XP');
    els('theoryRunner').classList.add('hidden');
    els('theoryBrowse').classList.remove('hidden');
    renderTheory();
    this.active = null;
  }
}

const lessonUI = new LessonRunnerUI(LESSONS, S, { onSave: persist, onToast: toast });

/* ============ GAME / EVENT ============ */
let gameTimer = null;
let gameTimeLeft = 25;
let currentEvent = null;
let gameLives = 3;

function startGame() {
  if (currentEvent) return;
  const pool = eventsForAudience(CONTENT.events, S.audience);
  currentEvent = pool[Math.floor(Math.random() * pool.length)];
  gameTimeLeft = 25;
  gameLives = 3;
  els('gameTimer').textContent = gameTimeLeft;
  els('gameQuestion').textContent = currentEvent.q;
  // предупреждающий треугольник — только для вопросов про мошенников
  const scam = /security|scam|fraud|\u043c\u043e\u0448\u0435\u043d/i.test((currentEvent.cat || '') + ' ' + (currentEvent.id || ''));
  const wi = els('gameWarnIcon');
  if (wi) { wi.innerHTML = ''; if (scam) mountSprite('gameWarnIcon', 'warn_icon', 3); }
  const answers = els('gameAnswers');
  answers.innerHTML = '';
  els('gameFeedback').innerHTML = '';
  const colors = ['orange', 'blue', 'green'];
  const keys = ['A', 'B', 'C'];
  // Случайный порядок вариантов (Fisher-Yates): правильный ответ каждый раз в случайной позиции.
  // dataset.orig хранит исходный индекс варианта, поэтому answerEvent(S, ev, origIdx) не меняется.
  const order = currentEvent.a.slice(0, 3).map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  order.forEach((origIdx, i) => {
    const b = document.createElement('button');
    b.className = 'game-answer ' + colors[i % 3];
    b.dataset.orig = origIdx;
    b.innerHTML = '<span class="ga-key">' + keys[i] + '</span><span>' + currentEvent.a[origIdx] + '</span>';
    b.onclick = () => answerGame(origIdx);
    answers.appendChild(b);
  });
  renderTopbar();
  renderGameHearts();
  mountSprite('gamePet', 'hori_desk', 3); // тот же Хори за ноутбуком, что на главном экране (desk статичен, HOMяк дышит)
  clearInterval(gameTimer);
  gameTimer = setInterval(() => {
    gameTimeLeft--;
    els('gameTimer').textContent = Math.max(0, gameTimeLeft);
    if (gameTimeLeft <= 0) {
      clearInterval(gameTimer);
      gameTimer = null;
      answerGame(-1, true); // время вышло = неверный ответ, минус сердечко
    }
  }, 1000);
}

function renderGameHearts(animateLost = false) {
  const gh = els('gameHearts');
  if (!gh) return;
  gh.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const h = createSprite('heart', 3);
    if (!h) continue;
    if (i >= gameLives) h.classList.add('lost');
    if (animateLost && i === gameLives) h.classList.add('heart-lost');
    gh.appendChild(h);
  }
}

/* летящий чип награды от кнопки ответа к иконке в HUD */
function flyReward(text, targetId) {
  const wrap = document.querySelector('#screen-game .game-wrap');
  const target = els(targetId);
  if (!wrap || !target) return;
  const fromBtn = document.querySelector('.game-answer.correct') || document.querySelector('.game-answer');
  const wr = wrap.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  const fr = fromBtn ? fromBtn.getBoundingClientRect() : tr;
  const chip = document.createElement('span');
  chip.className = 'fly-chip';
  chip.textContent = text;
  chip.style.left = (fr.left - wr.left + fr.width / 2 - 24) + 'px';
  chip.style.top = (fr.top - wr.top) + 'px';
  wrap.appendChild(chip);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    chip.style.transform = 'translate(' + (tr.left + tr.width / 2 - (fr.left + fr.width / 2)) + 'px,' + (tr.top - fr.top) + 'px) scale(.5)';
    chip.style.opacity = '.15';
  }));
  setTimeout(() => chip.remove(), 800);
}

function answerGame(idx, timeout = false) {
  if (!currentEvent) return;
  clearInterval(gameTimer);
  gameTimer = null;
  const ok = answerEvent(S, currentEvent, idx); // idx = -1 (таймаут) засчитывается как неверный ответ
  if (!ok) gameLives = Math.max(0, gameLives - 1);
  renderGameHearts(!ok);
  $$('.game-answer').forEach((b) => {
    b.disabled = true;
    const orig = Number(b.dataset.orig);
    if (orig === currentEvent.ok) b.classList.add('correct'); // подсветка только после ответа
    else if (orig === idx) b.classList.add('wrong');
  });
  const pet = els('gamePet');
  const top = pet ? pet.querySelector('.sprite-hori-top') : null;
  if (ok) {
    if (top) { top.classList.remove('pet-jump'); void top.offsetWidth; top.classList.add('pet-jump'); }
    flyReward('+10', 'gameCoinsIcon');
    flyReward('+' + (currentEvent.xp || 5) + ' KP', 'gameKpIcon');
    sfx.correct();
    toast('+10 XP +10 монет');
  } else {
    if (pet) { pet.classList.add('sad'); setTimeout(() => pet.classList.remove('sad'), 1000); }
    sfx.wrong();
  }
  const fb = els('gameFeedback');
  const head = ok
    ? 'Верно! +10 монет, +' + (currentEvent.xp || 5) + ' KP. '
    : (timeout ? 'Время вышло — ответ засчитан как неверный. Минус сердечко. ' : 'Мимо! Минус сердечко. ');
  fb.innerHTML = '<div class="lesson-feedback ' + (ok ? 'ok' : 'bad') + '">' + head + currentEvent.tip + '</div>' +
    '<button class="btn btn-green btn-block" id="btnNextEvent" style="margin-top:12px">СЛЕДУЮЩЕЕ ЗАДАНИЕ →</button>';
  els('btnNextEvent').onclick = () => {
    currentEvent = null;
    persist();
    startGame();
  };
  persist();
}


/* ============ SHOP ============ */
function renderShop() {
  const cell = (item, type, equipped) => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = '<span class="s-icon">' + item.icon + '</span><span class="s-name">' + item.name + '</span>';
    const price = document.createElement('span');
    price.className = 's-price';
    const btn = document.createElement('button');
    btn.className = 'btn';
    if (equipped) {
      btn.textContent = 'НАДЕТО ✓';
      btn.className += ' btn-green';
      btn.disabled = true;
      price.textContent = '—';
    } else if (owns(S, item.id) && type !== 'food') {
      btn.textContent = 'НАДЕТЬ';
      btn.className += ' btn-blue';
      price.textContent = 'КУПЛЕНО';
    } else {
      btn.textContent = 'КУПИТЬ';
      btn.className += ' btn-orange';
      price.textContent = item.price + ' МОНЕТ';
      if (S.coins < item.price) btn.disabled = true;
    }
    price.className = 's-price';
    div.appendChild(price);
    div.appendChild(btn);
    btn.onclick = () => {
      const r = buy(S, item, type);
      if (!r.ok) { toast('Не хватает монет!'); return; }
      if (r.action === 'consume') {
        if (item.id === 'food_seeds') S.health = Math.min(100, S.health + 15);
        if (item.id === 'food_cake') S.mood = Math.min(100, S.mood + 20);
        if (item.id === 'food_tea') { S.health = Math.min(100, S.health + 8); S.mood = Math.min(100, S.mood + 8); }
        toast('Ням! ' + item.name);
      } else {
        toast('Обновлено: ' + item.name + '!');
      }
      persist();
      renderShop();
    };
    return div;
  };
  const fill = (id, items, type) => {
    const el = els(id);
    el.innerHTML = '';
    items.forEach((it) => el.appendChild(cell(it, type, type !== 'food' && S.equipped[type] === it.id)));
  };
  fill('shopHats', SHOP.hats, 'hat');
  fill('shopWalls', SHOP.walls, 'wall');
  fill('shopFood', SHOP.food, 'food');
}

/* ============ SUPPORT / CHAT ============ */
let chatUI = null;
function initChat() {
  chatUI = new ChatUI(CONTENT, S, {
    onLog: toast,
    sfx,
    actions: { goTo: (target, label) => { toast('→ ' + label); if (NAV_MAP[target]) gotoScreen(NAV_MAP[target]); } }
  });
  chatUI.mount(els('chatBox'));
  const header = els('chatBox').querySelector('.chat-header');
  if (header) {
    const avatarWrap = header.querySelector('.ch-avatar');
    if (avatarWrap) {
      avatarWrap.className = 'ch-avatar-wrap';
      avatarWrap.innerHTML = '';
      const sprite = createSprite('hori_head', 2);
      if (sprite) avatarWrap.appendChild(sprite);
    }
  }
}

$$('#moodScale button').forEach((b) => {
  b.addEventListener('click', () => {
    const m = +b.dataset.mood;
    logMood(S, m);
    const msg = els('moodMsg');
    msg.textContent = CONTENT.moodMsgs[m];
    msg.classList.remove('hidden');
    if (m >= 4) { S.mood = Math.min(100, S.mood + 6); sfx.heart(); }
    else S.mood = Math.min(100, S.mood + 3);
    gainXP(S, 1);
    toast('💜 Чек-ин записан');
    persist();
    renderMoodChart(S, els('moodChart'));
  });
});

/* ============ SETTINGS ============ */
els('btnToggleSound').addEventListener('click', () => {
  const on = sfx.toggle();
  els('btnToggleSound').textContent = '🔊 Звук: ' + (on ? 'вкл' : 'выкл');
  els('btnSound').textContent = on ? '🔊' : '🔇';
});

els('btnSound').addEventListener('click', () => {
  const on = sfx.toggle();
  els('btnSound').textContent = on ? '🔊' : '🔇';
  els('btnToggleSound').textContent = '🔊 Звук: ' + (on ? 'вкл' : 'выкл');
});

els('btnReset').addEventListener('click', () => {
  if (!confirm('Точно сбросить весь прогресс?')) return;
  localStorage.removeItem('khomyagochi_pixel');
  location.reload();
});

/* Push-уведомления о состоянии питомца (по статье: pet gets push о состоянии) */
function renderNotifyBtn() {
  const supported = 'Notification' in window;
  const on = !!S.notifications && supported && Notification.permission === 'granted';
  els('btnToggleNotify').textContent = '🔔 Уведомления о Хори: ' + (on ? 'вкл' : 'выкл') + (supported ? '' : ' (не поддерживается браузером)');
}

els('btnToggleNotify').addEventListener('click', () => {
  if (!('Notification' in window)) { toast('Этот браузер не поддерживает уведомления'); return; }
  if (S.notifications && Notification.permission === 'granted') {
    S.notifications = false;
    persist();
    renderNotifyBtn();
    toast('Уведомления выключены');
    return;
  }
  Notification.requestPermission().then((p) => {
    S.notifications = (p === 'granted');
    persist();
    renderNotifyBtn();
    if (p === 'granted') {
      new Notification('Хори ждёт тебя! 🐹', { body: 'Заходи — питомец соскучился по урокам кибербезопасности.' });
      toast('Уведомления включены 🔔');
    } else {
      toast('Разрешение на уведомления не дано');
    }
  });
});
renderNotifyBtn();

let lastNotifyAt = 0;
function checkPetNotifications() {
  if (!S.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  const now = Date.now();
  if (now - lastNotifyAt < 5 * 60 * 1000) return;
  const a = petAlert(S, petState(S));
  if (a) {
    lastNotifyAt = now;
    new Notification(a.title, { body: a.body });
  }
}

/* ============ INIT ============ */
dayCheck(S, toast);
updateRoomNote();
renderTopbarSprites();
renderGameTools();
renderPetSprite();
renderRoomIcons();
mountDecorSprites();
mountSprite('theoryPet', 'hori_body', 3);
mountSprite('todoPet', 'hori_body', 3);
mountSprite('statsPet', 'hori_body', 3);
mountSprite('namePlatePet', 'hori_head');

/* ===== NAV ICONS (единый компонент bottom-nav, пиксельные иконки вместо эмодзи) ===== */
function renderNavIcons() {
  mountSprite('navHomeIcon', 'home_icon', 2);
  mountSprite('navHabitsIcon', 'check_icon', 2);
  mountSprite('navTheoryIcon', 'book_icon', 2);
  mountSprite('navGameIcon', 'play_icon', 2);
  mountSprite('navSupportIcon', 'help_icon', 2);
}
renderNavIcons();
mountSprite('statsTitleIcon', 'trophy_icon', 2);
mountSprite('supportTitleIcon', 'help_icon', 2);
renderTopbar();
renderPetBubble();

if (S.onboarded) {
  gotoScreen('home');
} else {
  showAudience();
}

setInterval(() => { tick(S, 1); persist(); }, 4000);
setInterval(renderPetBubble, 8000);
setInterval(checkPetNotifications, 60000);
document.addEventListener('visibilitychange', () => { if (document.hidden) checkPetNotifications(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') els('modalBg').classList.add('hidden');
});

window.addEventListener('error', function (e) {
  console.error('App error:', e.message);
});
