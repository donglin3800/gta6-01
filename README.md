# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/donglin3800/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/donglin3800/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Marisol Bay** — an original open-world crime game built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC. You are fresh off the boat in Marisol Bay: a 10×10-block coastal city with a beach, an ocean, a pier, traffic, pedestrians, police, and a four-mission story — steal cars, dodge the law, and pull off the Marisol Job.

## Play it

Serve the static files and open the game in desktop Chrome. No build step, no accounts, no network requests — everything (three.js, textures, sounds) is vendored or generated in these files.

```sh
node serve.ts
# open http://localhost:8080
```

## How to play

- **WASD** — move on foot / drive · **Mouse** — look (click to lock) · **Click** — shoot the pistol
- **E** — steal a car / get out · **R** — reload · **F** — horn · **M** — start the story · **P** — pause & save
- Steal cars, complete four story missions for Leo Marin and Mara Voss, and mind the wanted stars: at 5 stars the whole Marisol Bay police department is on you.
- Your progress saves in the browser (pause menu → Save game).

## What's inside

- `game/` — the whole game as plain static files: `index.html` plus ES modules under `src/` (city, traffic, pedestrians, police, missions, HUD, synth audio, effects) and vendored three.js under `game/vendor/`.
- `screenshots/` — 4 real renders of the game running in Chrome (driving, the beach, a police chase, the bank job).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `serve.ts` — a tiny static server for local play-testing. `shots.mjs` — the headless-Chrome screenshot driver.

---

<sub>Entered on [make.fun](https://make.fun/?ref=frrbny3y&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
