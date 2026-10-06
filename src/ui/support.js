import { moodAvg } from '../core/game.js';

export function renderMoodChart(state, el) {
  const days = {};
  state.moodLog.slice(-60).forEach((e) => {
    if (!days[e.d]) days[e.d] = [];
    days[e.d].push(e.m);
  });
  const entries = Object.entries(days).slice(-7);
  el.innerHTML = '';
  if (!entries.length) {
    el.innerHTML = '<p class="section-sub">Отмечай настроение — появится график недели ♥</p>';
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
    bar.style.background = mean >= 4 ? '#4ec97a' : mean >= 3 ? '#ffd166' : '#e5484d';
    const cap = document.createElement('span');
    cap.className = 'mood-day';
    cap.textContent = d.slice(0, 3);
    col.appendChild(bar); col.appendChild(cap);
    wrap.appendChild(col);
  });
  el.appendChild(wrap);
  const avgEl = document.createElement('p');
  avgEl.className = 'section-sub';
  avgEl.textContent = 'Среднее за неделю: ' + avg.toFixed(1) + '/5';
  el.appendChild(avgEl);
}

export function startGrounding(content, labelEl, stepsEl, done) {
  let idx = 0;
  const steps = content.grounding;
  labelEl.textContent = 'начни, когда будешь готов(а)';
  return function next() {
    if (idx >= steps.length) {
      labelEl.textContent = 'ты справился(лась) ★ вернись сюда, когда накроет';
      stepsEl.innerHTML = '';
      done && done();
      return;
    }
    const st = steps[idx];
    labelEl.textContent = 'шаг ' + st.n + ' из 5';
    stepsEl.innerHTML = '';
    const dots = document.createElement('div');
    dots.className = 'ground-dots';
    steps.forEach((s, i) => {
      const d = document.createElement('span');
      d.className = 'ground-dot' + (i < idx ? ' done' : i === idx ? ' cur' : '');
      d.textContent = s.n;
      dots.appendChild(d);
    });
    const txt = document.createElement('p');
    txt.className = 'ground-text';
    txt.textContent = st.text;
    stepsEl.appendChild(dots);
    stepsEl.appendChild(txt);
    idx++;
  };
}
