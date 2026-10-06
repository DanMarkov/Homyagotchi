import { makeRoomSprites, makeHamsterSprites } from './sprites.js';
import { sprite, tintSprite } from './engine.js';
import { petState, PET_STATES } from '../core/pet.js';

export const ROOM_POINTS = [
  { id: 'book', x: 134, y: 130, r: 34, label: '📖 дневник — статистика' },
  { id: 'bowl', x: 224, y: 216, r: 18, label: '🥣 миска — покормить' },
  { id: 'poster', x: 160, y: 44, r: 28, label: '🛡 плакат — совет' },
  { id: 'window', x: 49, y: 48, r: 32, label: '🪟 окно — привет' },
  { id: 'flower', x: 299, y: 190, r: 20, label: '🌱 цветок — забота' },
  { id: 'bed', x: 126, y: 218, r: 30, label: '💤 лежанка — спать' },
  { id: 'ham', x: 160, y: 190, r: 32, label: '🐹 погладить' }
];

export class RoomScene {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 320; this.H = 240;
    this.t = 0;
    this.hot = null;
    this.particles = [];
    this.wallId = null;
    this.hatId = null;
  }

  rebuild(state) {
    const wallChanged = this.wallId !== state.equipped.wall;
    const hatChanged = this.hatId !== state.equipped.hat;
    if (!this.sprites || wallChanged) {
      this.sprites = makeRoomSprites(state.equipped.wall);
      this.wallId = state.equipped.wall;
    }
    if (!this.ham || hatChanged) {
      this.ham = makeHamsterSprites(state.equipped.hat);
      this.hatId = state.equipped.hat;
    }
    if (!this.glowCache) {
      this.glowCache = {};
      ROOM_POINTS.forEach((p) => {
        const key = '_' + p.id;
        this.glowCache[key] = this.glowCache[key] || null;
      });
    }
  }

  puff(ch, color) {
    this.particles.push({ ch, c: color || '#ff8fa3', x: 145 + Math.random() * 30, y: 95, vy: -0.5, life: 60 });
    if (this.particles.length > 10) this.particles.shift();
  }

  draw(state, hot, dt) {
    this.rebuild(state);
    const ctx = this.ctx, W = this.W, H = this.H;
    this.t += dt;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sprites.background, 0, 0);

    ctx.drawImage(this.sprites.windowSpr, 20, 20);
    ctx.drawImage(this.sprites.poster, 134, 16);
    ctx.drawImage(this.sprites.shelf, 96, 100);
    ctx.drawImage(this.sprites.lamp, 20, 84);

    if (hot && hot.id === 'flower') {
      const sway = Math.sin(this.t * 4) * 1.5;
      ctx.drawImage(this.sprites.flower, 286, 144 + sway);
    } else {
      ctx.drawImage(this.sprites.flower, 286, 144);
    }

    ctx.drawImage(this.sprites.bed, 89, 206);
    ctx.drawImage(this.sprites.bowl, 208, 206);

    if (Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,209,102,.35)';
      ctx.fillRect(26, 167, 14, 10);
    }

    for (let d = 0; d < 4; d++) {
      const dx = 40 + ((this.t * 8 + d * 60) % 240), dy = 160 + d * 20;
      ctx.fillStyle = 'rgba(255,230,180,.25)';
      ctx.fillRect(dx, dy + Math.sin(this.t * 2 + d) * 2, 2, 1);
    }

    const ps = petState(state);
    let hamSpr, hx = 160 - 32, hy = 196 - 68;
    if (ps === PET_STATES.SLEEPING || ps === PET_STATES.SICK) hamSpr = this.ham.sleeping;
    else hamSpr = Math.floor(this.t * 3) % 2 === 0 ? this.ham.a : this.ham.b;
    if (ps === PET_STATES.JUMPING) {
      hy -= Math.abs(Math.sin(state._jumping * Math.PI / 12)) * 20;
    }
    ctx.drawImage(hamSpr, hx, hy);
    if (ps === PET_STATES.SLEEPING) {
      ctx.font = '10px monospace'; ctx.fillStyle = '#8fd0f0';
      ctx.fillText('z', 190, 140 - (Math.floor(this.t) % 2) * 4);
      ctx.fillText('Z', 202, 130);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.vy; p.life--;
      ctx.font = '10px monospace'; ctx.fillStyle = p.c;
      ctx.fillText(p.ch, p.x, p.y);
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (hot) this.drawHot(ctx, hot);
  }

  drawHot(ctx, hot) {
    const bump = Math.sin(this.t * 6) * 1;
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(hot.x - hot.r + .5, hot.y - hot.r + .5 + bump, hot.r * 2, hot.r * 2);
    ctx.setLineDash([]);
    ctx.font = '7px monospace';
    const tw = ctx.measureText(hot.label).width;
    const lx = Math.max(2, Math.min(this.W - tw - 4, hot.x - tw / 2 - 2));
    ctx.fillStyle = '#171225';
    ctx.fillRect(lx, hot.y + hot.r + 3, tw + 4, 11);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(lx, hot.y + hot.r + 3, tw + 4, 1);
    ctx.fillStyle = '#2b1d0e';
    ctx.fillText(hot.label, lx + 2, hot.y + hot.r + 11);
  }

  hitTest(canvasX, canvasY) {
    for (const pt of ROOM_POINTS) {
      const dx = canvasX - pt.x, dy = canvasY - pt.y;
      if (dx * dx + dy * dy <= pt.r * pt.r) return pt;
    }
    return null;
  }
}
