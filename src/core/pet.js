export const PET_STATES = {
  IDLE: 'idle',
  EATING: 'eating',
  JUMPING: 'jumping',
  SLEEPING: 'sleeping',
  SICK: 'sick',
  HAPPY: 'happy'
};

export function petState(s) {
  if (s.health < 25) return PET_STATES.SICK;
  if (s._sleepingOverride) return PET_STATES.SLEEPING;
  if (s._eating > 0) return PET_STATES.EATING;
  if (s._jumping > 0) return PET_STATES.JUMPING;
  if (s.mood >= 60) return PET_STATES.HAPPY;
  return PET_STATES.IDLE;
}

export function tick(state, dt = 1) {
  state.health = Math.max(0, state.health - 0.3 * dt);
  state.mood = Math.max(0, state.mood - 0.25 * dt);
  state.sec = Math.max(0, state.sec - 0.1 * dt);
  if (state._jumping > 0) state._jumping = Math.max(0, state._jumping - dt);
  if (state._eating > 0) state._eating = Math.max(0, state._eating - dt);
  return state;
}

export function feed(state, amount = 12) {
  state.health = Math.min(100, state.health + amount);
  state.mood = Math.min(100, state.mood + 3);
  state._eating = 8;
  return state;
}

export function play(state) {
  state.mood = Math.min(100, state.mood + 12);
  state.health = Math.max(0, state.health - 2);
  state._jumping = 16;
  return state;
}

export function rest(state, ms = 6000) {
  state.health = Math.min(100, state.health + 8);
  state.mood = Math.min(100, state.mood + 5);
  state._sleepingOverride = true;
  setTimeout(() => { state._sleepingOverride = false; }, ms);
  return state;
}
