// Marisol Bay — the player: third-person on-foot movement, pistol combat,
// stealing and driving cars, health, money.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './rng.js';
import { collideCircle } from './city.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f6f5c }); // teal jacket
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), jacket);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cap.position.y = 1.9;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), jeans);
  legL.position.set(-0.15, 0.45, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.18), jacket);
  armL.position.set(-0.39, 1.18, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.39;
  g.add(armR);
  // pistol in the right hand
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.39, 0.95, 0.22);
  g.add(gun);
  g.userData = { legL, legR, armL, armR, gun };
  return g;
}

export class Player {
  constructor(scene, city, spawn) {
    this.scene = scene;
    this.city = city;
    this.mesh = makePlayerMesh();
    this.mesh.position.copy(spawn);
    this.mesh.position.y = 0;
    scene.add(this.mesh);
    this.pos = this.mesh.position; // alias: Vector3
    this.heading = 0; // facing angle
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.velY = 0;
    this.grounded = true;
    this.health = 100;
    this.money = 250;
    this.ammo = CFG.pistolAmmo;
    this.reserve = CFG.pistolReserve;
    this.inCar = false;
    this.car = null;
    this.walkPhase = 0;
    this.moving = false;
    this.dead = false;
    this.lastDamageAt = 0;
  }

  get speed() { return this.inCar && this.car ? Math.abs(this.car.speed) : 0; }

  enterCar(car) {
    if (this.inCar || !car) return false;
    this.inCar = true;
    this.car = car;
    car.driven = true;
    car.parked = false;
    this.mesh.visible = false;
    return true;
  }

  ejectFromCar(wrecked = false) {
    if (!this.inCar || !this.car) return;
    const car = this.car;
    car.driven = false;
    if (wrecked) {
      car.health = 0;
      car.smoking = true;
    }
    this.inCar = false;
    this.car = null;
    const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    this.pos.set(car.pos.x + side.x * 2.4, 0, car.pos.z + side.z * 2.4);
    this.mesh.visible = true;
    this.heading = car.heading;
  }

  damage(n, now) {
    if (this.dead) return;
    this.health -= n;
    this.lastDamageAt = now;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(dt, now) {
    if (this.dead) return;
    if (now - this.lastDamageAt > 8 && this.health < 100) {
      this.health = Math.min(100, this.health + 4 * dt);
    }
  }

  shoot(origin, dir, targets) {
    // targets: [{mesh|object3D, radius, onHit(point)}]; raycast against spheres.
    if (this.ammo <= 0) return null;
    this.ammo -= 1;
    const ray = new THREE.Raycaster(origin, dir, 0.1, CFG.pistolRange);
    // build a temp list of hit spheres manually (cheap, no BVH needed)
    let best = null;
    let bestT = CFG.pistolRange;
    for (const t of targets) {
      const c = t.center();
      const r = t.radius;
      const oc = new THREE.Vector3().subVectors(c, origin);
      const tca = oc.dot(dir);
      if (tca < 0 || tca > bestT) continue;
      const d2 = oc.lengthSq() - tca * tca;
      if (d2 > r * r) continue;
      const thc = Math.sqrt(r * r - d2);
      const tHit = tca - thc;
      if (tHit < bestT) { bestT = tHit; best = t; }
    }
    const point = origin.clone().add(dir.clone().multiplyScalar(best ? bestT : CFG.pistolRange));
    return { hit: best, point, distance: bestT };
  }

  update(dt, input, now) {
    if (this.dead) return;
    if (this.inCar && this.car) {
      const throttle = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      // steering: left key turns left (heading decreases when moving forward)
      this.car.drive(dt, throttle, -steer, this.city.colliders);
      this.pos.copy(this.car.pos);
      this.heading = this.car.heading;
      return;
    }
    // on foot
    const run = input.run ? CFG.runSpeed : CFG.walkSpeed;
    let mx = 0;
    let mz = 0;
    if (input.forward) mz += 1;
    if (input.back) mz -= 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const wx = (mx * cos - mz * sin) * run;
      const wz = (mx * sin + mz * cos) * run;
      const nx = this.pos.x + wx * dt;
      const nz = this.pos.z + wz * dt;
      const fixed = collideCircle(this.city.colliders, nx, nz, CFG.playerRadius);
      this.pos.x = clamp(fixed.x, -CFG.worldHalf, CFG.worldHalf);
      this.pos.z = clamp(fixed.z, -CFG.worldHalf, CFG.worldHalf);
      const targetHeading = Math.atan2(wx, wz);
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += clamp(dh, -10 * dt, 10 * dt);
      this.walkPhase += dt * run * 1.6;
    }
    // jump / gravity
    if (input.jump && this.grounded) {
      this.velY = CFG.jumpSpeed;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.velY -= CFG.gravity * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.grounded = true; }
    }
    this.mesh.rotation.y = this.heading;
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.6;
    this.mesh.userData.armR.rotation.x = swing * 0.6;
    this.heal(dt, now);
  }
}
