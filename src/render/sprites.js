import { sprite } from './engine.js';

export const WALL_COLORS = {
  wall_rose: ['#d98ba0', '#c77b8f'], wall_sky: ['#7db8d9', '#6aa8cc'],
  wall_mint: ['#8fd9b0', '#7cc79d'], wall_star: ['#8f7fd9', '#7d6dcc']
};

export function makeRoomSprites(wallId) {
  const wc = WALL_COLORS[wallId] || WALL_COLORS.wall_rose;
  const W = 320, H = 240;

  const background = sprite(W, H, ({ px, rect }) => {
    rect(0, 0, W, 148, wc[0]);
    for (let y = 6; y < 148; y += 12)
      for (let x = (y % 24 === 6 ? 6 : 18); x < W; x += 24) px(x, y, wc[1]);
    rect(0, 146, W, 2, '#5e3d1f');
    rect(0, 148, W, H - 148, '#a3703f');
    for (let i = 0; i < 15; i++) {
      rect(0, 152 + i * 6, W, 1, '#8a5c32');
      px(24 + i * 24, 148, '#8a5c32', 1, H - 148);
      px(12 + i * 24, 148, '#96653a', 1, 4);
    }
  });

  const windowSpr = sprite(62, 56, ({ px, rect, ell }) => {
    rect(0, 0, 58, 54, '#5e3d1f');
    rect(3, 3, 52, 48, '#8fd0f0');
    rect(3, 36, 52, 15, '#b8e4f8');
    px(3, 3, '#e8f6ff', 52, 4);
    for (let c = 0; c < 5; c++) px(8 + c * 10, 6 + c * 4, '#fff', 4, 2);
    for (let s = 0; s < 4; s++) {
      const sx = 42 + (s % 2) * 8, sy = 7 + s * 3;
      px(sx, sy, '#fff', 2, 2); px(sx - 2, sy + 2, '#fff', 1, 1); px(sx + 3, sy + 2, '#fff', 1, 1);
    }
    ell(13, 42, 6, 5, '#2e7d4f'); ell(11, 46, 3, 3, '#4ec97a'); ell(20, 44, 4, 3, '#1d7a43');
    px(6, 14, '#ffd166', 5, 5); px(7, 12, 3, 9); px(4, 16, 9, 2);
    rect(28, 24, 2, 46, '#5e3d1f'); rect(3, 46, 52, 2, '#5e3d1f');
  });

  const poster = sprite(52, 56, ({ px, rect, ell }) => {
    rect(0, 0, 52, 56, '#171225');
    rect(2, 2, 48, 52, '#2a2440');
    px(11, 8, '#4cc3f7', 30, 2); px(11, 12, '#4cc3f7', 22, 2);
    px(11, 18, '#ffd166', 30, 2); px(11, 22, '#ffd166', 26, 2);
    px(11, 28, '#ff8fa3', 18, 2); px(11, 32, '#ff8fa3', 24, 2);
    px(11, 39, '#a78bfa', 30, 2); px(11, 43, '#a78bfa', 14, 2);
    ell(26, 28, 5, 5, '#5e3d1f'); px(24, 28, '#4cc3f7', 2, 2); px(27, 28, '#4cc3f7', 2, 2);
    px(15, 35, '#f5cd8f', 2, 1); px(31, 36, '#f5cd8f', 2, 1);
  });

  const shelf = sprite(76, 56, ({ px, rect }) => {
    rect(0, 0, 76, 52, '#5e3d1f');
    rect(4, 4, 68, 44, '#3a2a55');
    rect(4, 40, 68, 4, '#8a5c32');
    rect(4, 18, 68, 4, '#8a5c32');
    const spineC = ['#e5484d', '#4cc3f7', '#ffd166', '#4ec97a', '#a78bfa', '#ff8fa3'];
    for (let b = 0; b < 6; b++) {
      const bx = 6 + b * 11;
      rect(bx, 22, 9, 18, spineC[b]);
      px(bx + 1, 25, '#fff', 7, 1); px(bx + 1, 29, '#fff', 7, 1); px(bx + 3, 33, '#2b1d0e', 3, 3);
    }
    rect(6, 24, 9, 16, '#f5e6c8'); px(8, 28, '#2b1d0e', 5, 1); px(8, 31, '#2b1d0e', 5, 1); px(8, 34, '#2b1d0e', 5, 1);
    rect(20, 24, 12, 18, '#d98ba0'); px(26, 26, '#fff', 2, 2);
    rect(36, 24, 8, 16, '#ffd166'); px(38, 28, '#b8860b', 4, 2);
    rect(48, 22, 9, 20, '#8f7fd9'); px(50, 26, '#fff', 5, 1); px(50, 30, '#fff', 5, 1);
    rect(8, 5, 6, 13, '#c98d5a'); rect(8, 5, 6, 3, '#5aa85e'); px(10, 12, '#e5484d', 2, 2);
    rect(64, 4, 4, 12, '#efe6d5'); px(65, 6, '#2b1d0e', 2, 8);
    rect(-4, 52, 76, 4, '#5e3d1f');
  });

  const lamp = sprite(40, 70, ({ px, rect, ell }) => {
    rect(16, 34, 18, 36, '#3a2a55'); rect(14, 30, 22, 4, '#544a75');
    ell(25, 24, 8, 7, '#ffd166'); rect(19, 16, 12, 6, '#e8b46e'); rect(21, 12, 8, 4, '#ffd166');
    px(21, 2, 'rgba(255,209,102,.5)', 8, 10); px(17, 8, 'rgba(255,209,102,.3)', 16, 6);
  });

  const bed = sprite(74, 24, ({ px, rect, ell }) => {
    ell(37, 14, 34, 10, '#8a5c32'); ell(37, 12, 30, 8, '#c77b8f'); ell(37, 12, 24, 5, '#e8a7bb');
    for (let k = 0; k < 5; k++) px(19 + k * 12, 4 + (k % 2) * 2, '#f4c2d0', 3, 2);
  });

  const bowl = sprite(32, 20, ({ px, rect, ell }) => {
    ell(16, 14, 14, 7, '#5e3d1f'); ell(16, 13, 12, 5, '#c98d5a');
    rect(4, 14, 24, 3, '#e8b46e');
    for (let sd = 0; sd < 6; sd++) px(7 + (sd * 4) % 20, 10 + (sd % 3), '#7a4a1d', 2, 2);
  });

  const flower = sprite(26, 40, ({ px, rect, ell }) => {
    ell(13, 34, 11, 6, '#b45a3c'); rect(5, 30, 16, 3, '#c98d5a');
    rect(12, 6, 2, 24, '#1d7a43');
    px(7, 14, '#2e7d4f', 6, 2); px(15, 10, '#2e7d4f', 6, 2);
    px(10, 1, '#ff8fa3', 6, 6); px(8, 3, '#ff8fa3', 10, 2); px(12, 0, '#ffd166', 2, 2);
  });

  return { background, windowSpr, poster, shelf, lamp, bed, bowl, flower };
}

const HAM_COLS = { OUT: '#7a4a1d', FUR: '#f5cd8f', FUR2: '#e8b46e', BELLY: '#fff2d9', PINK: '#e898a3' };

export function makeHamsterSprites(hatId) {
  const sprites = {};
  const frames = ['a', 'b'];
  frames.forEach((f, fi) => {
    sprites[f] = sprite(64, 88, ({ px, rect, ell }) => {
      const cx = 32, cy = 36, bob = fi;
      const { OUT, FUR, FUR2, BELLY, PINK } = HAM_COLS;
      ell(cx, cy + 16, 22, 14, OUT); ell(cx, cy + 16, 20, 12, FUR);
      for (let fy = -10; fy <= 10; fy += 2) {
        const fw = Math.floor(19 * Math.sqrt(Math.max(0, 1 - fy * fy / 121)));
        for (let fx = -fw; fx <= fw; fx += 3) px(cx + fx, cy + 16 + fy + bob, (fx + fy) % 4 === 0 ? FUR2 : FUR);
      }
      ell(cx - 14, cy - 20 + bob, 8, 10, OUT); ell(cx - 14, cy - 20 + bob, 6, 8, PINK);
      px(cx - 16, cy - 24 + bob, '#e898a3', 3, 3); px(cx - 17, cy - 27 + bob, '#f4a8b8', 2, 2);
      ell(cx + 14, cy - 20 + bob, 8, 10, OUT); ell(cx + 14, cy - 20 + bob, 6, 8, PINK);
      px(cx + 14, cy - 24 + bob, '#e898a3', 3, 3); px(cx + 16, cy - 27 + bob, '#f4a8b8', 2, 2);
      ell(cx, cy - 4 + bob, 24, 16, OUT); ell(cx, cy - 4 + bob, 22, 14, FUR);
      for (let fy2 = -11; fy2 <= 11; fy2 += 3) {
        const fw2 = Math.floor(21 * Math.sqrt(Math.max(0, 1 - fy2 * fy2 / 169)));
        for (let fx2 = -fw2; fx2 <= fw2; fx2 += 4) px(cx + fx2, cy - 4 + fy2 + bob, (fx2 - fy2) % 6 === 0 ? FUR2 : FUR);
      }
      ell(cx, cy + 8, 14, 8, BELLY);
      px(cx + 2, cy + 6, '#e2d0b0', 5, 4);
      px(cx - 10, cy - 8 + bob, '#fff', 6, 6); px(cx + 6, cy - 8 + bob, '#fff', 6, 6);
      px(cx - 9, cy - 6 + bob, '#2b1d0e', 3, 4); px(cx + 8, cy - 6 + bob, '#2b1d0e', 3, 4);
      px(cx - 8, cy - 7 + bob, '#fff', 2, 2); px(cx + 9, cy - 7 + bob, '#fff', 2, 2);
      px(cx - 3, cy + 2 + bob, PINK, 6, 4); px(cx - 2, cy + 3 + bob, '#d16f80', 4, 2);
      px(cx - 5, cy + 9 + bob, OUT, 1, 1); px(cx + 5, cy + 9 + bob, OUT, 1, 1); px(cx - 5, cy + 10 + bob, OUT, 10, 1);
      ell(cx - 16, cy + 2 + bob, 4, 2, '#f4a8b8'); ell(cx + 16, cy + 2 + bob, 4, 2, '#f4a8b8');
      px(cx - 24, cy + bob, OUT, 2, 2); px(cx - 27, cy + 2 + bob, OUT, 2, 2); px(cx - 29, cy + 5 + bob, OUT, 2, 2);
      px(cx + 23, cy + bob, OUT, 2, 2); px(cx + 26, cy + 2 + bob, OUT, 2, 2); px(cx + 28, cy + 5 + bob, OUT, 2, 2);
      ell(cx - 12, cy + 30 + bob, 6, 4, PINK); ell(cx + 12, cy + 30 + bob, 6, 4, PINK);
      px(cx - 14, cy + 33 + bob, '#d16f80', 3, 2); px(cx + 11, cy + 33 + bob, '#d16f80', 3, 2);
      drawHatPx(px, rect, ell, cx, cy - 22 + bob, hatId);
    });
  });

  const sleeping = sprite(64, 88, ({ px, rect, ell }) => {
    const cx = 32, cy = 37;
    const { OUT, FUR, FUR2, BELLY, PINK } = HAM_COLS;
    ell(cx, cy + 16, 23, 13, OUT); ell(cx, cy + 16, 21, 11, FUR);
    for (let fy = -9; fy <= 9; fy += 2) {
      const fw = Math.floor(20 * Math.sqrt(Math.max(0, 1 - fy * fy / 100)));
      for (let fx = -fw; fx <= fw; fx += 3) px(cx + fx, cy + 16 + fy, (fx + fy) % 4 === 0 ? FUR2 : FUR);
    }
    ell(cx - 13, cy - 18, 8, 9, OUT); ell(cx - 13, cy - 18, 6, 7, PINK);
    ell(cx + 13, cy - 18, 8, 9, OUT); ell(cx + 13, cy - 18, 6, 7, PINK);
    ell(cx, cy - 4, 24, 17, OUT); ell(cx, cy - 4, 22, 15, FUR);
    ell(cx, cy + 8, 14, 8, BELLY);
    px(cx - 10, cy - 5, OUT, 6, 2); px(cx + 6, cy - 5, OUT, 6, 2);
    px(cx - 3, cy + 2, PINK, 6, 4);
    ell(cx - 12, cy + 30, 6, 4, PINK); ell(cx + 12, cy + 30, 6, 4, PINK);
    drawHatPx(px, rect, ell, cx, cy - 22, hatId);
  });

  return { a: sprites.a, b: sprites.b, sleeping };
}

function drawHatPx(px, rect, ell, cx, top, hat) {
  if (hat === 'hat_cap') {
    rect(cx - 14, top - 4, 28, 8, '#e5484d'); rect(cx - 18, top + 2, 24, 4, '#e5484d');
    rect(cx - 6, top - 8, 12, 4, '#b23a48'); px(cx - 10, top + 4, '#ffd166', 4, 2);
  } else if (hat === 'hat_bow') {
    rect(cx - 12, top - 6, 8, 8, '#ff8fa3'); rect(cx + 4, top - 6, 8, 8, '#ff8fa3');
    rect(cx - 2, top - 6, 6, 8, '#e56a85'); px(cx - 10, top - 4, '#fff', 2, 2); px(cx + 6, top - 4, '#fff', 2, 2);
  } else if (hat === 'hat_crown') {
    rect(cx - 12, top - 8, 24, 8, '#ffd166');
    px(cx - 12, top - 14, '#ffd166', 4, 6); px(cx - 2, top - 16, '#ffd166', 4, 8); px(cx + 8, top - 14, '#ffd166', 4, 6);
    px(cx - 2, top - 6, '#e5484d', 4, 4); px(cx - 11, top - 11, '#fff', 2, 2);
  } else if (hat === 'hat_ph') {
    rect(cx - 24, top + 4, 8, 10, '#544a75'); rect(cx + 16, top + 4, 8, 10, '#544a75');
    rect(cx - 18, top, 36, 4, '#171225'); px(cx - 22, top + 6, '#ffd166', 4, 4); px(cx + 18, top + 6, '#ffd166', 4, 4);
  }
}
