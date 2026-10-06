import { lessonProgress, saveLessonProgress, courseProgress, totalProgress, lessonKey } from '../core/lessons.js';
import { gainXP } from '../core/game.js';

export class LessonUI {
  constructor(content, state, { onSave, onLog, onPuff }) {
    this.courses = content.courses;
    this.state = state;
    this.onSave = onSave;
    this.onLog = onLog;
    this.onPuff = onPuff;
    this.active = null;
  }

  renderList(el) {
    el.innerHTML = '';
    const tp = totalProgress(this.state, this.courses);
    const head = document.createElement('p');
    head.className = 'section-sub';
    head.textContent = 'Пройди уроки: ' + tp.done + '/' + tp.total + ' (' + tp.pct + '%)';
    el.appendChild(head);
    this.courses.forEach((c) => {
      const p = courseProgress(this.state, c);
      const card = document.createElement('div');
      card.className = 'course';
      card.innerHTML =
        '<div class="course-head"><span class="course-emoji">' + c.emoji + '</span>' +
        '<span class="course-title">' + c.title + '</span></div>' +
        '<div class="course-bar"><div class="course-fill" style="width:' + p.pct + '%;background:' + c.color + '"></div></div>' +
        '<span class="course-pct">' + p.done + '/' + p.total + '</span>';
      const list = document.createElement('div');
      list.className = 'lesson-list';
      c.lessons.forEach((l, i) => {
        const done = (this.state.lessons[lessonKey(c.id, l.id)] || 0) >= l.scenes.length;
        const started = (this.state.lessons[lessonKey(c.id, l.id)] || 0) > 0;
        const btn = document.createElement('button');
        btn.className = 'lesson-btn' + (done ? ' done' : started ? ' started' : '');
        btn.innerHTML = (done ? '✓ ' : (i + 1) + '. ') + l.title;
        btn.onclick = () => this.start(c, l, el);
        list.appendChild(btn);
      });
      card.appendChild(list);
      el.appendChild(card);
    });
  }

  start(course, lesson, container) {
    this.active = { course, lesson, idx: (this.state.lessons[lessonKey(course.id, lesson.id)] || 0), container };
    this.showScene();
  }

  showScene() {
    const { course, lesson, idx, container } = this.active;
    if (idx >= lesson.scenes.length) { this.finish(); return; }
    const sc = lesson.scenes[idx];
    const box = document.createElement('div');
    box.className = 'lesson-scene';
    const title = document.createElement('h4');
    title.textContent = course.emoji + ' ' + lesson.title + ' — сцена ' + (idx + 1) + '/' + lesson.scenes.length;
    box.appendChild(title);
    if (sc.text) {
      const p = document.createElement('p');
      p.className = 'lesson-text';
      p.textContent = sc.text;
      box.appendChild(p);
      const next = document.createElement('button');
      next.className = 'act primary';
      next.textContent = 'ДАЛЕЕ →';
      next.onclick = () => this.advance();
      box.appendChild(next);
    } else if (sc.q) {
      const q = document.createElement('p');
      q.className = 'lesson-q';
      q.textContent = sc.q;
      box.appendChild(q);
      const btns = document.createElement('div');
      btns.className = 'lesson-btns';
      sc.a.forEach((opt, i) => {
        const b = document.createElement('button');
        b.textContent = opt;
        b.onclick = () => {
          Array.prototype.forEach.call(btns.children, (c, j) => {
            c.classList.add(j === sc.ok ? 'ok' : 'bad');
            c.disabled = true;
          });
          const fb = document.createElement('p');
          fb.className = 'lesson-tip';
          fb.textContent = (i === sc.ok ? '✅ ВЕРНО! ' : '❌ ОЙ! ') + (sc.tip || '');
          box.appendChild(fb);
          const next = document.createElement('button');
          next.className = 'act primary';
          next.textContent = 'ДАЛЕЕ →';
          next.onclick = () => this.advance();
          box.appendChild(next);
        };
        btns.appendChild(b);
      });
      box.appendChild(btns);
    }
    this.sceneBox = box;
    container.replaceChildren(box);
  }

  advance() {
    const { course, lesson, idx } = this.active;
    const sc = lesson.scenes[idx];
    if (sc.xp) {
      const r = saveLessonProgress(this.state, lessonKey(course.id, lesson.id), idx, lesson.scenes.length, sc.xp, gainXP);
      if (r.completed && r.firstTime) {
        this.onLog && this.onLog('🎓 урок «' + lesson.title + '» пройден! +' + sc.xp + ' XP');
        this.onPuff && this.onPuff('★', '#ffd166');
      } else if (sc.xp) {
        gainXP(this.state, sc.xp);
      }
      this.onSave();
    }
    this.active.idx++;
    this.showScene();
  }

  finish() {
    this.onLog && this.onLog('🎓 курс продвинулся дальше!');
    this.renderList(this.active.container);
    this.active = null;
  }
}
