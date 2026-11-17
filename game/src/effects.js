// Marisol Bay — particles (muzzle flash, sparks, smoke, explosions) and screen shake.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shake = 0;
    this.geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  }

  spawn(pos, { count = 10, color = 0xffcc66, speed = 6, life = 0.6, size = 1, gravity = -4, up = 2 } = {}) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const m = new THREE.Mesh(this.geo, mat);
      m.position.copy(pos);
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      const vel = new THREE.Vector3(Math.cos(a) * Math.cos(e) * s, Math.abs(Math.sin(e)) * s * 0.6 + up, Math.sin(a) * Math.cos(e) * s);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel, life: life * (0.6 + Math.random() * 0.7), age: 0, gravity });
    }
  }

  muzzle(pos, dir) {
    const p = pos.clone().add(dir.clone().multiplyScalar(0.7));
    this.spawn(p, { count: 6, color: 0xffdd44, speed: 3, life: 0.12, size: 1.4, gravity: 0, up: 0 });
  }

  blood(pos) { this.spawn(pos, { count: 12, color: 0xaa1111, speed: 4, life: 0.5, size: 0.9 }); }
  sparks(pos) { this.spawn(pos, { count: 16, color: 0xffee88, speed: 9, life: 0.4, size: 0.8 }); }
  smoke(pos, big = false) { this.spawn(pos, { count: big ? 26 : 8, color: 0x555555, speed: 2, life: 1.4, size: big ? 2.2 : 1.2, up: 3 }); }
  explosion(pos) {
    this.spawn(pos, { count: 40, color: 0xff7722, speed: 12, life: 0.8, size: 1.8 });
    this.spawn(pos, { count: 24, color: 0x333333, speed: 4, life: 1.8, size: 2.4, up: 4 });
    this.addShake(1.2);
  }

  addShake(amount) { this.shake = Math.min(1.5, this.shake + amount); }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 2.2);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = 1 - p.age / p.life;
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 7;
    }
  }

  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shake * 0.35,
      y: (Math.random() - 0.5) * this.shake * 0.35,
    };
  }
}
