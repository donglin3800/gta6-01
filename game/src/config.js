// Marisol Bay — shared tuning constants. All distances in metres, all speeds in m/s.
export const CFG = {
  // City: 10 x 10 blocks. Block pitch 34 m (24 m block + 10 m road).
  blocks: 10,
  blockSize: 24,
  roadWidth: 10,
  pitch: 34,
  // Derived: city spans from -170 to +170 on x and z; beach/ocean beyond +170 (east) and z > 170 (south).
  cityHalf: 170,
  worldHalf: 260,
  // Player on foot
  walkSpeed: 5.2,
  runSpeed: 9.0,
  jumpSpeed: 7.5,
  gravity: 22,
  playerRadius: 0.55,
  playerHeight: 1.8,
  // Cars
  carAccel: 16,
  carBrake: 30,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  carTurn: 1.9,
  trafficCount: 14,
  pedCount: 24,
  // Combat
  pistolDamage: 34,
  pistolRange: 90,
  pistolAmmo: 12,
  pistolReserve: 120,
  // Wanted
  wantedMax: 5,
  wantedDecaySeconds: 26,
  // Missions
  missionReward: [500, 1200, 2000, 5000],
  // Camera
  camDistance: 7.5,
  camHeight: 3.4,
  // Colours
  skyTop: 0x2f7fc4,
  skyBottom: 0xbfe3f2,
  sunColor: 0xfff2cf,
  oceanColor: 0x1b6f8f,
  sandColor: 0xe8d29a,
  grassColor: 0x4d8a4a,
  roadColor: 0x2e2e33,
  sidewalkColor: 0x9a9a94,
};

export function cityToWorld(bx, bz) {
  // Block indices 0..9 -> world centre of that block.
  const half = CFG.blocks / 2;
  return {
    x: (bx - half + 0.5) * CFG.pitch,
    z: (bz - half + 0.5) * CFG.pitch,
  };
}

export function roadCoord(i) {
  // Road centre lines sit between blocks: i = 0..10.
  return (i - CFG.blocks / 2) * CFG.pitch;
}
