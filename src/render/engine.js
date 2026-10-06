export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function sprite(w, h, draw) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const px = (x, y, col, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), ww, hh); };
  const rect = (x, y, w2, h2, col) => px(x, y, col, w2, h2);
  const ell = (cx, cy, rx, ry, col) => {
    g.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (hw >= 0) g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  };
  draw({ g, px, rect, ell, w, h });
  return c;
}

export function renderSpriteTo(target, spr, x, y) {
  target.drawImage(spr, Math.round(x), Math.round(y));
}

export function tintSprite(spr, color, alpha) {
  const c = makeCanvas(spr.width, spr.height);
  const g = c.getContext('2d');
  g.drawImage(spr, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
