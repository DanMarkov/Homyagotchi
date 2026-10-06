import { load, save } from '../core/store.js';
import { tick, feed, play, rest, petState, PET_STATES } from '../core/pet.js';
import { gainXP, dayCheck, addCoins, owns, buy, habitDone, toggleHabit, logMood, answerEvent, dailyGoalProgress, todayStr, moodAvg } from '../core/game.js';
import { RoomScene, ROOM_POINTS } from '../render/scene.js';
import { LessonUI } from './lessons.js';
import { CloudUI } from './cloud.js';
import { cloudSave } from '../core/cloud.js';
import { sfx } from './audio.js';
import { renderMoodChart, startGrounding } from './support.js';

const CONTENT = window.__CONTENT__;
const LESSONS = window.__LESSONS__;

const S = load();
const dailyGoal = CONTENT.dailyGoalXp || 10;
if (!S.habits || !S.habits.length) S.habits = CONTENT.habits.slice();

const els = (id) => document.getElementById(id);
const logEl = els('log');
function log(msg) {
  const p = document.createElement('p');
  p.textContent = msg;
  logEl.insertBefore(p, logEl.firstChild);
  while (logEl.children.length > 12) logEl.removeChild(logEl.lastChild);
}
function persist() { save(S); render(); }

const scene = new RoomScene(els('scene'));
scene.rebuild(S);
let hot = null;

function render() {
  const set = (b, t, v) => { els(b).style.width = v + '%'; els(t).textContent = v + '%'; };
  set('bHealth', 'tHealth', Math.max(0, Math.round(S.health)));
  set('bSec', 'tSec', Math.max(0, Math.round(S.sec)));
  set('bMood', 'tMood', Math.max(0, Math.round(S.mood)));
  els('lvl').textContent = S.lvl;
  els('coins').textContent = S.coins;
  els('streak').textContent = S.streak;
  const goal = dailyGoalProgress(S, dailyGoal);
  els('goalFill').style.width = goal + '%';
  els('goalText').textContent = 'цель дня: ' + (S.dailyXp || 0) + '/' + dailyGoal + ' XP';
  const avg = moodAvg(S.moodLog, 7);
  if (avg !== null) els('petState').textContent = stateLabel();
}

function stateLabel() {
  const ps = petState(S);
  return { idle: '😭 скучает', eating: '😈 ест', jumping: '★ радуется!', sleeping: '💤 спит', sick: '🤒 болеет — покорми!', happy: '😊 счастлив' }[ps];
}

dayCheck(S, log);
render();

let last = performance.now();
let running = true;
function frame(now) {
  if (!running) return;
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  scene.draw(S, hot, dt);
  els('petState').textContent = stateLabel();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(() => { tick(S, 1); persist(); }, 4000);

const cv = els('scene');
function scenePos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * 320 / r.width, y: (e.clientY - r.top) * 240 / r.height };
}
cv.addEventListener('mousemove', (e) => {
  hot = scene.hitTest(scenePos(e).x, scenePos(e).y);
  cv.style.cursor = hot ? 'pointer' : 'default';
});
cv.addEventListener('click', (e) => {
  const p = scenePos(e);
  const pt = scene.hitTest(p.x, p.y);
  if (pt) { sfx.click(); roomAction(pt.id); }
  else { S.mood = Math.min(100, S.mood + 2); S._jumping = 16; scene.puff('♥', '#ff8fa3'); log('пип! хомяк рад ♥'); persist(); }
});

function roomAction(id) {
  if (id === 'book') showPanel('📖 ДНЕВНИК ХОМЯКА', statsHtml());
  else if (id === 'bowl') { feed(S); scene.puff('⚡', '#e8b46e'); sfx.feed(); log('🥣 хомяк поел! +❤'); persist(); }
  else if (id === 'poster') showPanel('🛡 СОВЕТ ОТ ХОМЯКА', '<p class="panel-text">' + CONTENT.tips[Math.floor(Math.random() * CONTENT.tips.length)] + '</p>');
  else if (id === 'window') {
    const hr = new Date().getHours();
    const g = hr < 6 ? '🌙 ночь тиха... спать пора!' : hr < 12 ? '🌅 доброе утро!' : hr < 18 ? '☀ добрый день!' : '🌓 добрый вечер!';
    showPanel('🪟 ЗА ОКНОМ', '<p class="panel-text">' + g + ' Хомяк здесь для тебя ♥</p>');
    S.mood = Math.min(100, S.mood + 2); persist();
  } else if (id === 'flower') {
    S.mood = Math.min(100, S.mood + 4); gainXP(S, 1); scene.puff('♥', '#7fae90'); sfx.heart();
    log('🌱 ты полил цветок — забота возвращается!'); persist();
  } else if (id === 'bed') { rest(S); sfx.sleep(); log('💤 хомяк приснул на лежанке.'); persist(); }
  else if (id === 'wheel') {
    scene.spinWheel();
    S.mood = Math.min(100, S.mood + 10); gainXP(S, 3); S._jumping = 12;
    scene.puff('♪', '#ffd166'); sfx.wheel(); log('🎡 хомяк гоняет в колесе! +🧠'); persist();
  }
  else if (id === 'ham') { S.mood = Math.min(100, S.mood + 6); S._jumping = 16; scene.puff('♥', '#ff8fa3'); sfx.pet(); log('🐹 пип! хомяк рад!'); persist(); }
}

function showPanel(title, bodyHtml) {
  const p = els('roomPanel');
  p.innerHTML = '<h3>' + title + '</h3>' + bodyHtml +
    '<button class="act primary" style="margin-top:12px;width:100%" data-close>ЗАКРЫТЬ</button>';
  p.querySelector('[data-close]').onclick = () => p.classList.add('hidden');
  p.classList.remove('hidden');
}

function statsHtml() {
  let done = 0;
  S.habits.forEach((h) => { if (habitDone(S, h.id)) done++; });
  return '<div class="row"><span>LVL</span><span>' + S.lvl + ' (XP ' + S.xp + '/10)</span></div>' +
    '<div class="row"><span>монеты</span><span>' + S.coins + ' 🪙</span></div>' +
    '<div class="row"><span>серия дней</span><span>' + S.streak + '</span></div>' +
    '<div class="row"><span>привычки сегодня</span><span>' + done + '/' + S.habits.length + '</span></div>' +
    '<div class="row"><span>чек-инов настроения</span><span>' + S.moodLog.length + '</span></div>';
}

els('btnEvent').onclick = spawnEvent;
function spawnEvent() {
  const ev = CONTENT.events[Math.floor(Math.random() * CONTENT.events.length)];
  const bg = els('modalBg');
  els('mTitle').textContent = ev.cat;
  els('mQuestion').textContent = ev.q;
  const res = els('mResult');
  res.classList.add('hidden');
  const btns = els('mBtns');
  btns.innerHTML = '';
  ev.a.forEach((opt, i) => {
    const b = document.createElement('button');
    b.textContent = opt;
    b.onclick = () => {
      Array.prototype.forEach.call(btns.children, (c, j) => c.classList.add(j === ev.ok ? 'ok' : 'bad'));
      const ok = answerEvent(S, ev, i);
      res.textContent = ok ? '✅ ВЕРНО! +10🛡 +10🪙 ' + ev.tip : '❌ ОЙ! ' + ev.tip;
      if (ok) { S._jumping = 16; scene.puff('★', '#ffd166'); sfx.correct(); } else { scene.puff('?', '#e5484d'); sfx.wrong(); }
      res.classList.remove('hidden');
      persist();
      setTimeout(() => bg.classList.add('hidden'), 4000);
    };
    btns.appendChild(b);
  });
  bg.classList.remove('hidden');
}

els('btnFeed').onclick = () => { feed(S); scene.puff('⚡', '#e8b46e'); sfx.feed(); log('🥜 хомяк хрустит! +❤'); persist(); };
els('btnPlay').onclick = () => { play(S); gainXP(S, 3); scene.puff('♪', '#a78bfa'); sfx.play(); log('🎮 игра! +🧠'); persist(); };
els('btnRest').onclick = () => { rest(S); sfx.sleep(); log('💤 хомяк поспал.'); persist(); };

const SHOP = window.__SHOP__;
function renderShop() {
  const cell = (item, type, equipped) => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = '<span class="icon">' + item.icon + '</span><span class="name">' + item.name + '</span>';
    const price = document.createElement('span');
    const btn = document.createElement('button');
    if (equipped) { btn.textContent = 'НАДЕТО ✓'; btn.className = 'equip'; btn.disabled = true; price.textContent = '—'; }
    else if (owns(S, item.id) && type !== 'food') { btn.textContent = 'НАДЕТЬ'; btn.className = 'owned'; price.textContent = 'куплено'; }
    else { btn.textContent = 'КУПИТЬ'; price.textContent = item.price + ' 🪙'; if (S.coins < item.price) btn.disabled = true; }
    price.className = 'price';
    div.appendChild(price); div.appendChild(btn);
    btn.onclick = () => {
      const r = buy(S, item, type);
      if (!r.ok) return;
      if (r.action === 'consume') {
        if (item.id === 'food_seeds') S.health = Math.min(100, S.health + 15);
        if (item.id === 'food_cake') S.mood = Math.min(100, S.mood + 20);
        if (item.id === 'food_tea') { S.health = Math.min(100, S.health + 8); S.mood = Math.min(100, S.mood + 8); }
        S._eating = 8; scene.puff(item.icon, '#ffd166');
        log('куплено: ' + item.name);
      } else {
        log('обновлено: ' + item.name + '!');
        scene.puff('♥', '#ff8fa3');
      }
      scene.rebuild(S);
      persist(); renderShop();
    };
    return div;
  };
  const fill = (id, items, type) => {
    const el2 = els(id);
    el2.innerHTML = '';
    items.forEach((it) => el2.appendChild(cell(it, type, type !== 'food' && S.equipped[type] === it.id)));
  };
  fill('shopHats', SHOP.hats, 'hat');
  fill('shopWalls', SHOP.walls, 'wall');
  fill('shopFood', SHOP.food, 'food');
}

function renderHabits() {
  const list = els('habitList');
  list.innerHTML = '';
  S.habits.forEach((h) => {
    const div = document.createElement('div');
    div.className = 'habit' + (habitDone(S, h.id) ? ' done' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!habitDone(S, h.id);
    cb.onchange = () => {
      toggleHabit(S, h.id, cb.checked);
      if (cb.checked) { S._jumping = 16; scene.puff('★', '#ffd166'); sfx.correct(); log('✅ серия ' + S.habitState[h.id].streak + '!'); }
      renderHabits(); persist();
    };
    const label = document.createElement('span');
    label.textContent = h.emoji + ' ' + h.text;
    const st = document.createElement('span');
    st.className = 'st';
    st.textContent = '🔥' + ((S.habitState[h.id] && S.habitState[h.id].streak) || 0);
    div.appendChild(cb); div.appendChild(label); div.appendChild(st);
    list.appendChild(div);
  });
}

const lessonUI = new LessonUI(LESSONS, S, { onSave: persist, onLog: log, onPuff: (c, col) => scene.puff(c, col) });
function renderLessons() { lessonUI.renderList(els('lessonList')); }

document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.onclick = () => {
    sfx.tab();
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    ['home', 'shop', 'habits', 'lessons', 'support'].forEach((t) => {
      els('tab-' + t).classList.toggle('hidden', t !== btn.dataset.tab);
    });
    if (btn.dataset.tab === 'shop') renderShop();
    if (btn.dataset.tab === 'habits') renderHabits();
    if (btn.dataset.tab === 'lessons') renderLessons();
    if (btn.dataset.tab === 'support') renderMoodChart(S, els('moodChart'));
  };
});

els('btnAddHabit').onclick = () => {
  const inp = els('newHabit');
  const txt = inp.value.trim();
  if (!txt) return;
  S.habits.push({ id: 'h_' + Date.now(), emoji: '⭐', text: txt });
  inp.value = '';
  renderHabits(); save(S);
};

document.querySelectorAll('#moodScale button').forEach((b) => {
  b.onclick = () => {
    const m = +b.dataset.mood;
    logMood(S, m);
    const msg = els('moodMsg');
    msg.textContent = CONTENT.moodMsgs[m];
    msg.classList.remove('hidden');
    if (m >= 4) { S.mood = Math.min(100, S.mood + 6); S._jumping = 16; scene.puff('♥', '#ff8fa3'); sfx.heart(); }
    else S.mood = Math.min(100, S.mood + 3);
    gainXP(S, 1);
    log('💙 чек-ин записан');
    persist(); renderMoodChart(S, els('moodChart'));
  };
});

let breathing = false;
els('btnBreath').onclick = () => {
  if (breathing) return;
  breathing = true;
  const circle = els('breathCircle');
  const label = els('breathLabel');
  const phases = [['вдох... 4', 4000, 'scale(1.7)'], ['пауза... 4', 4000, 'scale(1.7)'], ['выдох... 6', 6000, 'scale(1)']];
  let cycle = 0, i = 0;
  function step() {
    if (cycle >= 3) {
      label.textContent = 'готово! ты молодец ★';
      circle.style.transform = 'scale(1)';
      breathing = false;
      S._jumping = 16;
      S.mood = Math.min(100, S.mood + 8); gainXP(S, 2);
      log('🌬 практика завершена +🧠');
      persist(); return;
    }
    const p = phases[i];
    label.textContent = p[0];
    circle.style.transform = p[2];
    setTimeout(() => { i++; if (i >= phases.length) { i = 0; cycle++; } step(); }, p[1]);
  }
  step();
};

let groundNext = startGrounding(CONTENT, els('groundLabel'), els('groundSteps'), () => {
  S.mood = Math.min(100, S.mood + 5); gainXP(S, 2);
  log('🧠 grounding завершён +🧠');
  persist();
});
els('btnGround').onclick = () => groundNext();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') els('roomPanel').classList.add('hidden');
});

log('🐹 добро пожаловать в домик!');
renderHabits();

const cloudUI = new CloudUI({ state: S, onSave: () => save(S), onLog: log, onRender: render });
cloudUI.init();

setInterval(() => {
  if (cloudUI.user && cloudUI.user.access_token) cloudSave(S).catch(() => {});
}, 60000);
