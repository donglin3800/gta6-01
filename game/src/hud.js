// Marisol Bay — HUD: health, money, wanted stars, minimap, objective, menus, toasts.
import { CFG } from './config.js';

export class HUD {
  constructor(G) {
    this.G = G;
    this.el = (id) => document.getElementById(id);
    this.beacon = null; // Vector3 | null
    this.toastTimer = 0;
    this.minimap = this.el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.saveKey = 'marisol-bay-save-v1';
  }

  moneyFmt(n) { return '$' + Math.floor(n).toLocaleString(); }

  toast(title, body) {
    const t = this.el('toast');
    t.querySelector('.toast-title').textContent = title;
    t.querySelector('.toast-body').textContent = body || '';
    t.classList.add('show');
    this.toastTimer = 5;
  }

  setBeacon(pos) { this.beacon = pos; }

  damageFlash() {
    const v = this.el('vignette');
    v.classList.remove('flash');
    void v.offsetWidth;
    v.classList.add('flash');
  }

  showScreen(name) {
    // name: 'start' | 'pause' | 'busted' | 'wasted' | null (hide all)
    for (const n of ['start', 'pause', 'busted', 'wasted']) {
      this.el('screen-' + n).classList.toggle('show', n === name);
    }
    this.el('hud').classList.toggle('hidden', name === 'start');
  }

  save() {
    const G = this.G;
    try {
      localStorage.setItem(this.saveKey, JSON.stringify({
        money: G.player.money,
        health: G.player.health,
        ammo: G.player.ammo,
        reserve: G.player.reserve,
        missionIndex: G.missions.index,
        missionStep: G.missions.step,
        x: G.player.pos.x,
        z: G.player.pos.z,
        wanted: G.police.wanted,
      }));
      this.toast('Game saved', 'Progress stored in this browser.');
    } catch { /* storage unavailable */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return false;
      const s = JSON.parse(raw);
      const G = this.G;
      G.player.money = s.money ?? 250;
      G.player.health = s.health ?? 100;
      G.player.ammo = s.ammo ?? 12;
      G.player.reserve = s.reserve ?? 120;
      G.player.pos.set(s.x ?? 0, 0, s.z ?? 0);
      G.player.heading = 0;
      if (s.missionIndex >= 0 && G.missions.index === -1) {
        G.missions.index = Math.min(s.missionIndex, G.missions.defs.length - 1);
        G.missions.step = s.missionStep || 0;
        G.missions.enterStep();
      }
      return true;
    } catch { return false; }
  }

  hasSave() {
    try { return !!localStorage.getItem(this.saveKey); } catch { return false; }
  }

  drawMinimap() {
    const G = this.G;
    const c = this.mm;
    const S = 180;
    const scale = S / (CFG.worldHalf * 2);
    const toMap = (x, z) => [(x + CFG.worldHalf) * scale, (z + CFG.worldHalf) * scale];
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#0e2a1e';
    c.fillRect(0, 0, S, S);
    // grass
    c.fillStyle = '#2f6b33';
    c.fillRect(0, 0, S, S);
    // beach + ocean
    const [bx] = toMap(CFG.cityHalf, 0);
    c.fillStyle = '#e8d29a';
    c.fillRect(bx, 0, S - bx, S);
    c.fillStyle = '#1b6f8f';
    c.fillRect(toMap(CFG.cityHalf + 60, 0)[0], 0, S, S);
    // roads
    c.strokeStyle = '#3a3a40';
    c.lineWidth = 4;
    for (const line of G.city.roadLines) {
      const [mx] = toMap(line, 0);
      c.beginPath(); c.moveTo(mx, 0); c.lineTo(mx, S); c.stroke();
      const [, mz] = toMap(0, line);
      c.beginPath(); c.moveTo(0, mz); c.lineTo(S, mz); c.stroke();
    }
    // mission beacon
    if (this.beacon) {
      const [x, y] = toMap(this.beacon.x, this.beacon.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      c.fillStyle = '#ffd23c';
      c.beginPath(); c.arc(x, y, pulse, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000';
      c.font = 'bold 11px sans-serif';
      c.textAlign = 'center';
      c.fillText('★', x, y + 4);
    }
    // traffic + peds (dots)
    c.fillStyle = '#ffffff';
    for (const car of G.traffic.cars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      c.fillStyle = car.isPolice ? '#3388ff' : '#dddddd';
      c.fillRect(x - 2, y - 2, 4, 4);
    }
    c.fillStyle = '#ffcc88';
    for (const p of G.peds.peds) {
      const [x, y] = toMap(p.mesh.position.x, p.mesh.position.z);
      c.fillRect(x - 1, y - 1, 2, 2);
    }
    // player arrow
    const [px, py] = toMap(G.player.pos.x, G.player.pos.z);
    c.save();
    c.translate(px, py);
    c.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)) * 0 + G.player.heading);
    c.fillStyle = '#37e08a';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath();
    c.fill();
    c.restore();
    // north label
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.font = 'bold 10px sans-serif';
    c.textAlign = 'left';
    c.fillText('N', 6, 12);
  }

  update(dt) {
    const G = this.G;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el('toast').classList.remove('show');
    }
    this.el('money').textContent = this.moneyFmt(G.player.money);
    const hp = Math.max(0, Math.round(G.player.health));
    const hpBar = this.el('health-fill');
    hpBar.style.width = hp + '%';
    hpBar.style.background = hp > 50 ? '#37e08a' : hp > 25 ? '#f1c40f' : '#e74c3c';
    this.el('health-num').textContent = hp;
    // wanted stars
    const stars = this.el('stars');
    stars.textContent = '★'.repeat(G.police.wanted) + '☆'.repeat(CFG.wantedMax - G.police.wanted);
    stars.classList.toggle('hot', G.police.wanted > 0);
    // ammo / speed
    this.el('ammo').textContent = G.player.inCar ? '—' : `${G.player.ammo} / ${G.player.reserve}`;
    const kmh = Math.round((G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) : 0) * 3.6);
    this.el('speed').textContent = G.player.inCar ? `${kmh} km/h` : (G.player.moving ? 'on foot' : '');
    this.el('objective-text').textContent = G.missions.objectiveText();
    this.el('clock').textContent = G.clockText;
    this.drawMinimap();
  }
}
