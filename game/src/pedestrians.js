// Marisol Bay — pedestrians: low-poly walkers who stroll the sidewalks and flee danger.
import * as THREE from 'three';
import { CFG, roadCoord } from './config.js';
import { mulberry32, range, rangeInt, pick, clamp } from './rng.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e, 0xd35400, 0x7f8c8d];
const PANTS = [0x2c3e50, 0x34495e, 0x5d6d7e, 0x6e2c00, 0x1b2631];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

function makePedMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const hairColors = [0x1a1a1a, 0x4a2f18, 0x777777, 0x2c1a0a];
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: hairColors[Math.floor(Math.random() * hairColors.length)] }));
  hair.position.y = 1.72;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pantsMat);
  legL.position.set(-0.14, 0.42, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), shirtMat);
  armL.position.set(-0.36, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.36;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Pedestrians {
  constructor(scene, city, seed = 777) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed);
    this.peds = [];
    for (let i = 0; i < CFG.pedCount; i++) this.spawn();
  }

  randomSidewalkPoint() {
    const rng = this.rng;
    // pick a random block, then a point near its edge (sidewalk ring)
    const bx = rangeInt(rng, 0, CFG.blocks - 1);
    const bz = rangeInt(rng, 0, CFG.blocks - 1);
    const cx = (bx - CFG.blocks / 2 + 0.5) * CFG.pitch;
    const cz = (bz - CFG.blocks / 2 + 0.5) * CFG.pitch;
    const side = rangeInt(rng, 0, 3);
    const off = CFG.blockSize / 2 + 1.5;
    const t = range(rng, -CFG.blockSize / 2, CFG.blockSize / 2);
    if (side === 0) return { x: cx + t, z: cz - off };
    if (side === 1) return { x: cx + t, z: cz + off };
    if (side === 2) return { x: cx - off, z: cz + t };
    return { x: cx + off, z: cz + t };
  }

  spawn() {
    const p = this.randomSidewalkPoint();
    const mesh = makePedMesh(pick(this.rng, SHIRTS), pick(this.rng, PANTS), pick(this.rng, SKINS));
    mesh.position.set(p.x, 0, p.z);
    const heading = this.rng() * Math.PI * 2;
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const ped = {
      mesh, heading,
      speed: range(this.rng, 0.9, 1.7),
      target: this.randomSidewalkPoint(),
      fleeing: false,
      fleeTimer: 0,
      walkPhase: this.rng() * 10,
      alive: true,
    };
    this.peds.push(ped);
    return ped;
  }

  fleeFrom(x, z, radius = 22) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < radius) {
        p.fleeing = true;
        p.fleeTimer = 4 + Math.random() * 3;
        const away = Math.atan2(p.mesh.position.x - x, p.mesh.position.z - z);
        p.target = {
          x: clamp(p.mesh.position.x + Math.sin(away) * 30, -CFG.cityHalf, CFG.cityHalf),
          z: clamp(p.mesh.position.z + Math.cos(away) * 30, -CFG.cityHalf, CFG.cityHalf),
        };
      }
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  kill(ped) {
    ped.alive = false;
    this.scene.remove(ped.mesh);
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
  }

  update(dt, t) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (p.fleeTimer > 0) p.fleeTimer -= dt;
      else p.fleeing = false;
      const dx = p.target.x - p.mesh.position.x;
      const dz = p.target.z - p.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        p.target = this.randomSidewalkPoint();
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
      const speed = p.fleeing ? p.speed * 2.6 : p.speed;
      const nx = p.mesh.position.x + Math.sin(p.heading) * speed * dt;
      const nz = p.mesh.position.z + Math.cos(p.heading) * speed * dt;
      const fixed = collideCircle(this.city.colliders, nx, nz, 0.4);
      p.mesh.position.x = clamp(fixed.x, -CFG.cityHalf, CFG.cityHalf);
      p.mesh.position.z = clamp(fixed.z, -CFG.cityHalf, CFG.cityHalf);
      p.mesh.rotation.y = p.heading;
      p.walkPhase += dt * speed * 5;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.userData.armL.rotation.x = -swing * 0.7;
      p.mesh.userData.armR.rotation.x = swing * 0.7;
    }
  }
}
