const NOTES = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, E6: 1318.51, G6: 1567.98
};

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = (localStorage.getItem('khomyagochi_sound') || '1') === '1';
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('khomyagochi_sound', this.enabled ? '1' : '0');
    if (this.enabled) this.blip();
    return this.enabled;
  }

  tone(freq, dur = 0.08, type = 'square', vol = 0.12, when = 0, slide = 0) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  seq(notes, step = 0.09, type = 'square', vol = 0.12) {
    notes.forEach((n, i) => {
      const f = typeof n === 'number' ? n : NOTES[n];
      if (f) this.tone(f, step * 1.2, type, vol, i * step);
    });
  }

  blip() { this.tone(NOTES.E5, 0.06, 'square', 0.08); }
  click() { this.tone(NOTES.C5, 0.05, 'triangle', 0.1); }
  pet() { this.seq(['E5', 'G5', 'C6'], 0.07, 'triangle', 0.1); }
  feed() { this.seq(['C5', 'E5', 'G5'], 0.06, 'square', 0.09); }
  play() { this.seq(['G4', 'C5', 'E5', 'G5'], 0.07, 'square', 0.11); }
  coin() { this.seq(['B5', 'E6'], 0.06, 'square', 0.12); }
  levelup() { this.seq(['C5', 'E5', 'G5', 'C6', 'E6'], 0.09, 'square', 0.12); }
  wrong() { this.tone(180, 0.25, 'sawtooth', 0.1, 0, -100); this.tone(120, 0.3, 'square', 0.08, 0.1); }
  correct() { this.seq(['C5', 'G5', 'C6'], 0.08, 'square', 0.12); }
  sleep() { this.seq(['G4', 'E4', 'C4'], 0.18, 'triangle', 0.08); }
  wake() { this.seq(['C4', 'E4', 'G4'], 0.1, 'triangle', 0.09); }
  wheel() {
    for (let i = 0; i < 8; i++) this.tone(NOTES.C5 + i * 40, 0.05, 'square', 0.06, i * 0.06);
  }
  heart() { this.seq(['E5', 'A5', 'C6', 'E6'], 0.06, 'sine', 0.12); }
  tab() { this.tone(NOTES.D5, 0.04, 'triangle', 0.07); }
}

export const sfx = new SoundFX();
