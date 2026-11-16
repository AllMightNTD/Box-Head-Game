# Mage ARPG Skill Kit & Mana System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gun arsenal and old `BLINK_FROST_NOVA` ultimate for the `MAGE` character class with a full 8-skill ARPG Mana + Cooldown kit (`ARCANE_BOLT` through `METEOR_STORM`), including ground hazard/support zones, Mana Shield, 18% AMMO drop/Mana-CD synergy, client controls/HUD/VFX/audio, and automated tests.

**Architecture:** Isolate Mage constants in `server/game/MageSkillsConfig.js` and authoritative 50Hz simulation logic in `server/game/MageAbilities.js` (mirroring modular separation without polluting `WeaponsConfig.js`). Extend `Player.js`, `Zombie.js`, `Bullet.js`, `UltimateConfig.js`, `UltimateAbilities.js`, `GameRoom.js`, and `socketHandler.js` with clean class-specific hooks, `groundZones`, `pendingMeteors`, and `player:skill` cursor-targeted casting. Mirror this on the client via `input.js`, `main.js`, `ui.js`, `renderer.js`, `audio.js`, `index.html`, and `style.css` while keeping `HUMAN`, `WARRIOR`, and legacy skins (`BAMBO`, `BON`, `BINGO`, `BERT`) on the existing gun system.

**Tech Stack:** Node.js (`>=18`, `node --test` + `node:assert/strict`), Express 4, Socket.IO 4, HTML5 Canvas 2D, Web Audio API.

## Global Constraints

- **Pure Mana + CD Resource Model for Mage:** Replace `ultCharge` ("Nộ khí") and gun ammo entirely with Mana (`maxMana = 100`, starting `100`, passive regen `+5 Mana/s`, `WAVE_CLEAR` restores `100%` Mana, `revive()` restores `50%` Mana).
- **Exact Skill Table Values (Slots `[1]`–`[8]`):**
  - `[1] ARCANE_BOLT`: unlock `x1`, cost `5 Mana`, `CD: 0` (`fireDelay: 0.25s` = 4 shots/s), speed `900 px/s`, range `400px`, damage `35` (`'MAGIC'`). Hold LMB / Space / `[1]` for continuous fire.
  - `[2] FROST_NOVA`: unlock `x5`, cost `20 Mana`, `CD: 5.0s`, radius `120px` around Mage, damage `45` (`'ICE'`), freeze `2.0s` (Boss `TANK`/`DEVIL`: `1.0s`).
  - `[3] CHAIN_LIGHTNING`: unlock `x10`, cost `30 Mana`, `CD: 4.5s`, cast range `450px`. Selects zombie nearest cursor (`<= 90px`) or fallback nearest in `±25°` forward cone; if no target exists, abort without spending Mana or triggering CD. Deals `70` (`'LIGHTNING'`) + `0.5s` stun to primary target, then bounces up to `4` unhit living zombies within `180px`, multiplying damage by `0.85` per bounce (`-15%` per jump) + `0.5s` stun.
  - `[4] FIREBALL`: unlock `x15`, cost `35 Mana`, `CD: 6.0s`, projectile speed `550 px/s`, range `500px`, explodes on impact/wall/max-range in `140px` radius for `130` (`'FIRE'`), leaving a `3.0s` burning pool (`140px` radius, `15 FIRE dmg/s`).
  - `[5] ARCANE_TELEPORT`: unlock `x20`, cost `25 Mana`, `CD: 7.0s`, teleports to cursor up to `250px` (wall/barricade-safe), leaving an origin arcane blast (`110px` radius, `50` `'MAGIC'` dmg, `260` knockback).
  - `[6] SANCTUARY_HEAL`: unlock `x30`, cost `35 Mana`, `CD: 12.0s`, placed at cursor (clamped to `350px` range), radius `180px`, duration `4.0s`. Heals alive non-downed allies `25 HP/s`, grants `1.35x` fire/reload & skill CD recovery rate while inside, and slows zombies entering by `40%` (`slowFactor: 0.6`).
  - `[7] MANA_SHIELD`: unlock `x40`, cost `15 Mana`, `CD: 10.0s`, duration `5.0s`. Absorbs 100% incoming damage converted `1:1` to Mana loss (`1 dmg = 1 Mana`); excess damage overflows to HP and shield breaks early when Mana reaches `0`.
  - `[8] METEOR_STORM`: unlock `x50`, cost `100 Mana`, `CD: 50.0s`. Triggered by `[8]`, `[F]`, `Right-Click`, or HUD click. Centered at cursor (clamped to `450px` range), radius `300px`, drops `5` meteors over `3.0s`, each dealing `150` (`'FIRE'`) in `120px` impact radius, and creates/refreshes a large unified `lava_pool` (`240px` radius, `4.0s`, `25 FIRE dmg/s`, `30%` slow `slowFactor: 0.7`).
- **Friendly Fire & Barricade Safety:** Mage AoE skills (`FIREBALL`, `ARCANE_TELEPORT`, `METEOR_STORM`) only damage zombies (and can detonate `Barrel`s), NEVER teammates, self, or `Barricade`s.
- **AMMO Pickup & Drop Rate:** Every zombie kill has an `18%` chance to drop `AMMO` and `7%` chance to drop `MEDKIT` (`25%` total pickup rate via shared helper). When Mage collects `AMMO`, restore `+30 Mana` and reduce active skill cooldowns `[2]..[8]` by `1.5s`.
- **Engineering Standards (`GEMINI.md`):** Validate all socket inputs (`slot`, `angle`, `targetX`, `targetY` via `Number.isFinite`), avoid duplicated drop/damage loops, keep functions modular (<40 lines where practical), preserve unrelated comments/docstrings, and follow AAA test structure (Arrange / Act / Assert) covering both happy and unhappy paths.

---

### Task 1: Mage Skill & Resource Configuration (`MageSkillsConfig.js`)

**Files:**
- Create: `server/game/MageSkillsConfig.js`
- Test: `tests/mage_skills.test.js`

**Interfaces:**
- Produces in `server/game/MageSkillsConfig.js`:
  - `MAGE_MANA_CONFIG`: `{ MAX_MANA: 100, STARTING_MANA: 100, REGEN_PER_SEC: 5, WAVE_CLEAR_RESTORE_RATIO: 1.0, REVIVE_RESTORE_RATIO: 0.5 }`
  - `MAGE_AMMO_PICKUP`: `{ AMMO_DROP_CHANCE: 0.18, MEDKIT_DROP_CHANCE: 0.07, MANA_RESTORE: 30, COOLDOWN_REDUCTION_SEC: 1.5 }`
  - `MAGE_SKILLS`: Frozen map of all 8 skill objects (`ARCANE_BOLT`, `FROST_NOVA`, `CHAIN_LIGHTNING`, `FIREBALL`, `ARCANE_TELEPORT`, `SANCTUARY_HEAL`, `MANA_SHIELD`, `METEOR_STORM`)
  - `MAGE_SKILL_KEYS`: Frozen ordered array of 8 skill IDs for slots `1..8`
  - `getMageSkillBySlot(slot: number) -> object | null`
  - `getMageSkillById(id: string) -> object | null`
  - `getUnlockedMageSkills(combo: number) -> Array<object>`

- [ ] **Step 1: Write the failing test for `MageSkillsConfig.js`**

Create `tests/mage_skills.test.js`:

```javascript
/**
 * @file mage_skills.test.js
 * @description Unit and integration tests for Mage Mana system, 8-skill kit, ground zones, and socket sync.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAGE_MANA_CONFIG,
  MAGE_AMMO_PICKUP,
  MAGE_SKILLS,
  MAGE_SKILL_KEYS,
  getMageSkillBySlot,
  getMageSkillById,
  getUnlockedMageSkills
} = require('../server/game/MageSkillsConfig.js');

test('MageSkillsConfig defines exact 8-skill progression, mana costs, cooldowns, and AMMO drop constants', () => {
  // Arrange & Act
  const expectedOrder = [
    ['ARCANE_BOLT', 1, 1, 5, 0],
    ['FROST_NOVA', 2, 5, 20, 5.0],
    ['CHAIN_LIGHTNING', 3, 10, 30, 4.5],
    ['FIREBALL', 4, 15, 35, 6.0],
    ['ARCANE_TELEPORT', 5, 20, 25, 7.0],
    ['SANCTUARY_HEAL', 6, 30, 35, 12.0],
    ['MANA_SHIELD', 7, 40, 15, 10.0],
    ['METEOR_STORM', 8, 50, 100, 50.0]
  ];

  // Assert
  assert.strictEqual(MAGE_MANA_CONFIG.MAX_MANA, 100);
  assert.strictEqual(MAGE_MANA_CONFIG.REGEN_PER_SEC, 5);
  assert.strictEqual(MAGE_AMMO_PICKUP.AMMO_DROP_CHANCE, 0.18);
  assert.strictEqual(MAGE_AMMO_PICKUP.MANA_RESTORE, 30);
  assert.strictEqual(MAGE_AMMO_PICKUP.COOLDOWN_REDUCTION_SEC, 1.5);
  assert.strictEqual(MAGE_SKILL_KEYS.length, 8);

  for (const [id, slot, unlockCombo, manaCost, cooldown] of expectedOrder) {
    const skill = getMageSkillById(id);
    assert.ok(skill, `Expected skill ${id}`);
    assert.strictEqual(getMageSkillBySlot(slot), skill);
    assert.strictEqual(skill.slot, slot);
    assert.strictEqual(skill.unlockCombo, unlockCombo);
    assert.strictEqual(skill.manaCost, manaCost);
    assert.strictEqual(skill.cooldown, cooldown);
  }

  // Invalid lookups & unlock filtering
  assert.strictEqual(getMageSkillBySlot(0), null);
  assert.strictEqual(getMageSkillBySlot(9), null);
  assert.strictEqual(getMageSkillBySlot(1.5), null);
  assert.strictEqual(getMageSkillById('UNKNOWN'), null);
  assert.deepStrictEqual(getUnlockedMageSkills(10).map(s => s.id), [
    'ARCANE_BOLT',
    'FROST_NOVA',
    'CHAIN_LIGHTNING'
  ]);
  assert.deepStrictEqual(getUnlockedMageSkills(NaN), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_skills.test.js`
Expected: FAIL with `Cannot find module '../server/game/MageSkillsConfig.js'`

- [ ] **Step 3: Implement `server/game/MageSkillsConfig.js`**

```javascript
/**
 * @file MageSkillsConfig.js
 * @description Immutable configuration for Mage Mana resource rules, AMMO pickup synergy,
 * 18% AMMO drop constants, and all 8 Mage ARPG skills (slots 1-8).
 */

'use strict';

const MAGE_MANA_CONFIG = Object.freeze({
  MAX_MANA: 100,
  STARTING_MANA: 100,
  REGEN_PER_SEC: 5,
  WAVE_CLEAR_RESTORE_RATIO: 1.0,
  REVIVE_RESTORE_RATIO: 0.5
});

const MAGE_AMMO_PICKUP = Object.freeze({
  AMMO_DROP_CHANCE: 0.18,
  MEDKIT_DROP_CHANCE: 0.07,
  MANA_RESTORE: 30,
  COOLDOWN_REDUCTION_SEC: 1.5
});

const MAGE_SKILLS = Object.freeze({
  ARCANE_BOLT: Object.freeze({
    id: 'ARCANE_BOLT',
    slot: 1,
    name: 'Tia Ma Pháp',
    unlockCombo: 1,
    manaCost: 5,
    cooldown: 0,
    fireDelay: 0.25,
    speed: 900,
    range: 400,
    damage: 35,
    damageType: 'MAGIC',
    radius: 7,
    knockback: 45
  }),
  FROST_NOVA: Object.freeze({
    id: 'FROST_NOVA',
    slot: 2,
    name: 'Vòng Tròn Băng Giá',
    unlockCombo: 5,
    manaCost: 20,
    cooldown: 5.0,
    radius: 120,
    damage: 45,
    damageType: 'ICE',
    freezeDuration: 2.0,
    bossFreezeDuration: 1.0
  }),
  CHAIN_LIGHTNING: Object.freeze({
    id: 'CHAIN_LIGHTNING',
    slot: 3,
    name: 'Lôi Điện Liên Hoàn',
    unlockCombo: 10,
    manaCost: 30,
    cooldown: 4.5,
    castRange: 450,
    cursorSnapRadius: 90,
    coneHalfRad: (25 * Math.PI) / 180,
    damage: 70,
    damageType: 'LIGHTNING',
    maxBounces: 4,
    bounceRadius: 180,
    bounceDamageDecay: 0.15,
    stunDuration: 0.5
  }),
  FIREBALL: Object.freeze({
    id: 'FIREBALL',
    slot: 4,
    name: 'Hỏa Cầu Đại Nổ',
    unlockCombo: 15,
    manaCost: 35,
    cooldown: 6.0,
    speed: 550,
    range: 500,
    radius: 14,
    explosionRadius: 140,
    damage: 130,
    damageType: 'FIRE',
    knockback: 180,
    burnRadius: 140,
    burnDuration: 3.0,
    burnDamagePerSec: 15,
    burnTickInterval: 0.5
  }),
  ARCANE_TELEPORT: Object.freeze({
    id: 'ARCANE_TELEPORT',
    slot: 5,
    name: 'Dịch Chuyển Không Gian',
    unlockCombo: 20,
    manaCost: 25,
    cooldown: 7.0,
    maxDistance: 250,
    blastRadius: 110,
    blastDamage: 50,
    damageType: 'MAGIC',
    knockback: 260
  }),
  SANCTUARY_HEAL: Object.freeze({
    id: 'SANCTUARY_HEAL',
    slot: 6,
    name: 'Thánh Vực Hồi Phục',
    unlockCombo: 30,
    manaCost: 35,
    cooldown: 12.0,
    maxCastRange: 350,
    radius: 180,
    duration: 4.0,
    healPerSec: 25,
    healTickInterval: 0.2,
    cooldownSpeedMultiplier: 1.35,
    zombieSlowFactor: 0.6,
    zombieSlowRefresh: 0.4
  }),
  MANA_SHIELD: Object.freeze({
    id: 'MANA_SHIELD',
    slot: 7,
    name: 'Khiên Năng Lượng',
    unlockCombo: 40,
    manaCost: 15,
    cooldown: 10.0,
    duration: 5.0,
    manaPerDamage: 1
  }),
  METEOR_STORM: Object.freeze({
    id: 'METEOR_STORM',
    slot: 8,
    name: 'Thiên Thạch Hủy Diệt',
    unlockCombo: 50,
    manaCost: 100,
    cooldown: 50.0,
    maxCastRange: 450,
    stormRadius: 300,
    duration: 3.0,
    meteorCount: 5,
    meteorImpactRadius: 120,
    meteorDamage: 150,
    damageType: 'FIRE',
    meteorKnockback: 220,
    lavaRadius: 240,
    lavaDuration: 4.0,
    lavaDamagePerSec: 25,
    lavaTickInterval: 0.5,
    lavaSlowFactor: 0.7
  })
});

const MAGE_SKILL_KEYS = Object.freeze([
  'ARCANE_BOLT',
  'FROST_NOVA',
  'CHAIN_LIGHTNING',
  'FIREBALL',
  'ARCANE_TELEPORT',
  'SANCTUARY_HEAL',
  'MANA_SHIELD',
  'METEOR_STORM'
]);

const MAGE_SLOT_MAP = new Map(
  Object.values(MAGE_SKILLS).map(skill => [skill.slot, skill])
);

/**
 * Retrieves Mage skill configuration by slot index (1..8).
 * @param {number} slot
 * @returns {object|null}
 */
function getMageSkillBySlot(slot) {
  if (typeof slot !== 'number' || !Number.isInteger(slot)) {
    return null;
  }
  return MAGE_SLOT_MAP.get(slot) || null;
}

/**
 * Retrieves Mage skill configuration by string ID.
 * @param {string} id
 * @returns {object|null}
 */
function getMageSkillById(id) {
  if (typeof id !== 'string' || !id) {
    return null;
  }
  return MAGE_SKILLS[id] || null;
}

/**
 * Retrieves all Mage skills unlocked at or below the given combo count.
 * @param {number} combo
 * @returns {Array<object>}
 */
function getUnlockedMageSkills(combo) {
  if (typeof combo !== 'number' || !Number.isFinite(combo)) {
    return [];
  }
  return Object.values(MAGE_SKILLS).filter(skill => combo >= skill.unlockCombo);
}

module.exports = {
  MAGE_MANA_CONFIG,
  MAGE_AMMO_PICKUP,
  MAGE_SKILLS,
  MAGE_SKILL_KEYS,
  getMageSkillBySlot,
  getMageSkillById,
  getUnlockedMageSkills
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mage_skills.test.js`
Expected: PASS (`1` test passing)

- [ ] **Step 5: Commit**

```bash
git add server/game/MageSkillsConfig.js tests/mage_skills.test.js
git commit -m "feat(mage): add MageSkillsConfig with 8-skill spec and mana constants"
```

---

### Task 2: Extend `Zombie.js`, `Bullet.js`, and `UltimateConfig.js` for Mage Spells

**Files:**
- Modify: `server/game/Zombie.js:100-115`
- Modify: `server/game/Bullet.js:15-30`
- Modify: `server/game/UltimateConfig.js:32-43`
- Modify: `tests/ultimates.test.js:6-18`
- Modify: `tests/mage_skills.test.js`

**Interfaces:**
- Produces in `server/game/Zombie.js`:
  - `Zombie.prototype.applySlow(duration: number, slowFactor: number) -> void` (non-blocking; validates finite numbers `(0, 1]`, preserves strongest slow `Math.min(this.slowFactor, slowFactor)` and max duration)
- Produces in `server/game/Bullet.js`:
  - `Bullet` constructor supports `options.type === 'arcane_bolt' | 'mage_fireball'`, `options.isMageFireball`, `options.damageType` (default `'BULLET'`), custom `options.radius`
- Modifies in `server/game/UltimateConfig.js`:
  - `ULTIMATE_CONFIGS.MAGE` becomes `{ id: 'METEOR_STORM', name: 'Meteor Storm', ... }` derived from `MAGE_SKILLS.METEOR_STORM`

- [ ] **Step 1: Write failing tests for `Zombie.applySlow`, `Bullet` Mage projectile types, and `UltimateConfig` MAGE mapping**

Append to `tests/mage_skills.test.js`:

```javascript
const { Zombie } = require('../server/game/Zombie.js');
const { Bullet } = require('../server/game/Bullet.js');
const { GameMap } = require('../server/game/Map.js');
const { getUltimateConfigForClass } = require('../server/game/UltimateConfig.js');

test('Zombie.applySlow reduces speed without diluting stronger slows and ignores invalid inputs', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS');
  const z = new Zombie('z1', 'NORMAL', 400, 400);
  const target = { x: 800, y: 400, radius: 16, isDead: false };

  // Act: apply 40% slow (0.6x) then weaker 10% slow (0.9x)
  z.applySlow(1.0, 0.6);
  z.applySlow(0.5, 0.9);
  z.applySlow(-1, 0.5);
  z.applySlow(1.0, 0);

  // Assert
  assert.strictEqual(z.slowFactor, 0.6);
  assert.strictEqual(z.slowTimer, 1.0);
  assert.strictEqual(z.serialize().isChilled, true);

  z.update(0.5, [target], [], map, []);
  const moved = z.x - 400;
  // Normal speed 110 * 0.6 * 0.5s = 33px
  assert.ok(Math.abs(moved - 33) < 0.5, `Expected ~33px movement, got ${moved}`);
});

test('Bullet supports arcane_bolt and mage_fireball properties cleanly', () => {
  // Arrange & Act
  const bolt = new Bullet('b1', 'm1', 100, 100, 0, {
    type: 'arcane_bolt',
    speed: 900,
    damage: 35,
    range: 400,
    radius: 7,
    damageType: 'MAGIC'
  });
  const fb = new Bullet('b2', 'm1', 100, 100, 0, {
    type: 'mage_fireball',
    isMageFireball: true,
    speed: 550,
    range: 500,
    radius: 14,
    explosionRadius: 140,
    explosionDamage: 130,
    damageType: 'FIRE'
  });

  // Assert
  assert.strictEqual(bolt.radius, 7);
  assert.strictEqual(bolt.damageType, 'MAGIC');
  assert.strictEqual(bolt.isExplosive, false);
  assert.strictEqual(fb.radius, 14);
  assert.strictEqual(fb.isMageFireball, true);
  assert.strictEqual(fb.isExplosive, true);
  assert.strictEqual(fb.damageType, 'FIRE');
  assert.strictEqual(fb.serialize().type, 'mage_fireball');
});

test('UltimateConfig maps MAGE to METEOR_STORM', () => {
  const mageUlt = getUltimateConfigForClass('MAGE');
  assert.strictEqual(mageUlt.id, 'METEOR_STORM');
});
```

Update line 16 of `tests/ultimates.test.js` in the same step so the suite stays aligned (`assert.strictEqual(mageUlt.id, 'METEOR_STORM');`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mage_skills.test.js`
Expected: FAIL with `z.applySlow is not a function` and `ULTIMATE_CONFIGS.MAGE` mismatch.

- [ ] **Step 3: Update `server/game/Zombie.js`, `server/game/Bullet.js`, `server/game/UltimateConfig.js`, and `tests/ultimates.test.js`**

In `server/game/Zombie.js` right above `applyStun(duration)` (around line 101):

```javascript
  /**
   * Applies movement slowdown to zombie without letting weaker slows dilute stronger ones.
   * @param {number} duration - Duration in seconds
   * @param {number} slowFactor - Speed multiplier in (0, 1]
   */
  applySlow(duration, slowFactor) {
    if (this.isDead || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return;
    if (typeof slowFactor !== 'number' || !Number.isFinite(slowFactor) || slowFactor <= 0 || slowFactor > 1) return;

    if (this.slowTimer <= 0) {
      this.slowTimer = duration;
      this.slowFactor = slowFactor;
    } else {
      this.slowTimer = Math.max(this.slowTimer, duration);
      this.slowFactor = Math.min(this.slowFactor, slowFactor);
    }
  }
```

In `server/game/Bullet.js` lines 15–28:

```javascript
    this.type = options.type || 'bullet'; // bullet | shotgun | rocket | grenade | railgun | fireball | arcane_bolt | mage_fireball
    this.isFireball = Boolean(options.isFireball);
    this.isMageFireball = Boolean(options.isMageFireball || options.type === 'mage_fireball');
    this.isExplosive = options.type === 'rocket' || options.type === 'grenade' || this.isFireball || this.isMageFireball;
    this.explosionRadius = options.explosionRadius || (this.isFireball ? 90 : (this.isMageFireball ? 140 : 160));
    this.explosionDamage = options.explosionDamage || this.damage;
    this.damageType = options.damageType || (this.isMageFireball ? 'FIRE' : (this.type === 'arcane_bolt' ? 'MAGIC' : 'BULLET'));
    this.penetration = Boolean(options.penetration);
    this.knockback = options.knockback !== undefined ? options.knockback : (options.type === 'shotgun' ? 180 : 50);
    this.fromUlt = Boolean(options.fromUlt);

    // Fuse time for grenades
    this.fuseTime = options.fuseTime || 0;
    this.life = 0;
    this.radius = options.radius || (this.isMageFireball ? 14 : (this.isFireball ? 12 : (options.type === 'rocket' ? 8 : (options.type === 'arcane_bolt' ? 7 : 4))));
```

In `server/game/UltimateConfig.js` lines 1–43 (import `MAGE_SKILLS` and replace `MAGE` entry):

```javascript
const { MAGE_SKILLS } = require('./MageSkillsConfig.js');
```
And replace lines 32–42:
```javascript
  MAGE: {
    id: 'METEOR_STORM',
    name: MAGE_SKILLS.METEOR_STORM.name,
    stormRadius: MAGE_SKILLS.METEOR_STORM.stormRadius,
    duration: MAGE_SKILLS.METEOR_STORM.duration,
    meteorCount: MAGE_SKILLS.METEOR_STORM.meteorCount,
    meteorImpactRadius: MAGE_SKILLS.METEOR_STORM.meteorImpactRadius,
    meteorDamage: MAGE_SKILLS.METEOR_STORM.meteorDamage,
    manaCost: MAGE_SKILLS.METEOR_STORM.manaCost,
    cooldown: MAGE_SKILLS.METEOR_STORM.cooldown
  }
```

In `tests/ultimates.test.js` line 16:
```javascript
  assert.strictEqual(mageUlt.id, 'METEOR_STORM');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mage_skills.test.js tests/zombie.test.js tests/combat_objects.test.js`
Expected: PASS (all tests in these 3 files pass; note `tests/ultimates.test.js` still has the old `Mage Blink & Frost Nova` GameRoom test which is updated in Task 5).

- [ ] **Step 5: Commit**

```bash
git add server/game/Zombie.js server/game/Bullet.js server/game/UltimateConfig.js tests/mage_skills.test.js tests/ultimates.test.js
git commit -m "feat(mage): add Zombie.applySlow, Mage bullet types, and METEOR_STORM ultimate config"
```

---

### Task 3: Extend `Player.js` with Mage Mana, Skill State, Mana Shield & Unlock Progression

**Files:**
- Modify: `server/game/Player.js:1-359`
- Modify: `tests/mage_skills.test.js`

**Interfaces:**
- Consumes: `MAGE_MANA_CONFIG`, `MAGE_AMMO_PICKUP`, `MAGE_SKILLS`, `MAGE_SKILL_KEYS`, `getUnlockedMageSkills` from `server/game/MageSkillsConfig.js`
- Produces on `Player`:
  - `player.mana: number`, `player.maxMana: number`, `player.hasSanctuaryBuff: boolean`, `player.mageState: { skills: Record<string, { id, slot, unlocked, cooldown, maxCooldown, manaCost }>, manaShieldTimer: number, manaShieldActive: boolean } | null`
  - `player.resetMageState() -> void`
  - `player.restoreMana(amount: number) -> number`
  - `player.consumeMana(amount: number) -> boolean`
  - `player.applyMageAmmoPickup() -> void` (`+30 Mana`, `-1.5s` cooldown on skills `2..8`)
  - `player.clearMageChannels() -> void`
  - `player.takeDamage(amount, sourceType, options)` returns `{ blocked, absorbedMana, damage, shieldBroken }` and applies Mana Shield `1:1` absorption with HP overflow + early break at `0` Mana (still safe for callers ignoring return value!).
  - `player.revive()` restores `50%` Mana (`50`) for Mage.
  - `player.serialize()` includes `mana`, `maxMana`, `hasSanctuaryBuff`, `mageState` summary.

- [ ] **Step 1: Write failing tests for Mage Mana, cooldown ticks, Mana Shield, unlocks, AMMO bonus, and serialization**

Append to `tests/mage_skills.test.js`:

```javascript
const { Player } = require('../server/game/Player.js');

test('Player initializes Mage Mana state, regenerates +5/s, and respects Sanctuary cooldown multiplier', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS');
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);

  // Assert initial state
  assert.strictEqual(mage.maxHp, 85);
  assert.strictEqual(mage.speed, 188);
  assert.strictEqual(mage.maxMana, 100);
  assert.strictEqual(mage.mana, 100);
  assert.strictEqual(mage.selectedWeapon, 'ARCANE_BOLT');
  assert.ok(mage.mageState);
  assert.strictEqual(mage.mageState.skills.ARCANE_BOLT.unlocked, true);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.unlocked, false);
  assert.strictEqual(mage.mageState.skills.METEOR_STORM.unlocked, false);

  // Act: spend mana and put skill on CD
  assert.strictEqual(mage.consumeMana(40), true);
  assert.strictEqual(mage.mana, 60);
  assert.strictEqual(mage.consumeMana(70), false);
  assert.strictEqual(mage.mana, 60);

  mage.mageState.skills.FROST_NOVA.cooldown = 5.0;
  mage.update(2.0, map, []);
  assert.strictEqual(mage.mana, 70); // 60 + 5 * 2
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 3.0);

  // Sanctuary buff speeds up cooldown recovery by 1.35x
  mage.hasSanctuaryBuff = true;
  mage.update(1.0, map, []);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 1.65);
});

test('Mage recordKill skips gun unlocks & ultCharge, unlocks Mage skills by combo, and AMMO pickup restores +30 Mana & -1.5s CD', () => {
  // Arrange
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  mage.mana = 50;
  mage.mageState.skills.FROST_NOVA.cooldown = 4.0;
  mage.mageState.skills.CHAIN_LIGHTNING.cooldown = 1.0;

  // Act: 4 kills -> combo reaches 5 -> unlocks FROST_NOVA
  let unlocked = [];
  for (let i = 0; i < 4; i++) {
    unlocked = mage.recordKill(10);
  }

  // Assert
  assert.strictEqual(mage.combo, 5);
  assert.strictEqual(mage.ultCharge, 0, 'Mage must not accumulate ultCharge');
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.unlocked, true);
  assert.ok(unlocked.some(u => u.id === 'FROST_NOVA'));

  // Act: AMMO pickup
  mage.applyMageAmmoPickup();
  assert.strictEqual(mage.mana, 80);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 2.5);
  assert.strictEqual(mage.mageState.skills.CHAIN_LIGHTNING.cooldown, 0);
});

test('Mage Mana Shield absorbs 1:1 into Mana, overflows remainder to HP, and breaks early at 0 Mana', () => {
  // Arrange
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  mage.mana = 50;
  mage.mageState.manaShieldActive = true;
  mage.mageState.manaShieldTimer = 5.0;

  // Act 1: 30 damage fully absorbed
  const res1 = mage.takeDamage(30, 'MELEE');
  assert.strictEqual(res1.absorbedMana, 30);
  assert.strictEqual(res1.damage, 0);
  assert.strictEqual(res1.shieldBroken, false);
  assert.strictEqual(mage.mana, 20);
  assert.strictEqual(mage.hp, 85);
  assert.strictEqual(mage.mageState.manaShieldActive, true);

  // Act 2: 35 damage (> 20 remaining mana) -> absorbs 20, overflows 15 to HP, breaks shield
  const res2 = mage.takeDamage(35, 'MELEE');
  assert.strictEqual(res2.absorbedMana, 20);
  assert.strictEqual(res2.damage, 15);
  assert.strictEqual(res2.shieldBroken, true);
  assert.strictEqual(mage.mana, 0);
  assert.strictEqual(mage.hp, 70);
  assert.strictEqual(mage.mageState.manaShieldActive, false);
  assert.strictEqual(mage.mageState.manaShieldTimer, 0);

  // Serialization includes mana & mageState
  const snap = mage.serialize();
  assert.strictEqual(snap.mana, 0);
  assert.strictEqual(snap.maxMana, 100);
  assert.ok(snap.mageState);
  assert.strictEqual(snap.mageState.manaShieldActive, false);

  // Revive restores 50% Mana
  mage.isDowned = true;
  mage.hp = 0;
  mage.mana = 0;
  mage.revive();
  assert.strictEqual(mage.isDowned, false);
  assert.strictEqual(mage.hp, 40);
  assert.strictEqual(mage.mana, 50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_skills.test.js`
Expected: FAIL (`mage.maxMana` is `undefined`, `mage.mageState` is `undefined`)

- [ ] **Step 3: Implement Mage support in `server/game/Player.js`**

Update `server/game/Player.js`:
1. Import Mage config constants at lines 1–3:
```javascript
const { WEAPONS, getUnlockedWeapons } = require('./WeaponsConfig.js');
const { ULT_CHARGE_CONFIG, getUltimateConfigForClass } = require('./UltimateConfig.js');
const {
  MAGE_MANA_CONFIG,
  MAGE_AMMO_PICKUP,
  MAGE_SKILLS,
  MAGE_SKILL_KEYS,
  getUnlockedMageSkills
} = require('./MageSkillsConfig.js');
```
2. Add Mage fields in `constructor` (after `this.applyClassConfig(this.character)` around line 45, and set `this.selectedWeapon` cleanly at line 72):
```javascript
    this.selectedWeapon = (this.character === 'MAGE') ? 'ARCANE_BOLT' : 'PISTOL';
```
3. In `applyInput(input)` (around line 105): ignore weapon switches for `MAGE` (`this.selectedWeapon` stays `'ARCANE_BOLT'`):
```javascript
    if (this.character !== 'MAGE' && input.weaponId && this.weapons[input.weaponId] && this.weapons[input.weaponId].unlocked) {
      this.selectedWeapon = input.weaponId;
    }
```
4. In `applyClassConfig(character)` (lines 174–188):
```javascript
    this.hasSanctuaryBuff = false;
    if (this.character === 'MAGE') {
      this.resetMageState();
    } else {
      this.mageState = null;
      this.mana = 0;
      this.maxMana = 0;
      this.selectedWeapon = 'PISTOL';
    }
```
5. Add `resetMageState()`, `restoreMana(amount)`, `consumeMana(amount)`, `applyMageAmmoPickup()`, `clearMageChannels()`, and `revive()` methods:
```javascript
  /**
   * Resets Mage Mana pool, skill cooldowns, unlock state, and Mana Shield timers.
   */
  resetMageState() {
    const skills = {};
    for (const key of MAGE_SKILL_KEYS) {
      const cfg = MAGE_SKILLS[key];
      skills[key] = {
        id: cfg.id,
        slot: cfg.slot,
        unlocked: cfg.unlockCombo === 1,
        manaCost: cfg.manaCost,
        cooldown: 0,
        maxCooldown: cfg.cooldown || 0
      };
    }
    this.maxMana = MAGE_MANA_CONFIG.MAX_MANA;
    this.mana = MAGE_MANA_CONFIG.STARTING_MANA;
    this.hasSanctuaryBuff = false;
    this.selectedWeapon = 'ARCANE_BOLT';
    this.mageState = {
      skills,
      manaShieldTimer: 0,
      manaShieldActive: false,
      shieldJustBroken: false
    };
  }

  /**
   * Restores Mage Mana up to maxMana.
   * @param {number} amount
   * @returns {number}
   */
  restoreMana(amount) {
    if (this.character !== 'MAGE' || this.isDead || this.isDowned) {
      return this.mana || 0;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return this.mana;
    }
    this.mana = Math.min(this.maxMana, Number((this.mana + amount).toFixed(2)));
    return this.mana;
  }

  /**
   * Consumes Mana if Mage has sufficient pool.
   * @param {number} amount
   * @returns {boolean}
   */
  consumeMana(amount) {
    if (this.character !== 'MAGE' || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return false;
    }
    if (this.mana + 1e-6 < amount) {
      return false;
    }
    this.mana = Math.max(0, Number((this.mana - amount).toFixed(2)));
    return true;
  }

  /**
   * Applies AMMO pickup bonus (+30 Mana and -1.5s CD on Mage skills 2..8).
   */
  applyMageAmmoPickup() {
    if (this.character !== 'MAGE' || !this.mageState) return;
    this.restoreMana(MAGE_AMMO_PICKUP.MANA_RESTORE);
    for (const key of MAGE_SKILL_KEYS) {
      const sk = this.mageState.skills[key];
      if (sk && sk.slot >= 2 && sk.cooldown > 0) {
        sk.cooldown = Math.max(0, Number((sk.cooldown - MAGE_AMMO_PICKUP.COOLDOWN_REDUCTION_SEC).toFixed(2)));
      }
    }
  }

  /**
   * Clears active Mage channeling/shield effects on death or downed.
   */
  clearMageChannels() {
    if (this.character !== 'MAGE' || !this.mageState) return;
    this.mageState.manaShieldTimer = 0;
    this.mageState.manaShieldActive = false;
    this.mageState.shieldJustBroken = false;
    this.hasSanctuaryBuff = false;
  }

  /**
   * Revives a downed player and restores 50% Mana if Mage.
   */
  revive() {
    this.isDowned = false;
    this.isDead = false;
    this.hp = 40;
    this.bleedoutTimer = 15;
    if (this.character === 'MAGE') {
      this.restoreMana(Math.round(this.maxMana * MAGE_MANA_CONFIG.REVIVE_RESTORE_RATIO));
    }
  }
```
6. Update `update(dt, map, barricades)` (lines 110–135):
```javascript
    if (this.isDowned) {
      this.bleedoutTimer -= dt;
      if (this.bleedoutTimer <= 0) {
        this.isDead = true;
        this.isDowned = false;
        this.hp = 0;
        this.clearMageChannels();
      }
      return;
    }

    const sanctuaryMult = this.hasSanctuaryBuff ? MAGE_SKILLS.SANCTUARY_HEAL.cooldownSpeedMultiplier : 1.0;

    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt * (this.reloadSpeedMultiplier || 1.0) * sanctuaryMult);
    }

    if (this.character === 'MAGE' && this.mageState) {
      this.restoreMana(MAGE_MANA_CONFIG.REGEN_PER_SEC * dt);
      for (const sk of Object.values(this.mageState.skills)) {
        if (sk.cooldown > 0) {
          sk.cooldown = Math.max(0, Number((sk.cooldown - dt * sanctuaryMult).toFixed(2)));
        }
      }
      if (this.mageState.manaShieldTimer > 0) {
        this.mageState.manaShieldTimer = Math.max(0, this.mageState.manaShieldTimer - dt);
        if (this.mageState.manaShieldTimer === 0) {
          this.mageState.manaShieldActive = false;
        }
      }
    }
```
And update `updateRevive(dt)` line 291–295 to call `this.revivingTarget.revive();`.
7. Update `addUltCharge(amount)`:
```javascript
  addUltCharge(amount) {
    if (this.character === 'MAGE') return 0;
    if (this.isDead || this.isDowned || typeof amount !== 'number' || amount <= 0) {
      return this.ultCharge;
    }
    this.ultCharge = Math.min(this.ultMaxCharge, Number((this.ultCharge + amount).toFixed(2)));
    return this.ultCharge;
  }
```
8. Update `recordKill(points, options)`:
```javascript
    const newlyUnlocked = [];
    const maxProgression = Math.max(this.combo, this.maxCombo);
    if (this.character === 'MAGE' && this.mageState) {
      const unlockedSkills = getUnlockedMageSkills(maxProgression);
      for (let i = 0; i < unlockedSkills.length; i++) {
        const s = unlockedSkills[i];
        const stateSkill = this.mageState.skills[s.id];
        if (stateSkill && !stateSkill.unlocked) {
          stateSkill.unlocked = true;
          newlyUnlocked.push(s);
        }
      }
      return newlyUnlocked;
    }
```
9. Update `takeDamage(amount, sourceType = 'MELEE')`:
```javascript
  takeDamage(amount, sourceType = 'MELEE') {
    if (this.isDead || this.isDowned) return { blocked: false, absorbedMana: 0, damage: 0, shieldBroken: false };
    let finalAmount = amount;
    if (sourceType === 'MELEE' && this.meleeResistance > 0) {
      finalAmount = Math.max(1, Math.round(amount * (1 - this.meleeResistance)));
    }

    let absorbedMana = 0;
    let shieldBroken = false;
    if (this.character === 'MAGE' && this.mageState && (this.mageState.manaShieldActive || this.mageState.manaShieldTimer > 0)) {
      absorbedMana = Math.min(this.mana, finalAmount);
      this.mana = Number((this.mana - absorbedMana).toFixed(2));
      finalAmount = Math.max(0, finalAmount - absorbedMana);
      if (this.mana <= 0) {
        this.mana = 0;
        this.mageState.manaShieldActive = false;
        this.mageState.manaShieldTimer = 0;
        this.mageState.shieldJustBroken = true;
        shieldBroken = true;
      }
      if (finalAmount === 0) {
        return { blocked: true, absorbedMana, damage: 0, shieldBroken };
      }
    }

    this.hp -= finalAmount;
    if (this.hp <= 0) {
      this.hp = 0;
      if (!this.isDowned) {
        this.isDowned = true;
        this.bleedoutTimer = 15;
      }
      this.clearMageChannels();
    }
    return { blocked: false, absorbedMana, damage: finalAmount, shieldBroken };
  }
```
10. Update `canShoot` and `consumeAmmo`:
```javascript
  canShoot(weaponType = null) {
    if (this.isDowned || this.isDead) return false;
    if (this.fireCooldown > 0) return false;
    if (this.character === 'MAGE') {
      return this.mana + 1e-6 >= MAGE_SKILLS.ARCANE_BOLT.manaCost;
    }
    const w = this.weapons[this.selectedWeapon];
    if (!w || !w.unlocked) return false;
    const def = WEAPONS[this.selectedWeapon];
    const resolvedType = weaponType || (def ? def.type : null);
    const isPlaceable = resolvedType === 'placeable_wall' || resolvedType === 'placeable_barrel';
    if (this.hasInfiniteAmmo && !isPlaceable) return true;
    return w.ammo > 0;
  }

  consumeAmmo(weaponType = null) {
    if (this.character === 'MAGE') return;
    // existing gun ammo consumption unchanged
```
11. Update `serialize()` to include:
```javascript
    let mageStateSummary = null;
    if (this.character === 'MAGE' && this.mageState) {
      const skillsSummary = {};
      for (const key of Object.keys(this.mageState.skills)) {
        const sk = this.mageState.skills[key];
        skillsSummary[key] = {
          id: sk.id,
          slot: sk.slot,
          unlocked: sk.unlocked,
          manaCost: sk.manaCost,
          cooldown: Number(sk.cooldown.toFixed(1))
        };
      }
      mageStateSummary = {
        skills: skillsSummary,
        manaShieldActive: Boolean(this.mageState.manaShieldActive || this.mageState.manaShieldTimer > 0),
        manaShieldTimer: Number(this.mageState.manaShieldTimer.toFixed(1))
      };
    }

    return {
      // existing fields unchanged, plus:
      mana: Math.floor(this.mana || 0),
      maxMana: this.maxMana || 0,
      hasSanctuaryBuff: Boolean(this.hasSanctuaryBuff),
      mageState: mageStateSummary
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mage_skills.test.js tests/player.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/game/Player.js tests/mage_skills.test.js
git commit -m "feat(mage): integrate Mage Mana, cooldown ticks, Mana Shield, and skill unlocks into Player"
```

---

### Task 4: Implement `MageAbilities.js` Engine & Update `UltimateAbilities.js`

**Files:**
- Create: `server/game/MageAbilities.js`
- Modify: `server/game/UltimateAbilities.js:1-208`
- Modify: `tests/mage_skills.test.js`

**Interfaces:**
- Consumes: `MAGE_SKILLS`, `MAGE_AMMO_PICKUP`, `getMageSkillBySlot` from `MageSkillsConfig.js`, `Bullet` from `Bullet.js`, `resolveBlinkDestination` from `UltimateAbilities.js`
- Produces in `server/game/MageAbilities.js`:
  - `maybeDropPickup(room, zombie) -> object | null` (shared 18% `AMMO`, 7% `MEDKIT` helper)
  - `damageAndCreditZombie(attacker, zombie, damage, sourceType, room, options) -> void`
  - `executeMageArcaneBolt(player, room) -> boolean`
  - `triggerMageSkill(player, slot, angle, room, targetPos) -> { activated: boolean, skillId?: string, reason?: string }`
  - `explodeMageFireball(x, y, radius, damage, ownerId, room) -> void` (zombies + barrels only; spawns `burn_pool`)
  - `updateMageRoomSystems(dt, room) -> void` (updates `groundZones` `burn_pool` / `sanctuary` / `lava_pool`, `pendingMeteors`, and `hasSanctuaryBuff`)
- Modifies in `server/game/UltimateAbilities.js`:
  - Removes `applyFrostNovaAt` and `executeBlinkFrostNova`; keeps `resolveBlinkDestination` exported; when `player.character === 'MAGE'`, `triggerPlayerUltimate(player, angle, room, targetPos)` delegates to `triggerMageSkill(player, 8, angle, room, targetPos)` without spending `ultCharge`.

- [ ] **Step 1: Write failing tests for all 8 Mage skills, ground zones, Barricade/ally safety, and 18% AMMO drop**

Append to `tests/mage_skills.test.js`:

```javascript
const { Barricade, Barrel } = require('../server/game/Barricade.js');
const {
  maybeDropPickup,
  executeMageArcaneBolt,
  triggerMageSkill,
  explodeMageFireball,
  updateMageRoomSystems
} = require('../server/game/MageAbilities.js');

function createMockRoom() {
  return {
    map: new GameMap('THE_ROOMS'),
    players: new Map(),
    zombies: [],
    bullets: [],
    barricades: [],
    pickups: [],
    drones: [],
    groundZones: [],
    pendingMeteors: [],
    state: 'PLAYING',
    eventsBuffer: []
  };
}

test('Mage [1] ARCANE_BOLT and [2] FROST_NOVA execute with exact mana, range, damage, and freeze durations', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 500, 500);
  mage.angle = 0;
  mage.mageState.skills.FROST_NOVA.unlocked = true;
  room.players.set('m1', mage);

  // Act [1]: Arcane Bolt
  const fired = executeMageArcaneBolt(mage, room);
  assert.strictEqual(fired, true);
  assert.strictEqual(mage.mana, 95);
  assert.strictEqual(room.bullets.length, 1);
  assert.strictEqual(room.bullets[0].type, 'arcane_bolt');
  assert.strictEqual(room.bullets[0].speed, 900);
  assert.strictEqual(room.bullets[0].range, 400);
  assert.strictEqual(room.bullets[0].damage, 35);

  // Act [2]: Frost Nova
  const zNormal = new Zombie('zn', 'NORMAL', 590, 500);
  const zTank = new Zombie('zt', 'TANK', 580, 500);
  const zFar = new Zombie('zf', 'NORMAL', 700, 500);
  room.zombies.push(zNormal, zTank, zFar);

  const res = triggerMageSkill(mage, 2, 0, room);
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 75);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 5.0);
  assert.strictEqual(zNormal.hp, 35);
  assert.strictEqual(zNormal.freezeTimer, 2.0);
  assert.strictEqual(zTank.hp, 355);
  assert.strictEqual(zTank.freezeTimer, 1.0);
  assert.strictEqual(zFar.hp, 80);
});

test('Mage [3] CHAIN_LIGHTNING chains up to 4 bounces with -15% damage decay and 0.5s stun, aborting cleanly if no target', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 500);
  mage.mageState.skills.CHAIN_LIGHTNING.unlocked = true;
  room.players.set('m1', mage);

  // Unhappy path: no zombies -> no mana spent, no cooldown
  const emptyRes = triggerMageSkill(mage, 3, 0, room, { x: 450, y: 500 });
  assert.strictEqual(emptyRes.activated, false);
  assert.strictEqual(emptyRes.reason, 'NO_TARGET');
  assert.strictEqual(mage.mana, 100);
  assert.strictEqual(mage.mageState.skills.CHAIN_LIGHTNING.cooldown, 0);

  // Happy path: 6 zombies along chain (1 primary + 4 bounces = 5 hit, 6th untouched)
  const zombies = [];
  for (let i = 0; i < 6; i++) {
    const z = new Zombie(`z${i}`, 'TANK', 450 + i * 100, 500); // TANK has 400 HP
    zombies.push(z);
    room.zombies.push(z);
  }

  const res = triggerMageSkill(mage, 3, 0, room, { x: 450, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 70);
  assert.strictEqual(mage.mageState.skills.CHAIN_LIGHTNING.cooldown, 4.5);

  const expectedDmgs = [70, 60, 51, 43, 37];
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(zombies[i].hp, 400 - expectedDmgs[i], `Bounce ${i} dmg mismatch`);
    assert.strictEqual(zombies[i].stunTimer, 0.5);
  }
  assert.strictEqual(zombies[5].hp, 400, 'Max 4 bounces -> 6th zombie must not be hit');
});

test('Mage [4] FIREBALL spawns explosive fireball that spares Barricades/allies and leaves 3s burn_pool', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 400, 500);
  const ally = new Player('h1', 'Ally', 'HUMAN', 620, 500);
  const barricade = new Barricade('bar1', 610, 500, 'h1');
  const zTank = new Zombie('zt', 'TANK', 630, 500);
  const zMummy = new Zombie('zm', 'MUMMY', 640, 500);
  mage.mageState.skills.FIREBALL.unlocked = true;
  room.players.set('m1', mage);
  room.players.set('h1', ally);
  room.barricades.push(barricade);
  room.zombies.push(zTank, zMummy);

  // Act: cast Fireball and detonate at (620, 500)
  const castRes = triggerMageSkill(mage, 4, 0, room);
  assert.strictEqual(castRes.activated, true);
  assert.strictEqual(mage.mana, 65);
  assert.strictEqual(mage.mageState.skills.FIREBALL.cooldown, 6.0);
  const fb = room.bullets.find(b => b.type === 'mage_fireball');
  assert.ok(fb);
  assert.strictEqual(fb.speed, 550);
  assert.strictEqual(fb.range, 500);

  explodeMageFireball(620, 500, 140, 130, 'm1', room);

  // Assert impact safety & burn pool creation
  assert.strictEqual(ally.hp, ally.maxHp, 'Fireball must not harm teammates');
  assert.strictEqual(barricade.hp, 300, 'Fireball must spare friendly Barricade');
  assert.strictEqual(zTank.hp, 270); // 400 - 130
  assert.strictEqual(zMummy.isDead, true); // 130 * 1.5 FIRE = 195 > 140 HP
  assert.strictEqual(room.groundZones.length, 1);
  assert.strictEqual(room.groundZones[0].type, 'burn_pool');

  // Tick burn_pool for 3.0s (6 ticks * 7.5 = 45 FIRE dmg)
  for (let i = 0; i < 60; i++) {
    updateMageRoomSystems(0.05, room);
  }
  assert.strictEqual(zTank.hp, 225); // 270 - 45
  assert.strictEqual(room.groundZones.length, 0);
});

test('Mage [5] ARCANE_TELEPORT blinks safely to cursor (<=250px) and blasts origin without hitting Barricades', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 500);
  mage.mageState.skills.ARCANE_TELEPORT.unlocked = true;
  const zOrigin = new Zombie('zo', 'NORMAL', 360, 500);
  const bar = new Barricade('bar1', 340, 500, 'm1');
  room.players.set('m1', mage);
  room.zombies.push(zOrigin);
  room.barricades.push(bar);

  // Act: request target 400px east -> clamped to 250px
  const res = triggerMageSkill(mage, 5, 0, room, { x: 700, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 75);
  assert.strictEqual(mage.mageState.skills.ARCANE_TELEPORT.cooldown, 7.0);
  assert.strictEqual(mage.x, 550);
  assert.strictEqual(zOrigin.hp, 30); // 80 - 50
  assert.ok(zOrigin.knockbackX > 0);
  assert.strictEqual(bar.hp, 300);
});

test('Mage [6] SANCTUARY_HEAL heals allies 25 HP/s, buffs CD speed, and slows zombies 40%', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 400, 500);
  const ally = new Player('h1', 'Soldier', 'HUMAN', 600, 500);
  ally.hp = 50;
  const downedAlly = new Player('h2', 'Down', 'HUMAN', 600, 510);
  downedAlly.isDowned = true;
  downedAlly.hp = 0;
  const zIn = new Zombie('zi', 'NORMAL', 620, 500);

  mage.mageState.skills.SANCTUARY_HEAL.unlocked = true;
  room.players.set('m1', mage);
  room.players.set('h1', ally);
  room.players.set('h2', downedAlly);
  room.zombies.push(zIn);

  // Act: cast Sanctuary at (600, 500)
  const res = triggerMageSkill(mage, 6, 0, room, { x: 600, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 65);
  assert.strictEqual(room.groundZones.length, 1);
  assert.strictEqual(room.groundZones[0].type, 'sanctuary');

  // Tick 1.0s (20 steps of 0.05s)
  for (let i = 0; i < 20; i++) {
    updateMageRoomSystems(0.05, room);
  }

  assert.strictEqual(ally.hp, 75); // +25 HP in 1.0s
  assert.strictEqual(ally.hasSanctuaryBuff, true);
  assert.strictEqual(downedAlly.hp, 0, 'Downed ally must not be healed');
  assert.strictEqual(zIn.slowFactor, 0.6, 'Zombie inside sanctuary slowed by 40%');
});

test('Mage [8] METEOR_STORM drops 5 meteors over 3.0s and maintains 240px lava_pool', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 400, 500);
  mage.mageState.skills.METEOR_STORM.unlocked = true;
  const zBoss = new Zombie('zb', 'TANK', 700, 500); // at cursor
  zBoss.hp = 2000;
  room.players.set('m1', mage);
  room.zombies.push(zBoss);

  // Act: cast at (700, 500)
  const res = triggerMageSkill(mage, 8, 0, room, { x: 700, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 0);
  assert.strictEqual(mage.mageState.skills.METEOR_STORM.cooldown, 50.0);
  assert.strictEqual(room.pendingMeteors.length, 1);

  // Advance 1 tick -> meteor #1 impacts immediately near (700, 500) and spawns lava_pool
  updateMageRoomSystems(0.05, room);
  assert.ok(zBoss.hp <= 1850, 'First meteor must deal 150 FIRE damage');
  assert.ok(room.groundZones.some(gz => gz.type === 'lava_pool' && gz.radius === 240));

  // Advance full 3.05s -> all 5 meteors complete
  for (let i = 0; i < 61; i++) {
    updateMageRoomSystems(0.05, room);
  }
  assert.strictEqual(room.pendingMeteors.length, 0);
});

test('maybeDropPickup respects 18% AMMO and 7% MEDKIT distribution', () => {
  const room = createMockRoom();
  const z = new Zombie('z1', 'NORMAL', 200, 200);
  const origRandom = Math.random;
  try {
    Math.random = () => 0.10; // < 0.18 -> AMMO
    maybeDropPickup(room, z);
    Math.random = () => 0.20; // [0.18, 0.25) -> MEDKIT
    maybeDropPickup(room, z);
    Math.random = () => 0.30; // >= 0.25 -> none
    maybeDropPickup(room, z);
  } finally {
    Math.random = origRandom;
  }

  assert.strictEqual(room.pickups.length, 2);
  assert.strictEqual(room.pickups[0].type, 'AMMO');
  assert.strictEqual(room.pickups[1].type, 'MEDKIT');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_skills.test.js`
Expected: FAIL with `Cannot find module '../server/game/MageAbilities.js'`

- [ ] **Step 3: Create `server/game/MageAbilities.js` and update `server/game/UltimateAbilities.js`**

Write `server/game/MageAbilities.js`:

```javascript
/**
 * @file MageAbilities.js
 * @description Authoritative 50Hz simulation engine for Mage 8-skill kit,
 * cursor-targeted casting, Chain Lightning bounces, Fireball/Meteor pools,
 * Sanctuary healing/buffs, Mana Shield, and 18% AMMO pickup drops.
 */

'use strict';

const {
  MAGE_SKILLS,
  MAGE_AMMO_PICKUP,
  getMageSkillBySlot
} = require('./MageSkillsConfig.js');
const { Bullet } = require('./Bullet.js');
const { resolveBlinkDestination } = require('./UltimateAbilities.js');

/**
 * Normalizes angle difference into [-Math.PI, Math.PI].
 * @param {number} diff
 * @returns {number}
 */
function normalizeAngleDiff(diff) {
  let d = diff;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Rolls zombie pickup drop using 18% AMMO and 7% MEDKIT probabilities.
 * @param {object} room
 * @param {object} zombie
 * @returns {object|null}
 */
function maybeDropPickup(room, zombie) {
  if (!room || !Array.isArray(room.pickups) || !zombie) return null;
  const roll = Math.random();
  let type = null;
  if (roll < MAGE_AMMO_PICKUP.AMMO_DROP_CHANCE) {
    type = 'AMMO';
  } else if (roll < MAGE_AMMO_PICKUP.AMMO_DROP_CHANCE + MAGE_AMMO_PICKUP.MEDKIT_DROP_CHANCE) {
    type = 'MEDKIT';
  }
  if (!type) return null;

  const pickup = {
    id: 'pk_' + Math.random().toString(36).substring(2, 7),
    type,
    x: Math.round(zombie.x),
    y: Math.round(zombie.y),
    life: 25
  };
  room.pickups.push(pickup);
  return pickup;
}

/**
 * Clamps cursor target within maxRange from origin, falling back to angle direction.
 * @param {object} player
 * @param {number} angle
 * @param {number} maxRange
 * @param {object|null} targetPos
 * @returns {{ x: number, y: number, dist: number }}
 */
function clampCastTarget(player, angle, maxRange, targetPos) {
  const hasCursor = targetPos &&
    typeof targetPos.x === 'number' && Number.isFinite(targetPos.x) &&
    typeof targetPos.y === 'number' && Number.isFinite(targetPos.y);

  if (hasCursor) {
    const dx = targetPos.x - player.x;
    const dy = targetPos.y - player.y;
    const rawDist = Math.hypot(dx, dy);
    if (rawDist <= maxRange) {
      return { x: targetPos.x, y: targetPos.y, dist: rawDist };
    }
    const dirAngle = Math.atan2(dy, dx);
    return {
      x: player.x + Math.cos(dirAngle) * maxRange,
      y: player.y + Math.sin(dirAngle) * maxRange,
      dist: maxRange
    };
  }

  return {
    x: player.x + Math.cos(angle) * maxRange,
    y: player.y + Math.sin(angle) * maxRange,
    dist: maxRange
  };
}

/**
 * Applies damage and optional CC to a zombie, credits kills, emits ZOMBIE_DIE/UNLOCKED, and rolls pickups.
 * @param {object|null} attacker
 * @param {object} zombie
 * @param {number} damage
 * @param {string} sourceType
 * @param {object} room
 * @param {object} [options={}]
 */
function damageAndCreditZombie(attacker, zombie, damage, sourceType, room, options = {}) {
  if (!zombie || zombie.isDead) return;

  zombie.takeDamage(damage, sourceType);

  if (options.knockback && options.knockAngle !== undefined) {
    zombie.applyKnockback(options.knockAngle, options.knockback);
  }
  if (options.freezeDuration) {
    const isBoss = zombie.type === 'TANK' || zombie.type === 'DEVIL';
    const dur = isBoss && options.bossFreezeDuration !== undefined
      ? options.bossFreezeDuration
      : options.freezeDuration;
    if (dur > 0) zombie.applyFreeze(dur);
  }
  if (options.stunDuration && options.stunDuration > 0) {
    zombie.applyStun(options.stunDuration);
  }

  if (zombie.isDead) {
    if (attacker) {
      const unlocks = attacker.recordKill(zombie.score, { awardUltCharge: false });
      if (room && Array.isArray(room.eventsBuffer) && Array.isArray(unlocks)) {
        for (let i = 0; i < unlocks.length; i++) {
          room.eventsBuffer.push({
            type: 'UNLOCKED',
            weapon: unlocks[i].name || unlocks[i].id,
            playerId: attacker.id,
            slot: unlocks[i].slot
          });
        }
      }
    }
    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'ZOMBIE_DIE',
        x: zombie.x,
        y: zombie.y,
        zType: zombie.type,
        angle: zombie.angle,
        killAngle: Number((options.killAngle !== undefined ? options.killAngle : zombie.angle).toFixed(2))
      });
    }
    if (options.dropPickup !== false) {
      maybeDropPickup(room, zombie);
    }
  }
}

/**
 * Triggers explosive barrel chain reactions within blast radius without harming Barricades or teammates.
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {number} damage
 * @param {string|null} ownerId
 * @param {object} room
 */
function detonateBarrelsInRadius(x, y, radius, damage, ownerId, room) {
  if (!room || !Array.isArray(room.barricades)) return;
  const barrels = room.barricades.filter(b => b && b.type === 'barrel' && !b.isDead);
  for (let i = 0; i < barrels.length; i++) {
    const b = barrels[i];
    if (b.isDead) continue;
    if (Math.hypot(b.x - x, b.y - y) <= radius + (b.radius || 20)) {
      b.takeDamage(damage, barrels, (bx, by, br, bd) => {
        if (typeof room.triggerExplosion === 'function') {
          room.triggerExplosion(bx, by, br, bd, ownerId);
        }
      });
    }
  }
}

/**
 * Resolves primary living zombie target for Chain Lightning.
 * @param {object} player
 * @param {number} angle
 * @param {object|null} targetPos
 * @param {object} skill
 * @param {Array<object>} zombies
 * @returns {object|null}
 */
function findChainPrimaryTarget(player, angle, targetPos, skill, zombies) {
  if (!Array.isArray(zombies) || zombies.length === 0) return null;

  const hasCursor = targetPos &&
    typeof targetPos.x === 'number' && Number.isFinite(targetPos.x) &&
    typeof targetPos.y === 'number' && Number.isFinite(targetPos.y);

  let bestCursorTarget = null;
  let bestCursorDist = skill.cursorSnapRadius;
  let bestConeTarget = null;
  let bestConeDist = skill.castRange;

  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    const distToPlayer = Math.hypot(z.x - player.x, z.y - player.y);
    if (distToPlayer > skill.castRange + z.radius) continue;

    if (hasCursor) {
      const distToCursor = Math.hypot(z.x - targetPos.x, z.y - targetPos.y);
      if (distToCursor <= bestCursorDist + z.radius) {
        bestCursorDist = distToCursor;
        bestCursorTarget = z;
      }
    }

    const angleToZ = Math.atan2(z.y - player.y, z.x - player.x);
    if (Math.abs(normalizeAngleDiff(angleToZ - angle)) <= skill.coneHalfRad) {
      if (distToPlayer < bestConeDist) {
        bestConeDist = distToPlayer;
        bestConeTarget = z;
      }
    }
  }

  return bestCursorTarget || bestConeTarget;
}

/**
 * Fires Mage slot [1] ARCANE_BOLT toward player's aim angle.
 * @param {object} player
 * @param {object} room
 * @returns {boolean}
 */
function executeMageArcaneBolt(player, room) {
  if (!player || player.character !== 'MAGE' || !player.mageState) return false;
  if (player.isDead || player.isDowned || player.fireCooldown > 0) return false;

  const skill = MAGE_SKILLS.ARCANE_BOLT;
  if (!player.consumeMana(skill.manaCost)) return false;

  player.fireCooldown = skill.fireDelay;
  const muzzleDist = player.radius + 18;
  const mx = player.x + Math.cos(player.angle) * muzzleDist;
  const my = player.y + Math.sin(player.angle) * muzzleDist;

  const bolt = new Bullet(
    'b_ab_' + Math.random().toString(36).substring(2, 8),
    player.id,
    mx,
    my,
    player.angle,
    {
      type: 'arcane_bolt',
      speed: skill.speed,
      damage: skill.damage,
      range: skill.range,
      radius: skill.radius,
      knockback: skill.knockback,
      damageType: skill.damageType
    }
  );
  if (room && Array.isArray(room.bullets)) {
    room.bullets.push(bolt);
  }
  if (room && Array.isArray(room.eventsBuffer)) {
    room.eventsBuffer.push({
      type: 'MAGE_SKILL',
      skillId: 'ARCANE_BOLT',
      slot: 1,
      playerId: player.id,
      x: Math.round(mx),
      y: Math.round(my),
      angle: Number(player.angle.toFixed(2))
    });
  }
  return true;
}

function castFrostNova(player, room, skill) {
  const zombies = room.zombies || [];
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    if (Math.hypot(z.x - player.x, z.y - player.y) <= skill.radius + z.radius) {
      damageAndCreditZombie(player, z, skill.damage, skill.damageType, room, {
        freezeDuration: skill.freezeDuration,
        bossFreezeDuration: skill.bossFreezeDuration
      });
    }
  }
  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'FROST_NOVA',
    slot: 2,
    playerId: player.id,
    x: Math.round(player.x),
    y: Math.round(player.y),
    radius: skill.radius
  });
}

function castChainLightning(player, angle, room, targetPos, skill) {
  const zombies = room.zombies || [];
  const primary = findChainPrimaryTarget(player, angle, targetPos, skill, zombies);
  if (!primary) return false;

  const links = [];
  const hitIds = new Set();
  let currentTarget = primary;
  let currentFromX = player.x;
  let currentFromY = player.y;

  for (let jump = 0; jump <= skill.maxBounces && currentTarget; jump++) {
    hitIds.add(currentTarget.id);
    const dmg = Math.max(1, Math.round(skill.damage * Math.pow(1 - skill.bounceDamageDecay, jump)));
    const tx = currentTarget.x;
    const ty = currentTarget.y;

    links.push({
      fromX: Math.round(currentFromX),
      fromY: Math.round(currentFromY),
      toX: Math.round(tx),
      toY: Math.round(ty)
    });

    damageAndCreditZombie(player, currentTarget, dmg, skill.damageType, room, {
      stunDuration: skill.stunDuration
    });

    // Pick closest unhit living zombie within bounceRadius
    let nextTarget = null;
    let minDist = skill.bounceRadius;
    for (let i = 0; i < zombies.length; i++) {
      const cand = zombies[i];
      if (!cand || cand.isDead || hitIds.has(cand.id)) continue;
      const d = Math.hypot(cand.x - tx, cand.y - ty);
      if (d <= minDist + cand.radius && d < minDist) {
        minDist = d;
        nextTarget = cand;
      }
    }
    currentFromX = tx;
    currentFromY = ty;
    currentTarget = nextTarget;
  }

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'CHAIN_LIGHTNING',
    slot: 3,
    playerId: player.id,
    x: Math.round(player.x),
    y: Math.round(player.y),
    links
  });
  return true;
}

function castFireball(player, angle, room, skill) {
  const muzzleDist = player.radius + 18;
  const mx = player.x + Math.cos(angle) * muzzleDist;
  const my = player.y + Math.sin(angle) * muzzleDist;

  const fb = new Bullet(
    'b_mfb_' + Math.random().toString(36).substring(2, 8),
    player.id,
    mx,
    my,
    angle,
    {
      type: 'mage_fireball',
      isMageFireball: true,
      speed: skill.speed,
      damage: skill.damage,
      range: skill.range,
      radius: skill.radius,
      explosionRadius: skill.explosionRadius,
      explosionDamage: skill.damage,
      knockback: skill.knockback,
      damageType: skill.damageType
    }
  );
  room.bullets.push(fb);

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'FIREBALL',
    slot: 4,
    playerId: player.id,
    x: Math.round(mx),
    y: Math.round(my),
    angle: Number(angle.toFixed(2))
  });
}

function castArcaneTeleport(player, angle, room, targetPos, skill) {
  const fromX = player.x;
  const fromY = player.y;
  const clamped = clampCastTarget(player, angle, skill.maxDistance, targetPos);
  const blinkAngle = clamped.dist > 0.001 ? Math.atan2(clamped.y - fromY, clamped.x - fromX) : angle;

  const dest = resolveBlinkDestination(
    fromX,
    fromY,
    blinkAngle,
    clamped.dist,
    player.radius,
    room.map,
    room.barricades || []
  );

  // Origin arcane blast (zombies + barrels only; Barricade & ally safe)
  const zombies = room.zombies || [];
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    const dist = Math.hypot(z.x - fromX, z.y - fromY);
    if (dist <= skill.blastRadius + z.radius) {
      const knockAngle = dist > 0.001 ? Math.atan2(z.y - fromY, z.x - fromX) : blinkAngle;
      damageAndCreditZombie(player, z, skill.blastDamage, skill.damageType, room, {
        knockback: skill.knockback,
        knockAngle
      });
    }
  }
  detonateBarrelsInRadius(fromX, fromY, skill.blastRadius, skill.blastDamage, player.id, room);

  player.x = dest.x;
  player.y = dest.y;
  player.angle = blinkAngle;

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'ARCANE_TELEPORT',
    slot: 5,
    playerId: player.id,
    fromX: Math.round(fromX),
    fromY: Math.round(fromY),
    toX: Math.round(dest.x),
    toY: Math.round(dest.y),
    radius: skill.blastRadius
  });
}

function castSanctuaryHeal(player, angle, room, targetPos, skill) {
  const target = clampCastTarget(player, angle, skill.maxCastRange, targetPos);
  const bounded = room.map ? room.map.clampToBounds(target.x, target.y, 16) : target;

  room.groundZones = room.groundZones || [];
  room.groundZones.push({
    id: 'gz_sanc_' + Math.random().toString(36).substring(2, 8),
    type: 'sanctuary',
    ownerId: player.id,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    radius: skill.radius,
    healPerTick: skill.healPerSec * skill.healTickInterval,
    tickInterval: skill.healTickInterval,
    slowFactor: skill.zombieSlowFactor,
    slowRefresh: skill.zombieSlowRefresh,
    timer: skill.duration,
    tickTimer: 0
  });

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'SANCTUARY_HEAL',
    slot: 6,
    playerId: player.id,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    radius: skill.radius,
    duration: skill.duration
  });
}

function castManaShield(player, room, skill) {
  player.mageState.manaShieldTimer = skill.duration;
  player.mageState.manaShieldActive = true;

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'MANA_SHIELD',
    slot: 7,
    playerId: player.id,
    x: Math.round(player.x),
    y: Math.round(player.y),
    duration: skill.duration
  });
}

function castMeteorStorm(player, angle, room, targetPos, skill) {
  const target = clampCastTarget(player, angle, skill.maxCastRange, targetPos);
  const bounded = room.map ? room.map.clampToBounds(target.x, target.y, 24) : target;

  // Fixed deterministic spread + center hit over 3.0s
  const offsets = [
    { dx: 0, dy: 0 },
    { dx: 130, dy: -90 },
    { dx: -140, dy: 80 },
    { dx: 95, dy: 135 },
    { dx: -110, dy: -120 }
  ];
  const stepDelay = skill.duration / Math.max(1, skill.meteorCount - 1);
  const meteors = offsets.map((off, idx) => {
    const mx = bounded.x + off.dx;
    const my = bounded.y + off.dy;
    const clamped = room.map ? room.map.clampToBounds(mx, my, 16) : { x: mx, y: my };
    return {
      delay: Number((idx * stepDelay).toFixed(2)),
      x: Math.round(clamped.x),
      y: Math.round(clamped.y),
      fired: false
    };
  });

  room.pendingMeteors = room.pendingMeteors || [];
  room.pendingMeteors.push({
    id: 'ms_' + Math.random().toString(36).substring(2, 8),
    playerId: player.id,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    stormRadius: skill.stormRadius,
    impactRadius: skill.meteorImpactRadius,
    damage: skill.meteorDamage,
    knockback: skill.meteorKnockback,
    timer: 0,
    meteorsDone: 0,
    meteors
  });

  room.eventsBuffer.push({
    type: 'ULTIMATE',
    ultId: 'METEOR_STORM',
    playerId: player.id,
    character: player.character,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    radius: skill.stormRadius,
    duration: skill.duration
  });
}

/**
 * Triggers a Mage skill by slot (1..8).
 * @param {object} player
 * @param {number} slot
 * @param {number} angle
 * @param {object} room
 * @param {object|null} [targetPos=null]
 * @returns {{ activated: boolean, skillId?: string, reason?: string }}
 */
function triggerMageSkill(player, slot, angle, room, targetPos = null) {
  if (!player || player.character !== 'MAGE' || !player.mageState) {
    return { activated: false, reason: 'NOT_MAGE' };
  }
  if (player.isDead || player.isDowned) return { activated: false, reason: 'UNAVAILABLE' };
  if (!room || (room.state !== 'PLAYING' && room.state !== 'INTERMISSION')) {
    return { activated: false, reason: 'INVALID_STATE' };
  }
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > 8) {
    return { activated: false, reason: 'INVALID_SLOT' };
  }
  if (slot === 1) {
    const ok = executeMageArcaneBolt(player, room);
    return ok ? { activated: true, skillId: 'ARCANE_BOLT' } : { activated: false, reason: 'COOLDOWN_OR_MANA' };
  }

  const safeAngle = (typeof angle === 'number' && Number.isFinite(angle)) ? angle : player.angle;
  const skill = getMageSkillBySlot(slot);
  const skillState = skill ? player.mageState.skills[skill.id] : null;
  if (!skill || !skillState || !skillState.unlocked) {
    return { activated: false, reason: 'LOCKED' };
  }
  if (skillState.cooldown > 0) {
    return { activated: false, reason: 'ON_COOLDOWN' };
  }
  if (player.mana + 1e-6 < skill.manaCost) {
    return { activated: false, reason: 'NO_MANA' };
  }

  room.eventsBuffer = room.eventsBuffer || [];
  room.zombies = room.zombies || [];
  room.bullets = room.bullets || [];

  // Chain Lightning validates target availability before consuming Mana/CD
  if (slot === 3) {
    const hit = castChainLightning(player, safeAngle, room, targetPos, skill);
    if (!hit) return { activated: false, reason: 'NO_TARGET' };
    player.consumeMana(skill.manaCost);
    skillState.cooldown = skill.cooldown;
    return { activated: true, skillId: skill.id };
  }

  player.consumeMana(skill.manaCost);
  skillState.cooldown = skill.cooldown;

  if (slot === 2) castFrostNova(player, room, skill);
  else if (slot === 4) castFireball(player, safeAngle, room, skill);
  else if (slot === 5) castArcaneTeleport(player, safeAngle, room, targetPos, skill);
  else if (slot === 6) castSanctuaryHeal(player, safeAngle, room, targetPos, skill);
  else if (slot === 7) castManaShield(player, room, skill);
  else if (slot === 8) castMeteorStorm(player, safeAngle, room, targetPos, skill);

  return { activated: true, skillId: skill.id };
}

/**
 * Detonates Mage Fireball (zombies + barrels only) and creates a 3.0s burn_pool ground zone.
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {number} damage
 * @param {string|null} ownerId
 * @param {object} room
 */
function explodeMageFireball(x, y, radius, damage, ownerId, room) {
  if (!room) return;
  const skill = MAGE_SKILLS.FIREBALL;
  const owner = room.players instanceof Map ? room.players.get(ownerId) : null;

  room.eventsBuffer = room.eventsBuffer || [];
  room.eventsBuffer.push({
    type: 'EXPLOSION',
    x: Math.round(x),
    y: Math.round(y),
    radius: Math.round(radius),
    source: 'MAGE_FIREBALL'
  });

  const zombies = room.zombies || [];
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    const d = Math.hypot(z.x - x, z.y - y);
    if (d <= radius + z.radius) {
      const knockAngle = d > 0.001 ? Math.atan2(z.y - y, z.x - x) : 0;
      damageAndCreditZombie(owner, z, damage, 'FIRE', room, {
        knockback: skill.knockback,
        knockAngle
      });
    }
  }

  detonateBarrelsInRadius(x, y, radius, damage, ownerId, room);

  room.groundZones = room.groundZones || [];
  room.groundZones.push({
    id: 'gz_burn_' + Math.random().toString(36).substring(2, 8),
    type: 'burn_pool',
    ownerId,
    x: Math.round(x),
    y: Math.round(y),
    radius: skill.burnRadius,
    damagePerTick: skill.burnDamagePerSec * skill.burnTickInterval,
    tickInterval: skill.burnTickInterval,
    timer: skill.burnDuration,
    tickTimer: 0
  });
}

function spawnOrRefreshLavaPool(x, y, ownerId, room) {
  const skill = MAGE_SKILLS.METEOR_STORM;
  room.groundZones = room.groundZones || [];
  const existing = room.groundZones.find(gz => gz.type === 'lava_pool' && gz.ownerId === ownerId);
  if (existing) {
    existing.timer = Math.max(existing.timer, skill.lavaDuration);
    return;
  }
  room.groundZones.push({
    id: 'gz_lava_' + Math.random().toString(36).substring(2, 8),
    type: 'lava_pool',
    ownerId,
    x: Math.round(x),
    y: Math.round(y),
    radius: skill.lavaRadius,
    damagePerTick: skill.lavaDamagePerSec * skill.lavaTickInterval,
    tickInterval: skill.lavaTickInterval,
    slowFactor: skill.lavaSlowFactor,
    timer: skill.lavaDuration,
    tickTimer: 0
  });
}

function updateMageGroundZones(dt, room) {
  if (!Array.isArray(room.groundZones)) return;
  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);
  const ownerLookup = (id) => (room.players instanceof Map ? room.players.get(id) : playersList.find(p => p.id === id));

  for (let i = 0; i < playersList.length; i++) {
    if (playersList[i]) playersList[i].hasSanctuaryBuff = false;
  }

  for (let i = room.groundZones.length - 1; i >= 0; i--) {
    const zone = room.groundZones[i];
    zone.timer -= dt;
    const zombies = room.zombies || [];

    if (zone.type === 'sanctuary') {
      for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
        const z = zombies[zIdx];
        if (!z || z.isDead) continue;
        if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
          z.applySlow(zone.slowRefresh || 0.4, zone.slowFactor);
        }
      }
      for (let pIdx = 0; pIdx < playersList.length; pIdx++) {
        const p = playersList[pIdx];
        if (!p || p.isDead || p.isDowned) continue;
        if (Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius) {
          p.hasSanctuaryBuff = true;
        }
      }
      zone.tickTimer = (zone.tickTimer || 0) + dt;
      if (zone.tickTimer >= zone.tickInterval - 1e-6) {
        zone.tickTimer = 0;
        for (let pIdx = 0; pIdx < playersList.length; pIdx++) {
          const p = playersList[pIdx];
          if (!p || p.isDead || p.isDowned) continue;
          if (Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius) {
            p.heal(zone.healPerTick);
          }
        }
      }
    } else if (zone.type === 'burn_pool' || zone.type === 'lava_pool') {
      if (zone.slowFactor) {
        for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
          const z = zombies[zIdx];
          if (!z || z.isDead) continue;
          if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
            z.applySlow(0.4, zone.slowFactor);
          }
        }
      }
      zone.tickTimer = (zone.tickTimer || 0) + dt;
      if (zone.tickTimer >= zone.tickInterval - 1e-6) {
        zone.tickTimer = 0;
        const owner = ownerLookup(zone.ownerId);
        for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
          const z = zombies[zIdx];
          if (!z || z.isDead) continue;
          if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
            damageAndCreditZombie(owner, z, zone.damagePerTick, 'FIRE', room);
          }
        }
      }
    }

    if (zone.timer <= 0) {
      room.groundZones.splice(i, 1);
    }
  }
}

function updatePendingMeteors(dt, room) {
  if (!Array.isArray(room.pendingMeteors)) return;
  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);
  const ownerLookup = (id) => (room.players instanceof Map ? room.players.get(id) : playersList.find(p => p.id === id));

  for (let i = room.pendingMeteors.length - 1; i >= 0; i--) {
    const storm = room.pendingMeteors[i];
    storm.timer += dt;
    const owner = ownerLookup(storm.playerId);

    for (let mIdx = 0; mIdx < storm.meteors.length; mIdx++) {
      const m = storm.meteors[mIdx];
      if (m.fired || storm.timer < m.delay - 1e-6) continue;
      m.fired = true;
      storm.meteorsDone++;

      const zombies = room.zombies || [];
      for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
        const z = zombies[zIdx];
        if (!z || z.isDead) continue;
        const dist = Math.hypot(z.x - m.x, z.y - m.y);
        if (dist <= storm.impactRadius + z.radius) {
          const knockAngle = dist > 0.001 ? Math.atan2(z.y - m.y, z.x - m.x) : 0;
          damageAndCreditZombie(owner, z, storm.damage, 'FIRE', room, {
            knockback: storm.knockback,
            knockAngle
          });
        }
      }

      detonateBarrelsInRadius(m.x, m.y, storm.impactRadius, storm.damage, storm.playerId, room);
      spawnOrRefreshLavaPool(storm.x, storm.y, storm.playerId, room);

      if (Array.isArray(room.eventsBuffer)) {
        room.eventsBuffer.push({
          type: 'MAGE_SKILL',
          skillId: 'METEOR_IMPACT',
          slot: 8,
          playerId: storm.playerId,
          x: m.x,
          y: m.y,
          radius: storm.impactRadius
        });
      }
    }

    if (storm.meteorsDone >= storm.meteors.length) {
      room.pendingMeteors.splice(i, 1);
    }
  }
}

/**
 * Authoritative tick update for Mage groundZones and pending meteor impacts.
 * @param {number} dt
 * @param {object} room
 */
function updateMageRoomSystems(dt, room) {
  if (!room) return;
  updateMageGroundZones(dt, room);
  updatePendingMeteors(dt, room);

  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);
  for (let i = 0; i < playersList.length; i++) {
    const p = playersList[i];
    if (p && p.character === 'MAGE' && p.mageState && p.mageState.shieldJustBroken) {
      p.mageState.shieldJustBroken = false;
      if (Array.isArray(room.eventsBuffer)) {
        room.eventsBuffer.push({
          type: 'MAGE_SHIELD_BREAK',
          playerId: p.id,
          x: Math.round(p.x),
          y: Math.round(p.y)
        });
      }
    }
  }
}

module.exports = {
  maybeDropPickup,
  damageAndCreditZombie,
  executeMageArcaneBolt,
  triggerMageSkill,
  explodeMageFireball,
  updateMageRoomSystems,
  clampCastTarget,
  findChainPrimaryTarget
};
```

Now update `server/game/UltimateAbilities.js`:
- Require `triggerMageSkill` lazily inside `triggerPlayerUltimate` (to avoid circular require since `MageAbilities.js` imports `resolveBlinkDestination` from `UltimateAbilities.js`!).
- Remove `applyFrostNovaAt` and `executeBlinkFrostNova`.
- In `triggerPlayerUltimate(player, angle, room, targetPos = null)`:
```javascript
function triggerPlayerUltimate(player, angle, room, targetPos = null) {
  if (!player || player.isDead || player.isDowned) return { activated: false };
  if (room.state !== 'PLAYING' && room.state !== 'INTERMISSION') return { activated: false };

  if (player.character === 'MAGE') {
    const { triggerMageSkill } = require('./MageAbilities.js');
    return triggerMageSkill(player, 8, angle, room, targetPos);
  }

  if (player.ultCharge < player.ultMaxCharge) return { activated: false };

  const conf = getUltimateConfigForClass(player.character);
  player.ultCharge = 0;

  let event = null;
  if (conf.id === 'SEISMIC_SLAM') {
    event = executeSeismicSlam(player, conf, room);
  } else {
    event = executeTacticalDrone(player, conf, room);
  }

  room.eventsBuffer.push(event);
  return { activated: true, event };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mage_skills.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/game/MageAbilities.js server/game/UltimateAbilities.js tests/mage_skills.test.js
git commit -m "feat(mage): implement MageAbilities engine and delegate Mage ultimate to Meteor Storm"
```

---

### Task 5: Wire Mage Into `GameRoom.js` & `socketHandler.js` + Update `ultimates.test.js`

**Files:**
- Modify: `server/game/GameRoom.js:1-693`
- Modify: `server/socketHandler.js:236-245`
- Modify: `tests/ultimates.test.js:251-365`
- Modify: `tests/mage_skills.test.js`

**Interfaces:**
- Consumes in `GameRoom.js`: `executeMageArcaneBolt`, `triggerMageSkill`, `explodeMageFireball`, `updateMageRoomSystems`, `maybeDropPickup` from `MageAbilities.js`
- Produces in `GameRoom.js`:
  - `room.groundZones: Array<object>`, `room.pendingMeteors: Array<object>`
  - `room.handleSkill(socketId: string, payload: { slot?: number, angle?: number, targetX?: number, targetY?: number }) -> object`
  - `room.handleUltimate(socketId, payload)` forwards `targetPos: { x: payload.targetX, y: payload.targetY }`
  - `room.getSnapshot()` includes `groundZones` and `pendingMeteors` summary
- Produces in `socketHandler.js`:
  - Listener `socket.on('player:skill', (payload) => ...)` forwarding `{ slot, angle, targetX, targetY }` to `room.gameRoom.handleSkill(socket.id, safePayload)`

- [ ] **Step 1: Write failing E2E & integration tests for `GameRoom` + `socketHandler` Mage flow and update `tests/ultimates.test.js`**

Append to `tests/mage_skills.test.js`:

```javascript
const { io: ioClient } = require('socket.io-client');
const { GameRoom } = require('../server/game/GameRoom.js');
const { startServer } = require('../server/server.js');
const { socketHandler } = require('../server/socketHandler.js');

test('GameRoom: Mage shoot spawns arcane_bolt, mage_fireball spawns burn_pool, AMMO pickup restores +30 Mana & -1.5s CD, and WAVE_CLEAR restores 100% Mana', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_mage_room', 'Mage Room', mockIo);
  t.after(() => room.stop());

  const mage = room.addPlayer('m1', 'Merlin', 'MAGE');
  room.startGame();
  mage.x = 500;
  mage.y = 500;
  mage.angle = 0;

  // 1. Handle shoot spawns arcane_bolt
  room.handleShoot('m1');
  assert.strictEqual(mage.mana, 95);
  assert.strictEqual(room.bullets.length, 1);
  assert.strictEqual(room.bullets[0].type, 'arcane_bolt');

  // 2. Arcane bolt hits zombie with MAGIC damage (no bullet resistance on Mummy)
  const mummy = new Zombie('zm', 'MUMMY', 530, 500);
  room.zombies.push(mummy);
  room.tick(0.02);
  assert.strictEqual(mummy.hp, 105); // 140 - 35 full damage (not 0.7x bullet resistance)

  // 3. Fireball hit triggers explodeMageFireball -> spawns burn_pool
  mage.combo = 15;
  mage.maxCombo = 15;
  mage.mageState.skills.FIREBALL.unlocked = true;
  mage.fireCooldown = 0;
  const resFb = room.handleSkill('m1', { slot: 4, angle: 0 });
  assert.strictEqual(resFb.activated, true);
  room.tick(0.1);
  assert.ok(room.groundZones.some(gz => gz.type === 'burn_pool'));

  // 4. AMMO pickup restores +30 Mana and reduces skill cooldown by 1.5s
  mage.mana = 40;
  mage.mageState.skills.FIREBALL.cooldown = 4.0;
  room.pickups.push({ id: 'pk1', type: 'AMMO', x: mage.x, y: mage.y, life: 10 });
  room.tick(0.02);
  assert.ok(mage.mana >= 70 && mage.mana < 71);
  assert.ok(mage.mageState.skills.FIREBALL.cooldown <= 2.5);

  // 5. WAVE_CLEAR restores 100% Mana
  mage.mana = 20;
  room.zombies = [];
  room.zombiesSpawnedInWave = room.waveTotalZombies;
  room.tick(0.02);
  assert.strictEqual(room.state, 'INTERMISSION');
  assert.strictEqual(mage.mana, 100);
});

test('E2E Socket: player:skill & player:ultimate synchronize Mage groundZones and Mana Shield over Socket.IO', async (t) => {
  // 1. Unit socketHandler check
  const handlers = {};
  const mockSocket = {
    id: 'sock_m1',
    emit: () => {},
    join: () => {},
    leave: () => {},
    on: (ev, fn) => { handlers[ev] = fn; }
  };
  let connectionCb = null;
  const mockIo = {
    on: (ev, fn) => { if (ev === 'connection') connectionCb = fn; },
    to: () => ({ emit: () => {} }),
    emit: () => {}
  };
  const { rooms } = socketHandler(mockIo);
  connectionCb(mockSocket);

  let createdRoomId = null;
  handlers['room:create']({ roomName: 'MageSock', playerName: 'Merlin', character: 'MAGE' }, (res) => {
    createdRoomId = res.room.id;
  });
  const createdRoom = rooms.get(createdRoomId);
  t.after(() => createdRoom.gameRoom.stop());
  handlers['room:start']();

  const gp = createdRoom.gameRoom.players.get('sock_m1');
  gp.x = 500;
  gp.y = 500;
  gp.mageState.skills.ARCANE_TELEPORT.unlocked = true;
  gp.mageState.skills.METEOR_STORM.unlocked = true;

  // Cast [5] Teleport via player:skill
  handlers['player:skill']({ slot: 5, angle: 0, targetX: 700, targetY: 500 });
  assert.strictEqual(gp.x, 700);
  assert.strictEqual(gp.mana, 75);

  // Cast [8] Meteor Storm via player:ultimate after regenerating mana
  gp.mana = 100;
  handlers['player:ultimate']({ angle: 0, targetX: 850, targetY: 500 });
  assert.strictEqual(gp.mana, 0);
  assert.strictEqual(createdRoom.gameRoom.pendingMeteors.length, 1);

  // 2. Real TCP Socket.IO snapshot check
  const { server, port } = await startServer(0);
  t.after(() => server.close());

  const socket = ioClient(`http://localhost:${port}`, { reconnection: false });
  await new Promise((resolve) => socket.on('connect', resolve));
  t.after(() => socket.disconnect());

  await new Promise((resolve) => {
    socket.emit('room:create', { roomName: 'MageLive', playerName: 'Merlin', character: 'MAGE' }, resolve);
  });
  await new Promise((resolve) => {
    socket.once('room:gameStarted', resolve);
    socket.emit('room:start');
  });

  const snap = await new Promise((resolve) => socket.once('game:snapshot', resolve));
  assert.strictEqual(snap.players[0].mana, 100);
  assert.strictEqual(snap.players[0].maxMana, 100);
  assert.strictEqual(snap.players[0].ultimateId, 'METEOR_STORM');
  assert.ok(Array.isArray(snap.groundZones));
  assert.ok(Array.isArray(snap.pendingMeteors));
});
```

Also update `tests/ultimates.test.js` lines 251–272 and 325–354:
- Replace `'GameRoom: Mage Blink & Frost Nova freezes at both origin and destination'` with `'GameRoom: Mage Meteor Storm ultimate casts at cursor when unlocked (x50) and spawns lava_pool'`.
- In `'E2E Socket: client emits player:ultimate through socketHandler and updates snapshot'`, test `player:ultimate` with `MAGE` having `METEOR_STORM` unlocked and `mana = 100` (and assert `firstSnap.players[0].ultimateId === 'METEOR_STORM'`), while keeping `resolveBlinkDestination` test intact.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mage_skills.test.js tests/ultimates.test.js`
Expected: FAIL (`room.handleSkill is not a function`, `groundZones` missing in snapshot)

- [ ] **Step 3: Update `server/game/GameRoom.js` and `server/socketHandler.js`**

In `server/game/GameRoom.js`:
1. Import Mage helpers at top (line 9):
```javascript
const { MAGE_MANA_CONFIG } = require('./MageSkillsConfig.js');
const {
  executeMageArcaneBolt,
  triggerMageSkill,
  explodeMageFireball,
  updateMageRoomSystems,
  maybeDropPickup
} = require('./MageAbilities.js');
```
2. In `constructor` (after `this.drones = []`, line 24):
```javascript
    this.groundZones = [];
    this.pendingMeteors = [];
```
3. In `startGame()` (lines 73–106):
- Clear `this.groundZones = [];` and `this.pendingMeteors = [];`.
- When resetting players:
```javascript
      if (p.character === 'MAGE') {
        p.resetMageState();
      } else {
        p.selectedWeapon = 'PISTOL';
        p.hasSanctuaryBuff = false;
      }
```
4. In `handleShoot(socketId)` (line 158):
```javascript
    if (player.character === 'MAGE') {
      executeMageArcaneBolt(player, this);
      return;
    }
```
5. In `handleUltimate(socketId, payload = {})` (line 288):
```javascript
  handleUltimate(socketId, payload = {}) {
    const player = this.players.get(socketId);
    if (!player) return { activated: false };
    const safePayload = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    const angle = typeof safePayload.angle === 'number' && Number.isFinite(safePayload.angle)
      ? safePayload.angle
      : player.angle;
    const targetPos = (typeof safePayload.targetX === 'number' && Number.isFinite(safePayload.targetX) &&
      typeof safePayload.targetY === 'number' && Number.isFinite(safePayload.targetY))
      ? { x: safePayload.targetX, y: safePayload.targetY }
      : null;
    return triggerPlayerUltimate(player, angle, this, targetPos);
  }

  /**
   * Handles active skill cast request for Mage (slots 1..8).
   * @param {string} socketId
   * @param {object} [payload={}]
   * @returns {object}
   */
  handleSkill(socketId, payload = {}) {
    const player = this.players.get(socketId);
    if (!player || player.character !== 'MAGE') {
      return { activated: false };
    }
    if (this.state !== 'PLAYING' && this.state !== 'INTERMISSION') {
      return { activated: false };
    }
    const safePayload = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    const slot = safePayload.slot;
    const angle = (typeof safePayload.angle === 'number' && Number.isFinite(safePayload.angle))
      ? safePayload.angle
      : player.angle;
    const targetPos = (typeof safePayload.targetX === 'number' && Number.isFinite(safePayload.targetX) &&
      typeof safePayload.targetY === 'number' && Number.isFinite(safePayload.targetY))
      ? { x: safePayload.targetX, y: safePayload.targetY }
      : null;
    return triggerMageSkill(player, slot, angle, this, targetPos);
  }
```
6. In `triggerExplosion`: reuse `maybeDropPickup(this, z)` when `z.isDead`!
7. In `tick(dt)`:
- On `WAVE_CLEAR` (lines 446–453):
```javascript
        for (const p of playersArr) {
          if (p.isDowned && !p.isDead) {
            p.isDowned = false;
            p.hp = 50;
          }
          if (!p.isDead && p.character === 'MAGE') {
            p.restoreMana(p.maxMana * MAGE_MANA_CONFIG.WAVE_CLEAR_RESTORE_RATIO);
          }
        }
```
- In bullet loop:
  - Line 465 (`const explosion = b.update(dt, this.map)`): if `explosion` and `b.isMageFireball`, call `explodeMageFireball(explosion.x, explosion.y, explosion.radius, explosion.damage, explosion.ownerId, this);`, else call `this.triggerExplosion(...)`.
  - Line 491 (`if (b.checkHit(z))` for player bullets):
    - If `b.isMageFireball`: mark `b.isDead = true`, call `explodeMageFireball(b.x, b.y, b.explosionRadius, b.explosionDamage, b.ownerId, this)`, and `break`!
    - Else: call `z.takeDamage(b.damage, b.damageType || 'BULLET')`, pass `!b.fromUlt && shooter?.character !== 'MAGE'` for `ultCharge`, and replace inline `if (Math.random() < 0.15)` pickup drop with `maybeDropPickup(this, z)`.
  - On barrel hit (`if (hit)` at line 555): if `b.isMageFireball`, call `explodeMageFireball(b.x, b.y, b.explosionRadius, b.explosionDamage, b.ownerId, this)`.
- Right after barrel contact cleanup (line 622): call `updateMageRoomSystems(dt, this);`.
- On `AMMO` pickup (lines 638–646):
```javascript
          } else {
            if (player.character === 'MAGE') {
              player.applyMageAmmoPickup();
            } else {
              // Restore ammo to current weapon & others
              for (const key of Object.keys(player.weapons)) {
                if (player.weapons[key].unlocked) {
                  const conf = WEAPONS[key];
                  player.addAmmo(key, Math.ceil(conf.startingAmmo * 0.75));
                }
              }
            }
          }
```
8. In `getSnapshot()` (lines 674–676): add:
```javascript
      groundZones: (this.groundZones || []).map(gz => ({
        id: gz.id,
        type: gz.type,
        ownerId: gz.ownerId,
        x: Math.round(gz.x),
        y: Math.round(gz.y),
        radius: gz.radius,
        timer: Number(gz.timer.toFixed(2))
      })),
      pendingMeteors: (this.pendingMeteors || []).map(pm => ({
        id: pm.id,
        x: pm.x,
        y: pm.y,
        stormRadius: pm.stormRadius,
        impactRadius: pm.impactRadius,
        timer: Number(pm.timer.toFixed(2)),
        meteors: pm.meteors.map(m => ({ delay: m.delay, x: m.x, y: m.y, fired: m.fired }))
      })),
```

In `server/socketHandler.js` right after `socket.on('player:ultimate', ...)` (line 243):
```javascript
    socket.on('player:skill', (payload) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.gameRoom) {
        const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        room.gameRoom.handleSkill(socket.id, safePayload);
      }
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mage_skills.test.js tests/ultimates.test.js tests/game_room.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/game/GameRoom.js server/socketHandler.js tests/mage_skills.test.js tests/ultimates.test.js
git commit -m "feat(mage): wire Mage combat, groundZones, pendingMeteors, and 18% AMMO drops into GameRoom & socketHandler"
```

---

### Task 6: Client Controls, World Cursor Targeting & Event Routing (`input.js`, `main.js`)

**Files:**
- Modify: `client/js/input.js:1-169`
- Modify: `client/js/main.js:50-440`
- Create: `tests/mage_client.test.js`

**Interfaces:**
- Produces in `client/js/input.js`:
  - `input.isMageMode: boolean`
  - `input.onSkillCast: (slot: number, angle: number, targetX: number, targetY: number) => void`
  - `input.updateWorldMouse(cameraX: number, cameraY: number, zoom?: number) -> void` (`worldX = cameraX + (screenX - innerWidth / 2) / zoom`, `worldY = cameraY + (screenY - innerHeight / 2) / zoom`)
  - Holding `[1]`, `LMB`, or `Space` sets `keys.shoot = true` in Mage mode; releasing stops shooting; keys `[2]..[8]` trigger `onSkillCast` once per press (`!e.repeat`); wheel does not switch Mage weapon slot; exports `{ InputHandler }` via CommonJS when `module.exports` exists.
- Updates in `client/js/main.js`:
  - Syncs `input.isMageMode = (localPlayer.character === 'MAGE')` and `ui.setWeaponsBarMode(localPlayer.character === 'MAGE' ? 'MAGE' : 'GUN')`.
  - Updates `input.updateWorldMouse(renderer.camera.x, renderer.camera.y, 1.15)` each frame / cast.
  - Emits `player:skill` with `{ slot, angle, targetX, targetY }` and `player:ultimate` with `{ angle, targetX, targetY }`.
  - Routes `MAGE_SKILL`, `MAGE_SHIELD_BREAK`, and `METEOR_STORM` events to `renderer.spawnMageVfx(ev)` and `soundManager.playMageSkill(ev)`.

- [ ] **Step 1: Write failing tests for `InputHandler` Mage mode and `handleGameEvent` routing**

Create `tests/mage_client.test.js` with minimal DOM/Window shim:

```javascript
/**
 * @file mage_client.test.js
 * @description Unit tests for Mage client input handling, HUD/Mana bar rendering, Canvas VFX, and WebAudio SFX.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function createMockElement(id = '', tagName = 'div') {
  const listeners = {};
  const classes = new Set();
  const attributes = {};
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    style: {},
    children: [],
    parentElement: null,
    listeners,
    _textContent: '',
    _innerHTML: '',
    get className() { return Array.from(classes).join(' '); },
    set className(val) {
      classes.clear();
      if (val) val.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
    classList: {
      add: (...t) => t.forEach(x => classes.add(x)),
      remove: (...t) => t.forEach(x => classes.delete(x)),
      contains: (x) => classes.has(x)
    },
    get textContent() { return el._textContent; },
    set textContent(val) { el._textContent = String(val); el.children = []; },
    get innerHTML() {
      if (el.children.length > 0) {
        return el.children.map(c => `<${c.tagName.toLowerCase()} id="${c.id}" class="${c.className}">${c.innerHTML}</${c.tagName.toLowerCase()}>`).join('');
      }
      return el._innerHTML || '';
    },
    set innerHTML(val) {
      el._innerHTML = String(val);
      el.children = [];
      const idRegex = /<([a-zA-Z0-9]+)[^>]*id=["']([^"']+)["'][^>]*>/g;
      let m;
      while ((m = idRegex.exec(val)) !== null) {
        const child = createMockElement(m[2], m[1]);
        child.parentElement = el;
        el.children.push(child);
        if (global.document && global.document._elements) {
          global.document._elements[m[2]] = child;
        }
      }
    },
    appendChild(child) {
      child.parentElement = el;
      el.children.push(child);
      if (child.id && global.document && global.document._elements) {
        global.document._elements[child.id] = child;
      }
      return child;
    },
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return attributes[k] || null; },
    addEventListener(ev, fn) {
      if (!listeners[ev]) listeners[ev] = [];
      listeners[ev].push(fn);
    },
    querySelectorAll(sel) {
      const res = [];
      const walk = (n) => {
        for (const c of n.children) {
          if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) res.push(c);
          walk(c);
        }
      };
      walk(el);
      return res;
    }
  };
  if (tagName.toUpperCase() === 'CANVAS') {
    el.width = 1600;
    el.height = 1200;
    el.getContext = () => createMockCtx(el);
  }
  return el;
}

function createMockCtx(canvas = { width: 1600, height: 1200 }) {
  const calls = [];
  const ctx = {
    calls,
    canvas,
    save: () => calls.push({ op: 'save' }),
    restore: () => calls.push({ op: 'restore' }),
    translate: (x, y) => calls.push({ op: 'translate', x, y }),
    rotate: (a) => calls.push({ op: 'rotate', a }),
    scale: (sx, sy) => calls.push({ op: 'scale', sx, sy }),
    beginPath: () => calls.push({ op: 'beginPath' }),
    closePath: () => calls.push({ op: 'closePath' }),
    arc: (...args) => calls.push({ op: 'arc', args }),
    ellipse: (...args) => calls.push({ op: 'ellipse', args }),
    moveTo: (x, y) => calls.push({ op: 'moveTo', x, y }),
    lineTo: (x, y) => calls.push({ op: 'lineTo', x, y }),
    stroke: () => calls.push({ op: 'stroke' }),
    fill: () => calls.push({ op: 'fill' }),
    fillRect: (x, y, w, h) => calls.push({ op: 'fillRect', x, y, w, h, fillStyle: ctx.fillStyle }),
    strokeRect: (x, y, w, h) => calls.push({ op: 'strokeRect', x, y, w, h }),
    clearRect: (x, y, w, h) => calls.push({ op: 'clearRect', x, y, w, h }),
    fillText: (text, x, y) => calls.push({ op: 'fillText', text, x, y }),
    strokeText: (text, x, y) => calls.push({ op: 'strokeText', text, x, y }),
    drawImage: (...args) => calls.push({ op: 'drawImage', args }),
    setLineDash: (d) => calls.push({ op: 'setLineDash', d }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
  return ctx;
}

function setupMockEnv() {
  const elements = {};
  const winListeners = {};
  const getOrCreate = (id, tag = 'div') => (elements[id] ||= createMockElement(id, tag));

  [
    'screen-lobby', 'screen-room', 'hud', 'modal-gameover', 'modal-pause', 'modal-map-preview',
    'copy-toast', 'lan-ip-display', 'nickname-input', 'room-name-input', 'rooms-list-body',
    'map-selection-grid', 'selected-map-name-label', 'room-map-banner', 'room-map-thumb-canvas',
    'room-map-badge', 'room-map-name', 'room-map-subtitle', 'room-map-desc', 'btn-change-map',
    'btn-preview-current-map', 'preview-modal-canvas', 'preview-modal-badge', 'preview-modal-title',
    'preview-modal-subtitle', 'preview-modal-desc', 'btn-close-map-preview', 'btn-select-this-map',
    'btn-create-room', 'btn-leave-room', 'btn-copy-room', 'btn-ready', 'btn-start-game',
    'btn-sound-toggle', 'btn-restart-game', 'btn-back-lobby', 'btn-resume-game', 'btn-pause-copy',
    'btn-pause-sound', 'btn-pause-leave', 'room-title', 'player-slots-container', 'hud-team-list',
    'hud-wave-title', 'hud-wave-sub', 'hud-combo-text', 'hud-combo-fill', 'hud-weapons-bar',
    'hud-ult-container', 'hud-ult-name', 'hud-ult-status', 'hud-ult-fill', 'hud-ult-hint',
    'go-wave-reached', 'go-total-score', 'go-best-combo'
  ].forEach(id => getOrCreate(id));

  const mockDocument = {
    _elements: elements,
    getElementById: (id) => getOrCreate(id),
    createElement: (tag) => createMockElement('', tag),
    querySelectorAll: () => []
  };

  const mockWindow = {
    innerWidth: 1600,
    innerHeight: 900,
    location: { origin: 'http://localhost:3000' },
    document: mockDocument,
    addEventListener: (ev, fn) => { (winListeners[ev] ||= []).push(fn); },
    dispatchEvent: (ev) => { (winListeners[ev.type] || []).forEach(fn => fn(ev)); }
  };

  global.window = mockWindow;
  global.document = mockDocument;
  global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ lanIp: '127.0.0.1', port: 3000 }) });
  return { elements, mockWindow };
}

test('InputHandler Mage mode casts skills 2-8 instantly with world cursor coordinates and holds [1] to shoot', () => {
  const { mockWindow } = setupMockEnv();
  delete require.cache[require.resolve('../client/js/input.js')];
  const { InputHandler } = require('../client/js/input.js');

  const canvas = createMockElement('gameCanvas', 'canvas');
  const input = new InputHandler(canvas);
  input.isMageMode = true;

  const casts = [];
  input.onSkillCast = (slot, angle, tx, ty) => casts.push({ slot, angle, tx, ty });

  // Move mouse 115px right of screen center -> at 1.15x zoom, worldX = cameraX + 100
  mockWindow.dispatchEvent({ type: 'mousemove', clientX: 800 + 115, clientY: 450 });
  input.updateWorldMouse(500, 600, 1.15);
  assert.strictEqual(Math.round(input.mouse.worldX), 600);
  assert.strictEqual(Math.round(input.mouse.worldY), 600);

  // Key '1' holds shoot
  mockWindow.dispatchEvent({ type: 'keydown', key: '1', code: 'Digit1', repeat: false });
  assert.strictEqual(input.keys.shoot, true);
  mockWindow.dispatchEvent({ type: 'keyup', key: '1', code: 'Digit1' });
  assert.strictEqual(input.keys.shoot, false);

  // Key '5' triggers instant cast with targetX/targetY (ignored on repeat)
  mockWindow.dispatchEvent({ type: 'keydown', key: '5', code: 'Digit5', repeat: false });
  mockWindow.dispatchEvent({ type: 'keydown', key: '5', code: 'Digit5', repeat: true });
  assert.strictEqual(casts.length, 1);
  assert.strictEqual(casts[0].slot, 5);
  assert.strictEqual(Math.round(casts[0].tx), 600);

  // Mouse wheel does not change Mage slot away from 1
  mockWindow.dispatchEvent({ type: 'wheel', deltaY: 100 });
  assert.strictEqual(input.selectedWeaponSlot, 1);
});

test('main.js handleGameEvent routes MAGE_SKILL, MAGE_SHIELD_BREAK, and METEOR_STORM to renderer and soundManager', () => {
  setupMockEnv();
  delete require.cache[require.resolve('../client/js/main.js')];
  const { handleGameEvent } = require('../client/js/main.js');

  const vfxEvents = [];
  const sfxEvents = [];
  const texts = [];
  const mockRnd = {
    camera: { x: 500, y: 500 },
    spawnMageVfx: (ev) => vfxEvents.push(ev),
    addFloatingText: (t) => texts.push(t)
  };
  const mockSnd = {
    playMageSkill: (ev) => sfxEvents.push(ev),
    playUltimate: (id) => sfxEvents.push({ type: 'ULT', id })
  };

  handleGameEvent({ type: 'MAGE_SKILL', skillId: 'CHAIN_LIGHTNING', x: 500, y: 500, links: [] }, {}, { renderer: mockRnd, soundManager: mockSnd });
  handleGameEvent({ type: 'MAGE_SHIELD_BREAK', x: 500, y: 500 }, {}, { renderer: mockRnd, soundManager: mockSnd });
  handleGameEvent({ type: 'ULTIMATE', ultId: 'METEOR_STORM', x: 600, y: 600, radius: 300 }, {}, { renderer: mockRnd, soundManager: mockSnd });

  assert.strictEqual(vfxEvents.length, 3);
  assert.strictEqual(sfxEvents.length, 3);
  assert.ok(texts.some(t => t.includes('METEOR STORM')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_client.test.js`
Expected: FAIL (`InputHandler` is undefined / `isMageMode` missing)

- [ ] **Step 3: Update `client/js/input.js` and `client/js/main.js`**

In `client/js/input.js`:
1. Guard `window` references in `constructor` and `setupListeners()` with `typeof window !== 'undefined'`.
2. Add `this.isMageMode = false;`, `this.onSkillCast = null;`, and `updateWorldMouse(cameraX, cameraY, zoom = 1.15)`:
```javascript
  updateWorldMouse(cameraX, cameraY, zoom = 1.15) {
    if (typeof window === 'undefined') return;
    if (typeof cameraX !== 'number' || typeof cameraY !== 'number') return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const scale = zoom > 0 ? zoom : 1;
    this.mouse.worldX = cameraX + (this.mouse.screenX - cx) / scale;
    this.mouse.worldY = cameraY + (this.mouse.screenY - cy) / scale;
  }
```
3. In `keydown`:
- If `this.isMageMode`:
  - `if (num === 1 || e.code === 'Space') { this.keys.shoot = true; }`
  - `if (num >= 2 && num <= 8 && !e.repeat && typeof this.onSkillCast === 'function') { this.onSkillCast(num, this.mouse.angle, this.mouse.worldX, this.mouse.worldY); }`
  - For `k === 'f' && !e.repeat`: pass `(this.mouse.angle, this.mouse.worldX, this.mouse.worldY)` to `this.onUltimate(...)`.
- In `keyup`: if `this.isMageMode && e.key === '1'`, set `this.keys.shoot = false`.
- In `mousedown` button `2`: pass `(this.mouse.angle, this.mouse.worldX, this.mouse.worldY)` to `this.onUltimate(...)`.
- In `wheel`: if `this.isMageMode`, `return;` immediately (keep slot 1 `ARCANE_BOLT` selected).
4. In `setWeaponSlot(slot, silent)`: if `this.isMageMode`, pin `selectedWeaponSlot = 1` and `selectedWeaponId = 'ARCANE_BOLT'`.
5. At bottom of `client/js/input.js`:
```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InputHandler };
}
if (typeof window !== 'undefined') {
  window.InputHandler = InputHandler;
}
```

In `client/js/main.js`:
1. In `trySwitchWeapon(slotIndex, weaponId)` (line 61): if `input && input.isMageMode`:
   - If `slotIndex >= 2 && slotIndex <= 8` and game is active/unpaused: sync `input.updateWorldMouse(renderer.camera.x, renderer.camera.y, 1.15)` and emit `socket.emit('player:skill', { slot: slotIndex, angle: input.mouse.angle, targetX: input.mouse.worldX, targetY: input.mouse.worldY })`; return!
   - If `slotIndex === 1`, return (basic attack).
2. Hook `input.onSkillCast`:
```javascript
    input.onSkillCast = (slot, angle, targetX, targetY) => {
      const isPaused = ui && ui.modalPause && !ui.modalPause.classList.contains('hidden');
      const isGameOver = ui && ui.modalGameOver && !ui.modalGameOver.classList.contains('hidden');
      if (isInGame && !isPaused && !isGameOver && socket) {
        if (renderer && renderer.camera && typeof input.updateWorldMouse === 'function') {
          input.updateWorldMouse(renderer.camera.x, renderer.camera.y, 1.15);
          targetX = input.mouse.worldX;
          targetY = input.mouse.worldY;
        }
        socket.emit('player:skill', { slot, angle, targetX, targetY });
      }
    };
```
3. Update `input.onUltimate`:
```javascript
    input.onUltimate = (angle, targetX, targetY) => {
      if (!isInGame) return;
      if (ui && ui.modalPause && !ui.modalPause.classList.contains('hidden')) return;
      if (ui && ui.modalGameOver && !ui.modalGameOver.classList.contains('hidden')) return;
      if (renderer && renderer.camera && typeof input.updateWorldMouse === 'function') {
        input.updateWorldMouse(renderer.camera.x, renderer.camera.y, 1.15);
        targetX = input.mouse.worldX;
        targetY = input.mouse.worldY;
      }
      socket.emit('player:ultimate', { angle, targetX, targetY });
    };
```
4. In `socket.on('game:snapshot', ...)` (line 299): detect `const isMage = localPlayer.character === 'MAGE';`, update `input.isMageMode` and call `ui.setWeaponsBarMode(isMage ? 'MAGE' : 'GUN')`, and skip `WEAPON_KEYS` reset if `isMage`.
5. In `handleUltimateEvent` (line 334): add `else if (ev.ultId === 'METEOR_STORM')`:
```javascript
    } else if (ev.ultId === 'METEOR_STORM') {
      if (typeof rnd.spawnMageVfx === 'function') {
        rnd.spawnMageVfx(ev);
      }
      if (typeof rnd.addFloatingText === 'function') {
        rnd.addFloatingText('METEOR STORM!', ev.x, ev.y - 35, '#ff5722', 30);
      }
    }
```
6. In `handleGameEvent` (line 404): handle `ev.type === 'MAGE_SKILL' || ev.type === 'MAGE_SHIELD_BREAK'`:
```javascript
    } else if (ev.type === 'MAGE_SKILL' || ev.type === 'MAGE_SHIELD_BREAK') {
      if (rnd && typeof rnd.spawnMageVfx === 'function') rnd.spawnMageVfx(ev);
      if (snd && typeof snd.playMageSkill === 'function') snd.playMageSkill(ev, listenerX, listenerY);
      if (ev.type === 'MAGE_SHIELD_BREAK' && rnd && typeof rnd.addFloatingText === 'function') {
        rnd.addFloatingText('SHIELD BROKEN!', ev.x, ev.y - 36, '#80d8ff', 22);
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mage_client.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/js/input.js client/js/main.js tests/mage_client.test.js
git commit -m "feat(mage): add Mage cursor-targeted skill input and event routing on client"
```

---

### Task 7: Client Lobby Card & Mage Mana/Skill HUD (`index.html`, `style.css`, `ui.js`)

**Files:**
- Modify: `client/index.html:127-131`
- Modify: `client/css/style.css:470-615`
- Modify: `client/js/ui.js:74-106,502-525,670-812`
- Modify: `tests/mage_client.test.js`

**Interfaces:**
- Produces in `client/js/ui.js`:
  - `MAGE_SKILL_DEFINITIONS`: Array of 8 skill HUD descriptors (`{ id, key, name, unlockCombo, manaCost, icon }`)
  - `ui.setWeaponsBarMode(mode: 'GUN' | 'MAGE') -> void`
  - `ui.updateHUD(gameState, localPlayerId)` renders:
    - Team Roster Mana bar (`.teammate-mana-bar` / `.teammate-mana-fill`) and `MP` stat when `p.maxMana > 0`
    - Mage 8-slot skill bar showing Mana cost (`5 MP`..`100 MP`), cooldown overlay (`#hud-cd-<id>`), `.no-mana` dimming when `mana < cost`, and `.locked` (`x<combo> 🔒`)
    - Bottom `#hud-ult-container` transformed into **NĂNG LƯỢNG PHÁP SƯ (MANA)** (`0 / 100 MP` + `+5/s`) with `.mana-mode` styling for Mage
  - Exports `{ UIController, MAGE_SKILL_DEFINITIONS }` via CommonJS when `module.exports` exists.

- [ ] **Step 1: Write failing tests for Mage UI HUD & Team Roster Mana bar**

Append to `tests/mage_client.test.js`:

```javascript
test('UIController switches to MAGE skill bar, displays cooldowns/mana costs, and renders Mana bar in Team Roster', () => {
  const { elements } = setupMockEnv();
  delete require.cache[require.resolve('../client/js/ui.js')];
  const { UIController, MAGE_SKILL_DEFINITIONS } = require('../client/js/ui.js');

  assert.strictEqual(MAGE_SKILL_DEFINITIONS.length, 8);
  const ui = new UIController();

  const state = {
    state: 'PLAYING',
    wave: 2,
    zombiesLeft: 10,
    players: [
      {
        id: 'm1',
        name: 'Merlin',
        character: 'MAGE',
        hp: 70,
        maxHp: 85,
        mana: 25,
        maxMana: 100,
        combo: 12,
        maxCombo: 12,
        comboTimer: 2,
        comboMaxTime: 3,
        selectedWeapon: 'ARCANE_BOLT',
        mageState: {
          manaShieldActive: false,
          skills: {
            ARCANE_BOLT: { id: 'ARCANE_BOLT', slot: 1, unlocked: true, manaCost: 5, cooldown: 0 },
            FROST_NOVA: { id: 'FROST_NOVA', slot: 2, unlocked: true, manaCost: 20, cooldown: 3.2 },
            CHAIN_LIGHTNING: { id: 'CHAIN_LIGHTNING', slot: 3, unlocked: true, manaCost: 30, cooldown: 0 },
            FIREBALL: { id: 'FIREBALL', slot: 4, unlocked: false, manaCost: 35, cooldown: 0 },
            ARCANE_TELEPORT: { id: 'ARCANE_TELEPORT', slot: 5, unlocked: false, manaCost: 25, cooldown: 0 },
            SANCTUARY_HEAL: { id: 'SANCTUARY_HEAL', slot: 6, unlocked: false, manaCost: 35, cooldown: 0 },
            MANA_SHIELD: { id: 'MANA_SHIELD', slot: 7, unlocked: false, manaCost: 15, cooldown: 0 },
            METEOR_STORM: { id: 'METEOR_STORM', slot: 8, unlocked: false, manaCost: 100, cooldown: 0 }
          }
        }
      }
    ]
  };

  ui.updateHUD(state, 'm1');

  assert.strictEqual(ui.hudBarMode, 'MAGE');
  assert.ok(elements['hud-team-list'].innerHTML.includes('teammate-mana-bar'));
  assert.ok(elements['hud-team-list'].innerHTML.includes('25 MP'));
  assert.strictEqual(elements['hud-ult-status'].textContent, '25 / 100 MP');
  assert.strictEqual(elements['hud-cd-FROST_NOVA'].classList.contains('hidden'), false);
  assert.strictEqual(elements['hud-cd-FROST_NOVA'].textContent, '3.2s');
  // Chain Lightning costs 30 Mana > 25 current -> flagged no-mana
  assert.strictEqual(elements['hud-weapon-CHAIN_LIGHTNING'].classList.contains('no-mana'), true);
  assert.strictEqual(elements['hud-weapon-FIREBALL'].classList.contains('locked'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_client.test.js`
Expected: FAIL (`MAGE_SKILL_DEFINITIONS` is undefined)

- [ ] **Step 3: Update `client/index.html`, `client/css/style.css`, and `client/js/ui.js`**

In `client/index.html` lines 127–131:
```html
          <button class="char-btn char-MAGE" data-char="MAGE">
            <span class="char-btn-title">🔮 MAGE</span>
            <span class="char-passive">85 HP &bull; 100 Mana (+5/s) &bull; Phép 1–8</span>
            <span class="char-ult-desc">☄️ Tuyệt Kỹ: Thiên Thạch Hủy Diệt</span>
          </button>
```

In `client/css/style.css`:
- After `.teammate-hp-fill` (line 482):
```css
.teammate-mana-bar {
  width: 100%;
  height: 4px;
  background: #171a2b;
  border-radius: 2px;
  overflow: hidden;
}

.teammate-mana-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #a855f7);
  box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
  transition: width 0.2s;
}
```
- After `.weapon-ammo` (line 608):
```css
/* Mage Skill Bar, Mana Gauge & Cooldown Overlays */
.weapon-slot.mage-slot {
  background: #141728;
  border-color: #323c69;
}

.weapon-slot.mage-slot.active {
  border-color: #38bdf8;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.65);
  transform: translateY(-4px);
}

.weapon-slot.mage-slot.no-mana:not(.locked) {
  border-color: #7e22ce;
  opacity: 0.65;
}

.skill-cooldown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 12, 18, 0.82);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Impact, monospace, sans-serif;
  font-size: 1.05rem;
  color: #80d8ff;
  pointer-events: none;
  z-index: 5;
}

.skill-cooldown-overlay.hidden {
  display: none !important;
}

.hud-ultimate.mana-mode {
  border-color: #38bdf8;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.35);
}

.hud-ultimate.mana-mode .hud-ult-fill {
  background: linear-gradient(90deg, #2563eb, #a855f7);
}
```

In `client/js/ui.js`:
1. Define `MAGE_SKILL_DEFINITIONS` at top of file, add `hudBarMode = 'GUN'`, `mageSkillDefinitions`, update `ultimateMeta.MAGE`, and replace `initWeaponsBar()` with `setWeaponsBarMode(mode)`:
```javascript
const MAGE_SKILL_DEFINITIONS = [
  { id: 'ARCANE_BOLT', key: 1, name: 'Tia Ma Pháp', unlockCombo: 1, manaCost: 5, icon: '✨' },
  { id: 'FROST_NOVA', key: 2, name: 'Băng Giá', unlockCombo: 5, manaCost: 20, icon: '❄️' },
  { id: 'CHAIN_LIGHTNING', key: 3, name: 'Lôi Điện', unlockCombo: 10, manaCost: 30, icon: '⚡' },
  { id: 'FIREBALL', key: 4, name: 'Hỏa Cầu', unlockCombo: 15, manaCost: 35, icon: '🔥' },
  { id: 'ARCANE_TELEPORT', key: 5, name: 'Dịch Chuyển', unlockCombo: 20, manaCost: 25, icon: '🌀' },
  { id: 'SANCTUARY_HEAL', key: 6, name: 'Thánh Vực', unlockCombo: 30, manaCost: 35, icon: '💠' },
  { id: 'MANA_SHIELD', key: 7, name: 'Khiên Mana', unlockCombo: 40, manaCost: 15, icon: '🛡️' },
  { id: 'METEOR_STORM', key: 8, name: 'Thiên Thạch', unlockCombo: 50, manaCost: 100, icon: '☄️' }
];
```
In `UIController`:
```javascript
  setWeaponsBarMode(mode = 'GUN') {
    this.hudBarMode = mode === 'MAGE' ? 'MAGE' : 'GUN';
    if (!this.hudWeaponsBar) return;
    this.hudWeaponsBar.innerHTML = '';

    if (this.hudBarMode === 'MAGE') {
      this.mageSkillDefinitions.forEach(s => {
        const slot = document.createElement('div');
        slot.className = 'weapon-slot mage-slot' + (s.key === 1 ? ' active' : ' locked');
        slot.id = 'hud-weapon-' + s.id;
        slot.innerHTML = `
          <div class="weapon-key">[${s.key}] ${s.icon}</div>
          <div class="weapon-name">${s.name}</div>
          <div class="weapon-ammo" id="hud-ammo-${s.id}">${s.key === 1 ? s.manaCost + ' MP' : 'x' + s.unlockCombo + ' 🔒'}</div>
          <div class="skill-cooldown-overlay hidden" id="hud-cd-${s.id}"></div>
        `;
        slot.addEventListener('click', () => {
          if (typeof this.onSelectWeapon === 'function') {
            this.onSelectWeapon(s.key, s.id);
          }
        });
        this.hudWeaponsBar.appendChild(slot);
      });
      return;
    }

    this.weaponDefinitions.forEach(w => {
      const slot = document.createElement('div');
      slot.className = 'weapon-slot' + (w.id === 'PISTOL' ? ' active' : ' locked');
      slot.id = 'hud-weapon-' + w.id;
      slot.innerHTML = `
        <div class="weapon-key">[${w.key}]</div>
        <div class="weapon-name">${w.name}</div>
        <div class="weapon-ammo" id="hud-ammo-${w.id}">${w.id === 'PISTOL' ? '∞' : 'x' + w.unlockCombo + ' 🔒'}</div>
      `;
      slot.addEventListener('click', () => {
        if (typeof this.onSelectWeapon === 'function') {
          this.onSelectWeapon(w.key, w.id);
        }
      });
      this.hudWeaponsBar.appendChild(slot);
    });
  }
```
2. Update `updateHUD` Team Roster, Skill Bar, and Mana Gauge:
```javascript
      // Team Roster Mana bar + badge
      const maxMana = p.maxMana || 0;
      const manaVal = Math.max(0, Math.floor(p.mana || 0));
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(100, (manaVal / maxMana) * 100)) : 0;
      const manaBarHtml = maxMana > 0 ? `
        <div class="teammate-mana-bar" title="Mana: ${manaVal}/${maxMana}">
          <div class="teammate-mana-fill" style="width: ${manaPct}%;"></div>
        </div>
      ` : '';
      const badgeHtml = maxMana > 0
        ? `<span class="teammate-ult-badge">${manaVal} MP</span>`
        : ultBadge;
```
And for the local Mage skill bar & bottom Mana bar:
```javascript
      if (localPlayer.character === 'MAGE') {
        if (this.hudBarMode !== 'MAGE') this.setWeaponsBarMode('MAGE');
        const ms = localPlayer.mageState;
        const currentMana = localPlayer.mana || 0;

        this.mageSkillDefinitions.forEach(s => {
          const slotEl = document.getElementById('hud-weapon-' + s.id);
          const ammoEl = document.getElementById('hud-ammo-' + s.id);
          const cdEl = document.getElementById('hud-cd-' + s.id);
          const sk = ms && ms.skills ? ms.skills[s.id] : null;
          const isUnlocked = Boolean((sk && sk.unlocked) || (playerMaxCombo >= s.unlockCombo) || s.key === 1);
          if (!slotEl) return;

          const isShieldActive = s.key === 7 && Boolean(ms && ms.manaShieldActive);
          slotEl.classList.toggle('active', s.key === 1 || isShieldActive);
          slotEl.classList.toggle('locked', !isUnlocked);
          slotEl.classList.toggle('no-mana', isUnlocked && currentMana < s.manaCost);

          if (!isUnlocked) {
            if (ammoEl) ammoEl.textContent = `x${s.unlockCombo} 🔒`;
            if (cdEl) { cdEl.classList.add('hidden'); cdEl.textContent = ''; }
            return;
          }

          if (ammoEl) ammoEl.textContent = `${s.manaCost} MP`;
          const cd = sk && sk.cooldown > 0 ? sk.cooldown : 0;
          if (cd > 0) {
            if (cdEl) { cdEl.classList.remove('hidden'); cdEl.textContent = `${cd.toFixed(1)}s`; }
          } else if (cdEl) {
            cdEl.classList.add('hidden');
            cdEl.textContent = '';
          }
        });
      } else {
        if (this.hudBarMode !== 'GUN') this.setWeaponsBarMode('GUN');
        // existing gun bar loop unchanged
      }
```
And in `#hud-ult-container`:
```javascript
        if (char === 'MAGE') {
          this.hudUltContainer.classList.add('mana-mode');
          this.hudUltContainer.classList.remove('buffed');
          const curM = Math.floor(localPlayer.mana || 0);
          const maxM = localPlayer.maxMana || 100;
          const mPct = Math.max(0, Math.min(100, Math.floor((curM / maxM) * 100)));
          this.hudUltFill.style.width = mPct + '%';
          this.hudUltStatus.textContent = `${curM} / ${maxM} MP`;
          this.hudUltContainer.classList.toggle('ready', curM >= 100);
          if (this.hudUltHint) this.hudUltHint.textContent = 'Hồi +5 Mana/giây • [F] / [Chuột Phải] / [8]: Thiên Thạch (100 MP, x50)';
        } else {
          this.hudUltContainer.classList.remove('mana-mode');
          // existing ult meter code unchanged
        }
```
3. Export at bottom of `client/js/ui.js`:
```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIController, MAGE_SKILL_DEFINITIONS };
}
if (typeof window !== 'undefined') {
  window.UIController = UIController;
  window.MAGE_SKILL_DEFINITIONS = MAGE_SKILL_DEFINITIONS;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mage_client.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/index.html client/css/style.css client/js/ui.js tests/mage_client.test.js
git commit -m "feat(mage): add Mage Mana bar, 8-skill cooldown HUD, and lobby card"
```

---

### Task 8: Client Mage VFX, Dynamic Lighting & WebAudio SFX (`renderer.js`, `audio.js`)

**Files:**
- Modify: `client/js/renderer.js:33-65,610-665,935-1020,1490-1565,1900-2045`
- Modify: `client/js/audio.js:1071-1150`
- Modify: `tests/mage_client.test.js`

**Interfaces:**
- Produces in `client/js/renderer.js`:
  - `renderer.lightningArcs: Array<object>`, `renderer.mageBurstEffects: Array<object>`
  - `renderer.drawGroundZones(ctx, groundZones)` (renders `burn_pool`, `sanctuary`, `lava_pool`)
  - `renderer.drawPendingMeteors(ctx, pendingMeteors)` (renders impact warning reticles & falling fire meteors)
  - `renderer.drawLightningArcs(ctx)` & `renderer.spawnMageVfx(ev)`
  - `drawBullets` handles `'arcane_bolt'` and `'mage_fireball'`
  - `drawBoxyPlayer` draws glowing `MANA_SHIELD` aura + `hasSanctuaryBuff` emerald/cyan ring
  - `drawPlayerTag` draws Mana bar under HP when `(player.maxMana || 0) > 0`
  - `cutoutEntityLights` illuminates `burn_pool`, `lava_pool`, `sanctuary`, `arcane_bolt`, `mage_fireball`
- Produces in `client/js/audio.js`:
  - `soundManager.playMageSkill(ev, listenerX, listenerY)` (synthesizes distinct spatial WebAudio tones for all 8 Mage skills + shield break)
  - `soundManager.playUltimate('METEOR_STORM')` delegates to `playMageSkill({ skillId: 'METEOR_STORM' })`

- [ ] **Step 1: Write failing tests for Mage Canvas rendering (`groundZones`, `pendingMeteors`, `spawnMageVfx`, `Mana Shield`, overhead Mana bar) and `SoundManager.playMageSkill`**

Append to `tests/mage_client.test.js`:

```javascript
test('Renderer draws Mage groundZones, pendingMeteors, Mana Shield, overhead Mana bar, and spawnMageVfx', () => {
  setupMockEnv();
  delete require.cache[require.resolve('../client/js/renderer.js')];
  const { Renderer } = require('../client/js/renderer.js');

  const canvas = createMockElement('gameCanvas', 'canvas');
  const rnd = new Renderer(canvas);
  const ctx = createMockCtx(canvas);

  assert.doesNotThrow(() => {
    rnd.drawGroundZones(ctx, [
      { id: 'gz1', type: 'burn_pool', x: 300, y: 300, radius: 140, timer: 2.0 },
      { id: 'gz2', type: 'sanctuary', x: 500, y: 500, radius: 180, timer: 3.0 },
      { id: 'gz3', type: 'lava_pool', x: 700, y: 700, radius: 240, timer: 3.5 }
    ]);
    rnd.drawPendingMeteors(ctx, [
      { id: 'm1', x: 700, y: 700, stormRadius: 300, impactRadius: 120, timer: 0.4, meteors: [{ delay: 0.75, x: 700, y: 700, fired: false }] }
    ]);
    rnd.drawBullets(ctx, [
      { id: 'b1', x: 200, y: 200, angle: 0, type: 'arcane_bolt' },
      { id: 'b2', x: 240, y: 200, angle: 0, type: 'mage_fireball' }
    ]);
    rnd.drawPlayerTag(ctx, { name: 'Merlin', x: 400, y: 400, hp: 85, maxHp: 85, mana: 60, maxMana: 100 }, true);
    rnd.spawnMageVfx({ type: 'MAGE_SKILL', skillId: 'CHAIN_LIGHTNING', links: [{ fromX: 400, fromY: 400, toX: 520, toY: 400 }] });
    rnd.spawnMageVfx({ type: 'MAGE_SKILL', skillId: 'ARCANE_TELEPORT', fromX: 400, fromY: 400, toX: 600, toY: 400, radius: 110 });
    rnd.spawnMageVfx({ type: 'MAGE_SKILL', skillId: 'METEOR_IMPACT', x: 700, y: 700, radius: 120 });
    rnd.updateVisuals(0.1, null, 1);
  });

  // Verify overhead Mana bar filled & lightning arc queued
  assert.ok(ctx.calls.some(c => c.op === 'fillRect'), 'Expected overhead bars drawn');
});

test('SoundManager.playMageSkill executes WebAudio synth safely for all Mage skill IDs', () => {
  setupMockEnv();
  class MockNode {
    constructor() {
      this.frequency = { value: 440, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
      this.gain = { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
      this.Q = { value: 1 };
    }
    connect() { return this; }
    start() {}
    stop() {}
  }
  global.window.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new MockNode(); this.sampleRate = 44100; }
    createGain() { return new MockNode(); }
    createOscillator() { return new MockNode(); }
    createBufferSource() { return new MockNode(); }
    createBiquadFilter() { return new MockNode(); }
    createStereoPanner() { return new MockNode(); }
    createBuffer() { return { getChannelData: () => new Float32Array(1024) }; }
  };

  delete require.cache[require.resolve('../client/js/audio.js')];
  const { SoundManager } = require('../client/js/audio.js');
  const sm = new SoundManager();

  const ids = ['ARCANE_BOLT', 'FROST_NOVA', 'CHAIN_LIGHTNING', 'FIREBALL', 'ARCANE_TELEPORT', 'SANCTUARY_HEAL', 'MANA_SHIELD', 'METEOR_STORM', 'METEOR_IMPACT', 'MAGE_SHIELD_BREAK'];
  assert.doesNotThrow(() => {
    for (const skillId of ids) {
      sm.playMageSkill({ type: skillId === 'MAGE_SHIELD_BREAK' ? 'MAGE_SHIELD_BREAK' : 'MAGE_SKILL', skillId, x: 500, y: 500 }, 500, 500);
    }
    sm.playUltimate('METEOR_STORM');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_client.test.js`
Expected: FAIL (`rnd.drawGroundZones is not a function`, `sm.playMageSkill is not a function`)

- [ ] **Step 3: Implement VFX in `client/js/renderer.js` and audio synthesis in `client/js/audio.js`**

In `client/js/renderer.js`:
1. Initialize `this.lightningArcs = [];` in `constructor()` and `resetSession()`, and decay `this.lightningArcs` in `updateVisuals(dt)`:
```javascript
    if (this.lightningArcs) {
      for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
        this.lightningArcs[i].life -= dt;
        if (this.lightningArcs[i].life <= 0) this.lightningArcs.splice(i, 1);
      }
    }
```
2. In `render()` (around line 614, before `drawShellCasings`, and around line 652):
```javascript
    this.drawGroundZones(ctx, gameState.groundZones || []);
    this.drawPendingMeteors(ctx, gameState.pendingMeteors || []);
    // ... after drawMuzzleFlashes:
    this.drawLightningArcs(ctx);
```
3. In `drawBoxyPlayer(ctx, player, isLocal)`:
```javascript
    if (player.hasSanctuaryBuff) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(Math.round(player.x), Math.round(player.y + 24), 24, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
```
And after drawing the player sprite/fallback:
```javascript
    if (player.character === 'MAGE' && player.mageState && player.mageState.manaShieldActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(Math.round(player.x), Math.round(player.y), 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
```
4. In `drawPlayerTag(ctx, player, isLocal)` right after the HP bar (line 1010):
```javascript
    const hasMana = (player.maxMana || 0) > 0;
    if (hasMana) {
      const manaRatio = Math.max(0, Math.min(1, (player.mana || 0) / player.maxMana));
      ctx.fillStyle = '#111111';
      ctx.fillRect(-barW / 2 - 1, 11, barW + 2, 4);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-barW / 2, 12, barW * manaRatio, 2);
    }
    if (player.reviving) {
      const revRatio = player.reviveProgress / 2.0;
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-barW / 2, hasMana ? 17 : 12, barW * revRatio, 4);
    }
```
5. In `drawBullets(ctx, bullets)` add `'arcane_bolt'` and `'mage_fireball'` cases:
```javascript
      } else if (b.type === 'arcane_bolt') {
        ctx.rotate(b.angle || 0);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(2, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'mage_fireball') {
        ctx.fillStyle = '#ff5722';
        ctx.shadowColor = '#ff9800';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
```
6. Add `drawGroundZones(ctx, groundZones)`, `drawPendingMeteors(ctx, pendingMeteors)`, `drawLightningArcs(ctx)`, and `spawnMageVfx(ev)`:
```javascript
  drawGroundZones(ctx, groundZones) {
    if (!Array.isArray(groundZones) || groundZones.length === 0) return;
    for (let i = 0; i < groundZones.length; i++) {
      const gz = groundZones[i];
      ctx.save();
      ctx.translate(gz.x, gz.y);
      const rad = gz.radius || 140;
      if (gz.type === 'sanctuary') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (gz.type === 'burn_pool' || gz.type === 'lava_pool') {
        ctx.fillStyle = gz.type === 'lava_pool' ? 'rgba(255, 61, 0, 0.24)' : 'rgba(255, 145, 0, 0.2)';
        ctx.strokeStyle = gz.type === 'lava_pool' ? 'rgba(255, 214, 0, 0.75)' : 'rgba(255, 87, 34, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawPendingMeteors(ctx, pendingMeteors) {
    if (!Array.isArray(pendingMeteors) || pendingMeteors.length === 0) return;
    for (let i = 0; i < pendingMeteors.length; i++) {
      const storm = pendingMeteors[i];
      const meteors = storm.meteors || [];
      for (let m = 0; m < meteors.length; m++) {
        const met = meteors[m];
        if (met.fired) continue;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 87, 34, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(met.x, met.y, storm.impactRadius || 120, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawLightningArcs(ctx) {
    if (!this.lightningArcs || this.lightningArcs.length === 0) return;
    for (let i = 0; i < this.lightningArcs.length; i++) {
      const arc = this.lightningArcs[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, arc.life / arc.maxLife);
      ctx.strokeStyle = '#80d8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let l = 0; l < arc.links.length; l++) {
        const lnk = arc.links[l];
        const midX = (lnk.fromX + lnk.toX) / 2 + (Math.random() - 0.5) * 18;
        const midY = (lnk.fromY + lnk.toY) / 2 + (Math.random() - 0.5) * 18;
        ctx.moveTo(lnk.fromX, lnk.fromY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(lnk.toX, lnk.toY);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  spawnMageVfx(ev) {
    if (!ev) return;
    const id = ev.skillId || ev.ultId;
    if (id === 'FROST_NOVA') {
      this.addShockwave(ev.x, ev.y, ev.radius || 120, '#00e5ff');
    } else if (id === 'CHAIN_LIGHTNING' && Array.isArray(ev.links)) {
      if (!this.lightningArcs) this.lightningArcs = [];
      this.lightningArcs.push({ links: ev.links, life: 0.25, maxLife: 0.25 });
    } else if (id === 'ARCANE_TELEPORT') {
      this.addBlinkTrail(ev.fromX, ev.fromY, ev.toX, ev.toY, '#a855f7');
      this.addShockwave(ev.fromX, ev.fromY, ev.radius || 110, '#c084fc');
    } else if (id === 'SANCTUARY_HEAL') {
      this.addShockwave(ev.x, ev.y, ev.radius || 180, '#38bdf8');
    } else if (id === 'MANA_SHIELD' || ev.type === 'MAGE_SHIELD_BREAK') {
      this.addShockwave(ev.x, ev.y, 65, '#a855f7');
    } else if (id === 'METEOR_STORM') {
      this.addShockwave(ev.x, ev.y, ev.radius || 300, '#ff6d00');
    } else if (id === 'METEOR_IMPACT') {
      this.addShockwave(ev.x, ev.y, ev.radius || 120, '#ff3d00');
      this.addExplosionParticles(ev.x, ev.y, ev.radius || 120);
    }
  }
```
7. In `cutoutEntityLights(dCtx, gameState)` add radial lights for `groundZones` (`sanctuary`, `burn_pool`, `lava_pool`) and Mage projectiles (`arcane_bolt`, `mage_fireball`):
```javascript
    const zones = gameState.groundZones || [];
    for (let i = 0; i < zones.length; i++) {
      this.cutoutRadialLight(dCtx, zones[i].x, zones[i].y, 20, zones[i].radius || 140, 0.7);
    }
```

In `client/js/audio.js`:
```javascript
  playMageSkill(ev, listenerX, listenerY) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime || 0;
    const skillId = (ev && (ev.skillId || ev.ultId)) || (ev && ev.type === 'MAGE_SHIELD_BREAK' ? 'MAGE_SHIELD_BREAK' : 'ARCANE_BOLT');
    const bus = (typeof this.createSpatialBus === 'function' && ev && typeof ev.x === 'number')
      ? this.createSpatialBus(ev.x, listenerX, ev.y, listenerY)
      : this.masterGain;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const profiles = {
      ARCANE_BOLT: { type: 'sine', f0: 780, f1: 360, dur: 0.1, vol: 0.22 },
      FROST_NOVA: { type: 'triangle', f0: 1200, f1: 320, dur: 0.3, vol: 0.35 },
      CHAIN_LIGHTNING: { type: 'sawtooth', f0: 960, f1: 240, dur: 0.22, vol: 0.32 },
      FIREBALL: { type: 'sawtooth', f0: 320, f1: 110, dur: 0.25, vol: 0.35 },
      ARCANE_TELEPORT: { type: 'sine', f0: 260, f1: 920, dur: 0.2, vol: 0.35 },
      SANCTUARY_HEAL: { type: 'sine', f0: 523, f1: 784, dur: 0.35, vol: 0.3 },
      MANA_SHIELD: { type: 'triangle', f0: 440, f1: 660, dur: 0.25, vol: 0.3 },
      MAGE_SHIELD_BREAK: { type: 'sawtooth', f0: 600, f1: 140, dur: 0.28, vol: 0.38 },
      METEOR_STORM: { type: 'triangle', f0: 180, f1: 45, dur: 0.5, vol: 0.5 },
      METEOR_IMPACT: { type: 'sawtooth', f0: 140, f1: 32, dur: 0.38, vol: 0.55 }
    };
    const p = profiles[skillId] || profiles.ARCANE_BOLT;
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.f0, t);
    osc.frequency.exponentialRampToValueAtTime(p.f1, t + p.dur);
    gain.gain.setValueAtTime(p.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + p.dur);
    osc.connect(gain);
    gain.connect(bus || this.masterGain);
    osc.start(t);
    osc.stop(t + p.dur);
  }
```
And in `playUltimate(ultId)` add:
```javascript
    } else if (ultId === 'METEOR_STORM') {
      this.playMageSkill({ skillId: 'METEOR_STORM' });
    }
```

- [ ] **Step 4: Run full test suite (`npm test`)**

Run: `npm test`
Expected: ALL tests pass (`0` failures, `0` skipped)!

- [ ] **Step 5: Commit**

```bash
git add client/js/renderer.js client/js/audio.js tests/mage_client.test.js
git commit -m "feat(mage): add Mage ground zone, meteor, lightning VFX and WebAudio SFX"
```

---

## Self-Review Checklist

1. **Spec Coverage:**
   - All 8 skills (`[1] ARCANE_BOLT`, `[2] FROST_NOVA`, `[3] CHAIN_LIGHTNING`, `[4] FIREBALL`, `[5] ARCANE_TELEPORT`, `[6] SANCTUARY_HEAL`, `[7] MANA_SHIELD`, `[8] METEOR_STORM`) match exact unlock combos (`x1..x50`), Mana costs (`5..100`), cooldowns (`0..50s`), radii, speeds, ranges, damages, damage types, and CC durations -> covered across Tasks 1–5.
   - Pure Mana (`100` max, `+5/s` regen, `WAVE_CLEAR` 100%, `revive` 50%) & `[F]`/`Right-Click`/`[8]` sync -> covered in Tasks 3–6.
   - `AMMO` `18%` drop rate & `+30 Mana / -1.5s CD` pickup -> covered in Tasks 1, 3, 4, 5.
   - Client HUD Mana bars, skill bar cooldown overlays, world cursor targeting, canvas VFX, and WebAudio SFX -> covered in Tasks 6–8.
2. **Placeholder Scan:** No `TODO`, `TBD`, or unimplemented references remain; every method signature matches between Producer/Consumer blocks across tasks.
3. **Type & Naming Consistency:**
   - `MAGE_SKILLS`, `MAGE_SKILL_KEYS`, `MAGE_MANA_CONFIG`, `MAGE_AMMO_PICKUP` match in `MageSkillsConfig.js`, `Player.js`, `MageAbilities.js`, `UltimateConfig.js`, `GameRoom.js`.
   - `groundZones` types (`'burn_pool'`, `'sanctuary'`, `'lava_pool'`) and `pendingMeteors` structure match across `MageAbilities.js`, `GameRoom.js`, and `renderer.js`.
   - `player:skill` payload `{ slot, angle, targetX, targetY }` matches across `input.js`, `main.js`, `socketHandler.js`, and `GameRoom.js`.
