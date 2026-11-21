import { t, tr, getLang, applyStatic } from '../i18n.js?v=42';
import { moodAvg } from '../core/game.js?v=42';

/* ===== Генеративные ответы раздела «Помощь» через собственный edge-прокси (Supabase Edge Function,
   open source; альтернативный хост — Cloudflare Worker в worker/). API-ключ и системный промпт
   живут ТОЛЬКО на сервере; в клиенте — только публичный URL функции. URL собирается из
   window.__SUPABASE_URL__ (content/config.js): <SUPABASE_URL>/functions/v1/help-ask. ===== */
const SUPABASE_BASE = (typeof window !== 'undefined' && window.__SUPABASE_URL__ ? String(window.__SUPABASE_URL__) : '').replace(/\/+$/, '');
const HELP_AI_URL = (SUPABASE_BASE || 'https://YOUR-PROJECT-REF.supabase.co') + '/functions/v1/help-ask';
const AI_SESSION_LIMIT = 15;  // генеративных ответов за сессию; при исчерпании — честная плашка паузы, функция НЕ вызывается, ответ НЕ подменяется шаблоном
const AI_TIMEOUT_MS = 12000;  // таймаут клиента: дальше — офлайн-заготовка, никакого «вечного спиннера»
const AI_LS_KEY = 'khomyagochi_help_ai';
const AI_SID_KEY = 'khomyagochi_sid';

let lastMoodEmoji = '🙂';
export function setLastMoodEmoji(e) { if (e) lastMoodEmoji = e; }

function aiSessionId() {
  try {
    let sid = sessionStorage.getItem(AI_SID_KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(AI_SID_KEY, sid);
    }
    return sid;
  } catch { return 'static'; }
}

function aiRecord() {
  try {
    const sid = aiSessionId();
    const raw = localStorage.getItem(AI_LS_KEY);
    const rec = raw ? JSON.parse(raw) : null;
    if (rec && rec.sid === sid && typeof rec.used === 'number') return rec;
    const fresh = { sid, used: 0 };
    localStorage.setItem(AI_LS_KEY, JSON.stringify(fresh));
    return fresh;
  } catch { return { sid: 'static', used: 0 }; }
}

export function aiLeft() { return Math.max(0, AI_SESSION_LIMIT - aiRecord().used); }

function aiConsume() {
  try {
    const rec = aiRecord();
    rec.used += 1;
    localStorage.setItem(AI_LS_KEY, JSON.stringify(rec));
  } catch { /* localStorage недоступен — просто не считаем */ }
}

/* Запрос к прокси. НИКОГДА не бросает и всегда возвращает объект:
   { text, source, cached } — есть сгенерированный ответ;
   { fallback: true, rateLimited?, noLimit? } — показать локальную заготовку. */
export async function askHelpAI(emotion, topic, custom) {
  if (aiLeft() <= 0) return { fallback: true, noLimit: true };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const resp = await fetch(HELP_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emotion, topic, custom: (custom || '').slice(0, 500), lang: getLang() }),
      signal: ctrl.signal
    });
    if (resp.status === 429) return { fallback: true, rateLimited: true };
    if (!resp.ok) return { fallback: true }; // 503 {fallback:true} и любые другие статусы — заготовка
    const data = await resp.json().catch(() => null);
    if (!data || data.fallback || typeof data.answer !== 'string' || !data.answer.trim()) {
      return { fallback: true };
    }
    aiConsume();
    return { text: data.answer, cached: !!data.cached, source: data.source || 'gen' };
  } catch {
    return { fallback: true }; // сеть недоступна / таймаут 12 с — заготовка
  } finally {
    clearTimeout(timer);
  }
}

export function renderMoodChart(state, el) {
  const days = {};
  (state.moodLog || []).slice(-60).forEach((e) => {
    if (!days[e.d]) days[e.d] = [];
    days[e.d].push(e.m);
  });
  const entries = Object.entries(days).slice(-7);
  el.innerHTML = '';
  if (!entries.length) {
    el.innerHTML = `<p style="color:var(--ink-soft);font-size:.9rem;font-weight:600">${t("h.otmechay-nastroenie-poyavitsya-grafik")}</p>`;
    return;
  }
  const avg = moodAvg(state.moodLog, 7);
  const wrap = document.createElement('div');
  wrap.className = 'mood-chart';
  const maxVal = 5;
  entries.forEach(([d, vals]) => {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const col = document.createElement('div');
    col.className = 'mood-col';
    const bar = document.createElement('div');
    bar.className = 'mood-bar';
    bar.style.height = Math.round(mean / maxVal * 100) + '%';
    bar.style.background = mean >= 4 ? '#58cc02' : mean >= 3 ? '#ffd166' : '#ea4b4b';
    const cap = document.createElement('span');
    cap.className = 'mood-day';
    cap.textContent = d.slice(0, 3);
    col.appendChild(bar); col.appendChild(cap);
    wrap.appendChild(col);
  });
  el.appendChild(wrap);
  const avgEl = document.createElement('p');
  avgEl.style.cssText = 'color:var(--ink-soft);font-size:.85rem;font-weight:700;margin-top:8px';
  avgEl.textContent = t("j.support.srednee-za-nedelyu", { avg: avg.toFixed(1) });
  el.appendChild(avgEl);
}

function crisisWords() {
  return [t("j.support.suitsid-2"), t("j.support.pokonchit-2"), t("j.support.ubit-sebya-2"), t("j.support.ne-hochu-zhit-2"), t("j.support.umeret-2"), t("j.support.pokonchit-s-soboy-2"), t("j.support.sdelat-s-soboy-2"), t("j.support.vse-nadoelo-navsegda-2")];
}

const TOPICS_RAW = (typeof window !== 'undefined' && window.__CONTENT__ && window.__CONTENT__.topics) || [];
function topics() { return tr(TOPICS_RAW, 'c.content.topics'); }

function detectCrisis(text) {
  const t = text.toLowerCase();
  return crisisWords().some((w) => t.includes(w));
}

function detectTopic(text) {
  const t = text.toLowerCase();
  for (const topic of topics()) {
    if (topic.words.some((w) => t.includes(w))) return topic;
  }
  return null;
}

/* Fallback для свободного текста без темы — ТОЛЬКО при недоступности генеративного ответа
/* Fallback при РЕАЛЬНОЙ ошибке сети/функции (503/429/таймаут/сеть) — и ТОЛЬКО он:
   поддерживающая заготовка, своя для каждой темы (topic.empath) и каждой эмоции
   (MOOD_FALLBACKS). В основном пути статических «ответов ассистента» нет вообще —
   любой ввод пользователя (длинный, короткий, эмодзи) уходит в генерацию через прокси. */
function moodFallbacks() {
  return {
  '😞': t("j.support.mne-ochen-zhal-chto-2"),
  '😕': t("j.support.vizhu-chto-tebe-seychas-2"),
  '😐': t("j.support.ponimayu-tebya-inogda-prosto-2"),
  '🙂': t("j.support.ya-slyshu-tebya-i-2"),
  '😄': t("j.support.rad-tebya-videt-rasskazhi-2"),
  };
}

export function pickFallback(emotion, topicLabel) {
  const tp = topics().find((x) => x.label === topicLabel);
  if (tp) return tp.empath;
  return moodFallbacks()[emotion] || moodFallbacks()['🙂'];
}

export class ChatUI {
  constructor(content, state, { onLog, sfx, actions }) {
    this.content = content;
    this.state = state;
    this.log = onLog;
    this.sfx = sfx;
    this.actions = actions;
    this.el = null;
    this.msgsEl = null;
    this.stage = 'greeting';
    this.topic = null;
    this.step = 0;
  }

  mount(el) {
    this.el = el;
    el.innerHTML = `
      <div class="chat-header">
        <span class="ch-avatar">🐹</span>
        <div>
          <div class="ch-name" data-i18n="h.homya-psiholog"></div>
          <div class="ch-status" data-i18n="h.na-svyazi-anonimno"></div>
        </div>
      </div>
      <div class="chat-msgs" id="chatMsgs"></div>
      <div class="chat-input-row">
        <input id="chatInput" placeholder="" data-i18n-ph="h.rasskazhi-chto-chuvstvuesh" maxlength="200">
        <button class="btn btn-purple" id="chatSend" style="padding:12px 18px">➤</button>
      </div>
      <div class="chat-quick" id="chatQuick"></div>`;
    applyStatic(el);
    this.msgsEl = el.querySelector('#chatMsgs');
    const input = el.querySelector('#chatInput');
    const send = el.querySelector('#chatSend');
    send.onclick = () => this.send(input);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.send(input); });
    this.renderQuick([t("j.support.trevoga-4"), t("j.support.stress-i-ucheba-4"), t("j.support.grustno-4"), t("j.support.odinoko-4"), t("j.support.zlyus-4"), t("j.support.mne-horosho-4")]);
    this.bot(t("j.support.privet-ya-homyak-psiholog-2"));
    this.analyzeWeek();
  }

  relocalize() {
    if (!this.el) return;
    applyStatic(this.el);
    if (this.topic) {
      const tp = topics().find((x) => x.id === this.topic.id);
      if (tp) this.topic = tp;
    }
    this.renderQuick([t("j.support.trevoga-4"), t("j.support.stress-i-ucheba-4"), t("j.support.grustno-4"), t("j.support.odinoko-4"), t("j.support.zlyus-4"), t("j.support.mne-horosho-4")]);
  }

  renderQuick(options) {
    const q = this.el.querySelector('#chatQuick');
    q.innerHTML = '';
    options.forEach((o) => {
      const b = document.createElement('button');
      b.className = 'chat-chip';
      b.textContent = o;
      b.onclick = () => {
        this.el.querySelector('#chatInput').value = o;
        this.send(this.el.querySelector('#chatInput'));
      };
      q.appendChild(b);
    });
  }

  addMsg(text, who) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + who;
    div.textContent = text;
    this.msgsEl.appendChild(div);
    this.msgsEl.scrollTop = this.msgsEl.scrollHeight;
    if (who === 'bot' && this.sfx) this.sfx.blip();
  }

  bot(text, delay = 500) {
    setTimeout(() => this.addMsg(text, 'bot'), delay);
  }

  /* Системная плашка (не сообщение ассистента): пауза по лимиту сессии, rate-limit и т.п. */
  note(text) {
    const div = document.createElement('div');
    div.className = 'chat-note';
    div.textContent = text;
    this.msgsEl.appendChild(div);
    this.msgsEl.scrollTop = this.msgsEl.scrollHeight;
  }

  /* Псевдо-typewriter: ответ «оживает» (~30 мс/символ, длинные — быстрее). */
  typeBot(text, done) {
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    this.msgsEl.appendChild(div);
    if (this.sfx) this.sfx.blip();
    let i = 0;
    const step = text.length > 240 ? 3 : text.length > 120 ? 2 : 1;
    const iv = setInterval(() => {
      i += step;
      div.textContent = text.slice(0, i);
      this.msgsEl.scrollTop = this.msgsEl.scrollHeight;
      if (i >= text.length) {
        clearInterval(iv);
        div.textContent = text;
        this.msgsEl.scrollTop = this.msgsEl.scrollHeight;
        if (done) done();
      }
    }, 30);
  }

  /* Единый путь для ЛЮБОГО ввода (кнопка-категория ИЛИ свободный текст любой длины):
     всегда генерация через прокси. Статический текст — только при реальном промахе
     (fallback-заготовка по теме/эмоции) либо плашка-пауза при исчерпанном лимите сессии. */
  async aiAnswer(customText, done) {
    const topic = this.topic; // null при свободном вводе — тогда генерируем только по custom
    const r = await askHelpAI(lastMoodEmoji, topic ? topic.label : '', customText || '');
    if (topic && this.topic && this.topic.id !== topic.id) { if (done) done(); return; } // тему сменили, пока ждали
    if (r.noLimit) {
      // Лимит сессии исчерпан: функция НЕ вызывается, ответ НЕ подменяется шаблоном — только честная плашка
      this.note(t("j.support.davay-sdelaem-pauzu-ya-2"));
      if (done) done();
      return;
    }
    if (r.text) {
      this.typeBot(r.text, () => { if (topic) this.offerTools(); if (done) done(); });
    } else {
      // fallback ТОЛЬКО при реальной ошибке сети/функции (503/429/сеть/таймаут): заготовка по теме или эмоции
      this.bot(pickFallback(lastMoodEmoji, topic ? topic.label : ''), 400);
      if (topic) this.bot(t("j.support.skazhi", { q: topic.asks[0] }), 1000);
      if (r.rateLimited) this.note(t("j.support.chut-otdohni-nemnogo-ya-2"));
      setTimeout(() => { if (done) done(); }, 1500);
    }
  }

  send(input) {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.addMsg(text, 'me');
    if (this.sfx) this.sfx.click();

    if (detectCrisis(text)) { this.crisis(); return; }

    if (this.stage === 'greeting') {
      this.topic = detectTopic(text);
      if (this.topic) this.stage = 'dialog';
    }
    // Единый путь: любой ввод (чип-категория, свободный текст любой длины, эмодзи) идёт в генерацию
    this.aiAnswer(text);
  }

  offerTools() {
    const q = this.el.querySelector('#chatQuick');
    q.innerHTML = '';
    this.topic.tools.forEach((tool) => {
      const b = document.createElement('button');
      b.className = 'chat-chip tool';
      b.textContent = tool.label;
      b.onclick = () => this.actions.goTo(tool.tab, tool.label);
      q.appendChild(b);
    });
    const regen = document.createElement('button');
    regen.className = 'chat-chip';
    regen.textContent = t("j.support.esche-odin-variant-2");
    regen.onclick = () => { this.aiAnswer(''); }; // перегенерация, считается в лимит
    q.appendChild(regen);
    const other = document.createElement('button');
    other.className = 'chat-chip';
    other.textContent = t("j.support.pogovorit-o-drugom-2");
    other.onclick = () => {
      this.stage = 'greeting';
      this.renderQuick([t("j.support.trevoga-2"), t("j.support.stress-i-ucheba-2"), t("j.support.grustno-2"), t("j.support.odinoko-2"), t("j.support.zlyus-2"), t("j.support.mne-horosho-2")]);
      this.bot(t("j.support.horosho-o-chem-hochesh-2"));
    };
    q.appendChild(other);
  }

  crisis() {
    this.addMsg(t("j.support.stop-to-chto-ty-2"), 'bot');
    this.addMsg(t("j.support.pozhaluysta-svyazhis-seychas-s-2"), 'bot');
    this.addMsg(t("j.support.112-ekstrennye-sluzhby-2"), 'bot');
    this.addMsg(t("j.support.8-800-2000-122-2"), 'bot');
    this.addMsg(t("j.support.8-800-100-49-2"), 'bot');
    this.addMsg(t("j.support.pozvoni-razgovor-s-zhivym-2"), 'bot');
    const q = this.el.querySelector('#chatQuick');
    q.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'chat-chip tool';
    b.textContent = t("j.support.ostatsya-v-chate-rasskazyvay-2");
    q.appendChild(b);
    this.stage = 'greeting';
    this.log && this.log(t("j.support.homyak-napravil-k-pomoschi-2"));
  }

  analyzeWeek() {
    const log = this.state.moodLog || [];
    if (log.length < 3) return;
    const avg = moodAvg(log, 7);
    if (avg !== null && avg < 2.8) {
      setTimeout(() => {
        this.addMsg(t("j.support.kstati-ya-smotryu-tvoy-2"), 'bot');
      }, 2200);
    } else if (avg !== null && avg >= 4) {
      setTimeout(() => {
        this.addMsg(t("j.support.vizhu-chto-nedelya-v-2"), 'bot');
      }, 2200);
    }
  }
}
