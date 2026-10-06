import { makeRoomSprites, makeHamsterSprites, makeSkySprites } from './sprites.js';
import { petState, PET_STATES } from '../core/pet.js';
import { dayPhase, SKIES } from './daynight.js';

export const ROOM_POINTS = [
  { id: 'book', x: 136, y: 130, r: 34, label: '📖 дневник — статистика' },
  { id: 'bowl', x: 226, y: 222, r: 20, label: '🥣 миска — покормить' },
  { id: 'poster', x: 163, y: 46, r: 30, label: '🛡 плакат — совет' },
  { id: 'window', x: 49, y: 50, r: 34, label: '🪟 окно — привет' },
  { id: 'flower', x: 301, y: 195, r: 22, label: '🌱 цветок — забота' },
  { id: 'bed', x: 128, y: 230, r: 30, label: '💤 лежанка — спать' },
  { id: 'wheel', x: 58, y: 200, r: 28, label: '🎡 колесо — играть!' },
  { id: 'ham', x: 160, y: 196, r: 32, label: '🐹 погладить' }
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
    this.wheelSpin = 0;
    this.wheelActive = 0;
    this.skySprites = makeSkySprites();
    this.phase = null;
  }

  rebuild(state) {
    if (!this.sprites || this.wallId !== state.equipped.wall) {
      this.sprites = makeRoomSprites(state.equipped.wall);
      this.wallId = state.equipped.wall;
    }
    if (!this.ham || this.hatId !== state.equipped.hat) {
      this.ham = makeHamsterSprites(state.equipped.hat);
      this.hatId = state.equipped.hat;
    }
    this.phase = dayPhase(new Date().getHours());
  }

  puff(ch, color) {
    this.particles.push({ ch, c: color || '#ffd166', x: 145 + Math.random() * 30, y: 110, vy: -0.6, life: 50 });
    if (this.particles.length > 12) this.particles.shift();
  }

  spinWheel() { this.wheelActive = 2; }

  draw(state, hot, dt) {
    this.rebuild(state);
    const ctx = this.ctx;
    this.t += dt;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sprites.background, 0, 0);

    ctx.drawImage(this.sprites.windowSpr, 20, 20);
    ctx.drawImage(this.skySprites[this.phase], 20, 20);

    const sky = SKIES[this.phase];
    if (this.phase === 'day' || this.phase === 'dawn') {
      const sunA = 0.5 + 0.5 * Math.sin(this.t * 0.8);
      ctx.save();
      ctx.globalAlpha = 0.10 + sunA * 0.06;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(24, 24); ctx.lineTo(78, 24); ctx.lineTo(150, 240); ctx.lineTo(60, 240);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    if (sky.tint) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = sky.tint;
      ctx.fillRect(0, 0, 320, 154);
      ctx.restore();
    }
    ctx.drawImage(this.sprites.poster, 135, 16);
    ctx.drawImage(this.sprites.shelf, 98, 100);
    ctx.drawImage(this.sprites.lamp, 14, 80);

    if (this.wheelActive > 0) {
      this.wheelSpin += dt * 14;
      this.wheelActive -= dt;
    } else {
      this.wheelSpin += dt * 0.4;
    }
    ctx.save();
    ctx.translate(58, 174);
    ctx.rotate(this.wheelSpin);
    ctx.drawImage(this.sprites.wheel, -26, -26);
    ctx.restore();

    const sway = hot && hot.id === 'flower' ? Math.sin(this.t * 6) * 2 : Math.sin(this.t * 1.5) * 0.8;
    ctx.drawImage(this.sprites.flower, 286, 152 + sway);

    ctx.drawImage(this.sprites.bed, 90, 214);
    ctx.drawImage(this.sprites.bowl, 208, 210);

    const isNight = this.phase === 'night';
    if (Math.floor(this.t * 2) % 2 === 0 || isNight) {
      ctx.fillStyle = isNight ? 'rgba(255,209,102,.6)' : 'rgba(255,209,102,.4)';
      ctx.fillRect(38, 106, 12, 8);
      ctx.fillStyle = isNight ? 'rgba(255,240,200,.45)' : 'rgba(255,240,200,.25)';
      ctx.fillRect(26, 92, 24, 12);
    }
    if (isNight) {
      ctx.fillStyle = 'rgba(255,209,102,.15)';
      ctx.fillRect(10, 82, 48, 44);
    }

    for (let d = 0; d < 5; d++) {
      const dx = 60 + ((this.t * 10 + d * 70) % 240);
      const dy = 170 + d * 14 + Math.sin(this.t * 1.5 + d) * 3;
      ctx.fillStyle = d % 2 ? 'rgba(255,235,190,.35)' : 'rgba(255,255,255,.25)';
      ctx.fillRect(dx, dy, 2, 1);
    }

    const ps = petState(state);
    let hamSpr;
    if (ps === PET_STATES.SLEEPING || ps === PET_STATES.SICK) hamSpr = this.ham.sleeping;
    else hamSpr = this.ham.frames[Math.floor(this.t * 6) % 4];
    let hx = 160 - 34, hy = 210 - 92;
    if (ps === PET_STATES.JUMPING) hy -= Math.abs(Math.sin(state._jumping * Math.PI / 12)) * 24;
    ctx.drawImage(hamSpr, hx, hy);
    if (ps === PET_STATES.SLEEPING) {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#8fd0f0';
      const zy = 118 - (Math.floor(this.t * 2) % 2) * 4;
      ctx.fillText('z', 196, zy);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#c8ecff';
      ctx.fillText('Z', 210, zy - 12);
    } else if (ps === PET_STATES.EATING && Math.floor(this.t * 8) % 2) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(156, 208, 3, 2);
      ctx.fillRect(163, 209, 2, 2);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.vy; p.life--;
      ctx.font = '12px monospace';
      ctx.fillStyle = p.c;
      ctx.fillText(p.ch, p.x, p.y);
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (hot) this.drawHot(ctx, hot);
  }

  drawHot(ctx, hot) {
    const bump = Math.sin(this.t * 6) * 1.5;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(hot.x - hot.r + .5, hot.y - hot.r + .5 + bump, hot.r * 2, hot.r * 2);
    ctx.setLineDash([]);
    ctx.font = '8px monospace';
    const tw = ctx.measureText(hot.label).width;
    const lx = Math.max(2, Math.min(this.W - tw - 6, hot.x - tw / 2 - 2));
    ctx.fillStyle = '#171225';
    ctx.fillRect(lx, hot.y + hot.r + 4, tw + 6, 13);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(lx, hot.y + hot.r + 4, tw + 6, 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(hot.label, lx + 3, hot.y + hot.r + 14);
  }

  hitTest(canvasX, canvasY) {
    for (const pt of ROOM_POINTS) {
      const dx = canvasX - pt.x, dy = canvasY - pt.y;
      if (dx * dx + dy * dy <= pt.r * pt.r) return pt;
    }
    return null;
  }
}
