# Mage Skill Balance & Ultimate Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance Mage skills according to user specifications: Slot 1 (Arcane Bolt) costs 0 Mana (infinite/free attack), Slot 2 (Frost Nova) mana cost reduced to 10 MP and radius expanded to 180px with bold VFX and ice particles, and Slot 8 / Ultimate (Meteor Storm) unlocked from Combo x1 so it activates as soon as Mana reaches 100 MP (with 50s Cooldown).

**Architecture:** Update constants in `MageSkillsConfig.js`, `UltimateConfig.js`, and `ui.js`. Adjust `Player.js` shooting & state initialization so Arcane Bolt requires 0 Mana and Meteor Storm is unlocked at start. Enhance `renderer.js` to render a vivid multi-ring frost nova with ice burst particles and screen shake. Verify with automated tests in `tests/mage_skills.test.js` and `tests/mage_client.test.js`.

**Tech Stack:** Node.js, Socket.IO, HTML5 Canvas 2D, WebAudio API, Node test runner (`node --test`).

## Global Constraints

- Preserve complete backward compatibility for HUMAN and WARRIOR classes.
- Zero hardcoded secrets; adhere strictly to `GEMINI.md`.
- All tests must use AAA (Arrange-Act-Assert) pattern.
- No destructive git or shell commands.

---

### Task 1: Skill Configurations & HUD UI Adjustments

**Files:**
- Modify: `server/game/MageSkillsConfig.js:24-55,128-150`
- Modify: `server/game/UltimateConfig.js:35-55`
- Modify: `client/js/ui.js:1-30,845-885,1025-1045`
- Test: `tests/mage_skills.test.js`

**Interfaces:**
- `MAGE_SKILLS.ARCANE_BOLT`: `manaCost = 0`
- `MAGE_SKILLS.FROST_NOVA`: `manaCost = 10`, `radius = 180`
- `MAGE_SKILLS.METEOR_STORM`: `unlockCombo = 1`, `manaCost = 100`, `cooldown = 50.0`
- `ui.js`: `mageSkillDefinitions` matching the new values; Slot 1 ammo badge displays `∞`; Slot 8 unlock combo badge removed or set to `x1`; Ultimate hint updated to `Hồi +5 Mana/giây • [F] / [Chuột Phải] / [8]: Thiên Thạch (100 MP, CD 50s)`

- [ ] **Step 1: Write failing tests for updated Mage skill config values**

In `tests/mage_skills.test.js`, add or update assertions for the new constants:

```javascript
test('MageSkillsConfig defines updated balance values: Arcane Bolt (0 MP), Frost Nova (10 MP, r=180), Meteor Storm (x1 unlock, 100 MP, 50s CD)', () => {
  const { MAGE_SKILLS } = require('../server/game/MageSkillsConfig.js');
  assert.strictEqual(MAGE_SKILLS.ARCANE_BOLT.manaCost, 0);
  assert.strictEqual(MAGE_SKILLS.FROST_NOVA.manaCost, 10);
  assert.strictEqual(MAGE_SKILLS.FROST_NOVA.radius, 180);
  assert.strictEqual(MAGE_SKILLS.METEOR_STORM.unlockCombo, 1);
  assert.strictEqual(MAGE_SKILLS.METEOR_STORM.manaCost, 100);
  assert.strictEqual(MAGE_SKILLS.METEOR_STORM.cooldown, 50.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_skills.test.js`
Expected: FAIL with assertion mismatch (e.g. `5 !== 0` or `20 !== 10`).

- [ ] **Step 3: Update `MageSkillsConfig.js`, `UltimateConfig.js`, and `ui.js`**

1. In `server/game/MageSkillsConfig.js`:
   - `ARCANE_BOLT`: set `manaCost: 0`.
   - `FROST_NOVA`: set `manaCost: 10`, `radius: 180`.
   - `METEOR_STORM`: set `unlockCombo: 1`.

2. In `server/game/UltimateConfig.js`:
   - Verify `METEOR_STORM` references `MAGE_SKILLS.METEOR_STORM`.

3. In `client/js/ui.js`:
   - Update `mageSkillDefinitions`:
     - `ARCANE_BOLT`: `manaCost: 0`
     - `FROST_NOVA`: `manaCost: 10`
     - `METEOR_STORM`: `unlockCombo: 1`
   - In `updateHUD` around line 865:
     ```javascript
     if (s.key === 1) {
       if (ammoEl) ammoEl.textContent = '∞';
     } else {
       if (ammoEl) ammoEl.textContent = `${s.manaCost} MP`;
     }
     ```
   - In `hudUltHint`: update text to `'Hồi +5 Mana/giây • [F] / [Chuột Phải] / [8]: Thiên Thạch (100 MP, CD 50s)'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mage_skills.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add server/game/MageSkillsConfig.js server/game/UltimateConfig.js client/js/ui.js tests/mage_skills.test.js
git commit -m "feat(mage): update skill balance for Arcane Bolt, Frost Nova, and Meteor Storm"
```

---

### Task 2: Gameplay Execution & State Management Updates

**Files:**
- Modify: `server/game/Player.js:190-230,920-940`
- Modify: `server/game/MageAbilities.js:540-605`
- Test: `tests/mage_skills.test.js`
- Test: `tests/player.test.js`

**Interfaces:**
- `Player.canShoot()`: For `character === 'MAGE'`, returns true whenever alive and `fireCooldown <= 0` (no longer blocked by 0 mana since cost is 0).
- `Player.resetMageState()`: Initializes all skills, ensuring `METEOR_STORM.unlocked = true` from combo 1.
- `MageAbilities.triggerMageSkill()`: When slot 8 is cast at combo 1 with 100 Mana, successfully activates `METEOR_STORM` and triggers 50s cooldown.

- [ ] **Step 1: Write failing tests for Player shooting at 0 Mana and Meteor Storm at Combo 1**

In `tests/mage_skills.test.js`:
```javascript
test('Mage can shoot Arcane Bolt even with 0 Mana, consuming 0 Mana', () => {
  const { Player } = require('../server/game/Player.js');
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  mage.mana = 0;
  assert.strictEqual(mage.canShoot(), true, 'Arcane Bolt must be shootable with 0 mana');
  mage.consumeAmmo();
  assert.strictEqual(mage.mana, 0, 'Mana should remain 0 after free shot');
});

test('Mage can cast Meteor Storm at combo 1 with 100 Mana, placing on 50s cooldown', () => {
  const { Player } = require('../server/game/Player.js');
  const { triggerMageSkill } = require('../server/game/MageAbilities.js');
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  const room = { state: 'PLAYING', pendingMeteors: [], eventsBuffer: [], zombies: [], bullets: [] };
  
  assert.strictEqual(mage.combo, 1);
  assert.strictEqual(mage.mana, 100);
  assert.strictEqual(mage.mageState.skills.METEOR_STORM.unlocked, true);

  const res = triggerMageSkill(mage, 8, 0, room, { x: 400, y: 300 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(res.skillId, 'METEOR_STORM');
  assert.strictEqual(mage.mana, 0);
  assert.strictEqual(mage.mageState.skills.METEOR_STORM.cooldown, 50.0);
  assert.strictEqual(room.pendingMeteors.length, 1);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test tests/mage_skills.test.js`
Expected: FAIL if `canShoot` checks `mana >= 5` or `METEOR_STORM.unlocked` was false at combo 1.

- [ ] **Step 3: Update `Player.js` and `MageAbilities.js`**

1. In `server/game/Player.js`:
   - In `canShoot()`:
     ```javascript
     if (this.character === 'MAGE') {
       return this.mana + 1e-6 >= MAGE_SKILLS.ARCANE_BOLT.manaCost;
     }
     ```
     (With `manaCost: 0`, this is always true when `fireCooldown <= 0`).
   - In `resetMageState()`:
     Ensure skills with `unlockCombo <= 1` (including `ARCANE_BOLT` and `METEOR_STORM`) have `unlocked: true`.
   - Update `recordKill()` unlock checks to match the new combo map.

2. In `server/game/MageAbilities.js`:
   - In `castFrostNova()`: verify `skill.radius` is passed into events and zombie freeze hit detection (radius 180px).
   - In `triggerMageSkill()`: verify `slot === 8` activates cleanly.

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `node --test tests/mage_skills.test.js tests/player.test.js tests/ultimates.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add server/game/Player.js server/game/MageAbilities.js tests/mage_skills.test.js tests/player.test.js
git commit -m "fix(mage): enable free Arcane Bolt and unlock Meteor Storm at combo 1"
```

---

### Task 3: Enhanced Frost Nova VFX & Polish

**Files:**
- Modify: `client/js/renderer.js:2635-2660`
- Test: `tests/mage_skills.test.js`

**Interfaces:**
- `Renderer.spawnMageVfx(ev)`:
  - When `ev.skillId === 'FROST_NOVA'`:
    - Spawns outer cyan shockwave (`maxRadius = ev.radius || 180`, color `#00e5ff`).
    - Spawns secondary inner white/ice shockwave (`maxRadius = (ev.radius || 180) * 0.65`, color `#e0f7fa`).
    - Emits 24 ice crystal / frost spark particles radiating outwards with life `0.45s` and colors `['#00e5ff', '#e0f7fa', '#80deea', '#ffffff']`.
    - Triggers screen shake with magnitude 6.

- [ ] **Step 1: Write test for enhanced Frost Nova VFX**

In `tests/mage_skills.test.js`, add test checking `spawnMageVfx`:

```javascript
test('Renderer.spawnMageVfx creates dual shockwaves and frost particles for FROST_NOVA', () => {
  const { Renderer } = require('../client/js/renderer.js');
  const rnd = new Renderer();
  rnd.spawnMageVfx({
    type: 'MAGE_SKILL',
    skillId: 'FROST_NOVA',
    x: 500,
    y: 500,
    radius: 180
  });

  assert.ok(rnd.shockwaves.length >= 2, 'Should create at least dual shockwaves');
  assert.strictEqual(rnd.shockwaves[0].maxRadius, 180);
  assert.ok(rnd.particles.length >= 20, 'Should spawn at least 20 frost particles');
  assert.strictEqual(rnd.screenShake.trauma > 0, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mage_skills.test.js`
Expected: FAIL because only 1 shockwave is currently created and no particles are spawned for Frost Nova.

- [ ] **Step 3: Implement enhanced Frost Nova VFX in `client/js/renderer.js`**

In `spawnMageVfx` in `client/js/renderer.js`:
```javascript
    if (id === 'FROST_NOVA') {
      const r = ev.radius || 180;
      this.addShockwave(ev.x, ev.y, r, '#00e5ff');
      this.addShockwave(ev.x, ev.y, Math.round(r * 0.65), '#e0f7fa');
      this.triggerScreenShake(6);
      if (!this.particles) this.particles = [];
      const frostColors = ['#00e5ff', '#e0f7fa', '#80deea', '#ffffff'];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const spd = Math.random() * 160 + 80;
        this.particles.push({
          x: ev.x,
          y: ev.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          radius: Math.random() * 4 + 3,
          color: frostColors[Math.floor(Math.random() * frostColors.length)],
          life: 0.45,
          maxLife: 0.45
        });
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mage_skills.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add client/js/renderer.js tests/mage_skills.test.js
git commit -m "feat(renderer): add bold dual-ring shockwave and frost particles for Frost Nova"
```

---

### Task 4: Full Test Suite Verification & Clean Up

**Files:**
- Test: All files in `tests/*.test.js`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS all 121+ tests with 0 failures, 0 skipped.

- [ ] **Step 2: Check git status to ensure working tree is clean**

Run: `git status`
Expected: clean working directory.

