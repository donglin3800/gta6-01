// Marisol Bay — bootstrap, input, camera, game loop, menus, screenshot mode.
import * as THREE from 'three';
import { CFG } from './config.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { SoundBank } from './audio.js';
import { Effects } from './effects.js';
import { clamp, angleLerp } from './rng.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') ? parseInt(params.get('shot'), 10) : 0;

const G = {
  state: 'start', // start | playing | paused | busted | wasted
  time: 0,
  gameMinutes: 14 * 60 + 5, // in-game clock starts 14:05
  clockText: '14:05',
};
window.__game = G;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe3f2, 220, 620);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2cf, 2.0);
sun.position.set(-140, 220, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -200;
sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200;
sun.shadow.camera.bottom = -200;
sun.shadow.camera.far = 700;
scene.add(sun);

const sound = new SoundBank();
const fx = new Effects(scene);
const city = buildCity(scene);
const traffic = new Traffic(scene, city);
const peds = new Pedestrians(scene, city);
const player = new Player(scene, city, city.playerSpawn.clone());
const hud = new HUD(G);
const missions = new Missions(G);
const police = new Police(scene, traffic, city, sound, () => bustPlayer());

Object.assign(G, { scene, camera, renderer, city, traffic, peds, player, police, missions, hud, sound, fx });

// parked cars near the spawn so stealing is instant
traffic.spawnParked(city.playerSpawn.x + 6, city.playerSpawn.z - 6, Math.PI / 2);
traffic.spawnParked(city.playerSpawn.x - 8, city.playerSpawn.z + 10, 0);
traffic.spawnParked(-17, 51, Math.PI);
traffic.spawnParked(51, -17, -Math.PI / 2);

// mission beacon: floating marker over the current objective
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.85 });
const beacon = new THREE.Group();
const beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
beaconBeam.position.y = 13;
beacon.add(beaconBeam);
const beaconArrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), beaconMat);
beaconArrow.rotation.x = Math.PI;
beaconArrow.position.y = 6;
beacon.add(beaconArrow);
beacon.visible = false;
scene.add(beacon);

// ---- input ----
const input = { forward: false, back: false, left: false, right: false, run: false, jump: false };
const KEYMAP = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump' };
let shooting = false;
let shootCooldown = 0;

addEventListener('keydown', (e) => {
  if (e.code in KEYMAP) { input[KEYMAP[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  if (e.code === 'KeyE' && G.state === 'playing') tryEnterExitCar();
  if (e.code === 'KeyR' && G.state === 'playing') reload();
  if (e.code === 'KeyM' && G.state === 'playing') { if (missions.index === -1) missions.start(); }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyF' && G.state === 'playing') { sound.horn(); }
});
addEventListener('keyup', (e) => { if (e.code in KEYMAP) input[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in input) input[k] = false; shooting = false; });

renderer.domElement.addEventListener('click', () => {
  if (G.state === 'playing' && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement) shooting = false;
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || G.state !== 'playing') return;
  player.camYaw -= e.movementX * 0.0028;
  player.camPitch = clamp(player.camPitch + e.movementY * 0.0022, -0.15, 1.1);
});
addEventListener('mousedown', (e) => {
  if (e.button === 0 && G.state === 'playing' && !player.inCar) shooting = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) shooting = false; });

function reload() {
  if (player.ammo >= CFG.pistolAmmo || player.reserve <= 0) return;
  const need = CFG.pistolAmmo - player.ammo;
  const take = Math.min(need, player.reserve);
  player.ammo += take;
  player.reserve -= take;
  sound.pickup();
}

function tryEnterExitCar() {
  if (player.inCar) {
    player.ejectFromCar(false);
    sound.engine(false);
    return;
  }
  const car = traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
  if (!car) return;
  const wasParked = car.parked;
  player.enterCar(car);
  sound.engine(true, 0);
  if (!wasParked || car.speed > 0.5) {
    police.addWanted(1, 'car theft');
    peds.fleeFrom(player.pos.x, player.pos.z, 18);
    hud.toast('Car stolen', 'The owner called it in — the police are coming.');
  } else {
    hud.toast('Car stolen', 'Nice wheels. Try not to attract attention.');
    police.addWanted(1, 'car theft');
  }
}

function shootOnce() {
  if (shootCooldown > 0 || player.ammo <= 0) {
    if (player.ammo <= 0) { sound.denied(); reload(); }
    return;
  }
  shootCooldown = 0.28;
  sound.shot();
  const origin = new THREE.Vector3(player.pos.x, player.pos.y + 1.55, player.pos.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // slight spread
  dir.x += (Math.random() - 0.5) * 0.02;
  dir.y += (Math.random() - 0.5) * 0.02;
  dir.normalize();
  fx.muzzle(origin, dir);
  const targets = [];
  for (const p of peds.peds) {
    targets.push({
      center: () => new THREE.Vector3(p.mesh.position.x, 1.2, p.mesh.position.z),
      radius: 0.8,
      kind: 'ped', ref: p,
    });
  }
  for (const car of traffic.cars) {
    if (car.driven) continue;
    targets.push({
      center: () => new THREE.Vector3(car.pos.x, 1.0, car.pos.z),
      radius: 2.4,
      kind: car.isPolice ? 'police' : 'car', ref: car,
    });
  }
  const res = player.shoot(origin, dir, targets);
  if (res.hit) {
    sound.hit();
    fx.sparks(res.point);
    if (res.hit.kind === 'ped') {
      fx.blood(res.point);
      peds.kill(res.hit.ref);
      peds.fleeFrom(res.point.x, res.point.z, 30);
      police.addWanted(2, 'shooting');
      hud.toast('Witnesses saw that', 'Your wanted level went up.');
    } else if (res.hit.kind === 'police') {
      res.hit.ref.health -= CFG.pistolDamage;
      if (res.hit.ref.health <= 0) {
        fx.explosion(res.point);
        sound.crash();
        traffic.removeCar(res.hit.ref);
        const i = police.policeCars.indexOf(res.hit.ref);
        if (i >= 0) police.policeCars.splice(i, 1);
        police.addWanted(1, 'police car destroyed');
      } else {
        police.addWanted(1, 'fired on police');
      }
    } else {
      res.hit.ref.health -= CFG.pistolDamage;
      if (res.hit.ref.health <= 30 && !res.hit.ref.smoking) {
        res.hit.ref.smoking = true;
        fx.smoke(res.point, true);
      }
      if (res.hit.ref.health <= 0) {
        fx.explosion(new THREE.Vector3(res.hit.ref.pos.x, 1, res.hit.ref.pos.z));
        sound.crash();
        traffic.removeCar(res.hit.ref);
        police.addWanted(1, 'car destroyed');
      } else {
        police.addWanted(1, 'fired on a car');
      }
    }
  } else {
    peds.fleeFrom(res.point.x, res.point.z, 12);
  }
}

function bustPlayer() {
  if (G.state !== 'playing') return;
  G.state = 'busted';
  sound.busted();
  sound.siren(false);
  sound.engine(false);
  document.exitPointerLock?.();
  const fine = Math.min(player.money, 500);
  player.money -= fine;
  police.clearWanted();
  if (player.inCar) player.ejectFromCar(false);
  hud.el('busted-fine').textContent = 'Fine paid: ' + hud.moneyFmt(fine);
  hud.showScreen('busted');
}

function wastePlayer() {
  if (G.state !== 'playing') return;
  G.state = 'wasted';
  sound.busted();
  sound.siren(false);
  sound.engine(false);
  document.exitPointerLock?.();
  hud.showScreen('wasted');
}

function respawn() {
  player.health = 100;
  player.dead = false;
  player.ammo = CFG.pistolAmmo;
  player.reserve = CFG.pistolReserve;
  if (player.inCar) player.ejectFromCar(false);
  player.pos.copy(city.playerSpawn);
  player.heading = 0;
  player.camYaw = 0;
  police.clearWanted();
  hud.showScreen(null);
  G.state = 'playing';
}

function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    document.exitPointerLock?.();
    sound.engine(false);
    hud.showScreen('pause');
  } else if (G.state === 'paused') {
    G.state = 'playing';
    hud.showScreen(null);
  }
}

function startGame(fromSave) {
  sound.ensure();
  if (fromSave) {
    hud.load();
    hud.toast('Save loaded', 'Welcome back to Marisol Bay.');
  }
  hud.showScreen(null);
  G.state = 'playing';
  if (missions.index === -1) missions.start();
}

// ---- menu buttons ----
document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-save').addEventListener('click', () => hud.save());
document.getElementById('btn-quit').addEventListener('click', () => { hud.save(); G.state = 'start'; hud.showScreen('start'); });
document.getElementById('btn-respawn').addEventListener('click', respawn);
document.getElementById('btn-respawn2').addEventListener('click', respawn);
document.getElementById('btn-mute').addEventListener('click', (e) => {
  const m = !sound.muted;
  sound.setMuted(m);
  e.target.textContent = m ? '🔇 Sound: off' : '🔊 Sound: on';
});
if (!hud.hasSave()) document.getElementById('btn-continue').style.display = 'none';

// ---- camera ----
function updateCamera(dt) {
  const target = player.inCar && player.car ? player.car.pos : player.pos;
  const focusY = player.inCar ? 1.6 : 1.7;
  let yaw = player.camYaw;
  if (player.inCar && player.car) {
    // chase cam relaxes toward the car's heading
    yaw = angleLerp(yaw, player.car.heading + Math.PI, 1 - Math.pow(0.001, dt));
    player.camYaw = yaw;
  }
  const dist = player.inCar ? CFG.camDistance + 2 : CFG.camDistance;
  const pitch = player.camPitch;
  const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = focusY + Math.sin(pitch) * dist + 1.2;
  camera.position.set(cx, cy, cz);
  const shake = fx.shakeOffset();
  camera.position.x += shake.x;
  camera.position.y += shake.y;
  camera.lookAt(target.x, focusY, target.z);
  // keep the camera out of buildings is skipped: fog + height keep it readable
}

// ---- screenshot mode: deterministic staged scenes ----
function setupShot(n) {
  sound.ensure();
  G.state = 'playing';
  hud.showScreen(null);
  const place = (x, z, yaw, pitch = 0.32) => {
    player.pos.set(x, 0, z);
    player.camYaw = yaw;
    player.camPitch = pitch;
    player.heading = yaw + Math.PI;
  };
  if (n === 1) {
    // cover: driving down a boulevard at speed, city towers behind
    const car = traffic.cars[0];
    player.enterCar(car);
    car.pos.set(-60, 0, 0);
    car.heading = Math.PI / 2;
    car.speed = 22;
    player.camYaw = car.heading + Math.PI;
    player.camPitch = 0.28;
  } else if (n === 2) {
    // on foot by the beach, ocean and palms
    place(178, 40, -Math.PI / 2 - 0.5, 0.3);
    missions.start();
  } else if (n === 3) {
    // police chase: two police cars closing in on the player's car
    const car = traffic.cars[1] || traffic.cars[0];
    player.enterCar(car);
    car.pos.set(0, 0, -40);
    car.heading = 0;
    car.speed = 18;
    player.camYaw = Math.PI;
    police.addWanted(3, 'chase');
    police.spawnTimer = 10; // no extra spawns before the shot
    const pc1 = traffic.spawnPolice(5, -58, 0);
    police.policeCars.push(pc1);
    const pc2 = traffic.spawnPolice(-5, -52, 0);
    police.policeCars.push(pc2);
  } else if (n === 4) {
    // mission moment: on foot on the road facing the bank, beacon overhead
    missions.jumpTo(3);
    place(34, 24, Math.PI, 0.3);
  }
  // let the world settle a few frames, then signal the screenshot driver
  setTimeout(() => { window.__shotReady = true; }, 2500);
}

// ---- main loop ----
const clock = new THREE.Clock();
let fpsAccum = 0;
let fpsFrames = 0;
window.__fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  fpsAccum += dt;
  fpsFrames += 1;
  if (fpsAccum >= 1) { window.__fps = Math.round(fpsFrames / fpsAccum); fpsAccum = 0; fpsFrames = 0; }
  G.gameMinutes += dt * 0.6; // 1 real second ≈ 36 game seconds... keep slow: 0.6 min/s
  const hh = Math.floor(G.gameMinutes / 60) % 24;
  const mm = Math.floor(G.gameMinutes % 60);
  G.clockText = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');

  if (G.state === 'playing') {
    if (shootCooldown > 0) shootCooldown -= dt;
    if (shooting) shootOnce();
    player.update(dt, input, G.time);
    if (player.dead) wastePlayer();
    traffic.update(dt, player.pos, police.wanted > 0);
    peds.update(dt, G.time);
    police.update(dt, player);
    missions.update(dt);
    // engine + siren ambience
    if (player.inCar && player.car) sound.engine(true, Math.abs(player.car.speed) / CFG.carMaxSpeed);
    else sound.engine(false);
    // beacon animation
    const target = missions.currentTarget();
    if (target && !missions.storyComplete) {
      beacon.visible = true;
      beacon.position.set(target.x, 0, target.z);
      beaconArrow.position.y = 6 + Math.sin(G.time * 3) * 0.8;
      beaconArrow.rotation.y = G.time * 1.5;
    } else {
      beacon.visible = false;
    }
    hud.update(dt);
  }
  city.update(dt, G.time);
  fx.update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

animate();

if (shotMode) {
  // hide the start screen immediately; the driver waits for __shotReady
  setupShot(shotMode);
} else {
  hud.showScreen('start');
}
window.__ready = true;
