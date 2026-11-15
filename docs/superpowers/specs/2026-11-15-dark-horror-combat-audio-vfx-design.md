# Design Spec: Dark Horror Atmosphere, Progressive Wave Darkness & Visceral Gunplay/Audio Overhaul

- **Date:** 2026-11-15
- **Project:** Box-Head-Game (`boxhead-lan-game`)
- **Status:** Draft (Pending User Approval)

---

## 1. Intent & Why

### Problem
In the current game build:
1. **Flat Audio ([client/js/audio.js](file:///d:/Box-Head-Game/client/js/audio.js)):** All weapon shots, hits, and deaths use single, raw 50–250ms 8-bit oscillators (`sine`, `square`, `sawtooth`, `triangle`) with no reverb, no distortion, no bass weight, no shell casing clinks, no stereo directionality, no monster vocalizations, and zero background horror ambience.
2. **Repetitive Weapon VFX ([client/js/renderer.js](file:///d:/Box-Head-Game/client/js/renderer.js)):** Every weapon (`PISTOL`, `UZI`, `SHOTGUN`, `ROCKET`, `RAILGUN`) renders the exact same 24px yellow triangle muzzle flash (`drawMuzzleFlashes`), identical 12×4px yellow rectangles for standard/shotgun bullets, no ejecting shell casings, no gun smoke, and non-directional circular blood dots on hit (`addBlood`).
3. **Lack of Escalating Atmosphere:** All waves look equally bright from Wave 1 to Wave 20+, so rising difficulty is only felt through enemy numbers rather than sensory tension.

### Goal & Desired Player Experience
Transform the combat loop into a **vivid, terrifying, and captivating Dark Horror Co-op Shooter ("Sinh tồn Bóng tối & Súng đạn Hạng nặng")**:
- **Progressive Wave Darkness:** The battlefield starts dimly lit at Wave 1 and grows progressively darker with each wave until Wave 6+ plunges the arena into oppressive darkness (~88% opacity), visually embodying rising difficulty.
- **Tactical Flashlights & Dynamic Combat Lighting:** Players rely on their directional weapon flashlight cones, teammates' flashlights, and transient bursts of light from muzzle flashes, explosions, rockets, railgun beams, and Devil fireballs. Zombies lurking outside light cones reveal menacing **glowing eyes** within threat range (~380px) before lunging.
- **Heavy, Visceral Gunplay VFX:** Every weapon has a distinct muzzle flash silhouette, dynamic light bloom, ejecting brass/shotgun shells that bounce on the floor, gun smoke, tracer trails, and directional blood/gore splatter along the bullet's exit vector.
- **Spatial Horror Audio Engine:** Procedural multi-layered Web Audio synthesis featuring room reverb, stereo panning (left/right based on world position), 3-layer gunshots (transient crack + sub-bass punch + shell casing clink), monster growls/shrieks/roars by zombie type, wet flesh/bone hit sounds, a wave-scaling dark ambient drone, and a dynamic heartbeat when low on HP or surrounded.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- Implement progressive wave-based darkness (`Wave 1: 18%` $\rightarrow$ `Wave 6+: 88%`) with smooth transitions between waves using an offscreen lighting canvas (`darknessCanvas`).
- Render conical flashlight beams + personal radial auras for all alive players, plus dynamic circular/beam light cutouts for muzzle flashes, explosions, projectiles, barrels, and drones.
- Render glowing monster eyes in the dark for zombies outside direct flashlight beams within a 380px threat radius of any alive player.
- Enrich server `HIT` and `ZOMBIE_DIE` events in [server/game/GameRoom.js](file:///d:/Box-Head-Game/server/game/GameRoom.js) with impact `angle`, `weapon`, and `zType` metadata.
- Upgrade [client/js/renderer.js](file:///d:/Box-Head-Game/client/js/renderer.js) with weapon-specific muzzle flashes, ejecting shell casings (`shellCasings`), barrel smoke (`gunSmoke`), lingering Railgun plasma beams (`railgunBeams`), and directional gore/blood splatter (`addDirectionalBlood`).
- Upgrade [client/js/audio.js](file:///d:/Box-Head-Game/client/js/audio.js) with a `DynamicsCompressorNode` master bus, synthetic `ConvolverNode` reverb, `StereoPannerNode` spatial positioning, 3-layer weapon synthesis, zombie vocalizations (`playZombieGrowl`, `playWaveStart`), wet gore impact audio, and a reactive horror soundscape (`updateHorrorAmbience` with dark drone + heartbeat).
- Maintain 100% compatibility with existing unit/E2E tests (`node --test tests/*.test.js`) and add dedicated tests covering the new server event payloads, renderer lighting/gore systems, and audio methods.

### Non-Goals
- **No external audio file dependencies (`.mp3`/`.wav`/`.ogg`):** Everything remains 100% procedural Web Audio API synthesis so LAN clients connect and play immediately with zero network asset lag.
- **No per-wall 2D raycasting shadow polygons:** Flashlights use feathered conical/radial gradients on an offscreen canvas to guarantee locked 60 FPS across 4 concurrent LAN players.
- **No balance changes to core combat stats:** Weapon damage, ammo counts, zombie HP/speed, and ultimate charge rates remain untouched.

### Anti-Goals
- **Unplayable pitch-black blindness:** Darkness alpha must never reach 1.0 (capped at `0.88`), and every alive player always retains a close-range personal aura (`135px` radius) so they can see their own character and immediate surroundings even when facing away.
- **Audio clipping or ear fatigue:** Simultaneous gunfire from 4 players must be tamed by a master `DynamicsCompressorNode` and per-sound polyphony/rate throttling (e.g., max 1 shell clink per 70ms, max 1 zombie vocalization per 1.8s).
- **Late-wave FPS degradation:** All new particle arrays (`shellCasings`, `gunSmoke`, `railgunBeams`, `particles`) must enforce strict FIFO caps.

---

## 3. Constraints

- **Architecture:** Authoritative Node.js server (`50 Hz` tick in `server/game/GameRoom.js`) broadcasting snapshots to vanilla HTML5 Canvas + Web Audio clients (`client/js/`).
- **World Coordinate System:** Fixed `1600x1200` arena across all 4 maps (`THE_ROOMS`, `DESERT`, `SNOW`, `VOLCANO`).
- **Headless Test Compatibility:** `Renderer` (`client/js/renderer.js`) and `GameRoom` (`server/game/GameRoom.js`) are imported in Node.js unit tests (`tests/*.test.js`) where `document`, `window`, or `AudioContext` may be absent or minimal. All DOM/Canvas/Audio calls must guard against missing browser globals.

---

## 4. Approaches Considered

### Approach 1 (Selected): Offscreen Lighting Canvas + Enriched Server `HIT` Event
- **Description:**
  - Add `angle`, `weapon`, and `zType` to `HIT` (and `killAngle` to `ZOMBIE_DIE`) in `server/game/GameRoom.js`.
  - Use an offscreen `darknessCanvas` (`1600x1200`) in `client/js/renderer.js` with `destination-out` gradient cutouts for flashlights, player auras, muzzle flashes, projectiles, and explosions, plus glowing zombie eyes rendered on top of the darkness layer.
  - Upgrade `client/js/audio.js` with procedural multi-layered Web Audio synthesis, synthetic reverb, stereo panning, monster vocalizations, and a wave-scaling horror drone + low-HP heartbeat.
- **Trade-offs:** Negligible network payload increase (~25 bytes per hit event); delivers physically accurate directional blood splatter and 60 FPS dynamic lighting without complex geometry math.
- **Why Selected:** Chosen by the user for the best balance of visceral realism, cooperative visibility, and smooth LAN performance.

### Approach 2: 100% Client-Side (No Server Changes)
- **Description:** Keep `GameRoom.js` untouched and guess hit angles on the client from zombie facing angles or random vectors.
- **Trade-offs:** Avoids touching server files, but blood and meat chunks spray in arbitrary directions instead of matching the shooter's bullet trajectory, weakening gunplay impact.

### Approach 3: 2D Raycasting Shadow Polygons
- **Description:** Compute line-of-sight shadow geometry against all map walls and player-placed barricades every frame for up to 4 flashlights and dynamic explosions.
- **Trade-offs:** Produces hard architectural shadows behind pillars, but scales poorly (`O(lights * obstaclesVertices)`) in late waves with dozens of barricades and projectiles, risking frame drops on lower-end laptops.

---

## 5. Detailed Technical Design

### 5.1. Server Event Payload Enrichment ([server/game/GameRoom.js](file:///d:/Box-Head-Game/server/game/GameRoom.js))

1. **Bullet `HIT` Event (in `GameRoom.prototype.tick`)**:
   When a player bullet `b` hits zombie `z`:
   ```js
   this.eventsBuffer.push({
     type: 'HIT',
     x: Math.round(z.x),
     y: Math.round(z.y),
     angle: Number((b.angle || 0).toFixed(2)),
     weapon: b.type || 'bullet',
     zType: z.type
   });
   ```
2. **Zombie Death `ZOMBIE_DIE` Event (in `tick` and `triggerExplosion`)**:
   Include `killAngle` so fatal shots/explosions produce a dramatic directional gore burst:
   ```js
   this.eventsBuffer.push({
     type: 'ZOMBIE_DIE',
     x: z.x,
     y: z.y,
     zType: z.type,
     angle: z.angle,
     killAngle: Number((b ? b.angle : knockAngle).toFixed(2))
   });
   ```

---

### 5.2. Progressive Wave Darkness & Tactical Flashlight System ([client/js/renderer.js](file:///d:/Box-Head-Game/client/js/renderer.js))

1. **Offscreen Darkness Canvas Initialization:**
   - In `Renderer.constructor`: create `this.darknessCanvas` (`1600x1200`) and `this.darknessCtx` alongside `this.bloodCanvas` when `typeof document !== 'undefined'`.
   - Track `this.currentDarknessAlpha = 0.18` and `this.targetDarknessAlpha = 0.18`.

2. **Wave Darkness Progression (`getTargetWaveDarkness(wave)`)**:
   - Formula:
     - `Wave 1`: `0.18` (twilight tension)
     - `Wave 2`: `0.32`
     - `Wave 3`: `0.48`
     - `Wave 4`: `0.62`
     - `Wave 5`: `0.75`
     - `Wave 6+`: `Math.min(0.88, 0.75 + (wave - 5) * 0.065)` (caps at `0.88` from Wave 7+).
   - In `updateVisuals(dt, map, wave)`: smoothly interpolate `this.currentDarknessAlpha += (target - this.currentDarknessAlpha) * Math.min(1, dt * 1.5)`.
   - Darkness base color adapts subtly to map theme (`#05070d` default/Rooms, `#040914` Snow, `#120604` Volcano, `#0e0905` Desert).

3. **Light Sources Cutout (`drawDarknessAndLights(ctx, state, myPlayerId, map)`)**:
   - Fill `this.darknessCtx` (`source-over`) with the map's darkness color at `globalAlpha = this.currentDarknessAlpha`.
   - Switch `this.darknessCtx.globalCompositeOperation = 'destination-out'`:
     - **Alive Players (`state.players`)**:
       - *Personal Close Aura*: Radial gradient at `(p.x, p.y)` from `r = 25` (`alpha: 1.0`) to `r = (p.id === myPlayerId ? 140 : 115)` (`alpha: 0`). Downed players emit a dim emergency aura (`r = 75`, `alpha: 0.6`).
       - *Tactical Flashlight Cone*: Drawn along `p.angle` starting from gun muzzle `(p.x + cos(angle)*18, p.y + sin(angle)*18)`, extending `420px` with half-angle `0.42 rad (~24°)`. Uses a linear/radial gradient from `rgba(0,0,0,0.95)` near muzzle to `rgba(0,0,0,0)` at `420px`, with a soft outer penumbra cone (`0.58 rad`, `alpha: 0.45`) so the beam edge looks natural rather than hard-clipped.
     - **Muzzle Flashes (`this.muzzleFlashes`)**:
       - Each active muzzle flash cuts out a large transient circle (`radius: mf.lightRadius || 200`, `alpha: (mf.life / mf.maxLife) * 0.95`) so rapid gunfire strobes the dark room like an action-horror film.
     - **Projectiles, Barrels, Drones & Shockwaves**:
       - `bullets`: Rockets (`r = 120`), Devil Fireballs (`r = 135`), Standard tracers (`r = 45`, `alpha = 0.45`).
       - `railgunBeams`: Glowing line cutout along the beam segment (`lineWidth = 70`).
       - `barricades`: Explosive Barrels emit a subtle pulsing hazard glow (`r = 65`, `alpha = 0.45`).
       - `drones`: Tactical Drone cuts out `r = 200` (`alpha = 0.75`).
       - `shockwaves` & `particles` (explosions): Cut out `r = s.radius * 1.35` (`alpha = s.alpha`).
   - Draw `this.darknessCanvas` onto main `ctx` (`0, 0`).
   - Add a subtle warm additive flashlight sheen (`rgba(255, 248, 220, 0.07)`) on the main `ctx` for each alive player's cone.

4. **Glowing Zombie Eyes in the Dark (`drawZombieEyesInDark(ctx, zombies, players)`)**:
   - Rendered **after** `this.darknessCanvas` is drawn onto main `ctx`, only when `this.currentDarknessAlpha >= 0.30`.
   - For each alive zombie within `400px` of any alive player:
     - Compute eye position from `zombie.x, zombie.y, zombie.angle`.
     - Eye glow color by type: `DEVIL` (`#ff6d00`), `VAMPIRE` (`#ff1744`), `MUMMY` (`#c6ff00`), `RUNNER` (`#ff5252`), `TANK` (`#ffab00`), `NORMAL` (`#ff1744`).
     - Draw twin glowing pupils with `shadowBlur = 10` and distance-based alpha fade so eyes gleam menacingly out of the shadows.

---

### 5.3. Visceral Weapon VFX & Directional Gore ([client/js/renderer.js](file:///d:/Box-Head-Game/client/js/renderer.js))

1. **Weapon-Specific Muzzle Flashes (`addMuzzleFlash(x, y, angle, weapon = 'PISTOL')`)**:
   - Store `{ x, y, angle, weapon, life, maxLife, lightRadius, seed }`.
   - Custom shapes in `drawMuzzleFlashes(ctx)`:
     - `PISTOL`: Crisp 3-point star flash (`28px` length, `lightRadius: 170`, `0.06s`).
     - `UZI`: Jagged rapid X-spike flash (`26px` length, `lightRadius: 160`, `0.045s`).
     - `SHOTGUN`: Wide multi-tongue blast cone (`48px` length, `36px` spread, `lightRadius: 250`, `0.09s`) + 8 flying incendiary sparks.
     - `ROCKET`: Heavy orange/red nozzle flame + rear exhaust puff (`54px` length, `lightRadius: 260`, `0.11s`).
     - `RAILGUN`: Electric cyan-white plasma burst (`64px` length, `lightRadius: 300`, `0.14s`) + persistent `this.railgunBeams` entry (`{ x, y, angle, life: 0.25, maxLife: 0.25 }`) rendering a decaying electric beam across the arena.
   - Also spawn 1–3 puffs of `this.gunSmoke` (capped at 50) drifting forward and upward from `(x, y)` and trigger subtle per-shot camera kick (`1.5px` for Uzi/Pistol, `6px` for Shotgun, `9px` for Rocket/Railgun) when the shooter is the local player.

2. **Ejecting Shell Casings (`this.shellCasings`, capped at 80)**:
   - Spawned inside `addMuzzleFlash` for `PISTOL`, `UZI`, `SHOTGUN`:
     - Ejects perpendicular to firing angle (`angle + Math.PI / 2 + rand(-0.3, 0.3)`), lateral speed `60–130 px/s`, vertical height `z = 12`, upward velocity `vz = 80–130`, gravity `420 px/s²`, bounce factor `0.45`, spin velocity `vRot`, color `#ffd54f` (brass) or `#d32f2f` (shotgun hull), total life `3.0s`.

3. **Enhanced Bullet Tracers (`drawBullets(ctx, bullets)`)**:
   - `shotgun`: Glowing orange-yellow pellet with a `22px` motion-blur tail.
   - `bullet` (Pistol/Uzi/Drone): Bright core + `34px` gradient tracer tail (`rgba(255, 235, 59, 0)` $\rightarrow$ `#fffde7`).
   - `rocket`: Animated flame thruster cone behind the warhead + smoke trail particle emission each frame.
   - `grenade`: Spinning military canister with blinking red fuse LED.

4. **Directional Blood & Gore Splatter (`addDirectionalBlood(x, y, impactAngle, weapon, isKill = false)`)**:
   - Paints directional high-velocity blood streaks onto persistent `this.bloodCanvas` fanning out in a `±0.45 rad` cone along `impactAngle` (`40–95px` throw distance, heavier for `SHOTGUN`, `RAILGUN`, `ROCKET`, or `isKill`).
   - Spawns airborne blood mist & dark crimson meat chunks (`this.particles`, capped at 180) flying along `impactAngle` with rapid drag deceleration.

---

### 5.4. Multi-Layered Horror & Spatial Audio Engine ([client/js/audio.js](file:///d:/Box-Head-Game/client/js/audio.js) & [client/js/main.js](file:///d:/Box-Head-Game/client/js/main.js))

1. **Master Bus, Compressor & Synthetic Reverb (`SoundManager.init()`)**:
   - Chain: `voiceGain -> [StereoPannerNode] -> dry/wet split (wet -> ConvolverNode -> reverbGain) -> DynamicsCompressorNode -> masterGain -> ctx.destination`.
   - `createReverbImpulse(duration = 1.1, decay = 3.2)`: Generates a stereo dark-bunker impulse response buffer (exponentially decaying lowpass-filtered noise) so every gunshot, explosion, and monster roar echoes ominously.
   - `createSpatialRoute(sourceX, listenerX, maxDist = 1100)`:
     - Computes `pan = Math.max(-0.88, Math.min(0.88, (sourceX - listenerX) / 550))` and `distGain = Math.max(0.18, 1 - Math.abs(sourceX - listenerX) / maxDist)` (if coordinates are omitted, defaults to centered `pan = 0, distGain = 1`).

2. **3-Layer Heavy Weapon Synthesis (`playShoot(weaponType, sourceX, listenerX)`)**:
   - **Layer 1 (Transient Crack & Distortion):** Filtered noise burst shaped with a `WaveShaperNode` soft-clipping curve.
   - **Layer 2 (Sub-Bass Punch):** Pitch-sweeping low oscillator (`190Hz -> 35Hz` for Pistol, `240Hz -> 42Hz` for Uzi, `150Hz -> 24Hz` heavy slam for Shotgun, `110Hz -> 22Hz` whoosh-boom for Rocket, `1800Hz -> 45Hz` electromagnetic crack + sub-drop for Railgun).
   - **Layer 3 (Mechanical Click & Shell Casing Clink):** High metallic ping (`3100Hz` & `4600Hz` sine ticks delayed by `130–210ms`, throttled to at most once per `75ms` to prevent clutter during Uzi spray) + wet send to `reverbNode`.

3. **Visceral Impact & Zombie Vocalizations**:
   - `playZombieHit(zType, weapon, sourceX, listenerX)`: Wet flesh squelch (resonant bandpass noise sweep `750Hz -> 140Hz`) + sharp bone crack transient (`1100Hz -> 180Hz` triangle).
   - `playZombieDie(zType, sourceX, listenerX)`: Guttural FM-synthesized death groan pitching down (`130Hz -> 28Hz` over `0.32s`) layered with a wet gore burst and reverb tail.
   - `playZombieGrowl(zType, sourceX, listenerX)` (throttled with a `1.8s` cooldown):
     - `RUNNER`: High-pitched ragged shriek (`480Hz -> 790Hz -> 290Hz` sawtooth + noise modulation).
     - `TANK`: Deep subterranean roar (`68Hz -> 28Hz` sawtooth + sub-sine + reverb).
     - `DEVIL` / `VAMPIRE`: Demonic dual-oscillator dissonant snarl (`165Hz` & `233Hz` tritone interval).
     - `NORMAL` / `MUMMY`: Hollow decaying moan (`115Hz -> 62Hz`).
   - `playWaveStart(wave)`: Ominous low dread horn (detuned sawtooth + sub-bass minor second interval swelling over `1.1s` through reverb) played on `WAVE_START`.

4. **Reactive Horror Soundscape (`updateHorrorAmbience(dt, contextState)`)**:
   - Called once per frame from `main.js` render loop while `isInGame === true`:
     - **Dark Ambient Drone:** Lazy-initialized continuous dual-oscillator sub-drone (`44Hz` & `65.9Hz` dark fifth) routed through a slow LFO lowpass filter (`90Hz–220Hz`). Gain scales smoothly with `wave` (`0.04` at Wave 1 up to `0.14` at Wave 6+) and silences automatically when leaving the game or on `GAMEOVER`.
     - **Tension Heartbeat (`heartbeatTimer`):** Triggers a realistic `lub-dub` (`52Hz` & `44Hz` sine thumps) whenever `hpRatio <= 0.45`, `localPlayer.isDowned`, or `nearbyZombiesCount >= 3` within `240px`. Interval scales dynamically from `0.95s` (mild danger) down to `0.42s` (critical danger).
     - **Proximity Zombie Vocalization Trigger:** Every `2.2s–3.8s`, if alive zombies are within `480px` of the local player, selects the closest/most dangerous zombie and triggers `playZombieGrowl(z.type, z.x, localPlayer.x)` so players hear monsters stalking them in the dark from the left or right ear.

---

## 6. What Is Left to the Builder

- Exact tuning of oscillator envelope constants, filter Q values, and particle alpha decay curves for optimal feel.
- Internal helper method decomposition inside `Renderer` and `SoundManager` (keeping methods under ~30–40 lines per `GEMINI.md` Clean Code guidelines).
- Unit test structure in `tests/` to verify the enriched `HIT` / `ZOMBIE_DIE` payloads, wave darkness curve calculations, directional gore/shell casing array bounds, and `SoundManager` method safety.
