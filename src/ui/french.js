/* ===== Модуль «Французский» (Duolingo-style MVP поверх механик игры) =====
   Контент — только статические файлы: content/fr/words.json + content/fr/units.json
   (сборка в content/fr/*.js через tools/build-fr.mjs, грузится <script> как window.__FR_WORDS__/__FR_UNITS__).
   id слов/уроков стабильные и языконезависимые; fr/ru-пары слов НЕ переводятся через словари интерфейса.
   SRS и награды — в src/core/fr.js. UI-строки — через t() с ключами h.fr.* и j.fr.* из locales.
   Ядро игры (сценарии, магазин, помощь, статистика) не тронуто — модуль аддитивный. */
import { t, getLang } from '../i18n.js?v=43';
import { createSprite } from '../render/pixel-sprites.js?v=43';
import { sfx } from './audio.js?v=43';
import {
  recordResult, dueWords, lessonDone, markLessonDone, lessonUnlocked,
  applyLessonReward, wordMap, exerciseWordIds, REVIEW_LIMIT, LESSON_HEARTS
} from '../core/fr.js?v=43';

const els = (id) => document.getElementById(id);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/* ===== озвучка: sayFr(text) — speechSynthesis, lang fr-FR, pitch 1, rate 0.9; голос кэшируется, voiceschanged обрабатывается ===== */
let frVoice = null;
const voiceListeners = [];

export function frSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickFrVoice() {
  if (!frSpeechSupported()) return;
  const vs = window.speechSynthesis.getVoices() || [];
  const found = vs.find((v) => /^fr/i.test(v.lang || '')) || null;
  if (found && found !== frVoice) {
    frVoice = found;
    voiceListeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  } else if (found) {
    frVoice = found;
  }
}

export function initFrSpeech() {
  if (!frSpeechSupported()) return;
  pickFrVoice();
  window.speechSynthesis.onvoiceschanged = pickFrVoice;
}

export function onFrVoiceReady(fn) { voiceListeners.push(fn); }

export function frVoiceReady() {
  if (!frSpeechSupported()) return false;
  if (!frVoice) pickFrVoice();
  return !!frVoice;
}

/* true, если удалось произнести; если fr-голоса нет — false, кнопку 🔊 мы прячем (без ошибок пользователю) */
export function sayFr(text) {
  if (!frSpeechSupported() || !frVoiceReady()) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.voice = frVoice;
  u.pitch = 1;
  u.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

/* ===== UI модуля ===== */
export class FrenchUI {
  constructor(words, units, state, ctx) {
    this.words = words || { words: [] };
    this.units = units || { units: [] };
    this.state = state;
    this.ctx = ctx || {}; // { toast, persist }
    this.map = wordMap(this.words);
    this.allIds = exerciseWordIds(this.units);
    this.active = null;
    onFrVoiceReady(() => {
      // голоса подгрузились асинхронно — перерисовать listen-упражнение, если оно сейчас активно
      const a = this.active;
      if (a && a.queue[a.idx] && a.queue[a.idx].type === 'listen' && !a.checked) this.renderExercise();
    });
  }

  toast(msg) { if (this.ctx.toast) this.ctx.toast(msg); }
  save() { if (this.ctx.persist) this.ctx.persist(); }

  titleOf(o) { const l = getLang(); return o['title_' + l] || o.title_ru || ''; }
  dueCount(now = Date.now()) { return dueWords(this.state, this.allIds, now, 9999).length; }

  /* ===== карта модуля (список юнитов и уроков-узлов) ===== */
  renderBrowse() {
    this.active = null;
    const runner = els('frenchRunner');
    const browse = els('frenchBrowse');
    if (runner) runner.classList.add('hidden');
    if (browse) browse.classList.remove('hidden');
    const rb = els('btnFrReview');
    if (rb) {
      const n = this.dueCount();
      const badge = rb.querySelector('.mc-badge');
      if (badge) badge.textContent = String(n);
      rb.classList.toggle('has-due', n > 0);
      rb.title = t('h.fr.slov-k-povtoreniyu', { n });
      rb.onclick = () => this.startReview();
    }
    const map = els('frenchMap');
    if (!map) return;
    map.innerHTML = '';
    let allDone = true;
    this.units.units.forEach((u, ui) => {
      const unitEl = document.createElement('div');
      unitEl.className = 'fr-unit card';
      const doneCount = u.lessons.filter((l) => lessonDone(this.state, l.id)).length;
      if (doneCount < u.lessons.length) allDone = false;
      const head = document.createElement('div');
      head.className = 'fr-unit-head';
      head.innerHTML = '<span class="fr-unit-emoji">' + (u.emoji || '🇫🇷') + '</span>' +
        '<span class="fr-unit-title"></span>' +
        '<span class="fr-unit-prog">' + doneCount + '/' + u.lessons.length + '</span>';
      head.querySelector('.fr-unit-title').textContent = this.titleOf(u);
      unitEl.appendChild(head);
      const path = document.createElement('div');
      path.className = 'fr-path';
      u.lessons.forEach((l, li) => {
        if (li > 0) {
          const line = document.createElement('div');
          line.className = 'fr-node-line';
          path.appendChild(line);
        }
        const unlocked = lessonUnlocked(this.units, ui, li, this.state);
        const done = lessonDone(this.state, l.id);
        const node = document.createElement('button');
        node.className = 'fr-node' + (done ? ' done' : unlocked ? ' open' : ' locked');
        if (u.color) node.style.setProperty('--node-color', u.color);
        node.innerHTML = '<span class="fr-node-label">' + (done ? '✓' : unlocked ? String(li + 1) : '🔒') + '</span>' +
          '<span class="fr-node-title"></span>';
        node.querySelector('.fr-node-title').textContent = this.titleOf(l);
        node.title = unlocked ? this.titleOf(l) : t('h.fr.zakryt');
        if (unlocked) {
          node.onclick = () => { sfx.click(); this.startLesson(u, l); };
        } else {
          node.disabled = true;
        }
        path.appendChild(node);
      });
      unitEl.appendChild(path);
      map.appendChild(unitEl);
    });
    if (allDone && this.units.units.length) {
      const p = document.createElement('p');
      p.className = 'fr-all-done';
      p.textContent = t('h.fr.vse-proydeno');
      map.appendChild(p);
    }
  }

  /* ===== сессия повторения (SRS): до 10 слов с истёкшим nextReview ===== */
  startReview(now = Date.now()) {
    const ids = dueWords(this.state, this.allIds, now, REVIEW_LIMIT);
    if (!ids.length) { this.toast(t('h.fr.net-slov')); return; }
    const queue = ids.map((id) => ({ type: 'choice', prompt: id, dir: 'fr2ru', options: this.pickOptions(id, 4) }));
    this.active = { mode: 'review', queue, idx: 0, ok: 0, sel: null, checked: false };
    this.showRunner();
    this.renderExercise();
  }

  /* 1 правильный + n-1 дистракторов из слов того же level (потом из остальных); возвращает id строками */
  pickOptions(promptId, n) {
    const w = this.map[promptId];
    const pool = this.words.words.filter((x) => x.kind !== 'phrase' && x.id !== promptId).map((x) => x.id);
    const sameLevel = pool.filter((id) => this.map[id].level === w.level);
    const rest = pool.filter((id) => this.map[id].level !== w.level);
    const picked = shuffle(sameLevel).slice(0, n - 1);
    while (picked.length < n - 1 && rest.length) picked.push(rest.shift());
    return shuffle([promptId, ...picked]);
  }

  /* ===== урок ===== */
  startLesson(unit, lesson) {
    this.active = {
      mode: 'lesson', unit, lesson,
      queue: lesson.exercises.slice(), // порядок как в контенте
      idx: 0, hearts: LESSON_HEARTS, mistakes: 0,
      repeat: [], repeatsDone: false,
      sel: null, built: [], matched: {}, firstTap: null, curWrong: false, checked: false
    };
    this.showRunner();
    this.renderExercise();
  }

  showRunner() {
    els('frenchRunner').classList.remove('hidden');
    els('frenchBrowse').classList.add('hidden');
  }

  backToMap() {
    this.active = null;
    this.renderBrowse();
  }

  renderExercise() {
    const a = this.active;
    const box = els('frLesson');
    if (!a) return;
    if (a.idx >= a.queue.length) { this.finishSession(); return; }
    const ex = a.queue[a.idx];
    a.sel = null; a.built = []; a.matched = {}; a.firstTap = null; a.curWrong = false; a.checked = false;
    box.innerHTML = '';

    /* шапка: назад + сердечки (только урок) + прогресс */
    const head = document.createElement('div');
    head.className = 'fr-lesson-head';
    const back = document.createElement('button');
    back.className = 'btn btn-ghost fr-back';
    back.textContent = t('j.fr.k-urokam');
    back.onclick = () => { sfx.click(); this.backToMap(); };
    head.appendChild(back);
    if (a.mode === 'lesson') {
      const hearts = document.createElement('span');
      hearts.className = 'fr-hearts';
      hearts.id = 'frHearts';
      for (let i = 0; i < LESSON_HEARTS; i++) {
        const h = createSprite('heart', 3);
        if (h) { if (i >= a.hearts) h.classList.add('lost'); hearts.appendChild(h); }
      }
      head.appendChild(hearts);
    } else {
      const lbl = document.createElement('span');
      lbl.className = 'fr-review-label';
      lbl.textContent = t('j.fr.slovo-iz', { i: a.idx + 1, n: a.queue.length });
      head.appendChild(lbl);
    }
    const progWrap = document.createElement('div');
    progWrap.className = 'fr-prog';
    progWrap.innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width:' + Math.round(a.idx / a.queue.length * 100) + '%"></div></div>';
    head.appendChild(progWrap);
    box.appendChild(head);

    /* тело упражнения */
    const body = document.createElement('div');
    body.className = 'fr-exercise';
    box.appendChild(body);
    if (ex.type === 'choice') this.renderChoice(body, ex);
    else if (ex.type === 'listen') this.renderListen(body, ex);
    else if (ex.type === 'build') this.renderBuild(body, ex);
    else if (ex.type === 'match') this.renderMatch(body, ex);

    /* подвал: фидбек + ПРОВЕРИТЬ/ДАЛЕЕ */
    const fb = document.createElement('div');
    fb.className = 'fr-feedback';
    fb.id = 'frFeedback';
    box.appendChild(fb);
    const check = document.createElement('button');
    check.className = 'btn btn-green btn-block';
    check.id = 'frCheck';
    check.textContent = t('j.fr.proverit');
    check.disabled = !this.ready(ex);
    check.onclick = () => this.checkExercise(ex);
    box.appendChild(check);
    a.checkBtn = check;
  }

  ready(ex) {
    const a = this.active;
    if (ex.type === 'choice' || ex.type === 'listen') return a.sel !== null;
    if (ex.type === 'build') return a.built.length === this.map[ex.prompt].words.length;
    if (ex.type === 'match') return Object.keys(a.matched).length === ex.ids.length;
    return false;
  }

  renderHearts() {
    const a = this.active;
    const hearts = els('frHearts');
    if (!hearts || !a || a.mode !== 'lesson') return;
    hearts.innerHTML = '';
    for (let i = 0; i < LESSON_HEARTS; i++) {
      const h = createSprite('heart', 3);
      if (h) { if (i >= a.hearts) h.classList.add('lost'); hearts.appendChild(h); }
    }
  }

  /* --- а) выбор перевода --- */
  renderChoice(body, ex) {
    const a = this.active;
    const w = this.map[ex.prompt];
    const label = document.createElement('p');
    label.className = 'fr-prompt-label';
    label.textContent = t('j.fr.vyberi-perevod');
    body.appendChild(label);
    const prompt = document.createElement('div');
    prompt.className = 'fr-prompt';
    const big = document.createElement('div');
    big.className = 'fr-prompt-word';
    big.textContent = ex.dir === 'fr2ru' ? w.fr : w.ru;
    prompt.appendChild(big);
    if (ex.dir === 'fr2ru' && w.emoji) {
      const em = document.createElement('div');
      em.className = 'fr-prompt-emoji';
      em.textContent = w.emoji;
      prompt.appendChild(em);
    }
    body.appendChild(prompt);
    const opts = document.createElement('div');
    opts.className = 'lesson-answers fr-options';
    const keys = ['A', 'B', 'C', 'D'];
    shuffle(ex.options).forEach((id, i) => {
      const w2 = this.map[id];
      const b = document.createElement('button');
      b.className = 'lesson-answer fr-option';
      b.dataset.wid = id;
      b.innerHTML = '<span class="la-key">' + keys[i % 4] + '</span><span></span>';
      b.querySelector('span:last-child').textContent = ex.dir === 'fr2ru' ? w2.ru : w2.fr;
      b.onclick = () => {
        if (a.checked) return;
        a.sel = id;
        opts.querySelectorAll('.fr-option').forEach((o) => o.classList.toggle('selected', o.dataset.wid === id));
        if (a.checkBtn) a.checkBtn.disabled = false;
        sfx.click();
      };
      opts.appendChild(b);
    });
    body.appendChild(opts);
  }

  /* --- г) аудирование --- */
  renderListen(body, ex) {
    const a = this.active;
    const w = this.map[ex.prompt];
    const label = document.createElement('p');
    label.className = 'fr-prompt-label';
    label.textContent = t('j.fr.slushay');
    body.appendChild(label);
    const prompt = document.createElement('div');
    prompt.className = 'fr-prompt';
    const btn = document.createElement('button');
    btn.className = 'fr-listen-btn';
    btn.id = 'frListenBtn';
    btn.textContent = '🔊';
    btn.setAttribute('aria-label', 'Écouter');
    if (frVoiceReady()) {
      btn.onclick = () => { sayFr(w.fr); };
    } else {
      btn.classList.add('hidden'); // fr-голоса нет — кнопку прячем, без ошибок
    }
    prompt.appendChild(btn);
    const hint = document.createElement('div');
    hint.className = 'fr-prompt-word fr-listen-hint';
    hint.textContent = '🔊 ?';
    prompt.appendChild(hint);
    body.appendChild(prompt);
    const opts = document.createElement('div');
    opts.className = 'lesson-answers fr-options';
    const keys = ['A', 'B', 'C'];
    shuffle(ex.options).forEach((id, i) => {
      const w2 = this.map[id];
      const b = document.createElement('button');
      b.className = 'lesson-answer fr-option';
      b.dataset.wid = id;
      b.innerHTML = '<span class="la-key">' + keys[i % 3] + '</span><span></span>';
      b.querySelector('span:last-child').textContent = w2.ru;
      b.onclick = () => {
        if (a.checked) return;
        a.sel = id;
        opts.querySelectorAll('.fr-option').forEach((o) => o.classList.toggle('selected', o.dataset.wid === id));
        if (a.checkBtn) a.checkBtn.disabled = false;
        sfx.click();
      };
      opts.appendChild(b);
    });
    body.appendChild(opts);
  }

  /* --- б) сборка фразы --- */
  renderBuild(body, ex) {
    const a = this.active;
    const ph = this.map[ex.prompt];
    const label = document.createElement('p');
    label.className = 'fr-prompt-label';
    label.textContent = t('j.fr.soberi-frazu');
    body.appendChild(label);
    const prompt = document.createElement('div');
    prompt.className = 'fr-prompt';
    const big = document.createElement('div');
    big.className = 'fr-prompt-word';
    big.textContent = ph.ru;
    prompt.appendChild(big);
    body.appendChild(prompt);
    const hint = document.createElement('p');
    hint.className = 'fr-build-hint';
    hint.textContent = t('j.fr.nazhmi-chto-ubrat');
    body.appendChild(hint);
    const answer = document.createElement('div');
    answer.className = 'fr-build-answer';
    answer.id = 'frBuildAnswer';
    body.appendChild(answer);
    const pool = document.createElement('div');
    pool.className = 'fr-chips';
    pool.id = 'frBuildPool';
    body.appendChild(pool);
    this.renderBuildZones();
  }

  renderBuildZones() {
    const a = this.active;
    const ex = a.queue[a.idx];
    const answer = els('frBuildAnswer');
    const pool = els('frBuildPool');
    if (!answer || !pool) return;
    answer.innerHTML = '';
    pool.innerHTML = '';
    a.built.forEach((id) => {
      const c = document.createElement('button');
      c.className = 'fr-chip in-answer';
      c.textContent = this.map[id].fr;
      c.onclick = () => {
        if (a.checked) return;
        a.built = a.built.filter((x) => x !== id); // тап по слову в ответе убирает его (порядок меняется свободно)
        this.renderBuildZones();
        if (a.checkBtn) a.checkBtn.disabled = !this.ready(ex);
        sfx.click();
      };
      answer.appendChild(c);
    });
    shuffle(ex.chips.filter((id) => a.built.indexOf(id) === -1)).forEach((id) => {
      const c = document.createElement('button');
      c.className = 'fr-chip';
      c.textContent = this.map[id].fr;
      c.onclick = () => {
        if (a.checked || a.built.indexOf(id) !== -1) return; // двойной тап/повтор не задваивает плашку
        a.built.push(id); // узел перерисовывается синхронно
        this.renderBuildZones();
        if (a.checkBtn) a.checkBtn.disabled = !this.ready(ex);
        sfx.click();
      };
      pool.appendChild(c);
    });
  }

  /* --- в) найди пару --- */
  renderMatch(body, ex) {
    const a = this.active;
    const label = document.createElement('p');
    label.className = 'fr-prompt-label';
    label.textContent = t('j.fr.naydi-paru');
    body.appendChild(label);
    const grid = document.createElement('div');
    grid.className = 'fr-match-grid';
    const left = document.createElement('div');
    left.className = 'fr-match-col';
    const right = document.createElement('div');
    right.className = 'fr-match-col';
    shuffle(ex.ids).forEach((id) => {
      const c = document.createElement('button');
      c.className = 'fr-match-card fr-word';
      c.dataset.wid = id;
      c.textContent = this.map[id].fr;
      c.onclick = () => this.tapMatch(c, 'fr');
      left.appendChild(c);
    });
    shuffle(ex.ids).forEach((id) => {
      const c = document.createElement('button');
      c.className = 'fr-match-card fr-emoji';
      c.dataset.wid = id;
      c.textContent = this.map[id].emoji || '❓';
      c.onclick = () => this.tapMatch(c, 'emoji');
      right.appendChild(c);
    });
    grid.appendChild(left);
    grid.appendChild(right);
    body.appendChild(grid);
  }

  tapMatch(card, side) {
    const a = this.active;
    if (!a || a.checked || card.classList.contains('done')) return;
    sfx.click();
    if (!a.firstTap) {
      if (side !== 'fr') return; // сначала слово, потом эмодзи
      a.firstTap = { id: card.dataset.wid, el: card };
      card.classList.add('sel');
      return;
    }
    if (side !== 'emoji') { // тап по другому слову — перевыбор
      a.firstTap.el.classList.remove('sel');
      a.firstTap = { id: card.dataset.wid, el: card };
      card.classList.add('sel');
      return;
    }
    const first = a.firstTap;
    a.firstTap = null;
    first.el.classList.remove('sel');
    if (first.id === card.dataset.wid) {
      first.el.classList.add('done');
      card.classList.add('done');
      a.matched[first.id] = true;
      recordResult(this.state, first.id, true);
      sfx.correct();
    } else {
      a.curWrong = true;
      recordResult(this.state, first.id, false);
      first.el.classList.add('shake');
      card.classList.add('shake');
      setTimeout(() => { first.el.classList.remove('shake'); card.classList.remove('shake'); }, 400);
      sfx.wrong();
    }
    if (a.checkBtn) a.checkBtn.disabled = !this.ready(a.queue[a.idx]);
  }

  /* ===== проверка ответа ===== */
  checkExercise(ex) {
    const a = this.active;
    if (!a || a.checked || !this.ready(ex)) return;
    a.checked = true;
    const w = this.map[ex.prompt] || this.map[ex.ids && ex.ids[0]] || { fr: '', ru: '' }; // у match нет prompt — берём первое слово для примера
    let ok = false;
    if (ex.type === 'choice' || ex.type === 'listen') {
      ok = a.sel === ex.prompt;
      recordResult(this.state, ex.prompt, ok);
    } else if (ex.type === 'build') {
      const ph = this.map[ex.prompt];
      ok = a.built.length === ph.words.length && a.built.every((id, i) => id === ph.words[i]);
      ph.words.forEach((wid, i) => recordResult(this.state, wid, a.built[i] === wid));
    } else if (ex.type === 'match') {
      ok = !a.curWrong;
    }
    if (a.mode === 'lesson') {
      if (!ok) {
        a.mistakes++;
        a.hearts = Math.max(0, a.hearts - 1);
        if (!a.repeatsDone) a.repeat.push(ex); // ошибка повторится в конце урока один раз
      }
    } else if (ok) {
      a.ok++;
    }
    this.save();

    /* пометки на кнопках */
    const box = els('frLesson');
    box.querySelectorAll('.fr-option').forEach((b) => {
      b.disabled = true;
      if (b.dataset.wid === ex.prompt) b.classList.add('correct');
      else if (b.dataset.wid === a.sel) b.classList.add('wrong');
      else b.classList.remove('selected');
    });
    if (ex.type === 'build') {
      const ph = this.map[ex.prompt];
      els('frBuildAnswer').querySelectorAll('.fr-chip').forEach((c, i) => {
        c.disabled = true;
        const want = ph.words[i];
        if (a.built[i] === want) c.classList.add('correct');
        else c.classList.add('wrong');
      });
    }
    this.renderHearts();

    /* фидбек */
    const fb = els('frFeedback');
    let html = '';
    if (ok) {
      html = '<div class="lesson-feedback ok">' + t('j.fr.verno') + '</div>';
      sfx.correct();
    } else {
      html = '<div class="lesson-feedback bad">' + t('j.fr.neverno') + '</div>' +
        '<div class="fr-correct-line">' + t('j.fr.pravilnyy', { fr: w.fr, ru: w.ru }) + '</div>';
      if (w.example_fr) html += '<div class="fr-example-line">' + t('j.fr.primer', { ex_fr: w.example_fr, ex_ru: w.example_ru }) + '</div>';
      if (a.mode === 'lesson') html += '<div class="fr-repeat-note">' + t('j.fr.oshibka-povtoritsya') + '</div>';
      sfx.wrong();
    }
    fb.innerHTML = html;

    const check = els('frCheck');
    if (a.mode === 'lesson' && a.hearts <= 0) {
      // 3 ошибки = урок сначала (по правилам игры)
      check.classList.add('hidden');
      fb.innerHTML += '<div class="lesson-feedback bad">' + t('j.fr.serdechki-konchilis') + '</div>';
      const again = document.createElement('button');
      again.className = 'btn btn-blue btn-block';
      again.id = 'frAgain';
      again.style.marginTop = '12px';
      again.textContent = t('j.fr.s-nachala');
      again.onclick = () => this.startLesson(a.unit, a.lesson);
      fb.appendChild(again);
      return;
    }
    check.textContent = t('j.fr.dalee');
    check.disabled = false;
    check.classList.remove('btn-green');
    check.classList.add('btn-blue');
    check.onclick = () => this.nextExercise();
  }

  nextExercise() {
    const a = this.active;
    if (!a) return;
    a.idx++;
    if (a.mode === 'lesson' && a.idx >= a.queue.length && a.repeat.length && !a.repeatsDone) {
      // повтор ошибочных упражнений в конце урока (один раз)
      a.queue = a.repeat;
      a.repeat = [];
      a.repeatsDone = true;
      a.idx = 0;
    }
    this.renderExercise();
  }

  /* ===== завершение урока / повторения ===== */
  finishSession() {
    const a = this.active;
    if (!a) return;
    if (a.mode === 'review') {
      this.toast(t('j.fr.povtorenie-zaversheno', { ok: a.ok, n: a.queue.length }));
      this.save();
      this.active = null;
      this.renderBrowse();
      return;
    }
    const lessonId = a.lesson.id;
    const already = lessonDone(this.state, lessonId);
    if (!already) {
      markLessonDone(this.state, lessonId, a.mistakes);
      const r = applyLessonReward(this.state, a.mistakes); // +монеты, +KP если без ошибок; хомяк +10 сытости/+5 радости и ест
      this.save();
      this.toast(a.mistakes === 0
        ? t('j.fr.urok-proyden-bez-oshibok', { coins: r.coins })
        : t('j.fr.urok-proyden', { coins: r.coins }));
      sfx.correct();
    } else {
      this.toast(t('j.fr.urok-uzhe-proyden')); // награда назначается один раз
    }
    this.active = null;
    this.renderBrowse();
  }
}
