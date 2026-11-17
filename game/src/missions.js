// Marisol Bay — story: four missions for Leo Marin and Mara Voss, then free roam.
import * as THREE from 'three';
import { CFG } from './config.js';

const GARAGE = new THREE.Vector3(-34, 0, -34); // Mara's garage, north-west blocks
const BANK = new THREE.Vector3(34, 0, 34); // Marisol Bay Bank, mid-city
const PARK = new THREE.Vector3(17, 0, 17); // the park at block (4,4) is near (17,17)

export class Missions {
  constructor(G) {
    this.G = G;
    this.index = -1; // -1 = not started
    this.step = 0;
    this.done = false;
    this.storyComplete = false;
    this.waitTimer = 0;
    this.defs = [
      {
        title: '1 · A Friendly Face',
        giver: 'Leo Marin',
        briefing: 'Leo Marin is waiting on the pier. Go meet him — he has work for a newcomer.',
        steps: [
          { text: 'Meet Leo Marin on the pier', target: () => this.G.city.pierEnd, radius: 6 },
        ],
        reward: CFG.missionReward[0],
      },
      {
        title: '2 · Borrowed Wheels',
        giver: 'Leo Marin',
        briefing: 'Mara Voss needs a car, any car. Take one — parked or rolling — and bring it to her garage.',
        steps: [
          { text: 'Steal a car (walk up and press E)', target: null, radius: 0, check: () => this.G.player.inCar },
          { text: 'Drive the car to Mara’s garage', target: () => GARAGE, radius: 8, check: () => this.G.player.inCar },
        ],
        reward: CFG.missionReward[1],
      },
      {
        title: '3 · Heat',
        giver: 'Mara Voss',
        briefing: 'That car was flagged. The police are on you — lose them, then lay low in the park.',
        steps: [
          { text: 'Lose the police (let your wanted level drop to zero)', target: null, radius: 0, check: () => this.G.police.wanted === 0, onEnter: () => this.G.police.addWanted(2, 'stolen car') },
          { text: 'Lay low in the park', target: () => PARK, radius: 10 },
        ],
        reward: CFG.missionReward[2],
      },
      {
        title: '4 · The Marisol Job',
        giver: 'Leo Marin',
        briefing: 'The big one. Hit the Marisol Bay Bank, grab the cash, and vanish down the beach.',
        steps: [
          { text: 'Reach the Marisol Bay Bank', target: () => BANK, radius: 9 },
          { text: 'Grab the cash inside (walk into the vault marker)', target: () => BANK, radius: 4, onEnter: () => { this.G.fx.explosion(BANK.clone().add(new THREE.Vector3(0, 1, 0))); this.G.sound.crash(); } },
          { text: 'Escape to the beach — the police are coming', target: () => this.G.city.beachCenter, radius: 14, onEnter: () => this.G.police.addWanted(3, 'bank job') },
        ],
        reward: CFG.missionReward[3],
      },
    ];
  }

  jumpTo(i) {
    // Jump straight to mission i (used by the screenshot staging, not by play).
    this.index = i;
    this.step = 0;
    this.enterStep();
    const m = this.defs[i];
    this.G.sound.missionStart();
    this.G.hud.toast('New mission — ' + m.title, m.briefing);
  }

  start() {
    if (this.index !== -1) return;
    this.index = 0;
    this.step = 0;
    this.enterStep();
    this.G.sound.missionStart();
    this.G.hud.toast('New mission — ' + this.defs[0].title, this.defs[0].briefing);
  }

  current() {
    if (this.index < 0 || this.index >= this.defs.length) return null;
    return this.defs[this.index];
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  objectiveText() {
    if (this.storyComplete) return 'Story complete — Marisol Bay is yours. Free roam!';
    const m = this.current();
    if (!m) return 'Press M to start the story — Leo Marin is waiting.';
    const s = this.currentStep();
    return `${m.title}: ${s.text}`;
  }

  currentTarget() {
    const s = this.currentStep();
    if (!s || !s.target) return null;
    return s.target();
  }

  enterStep() {
    const s = this.currentStep();
    if (s && s.onEnter) s.onEnter();
    const t = this.currentTarget();
    this.G.hud.setBeacon(t);
  }

  advance() {
    const m = this.current();
    const s = this.currentStep();
    if (!m || !s) return;
    this.G.sound.pickup();
    this.G.hud.toast('Objective complete', s.text);
    this.step += 1;
    if (this.step >= m.steps.length) {
      this.completeMission(m);
      return;
    }
    this.enterStep();
  }

  completeMission(m) {
    this.G.player.money += m.reward;
    this.G.sound.cash();
    this.G.sound.missionDone();
    this.G.hud.toast(`Mission complete — ${m.title}`, `Mara wired you $${m.reward.toLocaleString()}.`);
    this.index += 1;
    this.step = 0;
    if (this.index >= this.defs.length) {
      this.storyComplete = true;
      this.done = true;
      this.G.hud.setBeacon(null);
      this.G.hud.toast('The Marisol Job — done', 'You pulled it off. Marisol Bay is yours now.');
      return;
    }
    const next = this.defs[this.index];
    this.enterStep();
    this.G.sound.missionStart();
    this.G.hud.toast('New mission — ' + next.title, next.briefing);
  }

  update(dt) {
    if (this.index < 0 || this.storyComplete) return;
    if (this.waitTimer > 0) { this.waitTimer -= dt; return; }
    const s = this.currentStep();
    if (!s) return;
    if (s.check && s.check()) { this.advance(); return; }
    if (s.target) {
      const t = s.target();
      const d = Math.hypot(this.G.player.pos.x - t.x, this.G.player.pos.z - t.z);
      if (d < s.radius) this.advance();
    }
  }
}

export { GARAGE, BANK, PARK };
