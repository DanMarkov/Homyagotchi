export function dayPhase(hour) {
  if (hour >= 6 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export const SKIES = {
  dawn: { top: '#ffb886', mid: '#ffd9a8', bot: '#a8d8f0', sun: '#ff9a4d', star: 0, tint: 'rgba(255,180,120,.14)' },
  day: { top: '#7fd8f8', mid: '#a8ecff', bot: '#c8f4ff', sun: '#ffd166', star: 0, tint: null },
  dusk: { top: '#8a6ab8', mid: '#e88a6b', bot: '#ffd9a8', sun: '#ff6b4d', star: 0, tint: 'rgba(150,100,180,.16)' },
  night: { top: '#1a2350', mid: '#2a3568', bot: '#4858a8', sun: null, star: 1, tint: 'rgba(30,40,110,.28)' }
};

export function drawSky(g, phase, t) {
  const sky = SKIES[phase] || SKIES.day;
  const W = 52, H = 48;
  g.fillStyle = sky.top; g.fillRect(3, 3, W, H * 0.4);
  g.fillStyle = sky.mid; g.fillRect(3, 3 + H * 0.4, W, H * 0.3);
  g.fillStyle = sky.bot; g.fillRect(3, 3 + H * 0.7, W, H * 0.3);
  if (sky.star) {
    for (let i = 0; i < 8; i++) {
      const sx = 6 + (i * 13) % 46, sy = 5 + (i * 7) % 20;
      if (Math.floor(t * 2 + i) % 4 !== 0) {
        g.fillStyle = '#fff';
        g.fillRect(sx, sy, 1, 1);
        if (i % 3 === 0) { g.fillRect(sx - 1, sy, 1, 1); g.fillRect(sx + 1, sy, 1, 1); g.fillRect(sx, sy - 1, 1, 1); g.fillRect(sx, sy + 1, 1, 1); }
      }
    }
  }
  return sky;
}

export function sunMoonPos(phase, t) {
  const cycle = { dawn: 0.1, day: 0.5, dusk: 0.9, night: 0.5 }[phase];
  const x = 8 + cycle * 34;
  const y = phase === 'day' ? 8 : phase === 'night' ? 10 : 16;
  return { x, y, isMoon: phase === 'night', wob: Math.sin(t * 0.5) * 1 };
}
