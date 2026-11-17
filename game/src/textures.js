// Procedural canvas textures: every texture in the game is drawn at runtime,
// so the game ships zero image files and makes zero network requests.
import * as THREE from 'three';
import { mulberry32, rangeInt, pick } from './rng.js';

function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const FACADE_COLORS = ['#c9a37e', '#b7c4cc', '#d8c9a3', '#a8b8a0', '#c4a0a0', '#8fa8bf', '#d9b380', '#b0a8c4'];

export function makeFacadeTexture(seed) {
  const rng = mulberry32(seed);
  const base = pick(rng, FACADE_COLORS);
  const floors = rangeInt(rng, 3, 9);
  const cols = rangeInt(rng, 3, 6);
  const winLit = rng() < 0.35;
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // subtle vertical grime
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
      g.fillRect(rng() * w, 0, 2 + rng() * 6, h);
    }
    const cw = w / cols;
    const ch = h / floors;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.2;
        const y = f * ch + ch * 0.22;
        const ww = cw * 0.6;
        const wh = ch * 0.55;
        const lit = winLit && rng() < 0.25;
        g.fillStyle = lit ? '#ffd97a' : (rng() < 0.5 ? '#20262e' : '#2c3844');
        g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x, y, ww, 3);
      }
    }
    // ground floor shopfront band
    g.fillStyle = 'rgba(20,20,24,0.55)';
    g.fillRect(0, h - ch * 0.9, w, ch * 0.9);
  });
}

export function makeRoadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#2e2e33';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

export function makeSidewalkTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#9a9a94';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
    }
    for (let i = 0; i < 200; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

export function makeSandTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e8d29a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(120,90,40,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

export function makeGrassTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#4d8a4a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `rgba(20,60,20,${Math.random() * 0.18})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(140,190,90,${Math.random() * 0.15})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

export function makeWaterTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1b6f8f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3);
      g.stroke();
    }
  }, 8, 8);
}

export function makePalmTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#7a5230';
    g.fillRect(w / 2 - 4, 0, 8, h);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < h; y += 12) g.fillRect(w / 2 - 4, y, 8, 3);
  });
}
