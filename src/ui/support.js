import { moodAvg } from '../core/game.js?v=40';

/* ===== Генеративные ответы раздела «Помощь» через собственный edge-прокси (Supabase Edge Function,
   open source; альтернативный хост — Cloudflare Worker в worker/). API-ключ и системный промпт
   живут ТОЛЬКО на сервере; в клиенте — только публичный URL функции. URL собирается из
   window.__SUPABASE_URL__ (content/config.js): <SUPABASE_URL>/functions/v1/help-ask. ===== */
const SUPABASE_BASE = (typeof window !== 'undefined' && window.__SUPABASE_URL__ ? String(window.__SUPABASE_URL__) : '').replace(/\/+$/, '');
const HELP_AI_URL = (SUPABASE_BASE || 'https://YOUR-PROJECT-REF.supabase.co') + '/functions/v1/help-ask';
const AI_SESSION_LIMIT = 3;   // генеративных ответов за сессию (локальный лимит, пользователь о нём не знает)
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
      body: JSON.stringify({ emotion, topic, custom: (custom || '').slice(0, 500) }),
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
    el.innerHTML = '<p style="color:var(--ink-soft);font-size:.9rem;font-weight:600">Отмечай настроение — появится график недели ❤️</p>';
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
  avgEl.textContent = 'Среднее за неделю: ' + avg.toFixed(1) + '/5';
  el.appendChild(avgEl);
}

const CRISIS_WORDS = ['суицид', 'покончить', 'убить себя', 'не хочу жить', 'умереть', 'покончить с собой', 'сделать с собой', 'всё надоело навсегда'];

const TOPICS = [
  {
    id: 'anxiety', label: 'тревога', words: ['тревог', 'паник', 'боюсь', 'страшно', 'страха', 'нервнича', 'волну', 'трясет', 'паник атак', 'паника атак'],
    empath: 'Тревога — это очень тяжело. Тело как будто говорит тревогу без причины, и это изменяет. Ты не слабый(ая) — тревога так работает.',
    asks: ['где ты её чувствуешь больше всего — в теле или в мыслях?', 'что обычно помогает тебе чуть-чуть отпустить?'],
    tools: [{ label: '🛏️ отдохнуть с хомяком в домике', tab: 'home' }, { label: '💪 отметить привычку — забота о себе', tab: 'habit' }],
    tips: ['Медленный выдох длиннее вдоха — сигнал мозгу «мы в безопасности».', 'Тревога — не факт о будущем, а эмоция в настоящем.']
  },
  {
    id: 'stress', label: 'стресс и учёба', words: ['стресс', 'устал', 'выгор', 'перегруз', 'не успева', 'завал', 'дедлайн', 'сесси', 'экзамен', 'контрольн'],
    empath: 'Похоже, на тебя сейчас давит много всего сразу. Когда всё срочно — легко забыть, что ты живой человек, а не машина для задач.',
    asks: ['если бы можно было отложить одну вещь — какую?', 'когда ты последний раз пил(а) воду?'],
    tools: [{ label: '📝 отметить привычку', tab: 'habit' }, { label: '🏠 посидеть с хомяком', tab: 'home' }],
    tips: ['Правило 15 минут: мозг боится «всего», но справляется с маленьким кусочком.', 'Отдых — не награда за работу, а условие.']
  },
  {
    id: 'sad', label: 'грустно', words: ['груст', 'тоск', 'печаль', 'плохо на душе', 'депресс', 'плак', 'пусто внутри'],
    empath: 'Мне жаль, что сейчас так. Грусть — не слабость, а знак, что тебе не безразлично то, что происходит. Хомяк рядом, ты не один(одна).',
    asks: ['как давно ты так себя чувствуешь?', 'есть ли кто-то, кому ты можешь об этом сказать?'],
    tools: [{ label: '💬 поговорить с хомяком в домике', tab: 'home' }, { label: '🧠 заземление 5-4-3-2-1', tab: 'ground' }],
    tips: ['Если тоска держится дольше двух недель — это повод поговорить со специалистом. Это нормальная забота о себе.', 'Не нужно быть «сильным(ой)» постоянно. Просить помощи — это навык.']
  },
  {
    id: 'anger', label: 'злюсь', words: ['злюсь', 'бесит', 'злость', 'ненавиж', 'раздража', 'ярост'],
    empath: 'Злость часто — сигнал, что твои границы нарушили. Он не «плохая», она — причина что-то важное для тебя.',
    asks: ['что именно задело больше всего?', 'если бы злость могла говорить — что бы она сказала?'],
    tools: [{ label: '🏠 пойти погладить хомяка', tab: 'home' }],
    tips: ['Злость — вторичная эмоция: под ней часто обида или усталость.', 'Физическая разрядка (пройтись, сжать-разжать кулаки) помогает сбросить напряжение.']
  },
  {
    id: 'lonely', label: 'одиноко', words: ['одинок', 'никто не поним', 'нет друзей', 'не с кем', 'изолиров'],
    empath: 'Одиночество — одна из самых человеческих болей. Особенно когда вокруг люди, а ощущение — «некому».',
    asks: ['в каком моменте тебе особенно одиноко?', 'был ли человек, с которым было легко?'],
    tools: [{ label: '💜 чек-ин настроения', tab: 'mood' }],
    tips: ['Одиночество — сигнал о потребности в близости, а не «не со мной что-то не так».', 'Один честный «мне сейчас одиноко» сокращает дистанцию больше, чем «нормально».']
  },
  {
    id: 'study', label: 'учёба', words: ['учеб', 'универ', 'школ', 'провал', 'оценк', 'не получ', 'не поним', 'отчисл', 'тест'],
    empath: 'Учёба давит, когда кажется, что оценка = твоя ценность. Но это не так. Один тест — не приговор твоим способностям.',
    asks: ['какая часть учёбы даётся сильнее всего?', 'что для тебя в учёбе важно — оценки или знания?'],
    tools: [{ label: '🎓 закрыть — урок', tab: 'lessons' }],
    tips: ['«Я ярлык» («я тупой») — когнитивное искажение. Факт «не сдал» ≠ вывод о себе.', 'Сон и конспекты важнее зубрёжки.']
  },
  {
    id: 'sleep', label: 'сон', words: ['не сплю', 'бессонн', 'не могу уснуть', 'не высыпа', 'сон', 'ночн кошмар'],
    empath: 'Без сна всё кажется тяжелее — это не лень, тело реально восстанавливается ночью. Хомяк спец по сну, он знает.',
    asks: ['что мешает уснуть — мысли или тело?', 'сколько ты спишь в обычную ночь?'],
    tools: [{ label: '📵 привычка «без телефона перед сном»', tab: 'habit' }],
    tips: ['Экран за 30 минут до сна — главный вор сна у студентов.', 'Один и тот же время отхода ко сну важнее, чем «доспать» в выходные.']
  },
  {
    id: 'good', label: 'мне хорошо 👋', words: ['хорошо', 'отлично', 'рад', 'счастлив', 'круто', 'получилось', 'горж'],
    empath: 'Здорово! Хорошее важно замечать так же, как и тяжёлое. Хомяк шепчет лапкой и радуется с тобой! 🎉',
    asks: ['что случилось хорошего?', 'чем ты можешь это отметить?'],
    tools: [{ label: '🎓 закрепить — урок', tab: 'lessons' }],
    tips: ['Фиксация хорошего укрепляет ресурс.', 'Поделись радостью — она станет больше.']
  }
];

function detectCrisis(text) {
  const t = text.toLowerCase();
  return CRISIS_WORDS.some((w) => t.includes(w));
}

function detectTopic(text) {
  const t = text.toLowerCase();
  for (const topic of TOPICS) {
    if (topic.words.some((w) => t.includes(w))) return topic;
  }
  return null;
}

/* Fallback для свободного текста без темы — ТОЛЬКО при недоступности генеративного ответа
   (сама фраза из основного пути убрана: любой ввод уходит в прокси). */
const GENERIC_FALLBACK = 'Слышу тебя. Расскажи чуть побольше — что чувствуешь больше всего? Можно простыми словами: тревога, грусть, злость, усталость...';

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
          <div class="ch-name">Хомя-психолог</div>
          <div class="ch-status">● на связи • анонимно</div>
        </div>
      </div>
      <div class="chat-msgs" id="chatMsgs"></div>
      <div class="chat-input-row">
        <input id="chatInput" placeholder="расскажи, что чувствуешь..." maxlength="200">
        <button class="btn btn-purple" id="chatSend" style="padding:12px 18px">➤</button>
      </div>
      <div class="chat-quick" id="chatQuick"></div>`;
    this.msgsEl = el.querySelector('#chatMsgs');
    const input = el.querySelector('#chatInput');
    const send = el.querySelector('#chatSend');
    send.onclick = () => this.send(input);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.send(input); });
    this.renderQuick(['тревога', 'стресс и учёба', 'грустно', 'одиноко', 'злюсь', 'мне хорошо 👋']);
    this.bot('Привет! Я хомяк-психолог. Здесь можно писать как есть — без цензуры и осуждения. С чего начнём?');
    this.analyzeWeek();
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

  /* Ответ на выбранную тему: сначала генеративный ответ через прокси,
     при ЛЮБОМ промахе (503/429/сеть/лимит/таймаут) — обычная офлайн-заготовка. */
  /* Единый путь для ЛЮБОГО ввода (кнопка-категория И свободный текст):
     сначала генеративный ответ через прокси, при ЛЮБОМ промахе — офлайн-заготовка. */
  async aiAnswer(customText, done) {
    const topic = this.topic; // null при свободном вводе — тогда генерируем по одному custom
    const r = await askHelpAI(lastMoodEmoji, topic ? topic.label : '', customText || '');
    if (topic && this.topic && this.topic.id !== topic.id) { if (done) done(); return; } // тему сменили, пока ждали
    if (r.text) {
      this.typeBot(r.text, done);
    } else {
      this.bot(topic ? topic.empath : GENERIC_FALLBACK, 400); // fallback-слой, в основном пути не используется
      if (r.rateLimited) this.bot('Чуть отдохни немного 🙂 Я рядом.', 1000);
      setTimeout(() => { if (done) done(); }, 1200);
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
      if (this.topic) {
        this.stage = 'dialog';
        this.step = 0;
        this.aiAnswer(text, () => this.bot('Скажи, ' + this.topic.asks[0], 500));
      } else {
        this.aiAnswer(text); // свободный текст — тот же генеративный путь, что и кнопки-категории
      }
    } else if (this.stage === 'dialog') {
      this.continueDialog(text);
    }
  }

  continueDialog() {
    if (this.step === 0) {
      this.bot('Понимаю. ' + (this.topic.asks[1] ? 'И ещё: ' + this.topic.asks[1] : 'Что бы тебе сейчас помогло чуть-чуть?'), 500);
      this.step++;
    } else if (this.step === 1) {
      const tip = this.topic.tips[Math.floor(Math.random() * this.topic.tips.length)];
      this.bot('Спасибо, что поделился(лась). Запомни: ' + tip, 500);
      this.offerTools();
      this.step++;
    }
  }

  offerTools() {
    this.bot('Могу предложить что-то прямое сейчас:', 1400);
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
    regen.textContent = '🔄 ещё один вариант';
    regen.onclick = () => { this.aiAnswer(''); }; // перегенерация, считается в лимит
    q.appendChild(regen);
    const other = document.createElement('button');
    other.className = 'chat-chip';
    other.textContent = 'поговорить о другом';
    other.onclick = () => {
      this.stage = 'greeting';
      this.renderQuick(['тревога', 'стресс и учёба', 'грустно', 'одиноко', 'злюсь', 'мне хорошо 👋']);
      this.bot('Хорошо. О чём хочешь поговорить?');
    };
    q.appendChild(other);
  }

  wrapUp() {
    this.bot('Ты большой молодец, что не держишь это всё в себе. Если захочешь ещё — я тут, всегда. 💜', 400);
    this.stage = 'greeting';
    this.renderQuick(['тревога', 'стресс и учёба', 'грустно', 'одиноко', 'злюсь', 'мне хорошо 👋']);
  }

  crisis() {
    this.addMsg('Стоп. То, что ты описываешь, — очень серьёзно. Ты не должен(а) проходить это в одиночку.', 'bot');
    this.addMsg('Пожалуйста, свяжись сейчас с кем-то, кто может помочь:', 'bot');
    this.addMsg('📞 112 — экстренные службы', 'bot');
    this.addMsg('📞 8-800-2000-122 — телефон доверия, круглосуточно, бесплатно, анонимно', 'bot');
    this.addMsg('📞 8-800-100-49-94 — психологическая помощь взрослым', 'bot');
    this.addMsg('Позвони. Разговор с живым человеком в такой момент — не слабость, а забота о себе. Хомяк верит в тебя. 💜', 'bot');
    const q = this.el.querySelector('#chatQuick');
    q.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'chat-chip tool';
    b.textContent = '💬 остаться в чате — рассказывай дальше';
    q.appendChild(b);
    this.stage = 'greeting';
    this.log && this.log('💜 хомяк направил к помощи');
  }

  analyzeWeek() {
    const log = this.state.moodLog || [];
    if (log.length < 3) return;
    const avg = moodAvg(log, 7);
    if (avg !== null && avg < 2.8) {
      setTimeout(() => {
        this.addMsg('Кстати, я смотрю твой график недели: настроение было невысоким несколько дней. Если так держится — это повод поговорить со специалистом. Хочешь об этом?', 'bot');
      }, 2200);
    } else if (avg !== null && avg >= 4) {
      setTimeout(() => {
        this.addMsg('Вижу, что неделя в целом была хорошей — радуюсь вместе с тобой! ✨', 'bot');
      }, 2200);
    }
  }
}
