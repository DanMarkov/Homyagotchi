import { createPixelSprite, H, HAMSTER_SIT, HAMSTER_STAND, HAMSTER_HAPPY } from './pixel-sprites.js?v=14';

const SCALE = 3;

function drawFrame(canvas, art, palette, scale) {
  const lines = art.trim().split('\n').map((l) => l.replace(/\s+$/, ''));
  const w = Math.max(...lines.map((l) => l.length));
  const h = lines.length;
  canvas.width = w * scale;
  canvas.height = h * scale;
  canvas.style.width = (w * scale) + 'px';
  canvas.style.height = (h * scale) + 'px';
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lines.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch !== '.' && ch !== ' ' && palette[ch]) {
        ctx.fillStyle = palette[ch];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  });
}

/* Blink frames: eyes closed */

function makeBlink(art) {
  // Eyes are 7px wide: K+5E+K (normal), K+3e+2E+K (highlight row)
  return art
    .split('\n')
    .map(line => line
      .split('KeeeEEK').join('K^^^^^K')
      .split('KEEEEEK').join('K^^^^^K')
    )
    .join('\n');
}

/* Squash frame: body slightly wider (breathing) */

function makeSquash(art) {
  const lines = art.trim().split('\n');
  return lines.map((line, y) => {
    if (y < 8) return line;
    return '.' + line + '.';
  }).join('\n');
}

const FRAME_MAP = {
  sit: {
    normal: HAMSTER_SIT,
    blink: makeBlink(HAMSTER_SIT),
    squash: makeSquash(HAMSTER_SIT)
  },
  stand: {
    normal: HAMSTER_STAND,
    blink: makeBlink(HAMSTER_STAND),
    squash: makeSquash(HAMSTER_STAND)
  },
  happy: {
    normal: HAMSTER_HAPPY,
    blink: makeBlink(HAMSTER_HAPPY),
    squash: makeSquash(HAMSTER_HAPPY)
  }
};

export function createAnimatedHamster(state = 'sit') {
  const canvas = document.createElement('canvas');
  canvas.className = 'px-sprite sprite-hamster sprite-animated';

  const frames = FRAME_MAP[state] || FRAME_MAP.sit;
  let running = true;
  let breathTimer = null;
  let blinkTimer = null;

  function render(frameName) {
    if (!running) return;
    const art = frames[frameName] || frames.normal;
    drawFrame(canvas, art, H, SCALE);
  }

  function startBreathing() {
    let phase = 0;
    breathTimer = setInterval(() => {
      if (!running) return;
      phase = (phase + 1) % 4;
      render(phase < 2 ? 'squash' : 'normal');
    }, 500);
  }

  function scheduleBlink() {
    const delay = 1500 + Math.random() * 3000;
    blinkTimer = setTimeout(() => {
      if (!running) return;
      render('blink');
      setTimeout(() => {
        if (!running) return;
        render('normal');
        scheduleBlink();
      }, 150);
    }, delay);
  }

  render('normal');
  startBreathing();
  scheduleBlink();

  canvas._stopAnimation = () => {
    running = false;
    if (breathTimer) clearInterval(breathTimer);
    if (blinkTimer) clearTimeout(blinkTimer);
  };

  return canvas;
}

export function createStaticSprite(art, palette, scale, extraClass = '') {
  return createPixelSprite(art, palette, scale, extraClass);
}
