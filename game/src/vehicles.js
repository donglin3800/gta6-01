// Marisol Bay — cars: mesh factory, traffic AI on the road grid, player driving.
import * as THREE from 'three';
import { CFG, roadCoord } from './config.js';
import { mulberry32, range, rangeInt, pick, clamp, angleLerp } from './rng.js';
import { collideCircle, onRoad } from './city.js';

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x7f8c8d, 0x2c3e50, 0x27ae60, 0xe67e22, 0x8e44ad, 0xecf0f1, 0x16a085];
const POLICE_COLOR = 0x1a1a1a;

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.9), bodyMat);
  hood.position.set(0, 0.92, 1.6);
  g.add(hood);
  // headlights + taillights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.06), lightMat);
    hl.position.set(x, 0.62, 2.16);
    g.add(hl);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xdd2222 });
  for (const x of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.06), tailMat);
    tl.position.set(x, 0.62, -2.16);
    g.add(tl);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.position.set(0, 1.45, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.2, 4.32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  g.userData.wheels = [];
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    w.castShadow = true;
    g.add(w);
    g.userData.wheels.push(w);
  }
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, isPolice = false) {
    this.scene = scene;
    this.mesh = makeCarMesh(color, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.heading = heading;
    this.speed = 0;
    this.isPolice = isPolice;
    this.color = color;
    this.steer = 0;
    this.alive = true;
    this.health = 100;
    this.smoking = false;
    this.lightPhase = 0;
    scene.add(this.mesh);
  }

  get pos() { return this.mesh.position; }

  drive(dt, throttle, steerInput, colliders) {
    // Arcade driving: throttle accelerates, steering scales with speed.
    const maxF = CFG.carMaxSpeed;
    const maxR = CFG.carMaxReverse;
    if (throttle > 0) this.speed += CFG.carAccel * throttle * dt;
    else if (throttle < 0) this.speed += CFG.carBrake * throttle * dt * 0.7;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    this.speed = clamp(this.speed, -maxR, maxF);
    const turnRate = CFG.carTurn * clamp(Math.abs(this.speed) / 8, 0, 1) * (this.speed >= 0 ? 1 : -1);
    this.heading += steerInput * turnRate * dt;
    this.mesh.rotation.y = this.heading;
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const fixed = collideCircle(colliders, nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) {
      if (Math.abs(this.speed) > 6) this.speed *= -0.25;
      else this.speed *= 0.5;
    }
    this.pos.x = clamp(fixed.x, -CFG.worldHalf, CFG.worldHalf);
    this.pos.z = clamp(fixed.z, -CFG.worldHalf, CFG.worldHalf);
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2.2;
    // front wheels steer visually
    this.mesh.userData.wheels[0].rotation.y = steerInput * 0.3;
    this.mesh.userData.wheels[1].rotation.y = steerInput * 0.3;
  }
}

export class Traffic {
  constructor(scene, city, rngSeed = 42) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(rngSeed);
    this.cars = [];
    this.roadLines = city.roadLines;
    for (let i = 0; i < CFG.trafficCount; i++) {
      const c = this.spawnTrafficCar(true);
      if (c) this.cars.push(c);
    }
  }

  randomRoadPoint() {
    const rng = this.rng;
    const ns = rng() < 0.5; // north-south road (constant x) or east-west (constant z)
    const line = pick(rng, this.roadLines);
    const along = range(rng, -CFG.cityHalf + 10, CFG.cityHalf - 10);
    const side = (rng() < 0.5 ? -1 : 1) * 2.2;
    if (ns) return { x: line + side, z: along, heading: along > 0 ? Math.PI : 0, ns: true, line };
    return { x: along, z: line + side, heading: along > 0 ? -Math.PI / 2 : Math.PI / 2, ns: false, line };
  }

  spawnTrafficCar(anywhere = false) {
    const p = this.randomRoadPoint();
    const car = new Car(this.scene, p.x, p.z, p.heading, pick(this.rng, CAR_COLORS));
    car.ns = p.ns;
    car.line = p.line;
    car.cruise = range(this.rng, 7, 12);
    car.targetSpeed = car.cruise;
    car.waitTimer = 0;
    return car;
  }

  spawnParked(x, z, heading) {
    const car = new Car(this.scene, x, z, heading, pick(this.rng, CAR_COLORS));
    car.parked = true;
    this.cars.push(car);
    return car;
  }

  spawnPolice(x, z, heading = 0) {
    const car = new Car(this.scene, x, z, heading, POLICE_COLOR, true);
    car.isPolice = true;
    car.cruise = 20;
    this.cars.push(car);
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    car.alive = false;
  }

  nearestCar(x, z, maxDist, { parkedOnly = false } = {}) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (parkedOnly && !c.parked && c.speed > 0.5) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  update(dt, playerPos, policeChase) {
    for (const car of [...this.cars]) {
      if (car.driven) continue; // player drives this one
      if (car.isPolice && policeChase) continue; // police module steers it
      if (car.parked) continue;
      // simple traffic: cruise along its road, occasionally change road at intersections
      if (car.waitTimer > 0) {
        car.waitTimer -= dt;
        car.speed = 0;
        continue;
      }
      // slow down for the car ahead
      let target = car.cruise;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const ahead = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
        const side = Math.abs(Math.cos(car.heading) * dx - Math.sin(car.heading) * dz);
        if (ahead > 0 && ahead < 9 && side < 2.4) { target = 0; break; }
      }
      car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
      const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      // at an intersection, sometimes turn
      const nearLine = this.roadLines.some((c) => Math.abs((car.ns ? nz : nx) - c) < 1.2);
      if (nearLine && this.rng() < dt * 0.12) {
        const turn = this.rng() < 0.5 ? 1 : -1;
        car.heading += turn * Math.PI / 2;
        car.ns = !car.ns;
      }
      car.pos.x = clamp(nx, -CFG.cityHalf, CFG.cityHalf);
      car.pos.z = clamp(nz, -CFG.cityHalf, CFG.cityHalf);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
      // reached the city edge: turn around
      if (Math.abs(car.pos.x) > CFG.cityHalf - 4 || Math.abs(car.pos.z) > CFG.cityHalf - 4) {
        car.heading += Math.PI;
        car.ns = !car.ns;
      }
      // random brief stop (traffic light flavour)
      if (this.rng() < dt * 0.01) car.waitTimer = range(this.rng, 1, 3);
    }
  }
}

export { CAR_COLORS };
