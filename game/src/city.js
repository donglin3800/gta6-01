// Marisol Bay — the city. A 10x10 block grid with roads, buildings, a beach,
// an ocean, a pier, palms and street props. Everything is procedural and seeded.
import * as THREE from 'three';
import { CFG, cityToWorld, roadCoord } from './config.js';
import { mulberry32, range, rangeInt, pick } from './rng.js';
import {
  makeFacadeTexture, makeRoadTexture, makeSidewalkTexture,
  makeSandTexture, makeGrassTexture, makeWaterTexture,
} from './textures.js';

const ROOF_COLORS = [0x6b6f75, 0x7a6a58, 0x5d6b7a, 0x8a7f72];

export function buildCity(scene) {
  const rng = mulberry32(1337);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const roadLines = []; // road centre coordinates, for traffic AI
  for (let i = 0; i <= CFG.blocks; i++) roadLines.push(roadCoord(i));

  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // ---- ground: grass base, sand on the east + south edges, ocean beyond ----
  const grassTex = makeGrassTexture();
  grassTex.repeat.set(24, 24);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.worldHalf * 2, CFG.worldHalf * 2),
    new THREE.MeshLambertMaterial({ map: grassTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sandTex = makeSandTexture();
  sandTex.repeat.set(10, 10);
  const sandEast = new THREE.Mesh(
    new THREE.PlaneGeometry(60, CFG.worldHalf * 2),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sandEast.rotation.x = -Math.PI / 2;
  sandEast.position.set(CFG.cityHalf + 30, 0.02, 0);
  sandEast.receiveShadow = true;
  group.add(sandEast);
  const sandSouth = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.worldHalf * 2, 60),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sandSouth.rotation.x = -Math.PI / 2;
  sandSouth.position.set(0, 0.02, CFG.cityHalf + 30);
  sandSouth.receiveShadow = true;
  group.add(sandSouth);

  const waterTex = makeWaterTexture();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.96 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CFG.cityHalf + 230, 0.05, CFG.cityHalf + 230);
  group.add(ocean);
  const ocean2 = ocean.clone();
  ocean2.position.set(CFG.cityHalf + 230, 0.05, -CFG.cityHalf - 60);
  ocean2.rotation.z = Math.PI;
  group.add(ocean2);

  // ---- roads: one long plane per grid line, both directions ----
  const roadTex = makeRoadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const span = CFG.cityHalf * 2 + CFG.roadWidth;
  for (const c of roadLines) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, span), roadMat.clone());
    ns.material.map = roadTex.clone();
    ns.material.map.repeat.set(1, span / 10);
    ns.material.map.needsUpdate = true;
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.03, 0);
    ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(span, CFG.roadWidth), roadMat.clone());
    ew.material.map = roadTex.clone();
    ew.material.map.repeat.set(span / 10, 1);
    ew.material.map.needsUpdate = true;
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.03, c);
    ew.receiveShadow = true;
    group.add(ew);
    // thin yellow centre line (separate geometry: a texture dash rotates wrong on NS roads)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8b93a });
    const nsLine = new THREE.Mesh(new THREE.PlaneGeometry(0.28, span), lineMat);
    nsLine.rotation.x = -Math.PI / 2;
    nsLine.position.set(c, 0.045, 0);
    group.add(nsLine);
    const ewLine = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.28), lineMat);
    ewLine.rotation.x = -Math.PI / 2;
    ewLine.position.set(0, 0.045, c);
    group.add(ewLine);
  }

  // ---- sidewalks + buildings, block by block ----
  const sidewalkTex = makeSidewalkTexture();
  const sidewalkMat = new THREE.MeshLambertMaterial({ map: sidewalkTex });
  const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const palmLeafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  function addPalm(x, z, scale = 1) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.6, 6), palmTrunkMat);
    trunk.position.y = 2.3;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), palmLeafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.1, 4.7, Math.sin(a) * 1.1);
      leaf.rotation.set(0.5, -a + Math.PI / 2, 0);
      leaf.rotation.x = -0.45;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    palm.scale.setScalar(scale);
    palm.rotation.y = rng() * Math.PI * 2;
    group.add(palm);
  }

  function addLamp(x, z) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 6), lampMat);
    pole.position.y = 2.5;
    lamp.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampGlowMat);
    head.position.y = 5.1;
    lamp.add(head);
    lamp.position.set(x, 0, z);
    group.add(lamp);
  }

  const buildingSpots = [];
  for (let bx = 0; bx < CFG.blocks; bx++) {
    for (let bz = 0; bz < CFG.blocks; bz++) {
      const { x, z } = cityToWorld(bx, bz);
      const isBeach = bx >= 8 || bz >= 8;
      const isPark = bx === 4 && bz === 4;
      const isPierBlock = bx === 9 && bz === 9;
      // sidewalk slab under every block
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(CFG.blockSize + 2, CFG.blockSize + 2), sidewalkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(x, 0.04, z);
      slab.receiveShadow = true;
      group.add(slab);

      if (isBeach) {
        // beach blocks: sand, palms, umbrellas
        const sand = new THREE.Mesh(
          new THREE.PlaneGeometry(CFG.blockSize + 2, CFG.blockSize + 2),
          new THREE.MeshLambertMaterial({ map: sandTex }),
        );
        sand.rotation.x = -Math.PI / 2;
        sand.position.set(x, 0.05, z);
        group.add(sand);
        const nPalms = rangeInt(rng, 2, 4);
        for (let i = 0; i < nPalms; i++) {
          addPalm(x + range(rng, -10, 10), z + range(rng, -10, 10), range(rng, 0.8, 1.3));
        }
        // beach umbrella
        const um = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), lampMat);
        pole.position.y = 1.1;
        um.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.7, 8), new THREE.MeshLambertMaterial({ color: pick(rng, [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6]) }));
        top.position.y = 2.4;
        um.add(top);
        um.position.set(x + range(rng, -8, 8), 0, z + range(rng, -8, 8));
        group.add(um);
        continue;
      }
      if (isPark) {
        for (let i = 0; i < 7; i++) addPalm(x + range(rng, -10, 10), z + range(rng, -10, 10), range(rng, 0.9, 1.2));
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(5, 20),
          new THREE.MeshLambertMaterial({ color: 0x2a7f9e }),
        );
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(x + 4, 0.06, z - 3);
        group.add(pond);
        continue;
      }
      if (isPierBlock) continue;

      // buildings: 1 tall tower or 2 mid blocks
      const tower = rng() < 0.3;
      const count = tower ? 1 : rangeInt(rng, 1, 2);
      for (let i = 0; i < count; i++) {
        const w = tower ? range(rng, 14, 18) : range(rng, 10, 16);
        const d = tower ? range(rng, 14, 18) : range(rng, 10, 16);
        const h = tower ? range(rng, 26, 46) : range(rng, 7, 18);
        const ox = count === 1 ? 0 : (i === 0 ? -6 : 6) * (rng() < 0.5 ? 1 : 0.4);
        const oz = count === 1 ? 0 : (i === 0 ? 5 : -5);
        const bxPos = x + ox;
        const bzPos = z + oz;
        const tex = makeFacadeTexture(1000 + bx * 31 + bz * 7 + i);
        tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 12)));
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(bxPos, h / 2, bzPos);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 1.2, d * 0.7),
          new THREE.MeshLambertMaterial({ color: pick(rng, ROOF_COLORS) }),
        );
        roof.position.set(bxPos, h + 0.6, bzPos);
        roof.castShadow = true;
        group.add(roof);
        colliders.push({ minX: bxPos - w / 2, maxX: bxPos + w / 2, minZ: bzPos - d / 2, maxZ: bzPos + d / 2 });
        buildingSpots.push({ x: bxPos, z: bzPos, w, d, h });
      }
      // street lamps at block corners
      if (rng() < 0.7) addLamp(x + CFG.blockSize / 2 + 1, z + CFG.blockSize / 2 + 1);
      if (rng() < 0.5) addLamp(x - CFG.blockSize / 2 - 1, z - CFG.blockSize / 2 - 1);
    }
  }

  // ---- pier: wooden deck running south into the ocean from the beach ----
  const pierGroup = new THREE.Group();
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 2.4), plankMat);
    plank.position.set(153, 0.6, 176 + i * 2.5);
    plank.castShadow = true;
    pierGroup.add(plank);
  }
  const pierEnd = new THREE.Vector3(153, 0.8, 210);
  group.add(pierGroup);
  colliders.push({ minX: 149.5, maxX: 156.5, minZ: 174, maxZ: 212, noWalk: false });

  // ---- crates near the docks (cover for shootouts) ----
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9c7b4f });
  for (let i = 0; i < 10; i++) {
    const s = range(rng, 1, 1.8);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    const cx = range(rng, 120, 165);
    const cz = range(rng, 120, 165);
    crate.position.set(cx, s / 2, cz);
    crate.rotation.y = rng() * Math.PI;
    crate.castShadow = true;
    group.add(crate);
    colliders.push({ minX: cx - s / 2, maxX: cx + s / 2, minZ: cz - s / 2, maxZ: cz + s / 2 });
  }

  // ---- sky: gradient dome + sun + clouds ----
  const skyGeo = new THREE.SphereGeometry(600, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(CFG.skyTop) },
      bottom: { value: new THREE.Color(CFG.skyBottom) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: CFG.sunColor, fog: false }),
  );
  sun.position.set(-260, 300, -420);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 10; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 6, 12), 8, 6), cloudMat);
      puff.position.set(j * 8 - 12 + rng() * 4, rng() * 3, rng() * 4);
      puff.scale.y = 0.5;
      cl.add(puff);
    }
    cl.position.set(range(rng, -300, 300), range(rng, 90, 150), range(rng, -300, 300));
    scene.add(cl);
    clouds.push(cl);
  }

  function update(dt, t) {
    waterTex.offset.x = t * 0.008;
    waterTex.offset.y = t * 0.005;
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].position.x += dt * (0.6 + i * 0.07);
      if (clouds[i].position.x > 340) clouds[i].position.x = -340;
    }
  }

  return {
    colliders,
    roadLines,
    buildingSpots,
    pierEnd,
    beachCenter: new THREE.Vector3(185, 0, 60),
    playerSpawn: new THREE.Vector3(roadCoord(5), 0, roadCoord(5) + 4),
    update,
  };
}

export function collideCircle(colliders, x, z, radius) {
  // Push a circle out of every AABB it overlaps. Returns corrected {x, z}.
  let nx = x;
  let nz = z;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(nx, c.maxX));
    const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * radius;
        nz = cz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = nx - c.minX;
        const pr = c.maxX - nx;
        const pt = nz - c.minZ;
        const pb = c.maxZ - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = c.minX - radius;
        else if (m === pr) nx = c.maxX + radius;
        else if (m === pt) nz = c.minZ - radius;
        else nz = c.maxZ + radius;
      }
    }
  }
  return { x: nx, z: nz };
}

export function onRoad(x, z) {
  // True when within a road strip (either direction).
  const half = CFG.roadWidth / 2 + 0.5;
  for (let i = 0; i <= CFG.blocks; i++) {
    const c = roadCoord(i);
    if (Math.abs(x - c) < half || Math.abs(z - c) < half) return true;
  }
  return false;
}
