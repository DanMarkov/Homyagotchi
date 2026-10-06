export function lessonKey(courseId, lessonId) { return courseId + '/' + lessonId; }

export function lessonProgress(state, key) { return state.lessons[key] || 0; }

export function saveLessonProgress(state, key, sceneIdx, totalScenes, gainedXp, gainXPFn) {
  const prev = state.lessons[key] || 0;
  if (sceneIdx + 1 > prev) state.lessons[key] = Math.min(totalScenes, sceneIdx + 1);
  if (state.lessons[key] >= totalScenes) {
    const doneKey = key + ':done';
    if (!state.lessons[doneKey]) {
      state.lessons[doneKey] = 1;
      if (gainXPFn) gainXPFn(state, gainedXp);
      return { completed: true, firstTime: true };
    }
    return { completed: true, firstTime: false };
  }
  return { completed: false };
}

export function courseProgress(state, course) {
  const total = course.lessons.length;
  const done = course.lessons.filter((l) => (state.lessons[course.id + '/' + l.id] || 0) >= l.scenes.length).length;
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}

export function totalProgress(state, courses) {
  let done = 0, total = 0;
  courses.forEach((c) => {
    const p = courseProgress(state, c);
    done += p.done; total += p.total;
  });
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}
