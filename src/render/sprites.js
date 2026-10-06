import { sprite } from './engine.js';
import { SKIES } from './daynight.js';

export const WALL_COLORS = {
  wall_rose: { top: '#e8a0b8', bot: '#d98ba0', dot: '#f4c2d4', line: '#b8627f' },
  wall_sky: { top: '#8ecbe8', bot: '#7db8d9', dot: '#c8ecff', line: '#5a9dc4' },
  wall_mint: { top: '#a8e8c4', bot: '#8fd9b0', dot: '#d4f5e2', line: '#66bd8f' },
  wall_star: { top: '#a89ce8', bot: '#8f7fd9', dot: '#d4ccff', line: '#6e5cc4' }
};

function shade(d) {
  const { px, rect, ell } = d;
  const ell3 = (cx, cy, rx, ry, o, b, l) => {
    ell(cx, cy, rx, ry, o);
    ell(cx, cy, rx - 2, ry - 2, b);
    if (l) ell(cx - rx * 0.25, cy - ry * 0.3, rx * 0.5, ry * 0.45, l);
  };
  const rect3 = (x, y, w, h, o, b, l) => {
    rect(x - 1, y - 1, w + 2, h + 2, o);
    rect(x, y, w, h, b);
    if (l) rect(x + 1, y + 1, Math.max(1, w * 0.4), Math.max(1, h * 0.35), l);
  };
  return { px, rect, ell, ell3, rect3 };
}

export function makeRoomSprites(wallId) {
  const wc = WALL_COLORS[wallId] || WALL_COLORS.wall_rose;
  const W = 320, H = 240;

  const background = sprite(W, H, (d0) => {
    const { px, rect, ell } = shade(d0);
    rect(0, 0, W, 150, wc.bot);
    rect(0, 0, W, 60, wc.top);
    for (let y = 10; y < 70; y += 2) rect(0, y, W, 1, wc.top);
    for (let y = 74; y < 148; y += 26) {
      for (let x = 10; x < W; x += 40) {
        px(x + 4, y, wc.dot, 2, 2); px(x + 11, y + 3, wc.dot, 1, 1); px(x, y + 5, wc.dot, 1, 1);
        px(x + 6, y + 7, wc.line, 1, 1);
      }
    }
    for (let y = 12; y < 148; y += 26)
      for (let x = 20; x < W; x += 40) px(x, y, wc.dot, 3, 3);
    rect(0, 148, W, 6, '#4a2e15');
    rect(0, 148, W, 2, '#7a4a1d');
    rect(0, 154, W, H - 154, '#c98d5a');
    for (let i = 0; i < 14; i++) {
      const py = 155 + i * 6;
      rect(0, py, W, 2, '#b47a45');
      rect(0, py + 2, W, 1, '#e0aa72');
      for (let k = 0; k < 5; k++) px(30 + i * 13 + k * 9, py + 1, '#a86a38', 1, 1);
    }
    for (let i = 0; i < 15; i++) {
      const px_ = i * 22 + 6;
      rect(px_, 154, 3, H - 154, '#8a5c32');
      px(px_ + 1, 156, '#5e3d1f', 1, 2);
      px(px_ + 1, 170, '#5e3d1f', 1, 2);
      px(px_ + 1, 190, '#5e3d1f', 1, 2);
    }
    ell(160, 214, 52, 14, '#b8860b');
    ell(160, 214, 49, 12, '#e8b46e');
    ell(160, 214, 42, 9, '#c77b4a');
    for (let r = 0; r < 8; r++) {
      const a = r * Math.PI / 4;
      px(160 + Math.cos(a) * 38, 214 + Math.sin(a) * 7, '#ffd166', 3, 2);
    }
    ell(160, 214, 30, 6, '#e8a86b');
    px(146, 212, '#ffd166', 4, 2); px(170, 215, '#ffd166', 3, 2); px(158, 217, '#ffd166', 3, 2);
    px(238, 150, '#fff', 3, 1);
  });

  const windowSpr = sprite(62, 60, (d0) => {
    const { px, rect, ell, ell3 } = shade(d0);
    rect(-1, -1, 62, 60, '#171225');
    rect(0, 0, 58, 56, '#7a4a1d');
    rect(1, 1, 56, 54, '#2b1d0e');
    rect(28, 3, 3, 48, '#7a4a1d');
    rect(28, 24, 31, 3, '#7a4a1d');
    px(29, 24, '#a3703f', 1, 1);
    rect(0, 54, 60, 4, '#7a4a1d');
    rect(0, 54, 60, 1, '#a3703f');
    ell(44, 40, 8, 5, '#1d4a2e');
    ell(38, 42, 6, 4, '#2e7d4f');
    ell(50, 43, 5, 3, '#246b40');
    px(40, 34, '#2e7d4f', 2, 5); px(50, 36, '#2e7d4f', 2, 5);
  });

  const poster = sprite(56, 60, (d0) => {
    const { px, rect, ell, ell3 } = shade(d0);
    rect(0, 0, 52, 58, '#171225');
    rect(1, 1, 50, 56, '#ffd166');
    rect(2, 2, 48, 54, '#2a2440');
    for (let i = 0; i < 4; i++) px(6 + i * 3, 4 + i * 2, '#fff', 2, 2);
    px(10, 8, '#4cc3f7', 32, 3); px(10, 13, '#4cc3f7', 24, 2);
    px(10, 19, '#a78bfa', 30, 3); px(10, 24, '#a78bfa', 20, 2);
    ell3(26, 40, 11, 11, '#171225', '#5e3d1f', '#7a4a1d');
    ell(21, 37, 3, 4, '#fff'); ell(31, 37, 3, 4, '#fff');
    px(20, 37, '#2b1d0e', 2, 3); px(31, 37, '#2b1d0e', 2, 3);
    px(24, 43, '#e898a3', 4, 3);
    px(16, 44, '#ffd166', 3, 3); px(33, 44, '#ffd166', 3, 3);
    px(10, 52, '#ff8fa3', 20, 2); px(10, 50, '#4ec97a', 14, 2);
  });

  const shelf = sprite(80, 58, (d0) => {
    const { px, rect, ell, ell3, rect3 } = shade(d0);
    rect(-2, 0, 76, 54, '#171225');
    rect(0, 2, 72, 50, '#7a4a1d');
    rect(2, 4, 68, 46, '#3a2a55');
    rect(2, 4, 68, 3, '#544a75');
    rect(2, 34, 68, 4, '#8a5c32');
    rect(2, 34, 68, 1, '#a3703f');
    rect(2, 52, 72, 4, '#5e3d1f');
    const books = [
      { x: 4, c: '#e5484d', h: 22 }, { x: 14, c: '#4cc3f7', h: 24 }, { x: 24, c: '#ffd166', h: 20 },
      { x: 34, c: '#4ec97a', h: 23 }, { x: 44, c: '#ff8fa3', h: 25 }, { x: 54, c: '#a78bfa', h: 21 }
    ];
    books.forEach((b, i) => {
      rect(b.x, 34 - b.h, 9, b.h, '#171225');
      rect(b.x + 1, 34 - b.h + 1, 7, b.h - 2, b.c);
      px(b.x + 2, 34 - b.h + 3, '#fff', 5, 1);
      px(b.x + 2, 34 - b.h + 6, '#fff', 5, 1);
      px(b.x + 2, 34 - 6, '#2b1d0e', 5, 3);
      if (i % 2) px(b.x + 1, 34 - b.h + 1, '#fff', 7, 1);
    });
    rect3(4, 6, 7, 14, '#171225', '#c98d5a', '#e8b46e');
    px(6, 8, '#4ec97a', 3, 3); px(5, 11, '#2e7d4f', 2, 4); px(9, 12, '#2e7d4f', 2, 4);
    rect3(16, 8, 6, 6, '#171225', '#8fd0f0', '#c8ecff');
    px(18, 10, '#fff', 2, 2);
    ell3(30, 13, 4, 4, '#171225', '#ffd166', '#fff2c8');
    rect3(60, 12, 5, 9, '#171225', '#efe6d5', '#fff');
    px(62, 14, '#2b1d0e', 2, 6);
    rect3(48, 6, 8, 10, '#171225', '#d98ba0', '#f4c2d4');
  });

  const lamp = sprite(44, 74, (d0) => {
    const { px, rect, ell, ell3 } = shade(d0);
    rect(30, 46, 8, 26, '#171225');
    rect(31, 46, 6, 26, '#544a75');
    rect(31, 46, 2, 26, '#8a7fb8');
    rect(24, 68, 20, 4, '#171225');
    rect(25, 68, 18, 2, '#544a75');
    rect(18, 40, 32, 5, '#171225');
    rect(19, 40, 30, 3, '#8a7fb8');
    ell3(34, 32, 14, 12, '#171225', '#ffd166', '#fff2c8');
    px(28, 26, '#fff2c8', 4, 2); px(38, 24, '#fff2c8', 3, 2);
    px(22, 20, 'rgba(255,209,102,.45)', 24, 12);
    px(18, 26, 'rgba(255,209,102,.25)', 32, 8);
    px(26, 10, 'rgba(255,240,200,.4)', 16, 8);
  });

  const bed = sprite(78, 30, (d0) => {
    const { px, rect, ell } = shade(d0);
    ell(39, 16, 36, 12, '#171225');
    ell(39, 16, 34, 10, '#c77b4a');
    ell(39, 16, 31, 8, '#e85d75');
    ell(39, 16, 27, 6, '#ff8fa3');
    for (let k = 0; k < 6; k++) px(12 + k * 11, 10 + (k % 2) * 3, '#ffd166', 3, 3);
    ell(14, 10, 8, 7, '#171225');
    ell(14, 10, 6, 5, '#fff2d9');
    px(10, 8, '#ffd166', 3, 3);
    for (let k = 0; k < 5; k++) {
      px(20 + k * 9, 14 + (k % 2) * 2, '#e8a86b', 2, 2);
    }
    px(6, 18, '#8a5c32', 3, 2); px(68, 18, '#8a5c32', 3, 2);
  });

  const bowl = sprite(36, 24, (d0) => {
    const { px, rect, ell, ell3 } = shade(d0);
    ell(18, 15, 15, 8, '#171225');
    ell(18, 15, 13, 6, '#4cc3f7');
    ell(18, 15, 9, 4, '#8fe0ff');
    ell(18, 13, 11, 3, '#2b1d0e');
    for (let sd = 0; sd < 7; sd++) {
      const sx = 11 + (sd * 5) % 16, sy = 11 + (sd % 3) * 2;
      ell(sx, sy, 2, 2, '#171225');
      px(sx, sy, '#a3703f', 2, 1);
      px(sx, sy, '#e0aa72', 1, 1);
    }
    px(8, 12, '#fff', 2, 1); px(26, 17, '#fff', 2, 1);
    ell(18, 21, 14, 3, '#171225');
    ell(18, 21, 12, 2, '#5ab8e8');
  });

  const flower = sprite(30, 46, (d0) => {
    const { px, rect, ell, ell3 } = shade(d0);
    ell3(15, 38, 12, 7, '#171225', '#c9573a', '#e8856b');
    px(11, 36, '#e8856b', 3, 2);
    rect(13, 8, 3, 30, '#171225');
    rect(14, 8, 1, 30, '#2e7d4f');
    px(6, 16, '#171225', 8, 3); px(7, 16, '#4ec97a', 6, 2); px(8, 17, '#66d18f', 2, 1);
    px(18, 12, '#171225', 8, 3); px(19, 12, '#4ec97a', 6, 2);
    ell3(15, 6, 8, 8, '#171225', '#ff8fa3', '#ffc2d1');
    ell(15, 6, 3, 3, '#ffd166');
    px(13, 4, '#fff', 2, 2);
    ell3(22, 16, 5, 5, '#171225', '#a78bfa', '#d4ccff');
    px(22, 15, '#ffd166', 2, 2);
  });

  const wheel = sprite(52, 56, (d0) => {
    const { px, rect, ell } = shade(d0);
    rect(4, 40, 10, 14, '#171225'); rect(5, 40, 8, 14, '#8a7fb8');
    rect(0, 50, 22, 5, '#171225'); rect(1, 50, 20, 3, '#544a75');
    ell(26, 24, 24, 24, '#171225');
    ell(26, 24, 22, 22, '#c9c0e0');
    ell(26, 24, 18, 18, '#3a3350');
    for (let a = 0; a < 12; a++) {
      const ang = a * Math.PI / 6;
      px(26 + Math.cos(ang) * 20 - 1, 24 + Math.sin(ang) * 20 - 1, '#544a75', 2, 2);
      if (a % 3 === 0) rect(25, 6, 2, 36, '#8a7fb8');
    }
    ell(26, 24, 4, 4, '#171225');
    ell(26, 24, 2, 2, '#ffd166');
    px(16, 8, '#fff', 3, 1); px(34, 40, '#fff', 2, 1);
  });

  return { background, windowSpr, poster, shelf, lamp, bed, bowl, flower, wheel };
}

export function makeSkySprites() {
  const phases = ['dawn', 'day', 'dusk', 'night'];
  const spritesByPhase = {};
  phases.forEach((phase) => {
    spritesByPhase[phase] = sprite(62, 60, (d0) => {
      const { px, rect, ell } = shade(d0);
      const sky = SKIES[phase];
      rect(3, 3, 52, 19, sky.top);
      rect(3, 22, 52, 14, sky.mid);
      rect(3, 36, 52, 15, sky.bot);
      if (sky.star) {
        for (let i = 0; i < 9; i++) {
          const sx = 6 + (i * 11) % 46, sy = 5 + (i * 7) % 18;
          px(sx, sy, '#fff', 1, 1);
          if (i % 3 === 0) { px(sx - 1, sy, '#e8f0ff', 1, 1); px(sx + 1, sy, '#e8f0ff', 1, 1); }
        }
      } else {
        for (let c = 0; c < 4; c++) {
          const cx = 8 + c * 12, cy = 8 + (c % 2) * 4;
          px(cx, cy, '#fff', 5, 2); px(cx + 1, cy - 1, '#fff', 3, 1);
        }
      }
      if (phase === 'day' || phase === 'dawn') {
        const sx = phase === 'day' ? 24 : 8, sy = phase === 'day' ? 7 : 14;
        ell(sx, sy, 5, 5, '#ffd166');
        px(sx - 1, sy - 2, '#ffe9a8', 2, 2);
        if (phase === 'day') { px(sx - 8, sy - 2, '#ffe9a8', 2, 2); px(sx + 6, sy + 2, '#ffe9a8', 2, 2); }
      } else if (phase === 'night') {
        ell(24, 10, 6, 6, '#f4f0d8');
        ell(21, 9, 4, 4, '#2a3568');
        px(26, 8, '#f4f0d8', 1, 1);
      } else {
        ell(40, 16, 5, 5, '#ff6b4d');
        px(38, 14, '#ffb886', 3, 2);
      }
      rect(3, 40, 52, 8, phase === 'night' ? '#3a4a68' : phase === 'day' ? '#4ec97a' : '#2e7d4f');
      ell(20, 46, 9, 4, phase === 'night' ? '#2a3a55' : '#246b40');
      ell(40, 48, 7, 3, phase === 'night' ? '#33465e' : '#2e7d4f');
    });
  });
  return spritesByPhase;
}

const HAM = {
  OUT: '#171225', FUR: '#f5cd8f', LIGHT: '#ffe9b8', SHADE: '#d99a55',
  BELLY: '#fff2d9', PINK: '#ff9fb0', PINK_D: '#e87a90', NOSE: '#e898a3'
};

export function makeHamsterSprites(hatId) {
  const frames = [];
  const bobs = [0, 2, 3, 2];
  bobs.forEach((bob, fi) => {
    const blink = fi === 2;
    frames.push(sprite(68, 96, (d0) => {
      const { px, rect, ell } = shade(d0);
      const cx = 34, cy = 40;
      const { OUT, FUR, LIGHT, SHADE, BELLY, PINK, PINK_D, NOSE } = HAM;
      const earWig = fi === 3 ? 1 : 0;
      ell(cx, cy + 18, 23, 15, OUT);
      ell(cx, cy + 18, 21, 13, FUR);
      for (let y = -11; y <= 11; y += 2) {
        const hw = Math.floor(20 * Math.sqrt(Math.max(0, 1 - y * y / 121)));
        for (let x = -hw; x <= hw; x += 2) {
          const isLight = (x + y) % 8 === 0 && x < -3;
          const isShade = (x - y) % 7 === 0 && x > 6;
          px(cx + x, cy + 18 + y + (bob ? 0 : 0), isLight ? LIGHT : isShade ? SHADE : FUR, 2, 1);
        }
      }
      ell(cx - 9, cy + 12, 9, 5, LIGHT);
      ell(cx, cy + 20, 14, 8, OUT);
      ell(cx, cy + 20, 13, 7, BELLY);
      ell(cx - 15, cy - 21 - earWig, 8, 10, OUT);
      ell(cx - 15, cy - 21 - earWig, 6, 8, PINK);
      px(cx - 17, cy - 25 - earWig, PINK_D, 3, 3);
      px(cx - 18, cy - 28 - earWig, '#ffb8c6', 2, 2);
      ell(cx + 15, cy - 21, 8, 10, OUT);
      ell(cx + 15, cy - 21, 6, 8, PINK);
      px(cx + 14, cy - 25, PINK_D, 3, 3);
      px(cx + 16, cy - 28, '#ffb8c6', 2, 2);
      ell(cx, cy - 4 + Math.floor(bob / 2), 25, 17, OUT);
      ell(cx, cy - 4 + Math.floor(bob / 2), 23, 15, FUR);
      for (let y = -12; y <= 12; y += 2) {
        const hw = Math.floor(22 * Math.sqrt(Math.max(0, 1 - y * y / 169)));
        for (let x = -hw; x <= hw; x += 2) {
          const isLight = (x + y) % 9 === 0 && x < -5;
          const isShade = (x + y) % 8 === 0 && x > 8;
          px(cx + x, cy - 4 + y + Math.floor(bob / 2), isLight ? LIGHT : isShade ? SHADE : FUR, 2, 1);
        }
      }
      ell(cx - 6, cy - 12, 8, 5, LIGHT);
      if (blink) {
        px(cx - 11, cy - 5, OUT, 8, 2); px(cx + 5, cy - 5, OUT, 8, 2);
        px(cx - 10, cy - 4, '#fff', 2, 1); px(cx + 6, cy - 4, '#fff', 2, 1);
      } else {
        ell(cx - 7, cy - 7, 5, 6, '#fff');
        ell(cx + 8, cy - 7, 5, 6, '#fff');
        ell(cx - 6, cy - 6, 3, 4, '#2b1d0e');
        ell(cx + 9, cy - 6, 3, 4, '#2b1d0e');
        px(cx - 7, cy - 8, '#fff', 2, 2); px(cx + 8, cy - 8, '#fff', 2, 2);
        px(cx - 5, cy - 4, '#fff', 1, 1); px(cx + 10, cy - 4, '#fff', 1, 1);
      }
      ell(cx - 16, cy + 1, 4, 3, '#ffc2d1');
      ell(cx + 16, cy + 1, 4, 3, '#ffc2d1');
      ell(cx, cy + 3, 5, 4, OUT);
      ell(cx, cy + 3, 4, 3, NOSE);
      px(cx - 1, cy + 6, PINK_D, 3, 2);
      px(cx - 6, cy + 10, OUT, 13, 2);
      px(cx - 6, cy + 9, OUT, 1, 1); px(cx + 6, cy + 9, OUT, 1, 1);
      px(cx - 26, cy - 2, OUT, 2, 2); px(cx - 29, cy, OUT, 2, 2); px(cx - 31, cy + 3, OUT, 2, 2);
      px(cx + 25, cy - 2, OUT, 2, 2); px(cx + 28, cy, OUT, 2, 2); px(cx + 30, cy + 3, OUT, 2, 2);
      ell(cx - 11, cy + 33, 6, 4, OUT); ell(cx - 11, cy + 33, 5, 3, PINK);
      px(cx - 13, cy + 36, PINK_D, 3, 1);
      ell(cx + 11, cy + 33, 6, 4, OUT); ell(cx + 11, cy + 33, 5, 3, PINK);
      px(cx + 10, cy + 36, PINK_D, 3, 1);
      ell(cx - 8, cy + 30, 4, 3, OUT); ell(cx - 8, cy + 30, 3, 2, '#ffb8c6');
      ell(cx + 8, cy + 30, 4, 3, OUT); ell(cx + 8, cy + 30, 3, 2, '#ffb8c6');
      drawHatPx(px, rect, ell, cx, cy - 24 + Math.floor(bob / 2), hatId);
    }));
  });

  const sleeping = sprite(68, 96, (d0) => {
    const { px, rect, ell } = shade(d0);
    const cx = 34, cy = 42;
    const { OUT, FUR, LIGHT, SHADE, BELLY, PINK, PINK_D, NOSE } = HAM;
    ell(cx, cy + 20, 24, 13, OUT);
    ell(cx, cy + 20, 22, 11, FUR);
    ell(cx - 10, cy + 14, 9, 5, LIGHT);
    ell(cx, cy + 22, 14, 8, OUT);
    ell(cx, cy + 22, 13, 7, BELLY);
    ell(cx - 14, cy - 18, 8, 9, OUT); ell(cx - 14, cy - 18, 6, 7, PINK);
    px(cx - 16, cy - 21, PINK_D, 3, 3);
    ell(cx + 14, cy - 18, 8, 9, OUT); ell(cx + 14, cy - 18, 6, 7, PINK);
    px(cx + 13, cy - 21, PINK_D, 3, 3);
    ell(cx, cy - 2, 25, 18, OUT);
    ell(cx, cy - 2, 23, 16, FUR);
    for (let y = -13; y <= 13; y += 2) {
      const hw = Math.floor(22 * Math.sqrt(Math.max(0, 1 - y * y / 169)));
      for (let x = -hw; x <= hw; x += 2) {
        const isLight = (x + y) % 9 === 0 && x < -5;
        const isShade = (x + y) % 8 === 0 && x > 8;
        px(cx + x, cy - 2 + y, isLight ? LIGHT : isShade ? SHADE : FUR, 2, 1);
      }
    }
    ell(cx - 6, cy - 10, 8, 5, LIGHT);
    px(cx - 11, cy - 3, OUT, 8, 2); px(cx + 5, cy - 3, OUT, 8, 2);
    px(cx - 9, cy - 2, '#8a5c32', 2, 1); px(cx + 7, cy - 2, '#8a5c32', 2, 1);
    ell(cx - 16, cy + 3, 4, 3, '#ffc2d1');
    ell(cx + 16, cy + 3, 4, 3, '#ffc2d1');
    ell(cx, cy + 5, 5, 4, OUT); ell(cx, cy + 5, 4, 3, NOSE);
    ell(cx - 11, cy + 35, 6, 4, OUT); ell(cx - 11, cy + 35, 5, 3, PINK);
    ell(cx + 11, cy + 35, 6, 4, OUT); ell(cx + 11, cy + 35, 5, 3, PINK);
    drawHatPx(px, rect, ell, cx, cy - 22, hatId);
  });

  return { frames, sleeping };
}

function drawHatPx(px, rect, ell, cx, top, hat) {
  if (hat === 'hat_cap') {
    ell(cx, top - 2, 16, 7, '#171225');
    ell(cx, top - 2, 14, 5, '#e5484d');
    px(cx - 4, top - 8, '#b23a48', 8, 4);
    px(cx - 14, top - 2, '#e5484d', 6, 3);
    px(cx - 14, top - 3, '#ff8fa0', 6, 1);
    px(cx - 10, top + 2, '#ffd166', 4, 2);
    px(cx - 12, top - 6, '#fff', 3, 2);
  } else if (hat === 'hat_bow') {
    ell(cx - 8, top - 4, 6, 5, '#171225'); ell(cx - 8, top - 4, 4, 3, '#ff8fa3');
    ell(cx + 8, top - 4, 6, 5, '#171225'); ell(cx + 8, top - 4, 4, 3, '#ff8fa3');
    rect(cx - 3, top - 7, 6, 7, '#171225'); rect(cx - 2, top - 6, 4, 5, '#e56a85');
    px(cx - 9, top - 6, '#ffd1dc', 2, 2); px(cx + 7, top - 6, '#ffd1dc', 2, 2);
  } else if (hat === 'hat_crown') {
    rect(cx - 13, top - 8, 26, 8, '#171225');
    rect(cx - 12, top - 7, 24, 6, '#ffd166');
    px(cx - 12, top - 14, '#171225', 5, 8); px(cx - 11, top - 13, 3, 6, '#ffd166');
    px(cx - 2, top - 16, '#171225', 5, 10); px(cx - 1, top - 15, 3, 8, '#ffd166');
    px(cx + 8, top - 14, '#171225', 5, 8); px(cx + 9, top - 13, 3, 6, '#ffd166');
    ell(cx, top - 4, 3, 3, '#e5484d');
    px(cx - 1, top - 5, '#ff8fa0', 2, 2);
    px(cx - 11, top - 11, '#fff', 2, 2);
    px(cx - 10, top - 6, '#fff2c8', 4, 1);
  } else if (hat === 'hat_ph') {
    rect(cx - 25, top + 2, 8, 11, '#171225'); rect(cx - 24, top + 3, 6, 9, '#544a75');
    rect(cx + 17, top + 2, 8, 11, '#171225'); rect(cx + 18, top + 3, 6, 9, '#544a75');
    rect(cx - 20, top - 2, 40, 5, '#171225'); rect(cx - 19, top - 1, 38, 3, '#2a2440');
    px(cx - 22, top + 5, '#ffd166', 3, 3); px(cx + 20, top + 5, '#ffd166', 3, 3);
    px(cx - 23, top + 4, '#fff', 2, 2);
  }
}
