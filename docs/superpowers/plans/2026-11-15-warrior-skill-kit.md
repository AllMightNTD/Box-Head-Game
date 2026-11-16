# Warrior Stance & ARPG Skill Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `WARRIOR`'s 1–8 firearm loadout with an authoritative server-side Stance & ARPG melee skill kit (Stances `[1]`/`[2]`, Cooldown skills `[3]`–`[8]`, `75` Armor pool, Parry Counter, Ground Zones, HUD & Canvas VFX/WebAudio) while preserving `HUMAN` and `MAGE` gameplay.

**Architecture:** Isolate Warrior configuration (`server/game/WarriorSkillsConfig.js`) and combat simulation (`server/game/WarriorAbilities.js`) from `WeaponsConfig.js`, integrating cleanly through `Player.js` (Armor, Stances, Cooldowns, directional `takeDamage`), `Zombie.js` (`Taunt` and `Fear`), `GameRoom.js` (50Hz tick updates, `groundZones`, `AMMO` cooldown reduction, `War Cry` buff), and client `InputHandler` / `UIController` / `Renderer` / `SoundManager`.

**Tech Stack:** Node.js (`node:test`, `node:assert`), Express, Socket.IO 4, HTML5 Canvas 2D, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-11-15-warrior-skill-kit-design.md`

## Global Constraints

- Maintain `HUMAN`, `MAGE`, `BAMBO`, `BON`, `BINGO`, `BERT` weapon kits (`PISTOL`–`RAILGUN`) and ammo mechanics untouched.
- Preserve exact Combo unlock milestones for Warrior slots `[1]`–`[8]`: `1, 5, 10, 15, 20, 30, 40, 50` (permanently unlocked for the match once `maxCombo` reaches each milestone).
- Authoritative 50Hz server simulation in `GameRoom.tick(0.02)`: validate `slot`, finite `angle`, alive/downed status, unlock state, and cooldowns on every `player:input`, `player:skill`, and `player:ultimate`.
- `WARRIOR` stats: `maxHp: 150`, `maxArmor: 75` (starts full `75` on `startGame`), `speed: 144`, `meleeResistance: 0.25`, `knockbackImmune: true`.
- `AMMO` pickup (and re-reaching `unlockCombo`) for Warrior reduces remaining cooldowns on slots `[3]`–`[7]` by `30%` (minimum `1.5s`) and adds `+15` `ultCharge`.
- Run tests with `node --test tests/*.test.js` (PowerShell blocks `npm.ps1` in this environment).

## Review Focus

1. **Stance switching `[1]` ↔ `[2]` clears Fury & respects `x5` unlock:** Switching from `BERSERKER_STANCE` (`[1]`) to `JUGGERNAUT_STANCE` (`[2]`) resets `furyStacks` to `0`; attempting to switch to `[2]` before `Combo x5` keeps `[1]` active. *(Pinned in Task 2)*
2. **Downed/Dead Warrior cancels `Taunt` aggro and channeling states:** If a taunting Warrior is downed (`isDowned = true`) or dies, zombies immediately clear `tauntTargetId`/`tauntTimer`, and `whirlwind`/`counterShield`/`warCryAura` terminate cleanly. *(Pinned in Task 3)*
3. **Malformed `player:skill` validation:** Casting with `slot` outside `3..8`, `NaN`/`Infinity` angle, non-Warrior class, locked combo milestone, or active cooldown is safely ignored without throwing or mutating state. *(Pinned in Task 5)*
4. **Counter Shield `[7]` directional cone & single-trigger guard:** Attacks from behind (`|deltaAngle| > 70°`) bypass Counter Shield and damage Armor/HP; frontal hits (`<= 70°`, including Devil fireballs) deal `0` damage and trigger Perfect Counter once (`counterShieldTimer` resets immediately so simultaneous hits in one tick cannot double-counter). *(Pinned in Task 2 & Task 4)*
5. **Dash/Counter collision clamping & `SESSION_RESET` cleanup:** `[4] Shadow Dash` and `[7]` Counter step clamp cleanly against walls/pillars/`Barricade`, and `GameRoom.startGame()` resets `armor = 75`, `furyStacks = 0`, all skill cooldowns to `0`, and `groundZones = []`. *(Pinned in Task 4 & Task 5)*

---

### Task 1: Warrior Skills & Ultimate Configuration

**Files:**
- Create: `server/game/WarriorSkillsConfig.js`
- Modify: `server/game/UltimateConfig.js:23-31`
- Modify: `tests/ultimates.test.js:15`
- Test: `tests/warrior_skills.test.js`

**Interfaces:**
- Produces in `server/game/WarriorSkillsConfig.js`:
  - `WARRIOR_ARMOR_CONFIG`: `{ MAX_ARMOR: 75, WAVE_CLEAR_RESTORE_RATIO: 0.5, REVIVE_RESTORE_RATIO: 0.5 }`
  - `WARRIOR_AMMO_REDUCTION`: `{ COOLDOWN_RATIO: 0.3, MIN_SECONDS: 1.5, ULT_CHARGE_BONUS: 15 }`
  - `WARRIOR_SKILLS`: keyed object containing `BERSERKER_STANCE` (slot `1`, `unlockCombo: 1`), `JUGGERNAUT_STANCE` (slot `2`, `unlockCombo: 5`), `BLADE_WHIRLWIND` (slot `3`, `unlockCombo: 10`, `cooldown: 4.5`), `SHADOW_DASH_SLASH` (slot `4`, `unlockCombo: 15`, `cooldown: 5.0`), `SEISMIC_SLAM` (slot `5`, `unlockCombo: 20`, `cooldown: 8.0`), `WAR_CRY` (slot `6`, `unlockCombo: 30`, `cooldown: 10.0`), `COUNTER_SHIELD_BASH` (slot `7`, `unlockCombo: 40`, `cooldown: 8.0`, `missCooldown: 4.0`), `AVATAR_OF_WAR` (slot `8`, `unlockCombo: 50`, `cooldown: 60.0`)
  - `WARRIOR_SKILL_KEYS`: `['BERSERKER_STANCE', 'JUGGERNAUT_STANCE', 'BLADE_WHIRLWIND', 'SHADOW_DASH_SLASH', 'SEISMIC_SLAM', 'WAR_CRY', 'COUNTER_SHIELD_BASH', 'AVATAR_OF_WAR']`
  - `getWarriorSkillBySlot(slot: number) -> SkillConfig | null`
  - `getWarriorSkillById(id: string) -> SkillConfig | null`
  - `getUnlockedWarriorSkills(combo: number) -> SkillConfig[]`
- Updates in `server/game/UltimateConfig.js`:
  - `ULTIMATE_CONFIGS.WARRIOR`: `{ id: 'AVATAR_OF_WAR', name: 'Avatar of War', duration: 10.0, damageMultiplier: 1.5, attackSpeedMultiplier: 1.3, moveSpeedMultiplier: 1.3, fireSlashDamage: 55, fireSlashSpeed: 750, fireSlashRange: 340, endExplosionRadius: 210, endExplosionDamage: 180, endExplosionKnockback: 350 }`

- [ ] **Step 1: Write the failing tests for `WarriorSkillsConfig` and updated `UltimateConfig`**

Create `tests/warrior_skills.test.js` and update `tests/ultimates.test.js:15`:

```js
// tests/warrior_skills.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  WARRIOR_SKILLS,
  WARRIOR_SKILL_KEYS,
  WARRIOR_ARMOR_CONFIG,
  WARRIOR_AMMO_REDUCTION,
  getWarriorSkillBySlot,
  getWarriorSkillById,
  getUnlockedWarriorSkills
} = require('../server/game/WarriorSkillsConfig.js');
const { getUltimateConfigForClass } = require('../server/game/UltimateConfig.js');

test('WarriorSkillsConfig defines 8 skills with exact combo unlock milestones and spec constants', () => {
  assert.strictEqual(WARRIOR_SKILL_KEYS.length, 8);
  assert.strictEqual(WARRIOR_ARMOR_CONFIG.MAX_ARMOR, 75);
  assert.strictEqual(WARRIOR_AMMO_REDUCTION.COOLDOWN_RATIO, 0.3);
  assert.strictEqual(WARRIOR_AMMO_REDUCTION.MIN_SECONDS, 1.5);
  assert.strictEqual(WARRIOR_AMMO_REDUCTION.ULT_CHARGE_BONUS, 15);

  const expectedUnlocks = [1, 5, 10, 15, 20, 30, 40, 50];
  WARRIOR_SKILL_KEYS.forEach((key, idx) => {
    const skill = WARRIOR_SKILLS[key];
    assert.strictEqual(skill.slot, idx + 1);
    assert.strictEqual(skill.unlockCombo, expectedUnlocks[idx]);
  });

  assert.strictEqual(getWarriorSkillBySlot(1).id, 'BERSERKER_STANCE');
  assert.strictEqual(getWarriorSkillBySlot(7).missCooldown, 4.0);
  assert.strictEqual(getWarriorSkillById('SEISMIC_SLAM').fissureDuration, 4.0);
  assert.strictEqual(getUnlockedWarriorSkills(15).length, 4);
  assert.strictEqual(getUltimateConfigForClass('WARRIOR').id, 'AVATAR_OF_WAR');
});
```

In `tests/ultimates.test.js:15`, update `assert.strictEqual(warriorUlt.id, 'SEISMIC_SLAM');` to `assert.strictEqual(warriorUlt.id, 'AVATAR_OF_WAR');`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/warrior_skills.test.js tests/ultimates.test.js`
Expected: FAIL with `Cannot find module '../server/game/WarriorSkillsConfig.js'`

- [ ] **Step 3: Implement `server/game/WarriorSkillsConfig.js` and update `server/game/UltimateConfig.js`**

Write `server/game/WarriorSkillsConfig.js` with all exact spec values:
- `[1] BERSERKER_STANCE`: `damage: 42`, `fireDelay: 0.26`, `range: 80`, `arcRad: (90 * Math.PI) / 180`, `maxFuryStacks: 10`, `furyDuration: 4.0`, `atkSpeedPerStack: 0.03`, `moveSpeedPerStack: 0.02`.
- `[2] JUGGERNAUT_STANCE`: `damage: 58`, `fireDelay: 0.55`, `range: 125`, `arcRad: (130 * Math.PI) / 180`, `knockback: 260`, `frontalReduction: 0.2`, `frontalArcHalfRad: (70 * Math.PI) / 180`, `slowFactor: 0.7`, `slowDuration: 1.5`.
- `[3] BLADE_WHIRLWIND`: `cooldown: 4.5`, `duration: 1.5`, `tickInterval: 0.25`, `totalTicks: 6`, `radius: 105`, `damage: 45`, `moveSpeedMultiplier: 0.7`, `windBladeDamage: 65`, `windBladeSpeed: 560`, `windBladeRange: 260`, `juggernautSlamRadius: 135`, `juggernautSlamDamage: 90`, `juggernautSlamKnockback: 240`, `juggernautStunDuration: 1.2`, `juggernautBossStunDuration: 0.8`.
- `[4] SHADOW_DASH_SLASH`: `cooldown: 5.0`, `duration: 0.18`, `distance: 240`, `dashDamage: 55`, `markFuseTime: 0.5`, `markRadius: 115`, `markPullRadius: 160`, `markDamage: 75`.
- `[5] SEISMIC_SLAM`: `cooldown: 8.0`, `rings: [{ delay: 0, minR: 0, maxR: 95, damage: 165, knockback: 200, stun: 0, bossStun: 0 }, { delay: 0.12, minR: 95, maxR: 165, damage: 105, knockback: 300, stun: 2.0, bossStun: 1.2 }, { delay: 0.24, minR: 165, maxR: 230, damage: 70, knockback: 380, stun: 2.5, bossStun: 1.5 }]`, `fireballClearRadius: 230`, `fissureRadius: 210`, `fissureDuration: 4.0`, `fissureSlowFactor: 0.4`, `fissureTickInterval: 0.5`, `fissureTickDamage: 8`.
- `[6] WAR_CRY`: `cooldown: 10.0`, `tauntRadius: 900`, `tauntDuration: 4.0`, `fearRadius: 180`, `fearDuration: 1.5`, `armorRestoreRatio: 0.2`, `auraRadius: 200`, `auraDuration: 5.0`, `allyDamageBonus: 0.15`.
- `[7] COUNTER_SHIELD_BASH`: `cooldown: 8.0`, `missCooldown: 4.0`, `duration: 1.5`, `frontalArcHalfRad: (70 * Math.PI) / 180`, `moveSpeedMultiplier: 0.75`, `stepDistance: 75`, `bashConeRad: (130 * Math.PI) / 180`, `bashRange: 130`, `bashDamage: 95`, `bashKnockback: 360`, `bashStunDuration: 2.2`, `bashBossStunDuration: 1.4`, `cleaveDamage: 120`, `cleaveRange: 125`, `cleaveConeRad: (130 * Math.PI) / 180`.
- `[8] AVATAR_OF_WAR`: `cooldown: 60.0`, `duration: 10.0`, `damageMultiplier: 1.5`, `attackSpeedMultiplier: 1.3`, `moveSpeedMultiplier: 1.3`, `fireSlashDamage: 55`, `fireSlashSpeed: 750`, `fireSlashRange: 340`, `endExplosionRadius: 210`, `endExplosionDamage: 180`, `endExplosionKnockback: 350`.

Update `server/game/UltimateConfig.js:23-31` to define `ULTIMATE_CONFIGS.WARRIOR` with `AVATAR_OF_WAR`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/warrior_skills.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/game/WarriorSkillsConfig.js server/game/UltimateConfig.js tests/warrior_skills.test.js tests/ultimates.test.js
git commit -m "feat: add WarriorSkillsConfig and switch Warrior ultimate to Avatar of War"
```

---

### Task 2: Player Armor, Stances, Cooldowns, and Directional `takeDamage`

**Files:**
- Modify: `server/game/Player.js:1-359`
- Test: `tests/warrior_skills.test.js`
- Test: `tests/player.test.js:62-89`

**Interfaces:**
- Consumes: `WARRIOR_SKILLS`, `WARRIOR_SKILL_KEYS`, `WARRIOR_ARMOR_CONFIG`, `getUnlockedWarriorSkills` from `server/game/WarriorSkillsConfig.js`
- Produces on `Player`:
  - `player.armor: number`, `player.maxArmor: number`, `player.hasWarCryBuff: boolean`
  - `player.warriorState`: `{ activeStance, furyStacks, furyTimer, skills, whirlwind, dash, counterShieldTimer, warCryAuraTimer, avatarTimer, pendingParry }` (present for `'WARRIOR'`, `null` for others)
  - `player.resetWarriorState()`: resets stance to `'BERSERKER_STANCE'`, `furyStacks = 0`, `armor = maxArmor`, all cooldowns `0`, unlocks `[1]` only, clears active channels
  - `player.setWarriorStance(stanceId: string) -> boolean`: switches between `'BERSERKER_STANCE'` and `'JUGGERNAUT_STANCE'` if unlocked; clears `furyStacks` and `furyTimer` when leaving `'BERSERKER_STANCE'`
  - `player.getWarriorAttackSpeedMultiplier() -> number`
  - `player.getWarriorDamageMultiplier() -> number`
  - `player.takeDamage(amount: number, sourceType?: string, options?: { sourceX?: number, sourceY?: number, bypassShield?: boolean }) -> { blocked: boolean, parried: boolean, damage: number }`
  - `player.restoreArmor(amount: number) -> number`

- [ ] **Step 1: Write failing tests for Armor absorption, Stance switching/Fury clearing, directional Parry/Juggernaut reduction, and `serialize()`**

Append to `tests/warrior_skills.test.js`:

```js
const { Player } = require('../server/game/Player.js');
const { GameMap } = require('../server/game/Map.js');

test('Warrior starts with 75 Armor, absorbs damage before HP, and Juggernaut reduces frontal damage by 20%', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.angle = 0; // facing East (+X)
  assert.strictEqual(warrior.maxArmor, 75);
  assert.strictEqual(warrior.armor, 75);

  // Unlock Juggernaut stance at combo 5 and switch
  for (let i = 0; i < 4; i++) warrior.recordKill();
  assert.strictEqual(warrior.warriorState.skills.JUGGERNAUT_STANCE.unlocked, true);
  warrior.applyInput({ weaponId: 'JUGGERNAUT_STANCE' });
  assert.strictEqual(warrior.warriorState.activeStance, 'JUGGERNAUT_STANCE');

  // Frontal attack from East (500, 400): 25% melee + 20% Juggernaut = 45% reduction -> 100 * 0.55 = 55 -> absorbs into 75 armor
  const resFront = warrior.takeDamage(100, 'MELEE', { sourceX: 500, sourceY: 400 });
  assert.strictEqual(resFront.blocked, false);
  assert.strictEqual(resFront.damage, 55);
  assert.strictEqual(warrior.armor, 20);
  assert.strictEqual(warrior.hp, 150);

  // Rear attack from West (300, 400): only 25% melee reduction -> 100 * 0.75 = 75 -> drains remaining 20 armor + 55 HP
  const resBack = warrior.takeDamage(100, 'MELEE', { sourceX: 300, sourceY: 400 });
  assert.strictEqual(resBack.damage, 75);
  assert.strictEqual(warrior.armor, 0);
  assert.strictEqual(warrior.hp, 95);
});

test('Review Focus #1: Switching to Juggernaut clears Berserker furyStacks and ignores locked stance', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.warriorState.furyStacks = 6;
  warrior.warriorState.furyTimer = 3.5;

  // Before combo 5, switching to Juggernaut is rejected and keeps Berserker + stacks
  warrior.applyInput({ weaponId: 'JUGGERNAUT_STANCE' });
  assert.strictEqual(warrior.warriorState.activeStance, 'BERSERKER_STANCE');
  assert.strictEqual(warrior.warriorState.furyStacks, 6);

  // Unlock at combo 5 -> switch clears furyStacks immediately
  for (let i = 0; i < 4; i++) warrior.recordKill();
  warrior.applyInput({ weaponId: 'JUGGERNAUT_STANCE' });
  assert.strictEqual(warrior.warriorState.activeStance, 'JUGGERNAUT_STANCE');
  assert.strictEqual(warrior.warriorState.furyStacks, 0);
  assert.strictEqual(warrior.warriorState.furyTimer, 0);
});

test('Review Focus #4 (Player): Counter Shield blocks frontal hits at 0 dmg once per activation, but rear hits bypass', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.angle = 0;
  warrior.warriorState.counterShieldTimer = 1.5;

  // Attack from behind (West, 180 deg) must NOT trigger parry
  const rearHit = warrior.takeDamage(40, 'MELEE', { sourceX: 300, sourceY: 400 });
  assert.strictEqual(rearHit.parried, false);
  assert.strictEqual(warrior.warriorState.counterShieldTimer, 1.5);
  assert.ok(warrior.armor < 75);

  // Attack from 60 deg front-right triggers parry once with 0 damage
  const armorBefore = warrior.armor;
  const frontHit = warrior.takeDamage(40, 'MELEE', { sourceX: 450, sourceY: 480 });
  assert.strictEqual(frontHit.blocked, true);
  assert.strictEqual(frontHit.parried, true);
  assert.strictEqual(frontHit.damage, 0);
  assert.strictEqual(warrior.armor, armorBefore);
  assert.strictEqual(warrior.warriorState.counterShieldTimer, 0);
  assert.ok(warrior.warriorState.pendingParry);

  // Second hit in the same tick after parry is NOT blocked
  const secondHit = warrior.takeDamage(40, 'MELEE', { sourceX: 450, sourceY: 400 });
  assert.strictEqual(secondHit.parried, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/warrior_skills.test.js`
Expected: FAIL (`warrior.maxArmor` is `undefined`, `warrior.warriorState` is `undefined`)

- [ ] **Step 3: Implement Warrior Armor, Stances, Cooldowns, and directional `takeDamage` in `server/game/Player.js`**

Update `server/game/Player.js`:
1. Set `maxArmor: 75` in `CLASS_CONFIGS.WARRIOR`, `maxArmor: 0` in `HUMAN`/`MAGE`.
2. In `applyClassConfig`: set `this.maxArmor = cConf.maxArmor || 0`, `this.armor = this.maxArmor`, `this.hasWarCryBuff = false`; call `this.resetWarriorState()` when `this.character === 'WARRIOR'` (set `this.warriorState = null` otherwise).
3. Add helper `isAttackInFrontCone(sourceX, sourceY, halfArcRad)` normalizing `Math.atan2(sourceY - this.y, sourceX - this.x) - this.angle` into `[-Math.PI, Math.PI]`.
4. In `applyInput(input)`: if `this.character === 'WARRIOR'` and `input.weaponId` is `'BERSERKER_STANCE'` or `'JUGGERNAUT_STANCE'`, delegate to `this.setWarriorStance(input.weaponId)`.
5. In `update(dt, map, barricades)`:
   - Passive ult regen for Warrior (`if (this.character === 'WARRIOR' && this.warriorState.avatarTimer <= 0) this.addUltCharge((100 / 60) * dt)`).
   - Tick down `furyTimer` (reset `furyStacks = 0` on expire), skill `cooldown`s `[3..7]`, `warCryAuraTimer`, `avatarTimer`.
   - Compute `effectiveSpeed`: start from `this.baseSpeed`, multiply by `1 + furyStacks * 0.02` if in Berserker stance, apply `* 0.75` if `counterShieldTimer > 0 && avatarTimer <= 0`, `* 0.7` if `whirlwind` active, `* 1.3` if `avatarTimer > 0`.
   - Tick `fireCooldown` using `dt * this.getWarriorAttackSpeedMultiplier()` when Warrior (`(1 + furyStacks * 0.03) * (avatarTimer > 0 ? 1.3 : 1.0)`).
   - Note: While `dash.timer > 0`, skip normal WASD displacement so `WarriorAbilities` controls dash movement cleanly.
6. In `recordKill(points, options)`: when `this.character === 'WARRIOR'`, unlock Warrior skills from `getUnlockedWarriorSkills(maxProgression)` and return `newlyUnlocked`; on re-reaching an already unlocked milestone (`this.combo === s.unlockCombo`), reduce slots `3..7` remaining cooldown by `Math.max(1.5, cd * 0.3)` and add `+15` `ultCharge`.
7. In `takeDamage(amount, sourceType, options = {})`:
   - Check `counterShieldTimer > 0` and frontal cone (only if `typeof options.sourceX === 'number' && typeof options.sourceY === 'number'`); if inside `±70°`, clear `counterShieldTimer = 0`, set `pendingParry = { sourceX: options.sourceX, sourceY: options.sourceY, sourceType }`, and return `{ blocked: true, parried: true, damage: 0 }`.
   - Sum damage reduction: `(sourceType === 'MELEE' ? this.meleeResistance : 0)` + (`activeStance === 'JUGGERNAUT_STANCE'` and frontal source -> `+0.20`), cap reduction cleanly, compute `finalAmount = Math.max(1, Math.round(amount * (1 - reduction)))`.
   - Subtract `finalAmount` from `this.armor` first, then remainder from `this.hp`; if downed, clear `whirlwind`, `dash`, `counterShieldTimer = 0`, `warCryAuraTimer = 0`, `avatarTimer = 0`, `furyStacks = 0`.
   - Return `{ blocked: false, parried: false, damage: finalAmount }`.
8. In `serialize()`: include `armor: Math.round(this.armor)`, `maxArmor: this.maxArmor`, `hasWarCryBuff: Boolean(this.hasWarCryBuff)`, and `warriorState` summary (rounded timers/cooldowns) when `this.character === 'WARRIOR'`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/warrior_skills.test.js tests/player.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/game/Player.js tests/warrior_skills.test.js
git commit -m "feat: add Warrior Armor, Stance system, cooldowns, and directional takeDamage"
```

---

### Task 3: Zombie Crowd Control Extensions (`Taunt`, `Fear`, `applySlow`)

**Files:**
- Modify: `server/game/Zombie.js:90-328`
- Test: `tests/warrior_skills.test.js`
- Test: `tests/zombie.test.js`

**Interfaces:**
- Produces on `Zombie`:
  - `zombie.tauntTimer: number`, `zombie.tauntTargetId: string | null`
  - `zombie.fearTimer: number`, `zombie.fearSourceX: number`, `zombie.fearSourceY: number`
  - `zombie.applySlow(duration: number, slowFactor: number) -> void`
  - `zombie.applyTaunt(targetId: string, duration: number) -> void`
  - `zombie.applyFear(sourceX: number, sourceY: number, duration: number) -> void` (ignored if `this.type === 'TANK' || this.type === 'DEVIL'` or `this.isDead`)
  - `zombie.serialize()` adds `isTaunted: this.tauntTimer > 0` and `isFeared: this.fearTimer > 0`

- [ ] **Step 1: Write failing tests for Zombie `Taunt`, `Fear`, `applySlow`, and downed-target taunt clearing**

Append to `tests/warrior_skills.test.js`:

```js
const { Zombie } = require('../server/game/Zombie.js');

test('Review Focus #2: Zombie Taunt overrides nearest target, clears on downed target, and Fear repels non-bosses', () => {
  const map = new GameMap('THE_ROOMS');
  const nearHuman = new Player('h1', 'Near', 'HUMAN', 350, 400);
  const farWarrior = new Player('w1', 'Warrior', 'WARRIOR', 700, 400);
  const z = new Zombie('z1', 'NORMAL', 400, 400);
  const boss = new Zombie('b1', 'TANK', 400, 500);

  // Taunt draws z toward farWarrior instead of nearHuman
  z.applyTaunt('w1', 4.0);
  z.update(0.1, [nearHuman, farWarrior], [], map, []);
  assert.ok(z.x > 400, 'Taunted zombie must move East toward farWarrior');
  assert.strictEqual(z.serialize().isTaunted, true);

  // When farWarrior is downed, taunt clears immediately and zombie targets nearHuman
  farWarrior.isDowned = true;
  z.update(0.1, [nearHuman, farWarrior], [], map, []);
  assert.strictEqual(z.tauntTargetId, null);
  assert.strictEqual(z.tauntTimer, 0);
  assert.strictEqual(z.serialize().isTaunted, false);

  // Fear forces normal zombie away from (450, 400) while boss ignores Fear
  const zFear = new Zombie('z2', 'NORMAL', 400, 400);
  zFear.applyFear(450, 400, 1.5);
  boss.applyFear(450, 500, 1.5);
  zFear.update(0.1, [farWarrior], [], map, []);
  assert.ok(zFear.x < 400, 'Feared normal zombie must flee West away from Warrior');
  assert.strictEqual(zFear.serialize().isFeared, true);
  assert.strictEqual(boss.serialize().isFeared, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/warrior_skills.test.js`
Expected: FAIL (`z.applyTaunt is not a function`)

- [ ] **Step 3: Implement `applySlow`, `applyTaunt`, `applyFear`, and directional `takeDamage` source passing in `server/game/Zombie.js`**

Update `server/game/Zombie.js`:
1. Initialize `this.tauntTimer = 0`, `this.tauntTargetId = null`, `this.fearTimer = 0`, `this.fearSourceX = 0`, `this.fearSourceY = 0`.
2. Implement `applySlow(duration, slowFactor)`, `applyTaunt(targetId, duration)`, `applyFear(sourceX, sourceY, duration)` (skip Fear for `TANK` and `DEVIL`).
3. In `update(dt, ...)`:
   - Decrement `tauntTimer` (clear `tauntTargetId` at 0) and `fearTimer`.
   - After stun/freeze check, if `this.fearTimer > 0`, compute away angle `Math.atan2(this.y - this.fearSourceY, this.x - this.fearSourceX)`, set `this.angle`, move via `this.moveWithCollision(...)` at `this.speed * speedMult * 0.8 * dt`, and return early (skip attacks while fleeing).
   - Target selection: if `this.tauntTimer > 0 && this.tauntTargetId`, find matching `p` in `players` where `!p.isDead && !p.isDowned`; if missing, clear `this.tauntTimer = 0; this.tauntTargetId = null` and fall back to nearest alive player.
   - At melee attack line 251: pass `{ sourceX: this.x, sourceY: this.y }` as 3rd argument to `target.takeDamage(this.damage, 'MELEE', { sourceX: this.x, sourceY: this.y })`.
4. Add `isTaunted: this.tauntTimer > 0` and `isFeared: this.fearTimer > 0` to `serialize()`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/warrior_skills.test.js tests/zombie.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/game/Zombie.js tests/warrior_skills.test.js
git commit -m "feat: add Zombie Taunt, Fear, and directional melee source coordinates"
```

---

### Task 4: Warrior Abilities Engine & `UltimateAbilities` Integration

**Files:**
- Create: `server/game/WarriorAbilities.js`
- Modify: `server/game/Bullet.js:15-28,98-107`
- Modify: `server/game/UltimateAbilities.js:183-207`
- Test: `tests/warrior_skills.test.js`

**Interfaces:**
- Consumes: `WARRIOR_SKILLS`, `WARRIOR_AMMO_REDUCTION`, `getWarriorSkillBySlot` from `WarriorSkillsConfig.js`, `Bullet` from `Bullet.js`, `ULT_CHARGE_CONFIG`, `getUltimateConfigForClass` from `UltimateConfig.js`
- Produces in `server/game/WarriorAbilities.js`:
  - `executeWarriorBasicAttack(player: Player, room: GameRoom) -> boolean`
  - `triggerWarriorSkill(player: Player, slot: number, angle: number, room: GameRoom) -> { activated: boolean, skillId?: string }`
  - `activateAvatarOfWar(player: Player, room: GameRoom) -> object` (event object for `eventsBuffer`)
  - `triggerWarriorCounterParry(player: Player, room: GameRoom) -> void`
  - `updateWarriorRoomSystems(dt: number, room: GameRoom) -> void`
  - `applyWarriorAmmoPickup(player: Player) -> void`
  - `isFrontalShieldBlocking(player: Player, sourceX: number, sourceY: number) -> boolean`

- [ ] **Step 1: Write failing tests covering all 8 Warrior skills, stance synergies, Parry counter, Death Mark pull, 3-ring Seismic Slam + Fissure, War Cry aura/armor/fear, and Avatar Fire Slash + end explosion**

Append to `tests/warrior_skills.test.js` tests for:
- `[1]` Berserker builds `furyStacks` on hit and `[2]` Juggernaut pierces all zombies in cone + applies slow + knockback.
- `[3]` Blade Whirlwind executes 6 ticks over `1.5s`; `[1]` fires 4 `wind_blade` `Bullet`s on tick 6; `[2]` slams & stuns on tick 6.
- `[4]` Shadow Dash moves `240px` over `0.18s` (clamped at walls/pillars), drops 2 `slash_mark` zones that explode at `0.5s` and pull zombies inward.
- `[5]` Seismic Slam fires 3 staggered rings, clears enemy fireballs, spares `Barricade`, creates a `4.0s` `seismic_fissure` zone that slows & deals `'FIRE'` damage.
- `[6]` War Cry taunts zombies (`900px`), fears close normal zombies (`<=180px`), restores `+15` Armor, and grants `hasWarCryBuff` to nearby allies for `5.0s`.
- `[7]` Counter Shield Parry steps forward, stuns cone, and cleaves when `pendingParry` is set; misses halve cooldown to `4.0s`.
- `[8]` Avatar of War activates `10.0s` buff (`+50%` dmg, `+30%` atk/move speed, `ccImmune`), spawns `fire_slash` `Bullet`s on `[1]` & `[2]` basic attacks, and triggers Final Fire Nova on expiry.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/warrior_skills.test.js`
Expected: FAIL with `Cannot find module '../server/game/WarriorAbilities.js'`

- [ ] **Step 3: Implement `server/game/WarriorAbilities.js` and update `Bullet.js` & `UltimateAbilities.js`**

Key implementation details:
1. In `Bullet.js`: support `type` `'wind_blade'` and `'fire_slash'` (`radius: 16`, `penetration: true`).
2. In `WarriorAbilities.js`:
   - `damageAndCreditZombie(warrior, zombie, baseDmg, sourceType, room, options)`: multiplies `baseDmg` by `(avatarActive ? 1.5 : 1.0) * (warrior.hasWarCryBuff ? 1.15 : 1.0)`, applies `zombie.takeDamage`, `applyKnockback`, `applyStun`, `applySlow`, awards `+0.8%` `ultCharge` when `!avatarActive`, and handles `recordKill` + `UNLOCKED` events + `15%` pickup drops.
   - `executeWarriorBasicAttack(player, room)`: checks `player.fireCooldown <= 0`, sets `player.fireCooldown = skill.fireDelay`, iterates `room.zombies` in cone (`Math.hypot <= range + z.radius` and `|deltaAngle| <= arcRad / 2`), updates `furyStacks` (on `[1]`), applies knockback + slow (on `[2]`), spawns `fire_slash` `Bullet` (when `avatarTimer > 0`), and pushes `WARRIOR_SKILL` event.
   - `triggerWarriorSkill(player, slot, angle, room)`: validates `player.character === 'WARRIOR'`, `!player.isDead && !player.isDowned`, `room.state === 'PLAYING' || room.state === 'INTERMISSION'`, `slot` integer `3..8`, finite `angle`, `skillState.unlocked === true`, and `cooldown <= 0` (for slot `8`, requires `ultCharge >= ultMaxCharge`). Sets cooldown and initializes active state / ground zones / staggered slam object.
   - `updateWarriorRoomSystems(dt, room)`: updates `room.groundZones` (`slash_mark` countdown -> detonate + pull zombies within `160px`; `seismic_fissure` countdown -> apply `0.4` slow & `8` `'FIRE'` dmg every `0.5s` inside `210px`), updates each Warrior's `whirlwind`, `dash` (incremental clamped movement + `dash.hitIds` + destination mark), `pendingSlams` (3 rings), `counterShieldTimer` (detecting `pendingParry` -> `triggerWarriorCounterParry` vs expiry -> `4.0s` CD), `avatarTimer` expiry -> Final Fire Nova, and computes `p.hasWarCryBuff` for all players within `200px` of any Warrior with `warCryAuraTimer > 0`.
   - `UltimateAbilities.js`: route `conf.id === 'AVATAR_OF_WAR'` to `activateAvatarOfWar(player, room)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/warrior_skills.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/game/WarriorAbilities.js server/game/Bullet.js server/game/UltimateAbilities.js tests/warrior_skills.test.js
git commit -m "feat: implement WarriorAbilities combat engine and Avatar of War ultimate"
```

---

### Task 5: Integrate Warrior Kit into `GameRoom`, `socketHandler`, and Update `tests/ultimates.test.js`

**Files:**
- Modify: `server/game/GameRoom.js:1-661`
- Modify: `server/socketHandler.js:208-245`
- Modify: `tests/ultimates.test.js:181-212`
- Test: `tests/warrior_skills.test.js`
- Test: `tests/game_room.test.js`

**Interfaces:**
- Consumes: `WarriorAbilities` functions in `GameRoom.js`
- Produces:
  - `GameRoom.groundZones: Array` (cleared in `startGame()`, serialized in `getSnapshot()`)
  - `GameRoom.handleSkill(socketId: string, payload: { slot?: number, angle?: number }) -> { activated: boolean }`
  - Socket listener `player:skill` in `server/socketHandler.js`

- [ ] **Step 1: Write failing `GameRoom` + Socket E2E tests (including Review Focus #3 & #5)**

Append to `tests/warrior_skills.test.js`:

```js
const { GameRoom } = require('../server/game/GameRoom.js');
const { socketHandler } = require('../server/socketHandler.js');

test('Review Focus #3 & #5: GameRoom validates player:skill, blocks Devil fireballs via Counter Shield, and resets groundZones/Armor on startGame', () => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_wkit', 'Warrior Room', mockIo);
  const warrior = room.addPlayer('w1', 'Garen', 'WARRIOR');
  const human = room.addPlayer('h1', 'Ranger', 'HUMAN');
  room.startGame();

  // Invalid inputs ignored safely
  assert.strictEqual(room.handleSkill('w1', { slot: 99, angle: 0 }).activated, false);
  assert.strictEqual(room.handleSkill('w1', { slot: 5, angle: Number.NaN }).activated, false);
  assert.strictEqual(room.handleSkill('w1', { slot: 5, angle: 0 }).activated, false); // locked before combo 20
  assert.strictEqual(room.handleSkill('h1', { slot: 5, angle: 0 }).activated, false); // human cannot cast warrior skills

  // Unlock all Warrior skills, verify Counter Shield blocks incoming Devil fireball at 0 dmg & triggers parry
  warrior.maxCombo = 50;
  warrior.recordKill(10); // unlocks through slot 8
  warrior.x = 500;
  warrior.y = 500;
  warrior.angle = 0;

  const { Bullet } = require('../server/game/Bullet.js');
  const fireball = new Bullet('fb_test', 'devil_1', 515, 500, Math.PI, {
    speed: 260,
    damage: 25,
    isFireball: true,
    explosionRadius: 55,
    explosionDamage: 45
  });
  room.bullets.push(fireball);

  assert.strictEqual(room.handleSkill('w1', { slot: 7, angle: 0 }).activated, true);
  room.tick(0.02);
  assert.strictEqual(warrior.armor, 75, 'Frontal fireball must be absorbed cleanly with 0 damage');
  assert.strictEqual(warrior.hp, 150);
  assert.strictEqual(room.bullets.length, 0, 'Parried fireball must be destroyed');

  // Cast Seismic Slam -> creates groundZone, then startGame resets everything
  warrior.warriorState.skills.SEISMIC_SLAM.cooldown = 0;
  assert.strictEqual(room.handleSkill('w1', { slot: 5, angle: 0 }).activated, true);
  assert.ok(room.groundZones.length > 0);

  room.startGame();
  assert.strictEqual(room.groundZones.length, 0);
  assert.strictEqual(warrior.armor, 75);
  assert.strictEqual(warrior.warriorState.furyStacks, 0);
  assert.strictEqual(warrior.warriorState.skills.SEISMIC_SLAM.unlocked, false);
  room.stop();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/warrior_skills.test.js`
Expected: FAIL (`room.handleSkill is not a function`)

- [ ] **Step 3: Implement `GameRoom.js`, `socketHandler.js`, and update `tests/ultimates.test.js`**

Update `server/game/GameRoom.js`:
1. Initialize `this.groundZones = []` in constructor and reset in `startGame()` alongside `p.armor = p.maxArmor; p.hasWarCryBuff = false; if (p.character === 'WARRIOR') p.resetWarriorState();`.
2. In `handleShoot(socketId)`: if `player.character === 'WARRIOR'`, call `executeWarriorBasicAttack(player, this)` and return early.
3. Add `handleSkill(socketId, payload = {})`: validate player & payload, call `triggerWarriorSkill(player, payload.slot, payload.angle, this)`.
4. In `triggerExplosion`: pass `{ sourceX: x, sourceY: y }` to `p.takeDamage(...)`.
5. In `tick(dt)`:
   - Call `updateWarriorRoomSystems(dt, this)`.
   - Multiply player bullet damage by `(shooter && shooter.hasWarCryBuff ? 1.15 : 1.0)`.
   - For Devil Fireball `b.checkHit(p)`: if `p.character === 'WARRIOR' && isFrontalShieldBlocking(p, b.x, b.y)`, call `p.takeDamage(b.explosionDamage, 'FIRE', { sourceX: b.x, sourceY: b.y })`, mark `b.isDead = true`, and skip `triggerExplosion`!
   - On `WAVE_CLEAR` & teammate `revive`: restore `50% maxArmor` for Warriors (`p.restoreArmor(Math.ceil(p.maxArmor * 0.5))`).
   - On `AMMO` pickup: if `player.character === 'WARRIOR'`, call `applyWarriorAmmoPickup(player)` instead of iterating `player.weapons`.
   - Include `groundZones` serialized items in `getSnapshot()`.
6. In `server/socketHandler.js`: add `socket.on('player:skill', (payload) => { ... room.gameRoom.handleSkill(socket.id, payload); })`.
7. In `tests/ultimates.test.js:181-212`: update the `WARRIOR` ultimate test to verify `AVATAR_OF_WAR` (`avatarTimer === 10`, `ultCharge === 0`, `fire_slash` projectile on basic attack), and verify `BARRICADE` placement sparing in a `HUMAN` test or keep `BARRICADE` test on `HUMAN`.

- [ ] **Step 4: Run full test suite to verify everything passes**

Run: `node --test tests/*.test.js`
Expected: PASS (all existing + new Warrior tests pass)

- [ ] **Step 5: Commit**

```bash
git add server/game/GameRoom.js server/socketHandler.js tests/ultimates.test.js tests/warrior_skills.test.js
git commit -m "feat: integrate Warrior skill kit into GameRoom and socketHandler"
```

---

### Task 6: Client Input, Lobby Description & Warrior HUD

**Files:**
- Modify: `client/index.html:122-126`
- Modify: `client/js/input.js:1-169`
- Modify: `client/js/main.js:34-100,221-348`
- Modify: `client/js/ui.js:74-106,502-520,680-787`
- Modify: `client/css/style.css:546-609`
- Test: `tests/warrior_client.test.js`

**Interfaces:**
- Produces in `client/js/input.js`:
  - `input.isWarriorMode: boolean`
  - `input.onSkillCast: ((slot: number, angle: number) => void) | null`
  - When `isWarriorMode === true`: keys `1`/`2` and mouse `wheel` only switch between slots `1` and `2`; keys `3..8` (on `!e.repeat`) call `this.onSkillCast(num, this.mouse.angle)`.
- Produces in `client/js/ui.js`:
  - `ui.warriorSkillDefinitions`: 8 slot metadata entries (`BERSERKER_STANCE`, `JUGGERNAUT_STANCE`, `BLADE_WHIRLWIND`, `SHADOW_DASH_SLASH`, `SEISMIC_SLAM`, `WAR_CRY`, `COUNTER_SHIELD_BASH`, `AVATAR_OF_WAR`)
  - `ui.setWeaponsBarMode(isWarrior: boolean)` swapping slot labels/icons/CD overlays cleanly
  - `ui.ultimateMeta.WARRIOR = { name: 'HÓA THÂN CHIẾN THẦN (AVATAR)', color: '#ff3d00' }`

- [ ] **Step 1: Write failing unit tests for `InputHandler` Warrior mode & `UIController` Warrior HUD**

Create `tests/warrior_client.test.js` using minimal `global.window` / `global.document` shims (matching `tests/ultimates.test.js` line 358):
- Test `InputHandler` with `isWarriorMode = true`: pressing `1`/`2` calls `onWeaponChange` with `'BERSERKER_STANCE'` / `'JUGGERNAUT_STANCE'`; mouse `wheel` alternates only between `1` and `2` (never `3..8`); pressing `5` invokes `onSkillCast(5, angle)`.
- Test `InputHandler` with `isWarriorMode = false` preserves `PISTOL`–`RAILGUN` `1..8` switching unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/warrior_client.test.js`
Expected: FAIL (`input.isWarriorMode` / `onSkillCast` missing)

- [ ] **Step 3: Implement updates in `client/index.html`, `client/js/input.js`, `client/js/main.js`, `client/js/ui.js`, and `client/css/style.css`**

1. `client/index.html:122-126`: Update `WARRIOR` card to `150 HP • 75 Giáp • Kiếm Khiên 1–8` and `⚡ Ult: Hóa Thân Chiến Thần (Avatar)`.
2. `client/js/input.js`: Add `this.isWarriorMode = false`, `this.onSkillCast = null`, `WARRIOR_STANCES = ['BERSERKER_STANCE', 'JUGGERNAUT_STANCE']`; route keys `1..8` and `wheel` cleanly based on `this.isWarriorMode` without breaking `HUMAN`/`MAGE`.
3. `client/js/main.js`:
   - In `trySwitchWeapon`: handle `isWarriorMode` stances (`1` & `2` unlocked check against `localPlayer.warriorState.skills`), dispatch slots `3..8` clicks to `socket.emit('player:skill', { slot, angle })`.
   - Wire `input.onSkillCast = (slot, angle) => { if (isInGame && !paused && !gameOver) socket.emit('player:skill', { slot, angle }); }`.
   - On `game:snapshot`: sync `input.isWarriorMode = localPlayer.character === 'WARRIOR'` and `ui.setWeaponsBarMode(input.isWarriorMode)`, sync `pendingWeapon` with `localPlayer.warriorState.activeStance` when Warrior.
   - In `handleGameEvent`: handle `WARRIOR_SKILL`, `WARRIOR_COUNTER`, `WARRIOR_MARK_EXPLODE`, `WARRIOR_AVATAR_END` dispatching `renderer` VFX and `soundManager.playWarriorSkill(...)`.
4. `client/js/ui.js` & `client/css/style.css`:
   - Render `Armor` bar in team roster rows when `p.maxArmor > 0`.
   - Switch weapon bar slots dynamically between `weaponDefinitions` and `warriorSkillDefinitions`; display `furyStacks` badge (`⚡xN`) on slot `[1]`, highlight active stance (`[1]` or `[2]`), render cooldown overlay (`.skill-cooldown-overlay`) showing remaining seconds on `[3..8]`.
   - In Ultimate HUD (`hudUltContainer`): when `warriorState.avatarActive`, show `buffed` state with remaining seconds (`🔥 CHIẾN THẦN: X.Xs`).

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/warrior_client.test.js tests/*.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/index.html client/js/input.js client/js/main.js client/js/ui.js client/css/style.css tests/warrior_client.test.js
git commit -m "feat: add Warrior ARPG input handling, HUD skill bar, and Armor UI"
```

---

### Task 7: Canvas Visual Effects & Synthesized WebAudio

**Files:**
- Modify: `client/js/renderer.js:23-60,315-420,639-882,1235-1283`
- Modify: `client/js/audio.js:313-395`
- Test: `tests/warrior_client.test.js`
- Test: `tests/sprites_config.test.js`

**Interfaces:**
- Produces on `Renderer` (`client/js/renderer.js`):
  - `renderer.addSwordTrail(x: number, y: number, angle: number, options: { radius, arcRad, color, duration, isFullCircle }) -> void`
  - `renderer.addWarriorSkillVfx(ev: object) -> void`
  - `renderer.drawGroundZones(ctx: CanvasRenderingContext2D, groundZones: Array) -> void`
  - `renderer.drawSwordTrails(ctx: CanvasRenderingContext2D) -> void`
  - `drawPlayerTag` renders Armor bar when `(player.maxArmor || 0) > 0`
  - `drawBoxyPlayer` applies `1.35x` scale + flame aura during `avatarActive`, draws frontal shield arc during `counterShieldActive`, War Cry foot aura during `warCryAuraActive` (only when `player.character === 'WARRIOR' && player.warriorState`)
  - `drawBullets` renders `wind_blade` and `fire_slash` crescents
  - `drawBoxyZombie` renders `isTaunted` and `isFeared` overhead icons
- Produces on `SoundManager` (`client/js/audio.js`):
  - `soundManager.playWarriorSkill(skillId: string, subType?: string) -> void`

- [ ] **Step 1: Write failing unit tests for `Renderer` Warrior VFX, Armor bar, `groundZones`, `swordTrails`, and `HUMAN` regression safety**

Append to `tests/warrior_client.test.js`:
- Verify `renderer.addSwordTrail(...)` and `renderer.updateVisuals(0.1)` decay and expire sword trails cleanly.
- Verify `renderer.drawPlayerTag` draws Armor bar rect when `player.maxArmor === 75` and skips it for `HUMAN` (`maxArmor === 0`).
- Verify `renderer.drawGroundZones` draws both `seismic_fissure` and `slash_mark` entries without errors.
- Verify `renderer.drawBoxyPlayer` with `WARRIOR` + `avatarActive` scales to `1.35x` cleanly.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/warrior_client.test.js tests/sprites_config.test.js`
Expected: FAIL (`renderer.addSwordTrail is not a function`)

- [ ] **Step 3: Implement VFX in `client/js/renderer.js` and WebAudio in `client/js/audio.js`**

1. `client/js/renderer.js`:
   - Add `this.swordTrails = []` (cleared in `resetSession()`, decayed in `updateVisuals(dt)`).
   - Add `addSwordTrail`, `addWarriorSkillVfx(ev)` (spawning trails, shockwaves, blood/spark particles, ground crack decals, and `triggerScreenShake` on Seismic Slam / Counter Parry / Mark Explosion / Avatar End).
   - Call `this.drawGroundZones(ctx, gameState.groundZones || [])` after `drawCorpses`, and `this.drawSwordTrails(ctx)` after `drawMuzzleFlashes`.
   - In `drawBoxyPlayer`: guard Warrior overlays strictly behind `if (player.character === 'WARRIOR' && player.warriorState)` (draw War Cry aura ring, scale `1.35x` + fiery aura for Avatar, frontal arc for Counter Shield, whirlwind blade ring).
   - In `drawPlayerTag`: draw cyan/gold Armor bar above HP bar only if `(player.maxArmor || 0) > 0`.
   - In `drawBullets`: render spinning/crescent `wind_blade` (`#80d8ff`) and `fire_slash` (`#ff5722`/`#ffd600`).
   - In `drawBoxyZombie`: render `💢 TAUNTED` and `😱 FEAR` badges when `isTaunted` / `isFeared`.
2. `client/js/audio.js`: implement `playWarriorSkill(skillId, subType)` synthesizing clean WebAudio effects for all 8 skills, parry clang, death mark pull/boom, and Avatar roar.

- [ ] **Step 4: Run complete test suite to verify zero regressions and 100% pass**

Run: `node --test tests/*.test.js`
Expected: PASS (all suites pass with 0 failures and 0 skipped tests)

- [ ] **Step 5: Commit**

```bash
git add client/js/renderer.js client/js/audio.js tests/warrior_client.test.js
git commit -m "feat: add Warrior melee sword trails, ground zones, Avatar VFX, and WebAudio"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - `[1] BERSERKER_STANCE` & `[2] JUGGERNAUT_STANCE` + fury stacks + stance clear + frontal reduction + slow: Tasks 1, 2, 4.
   - `[3]` Whirlwind 6 ticks + `[1]` 4 wind blades / `[2]` slam stun: Tasks 1, 4, 7.
   - `[4]` Shadow Dash + 2 Death Marks + 0.5s detonation pull: Tasks 1, 4, 5, 7.
   - `[5]` 3-ring Seismic Slam + fireball clear + Barricade preservation + 4s slowing/burning fissure: Tasks 1, 4, 5, 7.
   - `[6]` War Cry taunt + close Fear + 20% maxArmor heal (+15) + 5s `+15%` ally aura: Tasks 1, 3, 4, 5, 7.
   - `[7]` Counter Shield Parry `1.5s` (`0` dmg frontal, step forward + cone stun + free cleave, `8s`/`4s` CD): Tasks 1, 2, 4, 5, 7.
   - `[8]` Avatar of War `10s` (`[F]`/`RMB`/`[8]`, `1.35x`, CC immune, `+50%` dmg, `+30%` atk/move speed, `fire_slash` projectiles on `[1]`/`[2]`, final explosion): Tasks 1, 2, 4, 5, 6, 7.
   - Combo milestones `1, 5, 10, 15, 20, 30, 40, 50`, `AMMO` pickup cooldown reduction, UI skill bar & lobby update, VFX & Audio: Tasks 1, 2, 4, 5, 6, 7.
2. **Type consistency:** Skill IDs (`BERSERKER_STANCE`, `JUGGERNAUT_STANCE`, `BLADE_WHIRLWIND`, `SHADOW_DASH_SLASH`, `SEISMIC_SLAM`, `WAR_CRY`, `COUNTER_SHIELD_BASH`, `AVATAR_OF_WAR`), projectile types (`wind_blade`, `fire_slash`), groundZone types (`slash_mark`, `seismic_fissure`), and socket event (`player:skill`) match identically across all 7 tasks.
3. **Review Focus coverage:** All 5 edge cases in Review Focus have explicit assertions pinned in Tasks 2, 3, 4, and 5.
