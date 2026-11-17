// Marisol Bay — the wanted system: stars, police spawns, chases, busted / escape.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './rng.js';

export class Police {
  constructor(scene, traffic, city, sound, onBusted) {
    this.scene = scene;
    this.traffic = traffic;
    this.city = city;
    this.sound = sound;
    this.onBusted = onBusted;
    this.wanted = 0;
    this.heat = 0; // 0..100 within the current star level
    this.decayTimer = 0;
    this.policeCars = [];
    this.policeOnFoot = [];
    this.chaseTarget = null; // {kind:'car'|'foot', car?, pos:Vector3}
    this.sirenOn = false;
    this.spawnTimer = 0;
  }

  addWanted(n, reason) {
    if (this.wanted >= CFG.wantedMax) return;
    this.wanted = clamp(this.wanted + n, 0, CFG.wantedMax);
    this.heat = 60;
    this.decayTimer = CFG.wantedDecaySeconds;
    this.spawnTimer = 0;
    if (this.wanted > 0) this.sound.siren(true);
    return this.wanted;
  }

  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
    this.sound.siren(false);
    for (const c of this.policeCars) this.traffic.removeCar(c);
    this.policeCars = [];
  }

  wantedCars() {
    return Math.min(this.wanted, 3) + (this.wanted >= 4 ? 1 : 0);
  }

  update(dt, player) {
    // decay: hide long enough and the heat drops a star
    if (this.wanted > 0) {
      this.decayTimer -= dt;
      if (this.decayTimer <= 0) {
        this.wanted -= 1;
        this.decayTimer = CFG.wantedDecaySeconds;
        if (this.wanted === 0) this.clearWanted();
      }
    }
    const want = this.wanted > 0 ? this.wantedCars() : 0;
    this.spawnTimer -= dt;
    if (this.policeCars.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const a = Math.random() * Math.PI * 2;
      const d = 55 + Math.random() * 25;
      const x = clamp(player.pos.x + Math.sin(a) * d, -CFG.cityHalf + 5, CFG.cityHalf - 5);
      const z = clamp(player.pos.z + Math.cos(a) * d, -CFG.cityHalf + 5, CFG.cityHalf - 5);
      const car = this.traffic.spawnPolice(x, z, Math.atan2(player.pos.x - x, player.pos.z - z));
      this.policeCars.push(car);
    }
    // cull far-away police cars when the player escapes
    for (const c of [...this.policeCars]) {
      const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
      if (d > 160) {
        this.traffic.removeCar(c);
        this.policeCars.splice(this.policeCars.indexOf(c), 1);
      }
    }
    if (this.wanted === 0) return;

    // chase: ram the player's car, or run the player down on foot
    const target = player.inCar ? player.car.pos : player.pos;
    for (const car of this.policeCars) {
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.6, -1, 1);
      const throttle = dist > 6 ? 1 : 0.4;
      car.drive(dt, throttle, steer, this.city.colliders);
      // ram damage + busted check
      if (dist < 3.4) {
        if (player.inCar) {
          player.car.health -= 18 * dt;
          player.car.speed *= 0.96;
          if (player.car.health <= 0) {
            player.ejectFromCar(true);
          }
        } else if (dist < 2.2) {
          this.onBusted();
        }
      }
      // flashing light bar
      car.lightPhase += dt * 10;
      if (car.mesh.userData.lightBar) {
        car.mesh.userData.lightBar.material.color.setHex(Math.sin(car.lightPhase) > 0 ? 0xff2222 : 0x2233ff);
      }
    }
  }
}
