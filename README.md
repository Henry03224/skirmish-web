# Skirmish Web

Original 2D jetpack stick shooter you can play in the browser.

Inspired by the *feel* of classic 2016–2017 mobile LAN deathmatch games (jetpack, dual-stick chaos, short matches). **This is not Mini Militia / Doodle Army.** No official assets, maps, names, or code were copied.

## Play

Open `index.html` locally, or after GitHub Pages is on:

**https://henry03224.github.io/skirmish-web/**

### Modes
- **Play vs Bots** — 1 human + 4 bots, 2-minute deathmatch
- **2P Same Screen** — WASD vs Arrow keys
- **Host / Join Online Room** — PeerJS WebRTC rooms (share the 5-letter code)

### Controls
| Action | Player 1 | Player 2 |
|---|---|---|
| Move | WASD | Arrow keys |
| Jetpack | Space | Shift |
| Fire | J / Z / Enter | / |
| Grenade | K / X | . |

Touch controls appear on phones.

Pickups: green = health, blue = SMG, gold = shotgun.

## Stack
- HTML5 Canvas
- Vanilla JS
- PeerJS for optional online rooms (no custom server)
- GitHub Pages compatible (static files only)

## Legal
Original work. Do not drop copyrighted Mini Militia sprites, audio, or maps into this repo.

MIT license.
