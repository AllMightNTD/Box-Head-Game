/**
 * @file Player.js
 * @description Player entity managing movement, combat, weapon/skill loadout,
 * armor mechanics, and character class attributes.
 */

'use strict';

const { WEAPONS, getUnlockedWeapons } = require('./WeaponsConfig.js');
const { ULT_CHARGE_CONFIG, getUltimateConfigForClass } = require('./UltimateConfig.js');
const {
  WARRIOR_ARMOR_CONFIG,
  WARRIOR_AMMO_REDUCTION,
  WARRIOR_SKILLS,
  WARRIOR_SKILL_KEYS,
  getUnlockedWarriorSkills
} = require('./WarriorSkillsConfig.js');
const {
  MAGE_MANA_CONFIG,
  MAGE_AMMO_PICKUP,
  MAGE_SKILLS,
  MAGE_SKILL_KEYS,
  getUnlockedMageSkills
} = require('./MageSkillsConfig.js');

/**
 * Class-specific base stats and modifiers.
 */
const CLASS_CONFIGS = {
  HUMAN: {
    maxHp: 100,
    maxArmor: 0,
    speed: 160, // 1.0x (160 px/s)
    ammoPickupBonus: 1.25,
    reloadSpeedMultiplier: 1.15,
    meleeResistance: 0,
    knockbackImmune: false,
    comboDecayMultiplier: 1.0
  },
  WARRIOR: {
    maxHp: 150,
    maxArmor: WARRIOR_ARMOR_CONFIG.MAX_ARMOR, // 75
    speed: 144, // 0.9x (144 px/s)
    ammoPickupBonus: 1.0,
    reloadSpeedMultiplier: 1.0,
    meleeResistance: 0.25, // -25% melee damage
    knockbackImmune: true,
    comboDecayMultiplier: 1.0
  },
  MAGE: {
    maxHp: 85,
    maxArmor: 0,
    speed: 188, // 1.18x (188 px/s)
    ammoPickupBonus: 1.0,
    reloadSpeedMultiplier: 1.0,
    meleeResistance: 0,
    knockbackImmune: false,
    comboDecayMultiplier: 0.8 // combo decay is 20% slower
  }
};

class Player {
  /**
   * @param {string} id
   * @param {string} name
   * @param {string} [character='HUMAN']
   * @param {number} [x=800]
   * @param {number} [y=600]
   */
  constructor(id, name, character = 'HUMAN', x = 800, y = 600) {
    this.id = id;
    this.name = name || 'Hero';
    this.character = character || 'HUMAN';
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.angle = 0;

    // Apply class configuration
    this.applyClassConfig(this.character);
    this.ultCharge = 0;
    this.ultMaxCharge = ULT_CHARGE_CONFIG.MAX_CHARGE;
    this.hasInfiniteAmmo = false;

    this.isDowned = false;
    this.isDead = false;
    this.bleedoutTimer = 15;

    this.score = 0;
    this.kills = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.comboMaxTime = 3.5;

    // Weapons setup (guns used by HUMAN/MAGE/legacy skins)
    this.weapons = {};
    for (const key of Object.keys(WEAPONS)) {
      const w = WEAPONS[key];
      this.weapons[key] = {
        id: w.id,
        unlocked: w.unlockCombo === 1,
        ammo: w.startingAmmo,
        maxAmmo: w.maxAmmo
      };
    }
    if (this.character === 'MAGE') {
      this.selectedWeapon = 'ARCANE_BOLT';
    } else if (this.character === 'WARRIOR' && this.warriorState) {
      this.selectedWeapon = this.warriorState.activeStance;
    } else {
      this.selectedWeapon = 'PISTOL';
    }
    this.fireCooldown = 0;

    // Movement input state
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      angle: 0,
      shoot: false,
      revive: false
    };

    // Revive mechanics
    this.revivingTarget = null;
    this.reviveProgress = 0;
    this.reviveDuration = 2.0;

    // === BROTATO RPG STATS ===
    this.materials = 0;          // currency for shop
    this.pickupRange = 80;       // magnet radius in px
    // Stat bonuses (additive on top of class base)
    this.damageBonus = 0;        // %
    this.attackSpeedBonus = 0;   // %
    this.critChance = 0;         // %
    this.critMultiplier = 1.5;   // base crit multiplier
    this.rangeBonus = 0;         // %
    this.hpRegen = 0;            // HP per 5s
    this.hpRegenTimer = 0;       // internal timer
    this.lifeSteal = 0;          // % chance to heal 1HP on hit
    this.lifeStealICD = 0;       // internal cooldown (0.1s)
    this.armor_bonus = 0;        // flat armor bonus from items
    this.dodge = 0;              // % dodge chance (hard cap 60%)
    this.speedBonus = 0;         // % speed bonus
    this.maxHpBonus = 0;         // flat HP bonus from items
    this.pickupRange_bonus = 0;  // bonus pickup range from items
    this.materialBonus = 0;      // % bonus materials from kills
    // Inventory: array of { itemId, stack } objects (max 18 slots)
    this.inventory = [];
  }

  /**
   * Adds materials with materialBonus applied.
   * @param {number} amount
   */
  addMaterials(amount) {
    const bonus = 1 + (this.materialBonus / 100);
    this.materials += Math.round(amount * bonus);
  }

  /**
   * Returns effective pickup range including item bonuses.
   * @returns {number}
   */
  effectivePickupRange() { return this.pickupRange + (this.pickupRange_bonus || 0); }

  /**
   * Updates player inputs from client payload.
   * For WARRIOR, stance weaponId switching delegates to setWarriorStance.
   * @param {object} input
   */
  applyInput(input) {
    if (!input || typeof input !== 'object') return;
    if (input.up !== undefined) this.input.up = Boolean(input.up);
    if (input.down !== undefined) this.input.down = Boolean(input.down);
    if (input.left !== undefined) this.input.left = Boolean(input.left);
    if (input.right !== undefined) this.input.right = Boolean(input.right);
    if (typeof input.angle === 'number' && !Number.isNaN(input.angle)) {
      this.input.angle = input.angle;
      this.angle = input.angle;
    }
    if (input.shoot !== undefined) this.input.shoot = Boolean(input.shoot);
    if (input.revive !== undefined) this.input.revive = Boolean(input.revive);

    if (this.character === 'WARRIOR') {
      if (input.weaponId === 'BERSERKER_STANCE' || input.weaponId === 'JUGGERNAUT_STANCE') {
        this.setWarriorStance(input.weaponId);
      }
    } else if (this.character !== 'MAGE') {
      if (input.weaponId && this.weapons[input.weaponId] && this.weapons[input.weaponId].unlocked) {
        this.selectedWeapon = input.weaponId;
      }
    }
  }

  /**
   * Applies character class configuration and resets class-specific state.
   * @param {string} character
   */
  applyClassConfig(character) {
    this.character = character || 'HUMAN';
    const cConf = CLASS_CONFIGS[this.character] || CLASS_CONFIGS.HUMAN;
    const ultConf = getUltimateConfigForClass(this.character);

    this.maxHp = cConf.maxHp;
    this.hp = this.maxHp;
    this.maxArmor = cConf.maxArmor || 0;
    this.armor = this.maxArmor;
    this.hasWarCryBuff = false;
    this.baseSpeed = cConf.speed;
    this.speed = this.baseSpeed;
    this.ammoPickupBonus = cConf.ammoPickupBonus;
    this.reloadSpeedMultiplier = cConf.reloadSpeedMultiplier;
    this.meleeResistance = cConf.meleeResistance;
    this.knockbackImmune = cConf.knockbackImmune;
    this.comboDecayMultiplier = cConf.comboDecayMultiplier;
    this.ultimateId = ultConf.id;

    if (this.character === 'WARRIOR') {
      this.resetWarriorState();
    } else {
      this.warriorState = null;
    }

    this.hasSanctuaryBuff = false;
    if (this.character === 'MAGE') {
      this.resetMageState();
    } else {
      this.mageState = null;
      this.mana = 0;
      this.maxMana = 0;
      if (this.character !== 'WARRIOR') {
        this.selectedWeapon = 'PISTOL';
      }
    }
  }

  /**
   * Resets Warrior state (stance, skills, fury, armor, active channels).
   */
  resetWarriorState() {
    const skills = {};
    for (const key of WARRIOR_SKILL_KEYS) {
      const cfg = WARRIOR_SKILLS[key];
      skills[key] = {
        id: cfg.id,
        slot: cfg.slot,
        unlocked: cfg.unlockCombo === 1,
        cooldown: 0,
        maxCooldown: cfg.cooldown || 0
      };
    }

    this.warriorState = {
      activeStance: 'BERSERKER_STANCE',
      furyStacks: 0,
      furyTimer: 0,
      skills,
      whirlwind: null,
      dash: null,
      counterShieldTimer: 0,
      counterShieldActive: false,
      warCryAuraTimer: 0,
      avatarTimer: 0,
      avatarActive: false,
      pendingParry: null
    };

    this.armor = this.maxArmor;
    this.hasWarCryBuff = false;
    this.selectedWeapon = 'BERSERKER_STANCE';
  }

  /**
   * Switches Warrior stance between BERSERKER_STANCE and JUGGERNAUT_STANCE.
   * Clears furyStacks and furyTimer when leaving BERSERKER_STANCE.
   * Mirrors activeStance into selectedWeapon for uniform serialization.
   * @param {string} stanceId
   * @returns {boolean} True if switch was successful
   */
  setWarriorStance(stanceId) {
    if (this.character !== 'WARRIOR' || !this.warriorState) {
      return false;
    }
    if (stanceId !== 'BERSERKER_STANCE' && stanceId !== 'JUGGERNAUT_STANCE') {
      return false;
    }
    const targetSkill = this.warriorState.skills[stanceId];
    if (!targetSkill || !targetSkill.unlocked) {
      return false;
    }
    if (this.warriorState.activeStance === stanceId) {
      return true;
    }
    if (this.warriorState.activeStance === 'BERSERKER_STANCE') {
      this.warriorState.furyStacks = 0;
      this.warriorState.furyTimer = 0;
    }
    this.warriorState.activeStance = stanceId;
    this.selectedWeapon = stanceId;
    return true;
  }

  /**
   * Applies cooldown reduction bonus to Warrior skill slots 3..7 and adds ultCharge.
   * Triggered by AMMO pickups and re-reaching combo milestones.
   */
  applyWarriorCooldownBonus() {
    if (this.character !== 'WARRIOR' || !this.warriorState) {
      return;
    }
    const slots = [
      'BLADE_WHIRLWIND',
      'SHADOW_DASH_SLASH',
      'SEISMIC_SLAM',
      'WAR_CRY',
      'COUNTER_SHIELD_BASH'
    ];
    for (let i = 0; i < slots.length; i++) {
      const skill = this.warriorState.skills[slots[i]];
      if (skill && skill.cooldown > 0) {
        const reduction = Math.max(
          WARRIOR_AMMO_REDUCTION.MIN_SECONDS,
          skill.cooldown * WARRIOR_AMMO_REDUCTION.COOLDOWN_RATIO
        );
        skill.cooldown = Math.max(0, Number((skill.cooldown - reduction).toFixed(2)));
      }
    }
    this.addUltCharge(WARRIOR_AMMO_REDUCTION.ULT_CHARGE_BONUS);
  }

  /**
   * Checks if incoming attack coordinates fall within player's frontal cone.
   * Normalizes angle delta into [-Math.PI, Math.PI].
   * @param {number} sourceX
   * @param {number} sourceY
   * @param {number} halfArcRad
   * @returns {boolean}
   */
  isAttackInFrontCone(sourceX, sourceY, halfArcRad) {
    if (typeof sourceX !== 'number' || typeof sourceY !== 'number') {
      return false;
    }
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
      return false;
    }
    const angleToSource = Math.atan2(sourceY - this.y, sourceX - this.x);
    let diff = angleToSource - this.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) <= halfArcRad;
  }

  /**
   * Returns Warrior attack speed multiplier from Berserker fury and Avatar of War.
   * @returns {number}
   */
  getWarriorAttackSpeedMultiplier() {
    if (this.character !== 'WARRIOR' || !this.warriorState) {
      return 1.0;
    }
    let mult = 1.0;
    if (this.warriorState.activeStance === 'BERSERKER_STANCE') {
      mult += this.warriorState.furyStacks * WARRIOR_SKILLS.BERSERKER_STANCE.atkSpeedPerStack;
    }
    if (this.warriorState.avatarTimer > 0) {
      mult *= WARRIOR_SKILLS.AVATAR_OF_WAR.attackSpeedMultiplier;
    }
    return mult;
  }

  /**
   * Returns Warrior damage multiplier from Avatar of War and War Cry buff.
   * @returns {number}
   */
  getWarriorDamageMultiplier() {
    let mult = 1.0;
    if (this.character === 'WARRIOR' && this.warriorState) {
      if (this.warriorState.avatarTimer > 0) {
        mult *= WARRIOR_SKILLS.AVATAR_OF_WAR.damageMultiplier;
      }
    }
    if (this.hasWarCryBuff) {
      mult *= (1 + WARRIOR_SKILLS.WAR_CRY.allyDamageBonus);
    }
    return mult;
  }

  /**
   * Restores Armor up to maxArmor.
   * @param {number} amount
   * @returns {number} Current armor after restoration
   */
  restoreArmor(amount) {
    if (this.character !== 'WARRIOR' || this.isDead || this.isDowned) {
      return this.armor || 0;
    }
    if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
      return this.armor;
    }
    this.armor = Math.min(this.maxArmor, Math.round(this.armor + amount));
    return this.armor;
  }

  /**
   * Clears active channeling states, timers, and buffs for Warrior.
   */
  clearWarriorActiveChannels() {
    if (this.character !== 'WARRIOR' || !this.warriorState) return;
    this.warriorState.whirlwind = null;
    this.warriorState.dash = null;
    this.warriorState.counterShieldTimer = 0;
    this.warriorState.counterShieldActive = false;
    this.warriorState.warCryAuraTimer = 0;
    this.warriorState.avatarTimer = 0;
    this.warriorState.avatarActive = false;
    this.warriorState.furyStacks = 0;
    this.warriorState.furyTimer = 0;
    this.warriorState.pendingParry = null;
    this.hasWarCryBuff = false;
  }

  /**
   * Updates player simulation tick.
   * @param {number} dt
   * @param {object} map
   * @param {Array<object>} [barricades=[]]
   */
  update(dt, map, barricades = []) {
    if (this.isDead) return;

    if (this.isDowned) {
      this.bleedoutTimer -= dt;
      if (this.bleedoutTimer <= 0) {
        this.isDead = true;
        this.isDowned = false;
        this.hp = 0;
        this.clearMageChannels();
        this.clearWarriorActiveChannels();
      }
      return;
    }

    const sanctuaryMult = this.hasSanctuaryBuff ? MAGE_SKILLS.SANCTUARY_HEAL.cooldownSpeedMultiplier : 1.0;

    // Warrior-specific timer updates and passive ult regen
    if (this.character === 'WARRIOR' && this.warriorState) {
      if (this.warriorState.avatarTimer <= 0) {
        this.addUltCharge((100 / 60) * dt);
      }

      if (this.warriorState.furyTimer > 0) {
        this.warriorState.furyTimer -= dt;
        if (this.warriorState.furyTimer <= 0) {
          this.warriorState.furyTimer = 0;
          this.warriorState.furyStacks = 0;
        }
      }

      for (const skill of Object.values(this.warriorState.skills)) {
        if (skill.cooldown > 0) {
          skill.cooldown = Math.max(0, Number((skill.cooldown - dt * sanctuaryMult).toFixed(2)));
        }
      }

      // Decrement timers without clearing active boolean flags (Task 4 handles expiry effects)
      if (this.warriorState.counterShieldTimer > 0) {
        this.warriorState.counterShieldTimer = Math.max(0, this.warriorState.counterShieldTimer - dt);
      }
      if (this.warriorState.warCryAuraTimer > 0) {
        this.warriorState.warCryAuraTimer = Math.max(0, this.warriorState.warCryAuraTimer - dt);
      }
      if (this.warriorState.avatarTimer > 0) {
        this.warriorState.avatarTimer = Math.max(0, this.warriorState.avatarTimer - dt);
      }

      if (this.fireCooldown > 0) {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt * this.getWarriorAttackSpeedMultiplier() * sanctuaryMult);
      }
    } else if (this.character === 'MAGE' && this.mageState) {
      if (this.fireCooldown > 0) {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt * (this.reloadSpeedMultiplier || 1.0) * sanctuaryMult);
      }
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
    } else {
      if (this.fireCooldown > 0) {
        this.fireCooldown -= dt * (this.reloadSpeedMultiplier || 1.0) * sanctuaryMult;
      }
    }

    // Update combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt * (this.comboDecayMultiplier || 1.0);
    }
    if (this.comboTimer <= 0) {
      this.combo = 1;
      this.comboTimer = 0;
    }

    // Compute effective speed
    let effectiveSpeed = this.baseSpeed;
    if (this.character === 'WARRIOR' && this.warriorState) {
      if (this.warriorState.activeStance === 'BERSERKER_STANCE') {
        effectiveSpeed *= (1 + this.warriorState.furyStacks * WARRIOR_SKILLS.BERSERKER_STANCE.moveSpeedPerStack);
      }
      if (this.warriorState.counterShieldTimer > 0 && this.warriorState.avatarTimer <= 0) {
        effectiveSpeed *= WARRIOR_SKILLS.COUNTER_SHIELD_BASH.moveSpeedMultiplier;
      }
      if (this.warriorState.whirlwind && (this.warriorState.whirlwind.timer > 0 || this.warriorState.whirlwind.ticksRemaining > 0)) {
        effectiveSpeed *= WARRIOR_SKILLS.BLADE_WHIRLWIND.moveSpeedMultiplier;
      }
      if (this.warriorState.avatarTimer > 0) {
        effectiveSpeed *= WARRIOR_SKILLS.AVATAR_OF_WAR.moveSpeedMultiplier;
      }
    }
    this.speed = effectiveSpeed;

    // While dash is active, skip WASD displacement (movement handled by WarriorAbilities)
    const isDashing = Boolean(this.warriorState?.dash && this.warriorState.dash.timer > 0);
    if (isDashing) {
      return;
    }

    // Movement vector
    let dx = 0;
    let dy = 0;
    if (this.input.up) dy -= 1;
    if (this.input.down) dy += 1;
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;

    if (dx !== 0 || dy !== 0) {
      // Normalize diagonal
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      let nextX = this.x + dx * this.speed * dt;
      let nextY = this.y + dy * this.speed * dt;

      // Map boundary & interior pillar collision
      if (map) {
        const resolved = map.resolveCircleCollision(nextX, nextY, this.radius);
        nextX = resolved.x;
        nextY = resolved.y;
      }

      // Barricade collision
      for (let i = 0; i < barricades.length; i++) {
        const b = barricades[i];
        if (b.isDead) continue;
        const bCol = b.resolveCircleCollision(nextX, nextY, this.radius);
        nextX = bCol.x;
        nextY = bCol.y;
      }

      this.x = nextX;
      this.y = nextY;
    }

    // HP regen
    if (this.hpRegen > 0 && !this.isDowned && !this.isDead) {
      this.hpRegenTimer += dt;
      if (this.hpRegenTimer >= 5) {
        this.hpRegenTimer = 0;
        this.hp = Math.min(this.maxHp + this.maxHpBonus, this.hp + this.hpRegen);
      }
    }
    // Life steal ICD decay
    if (this.lifeStealICD > 0) this.lifeStealICD -= dt;
  }

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
   * Adds ultimate charge to player pool.
   * @param {number} amount
   * @returns {number}
   */
  addUltCharge(amount) {
    if (this.character === 'MAGE') return 0;
    if (this.isDead || this.isDowned || typeof amount !== 'number' || amount <= 0) {
      return this.ultCharge;
    }
    this.ultCharge = Math.min(this.ultMaxCharge, Number((this.ultCharge + amount).toFixed(2)));
    return this.ultCharge;
  }

  /**
   * Records a zombie kill, increments combo, unlocks weapons or warrior skills,
   * and awards cooldown bonus on re-reaching combo milestones.
   * @param {number} [points=10]
   * @param {object} [options={}]
   * @returns {Array<object>} Newly unlocked weapons or warrior skills
   */
  recordKill(points = 10, options = {}) {
    const { awardUltCharge = true } = options;
    if (awardUltCharge && this.character !== 'MAGE') {
      const comboMult = Math.min(
        ULT_CHARGE_CONFIG.MAX_COMBO_MULTIPLIER,
        1 + Math.max(0, this.combo - 1) * ULT_CHARGE_CONFIG.COMBO_STEP_BONUS
      );
      this.addUltCharge(ULT_CHARGE_CONFIG.KILL_BASE * comboMult);
    }
    this.kills += 1;
    this.score += points * this.combo;
    this.combo += 1;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    // Dynamic combo window: gets tighter as combo increases (3.8s down to 1.5s)
    this.comboMaxTime = Math.max(1.5, 3.8 - (this.combo * 0.04));
    this.comboTimer = this.comboMaxTime;

    const newlyUnlocked = [];
    const maxProgression = Math.max(this.combo, this.maxCombo);

    if (this.character === 'WARRIOR' && this.warriorState) {
      const unlockedSkills = getUnlockedWarriorSkills(maxProgression);
      for (let i = 0; i < unlockedSkills.length; i++) {
        const s = unlockedSkills[i];
        const stateSkill = this.warriorState.skills[s.id];
        if (stateSkill && !stateSkill.unlocked) {
          stateSkill.unlocked = true;
          newlyUnlocked.push(s);
        } else if (stateSkill && stateSkill.unlocked && this.combo === s.unlockCombo) {
          if (s.slot >= 3 && s.slot <= 7) {
            this.applyWarriorCooldownBonus();
          }
        }
      }
      return newlyUnlocked;
    }

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

    // Check newly unlocked weapons (for standard gun classes)
    const unlocked = getUnlockedWeapons(maxProgression);
    for (let i = 0; i < unlocked.length; i++) {
      const w = unlocked[i];
      if (!this.weapons[w.id].unlocked) {
        this.weapons[w.id].unlocked = true;
        this.weapons[w.id].ammo = w.startingAmmo;
        newlyUnlocked.push(w);
      } else if (this.combo === w.unlockCombo) {
        this.addAmmo(w.id, Math.ceil(w.startingAmmo * 0.5));
      }
    }
    return newlyUnlocked;
  }

  /**
   * Deals damage to player, handling Counter Shield parry, Juggernaut frontal reduction,
   * Mana Shield absorption (Mage), Armor absorption before HP (Warrior), and state clearing on downed.
   * @param {number} amount
   * @param {string} [sourceType='MELEE']
   * @param {object} [options={}]
   * @param {number} [options.sourceX]
   * @param {number} [options.sourceY]
   * @param {boolean} [options.bypassShield=false]
   * @returns {{ blocked: boolean, parried: boolean, absorbedMana: number, damage: number, shieldBroken: boolean }}
   */
  takeDamage(amount, sourceType = 'MELEE', options = {}) {
    if (this.isDead || this.isDowned) {
      return { blocked: false, parried: false, absorbedMana: 0, damage: 0, shieldBroken: false };
    }
    if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
      return { blocked: false, parried: false, absorbedMana: 0, damage: 0, shieldBroken: false };
    }

    const opts = (options && typeof options === 'object') ? options : {};

    // 1. Counter Shield Parry Check (Warrior)
    if (
      this.character === 'WARRIOR' &&
      this.warriorState &&
      this.warriorState.counterShieldTimer > 0 &&
      !opts.bypassShield
    ) {
      const isFrontal = this.isAttackInFrontCone(
        opts.sourceX,
        opts.sourceY,
        WARRIOR_SKILLS.COUNTER_SHIELD_BASH.frontalArcHalfRad
      );
      if (isFrontal) {
        this.warriorState.counterShieldTimer = 0;
        this.warriorState.counterShieldActive = false;
        this.warriorState.pendingParry = {
          sourceX: opts.sourceX,
          sourceY: opts.sourceY,
          sourceType
        };
        return { blocked: true, parried: true, absorbedMana: 0, damage: 0, shieldBroken: false };
      }
    }

    // 2. Damage Reduction Calculation
    let reduction = 0;
    if (sourceType === 'MELEE' && this.meleeResistance > 0) {
      reduction += this.meleeResistance;
    }
    if (
      this.character === 'WARRIOR' &&
      this.warriorState &&
      this.warriorState.activeStance === 'JUGGERNAUT_STANCE'
    ) {
      const isFrontal = this.isAttackInFrontCone(
        opts.sourceX,
        opts.sourceY,
        WARRIOR_SKILLS.JUGGERNAUT_STANCE.frontalArcHalfRad
      );
      if (isFrontal) {
        reduction += WARRIOR_SKILLS.JUGGERNAUT_STANCE.frontalReduction;
      }
    }

    reduction = Math.min(0.9, Math.max(0, reduction));
    let finalAmount = Math.max(1, Math.round(amount * (1 - reduction)));

    // 3. Mana Shield Absorption (Mage: 1 damage = 1 Mana, absorbs 100% until Mana depleted)
    let absorbedMana = 0;
    let shieldBroken = false;
    if (
      this.character === 'MAGE' &&
      this.mageState &&
      (this.mageState.manaShieldActive || this.mageState.manaShieldTimer > 0)
    ) {
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
        return { blocked: true, parried: false, absorbedMana, damage: 0, shieldBroken };
      }
    }

    // 4. Armor absorbs before HP (Warrior & others)
    if (this.armor > 0) {
      if (this.armor >= finalAmount) {
        this.armor -= finalAmount;
      } else {
        const remaining = finalAmount - this.armor;
        this.armor = 0;
        this.hp -= remaining;
      }
    } else {
      this.hp -= finalAmount;
    }

    // 5. Downed & Active State Cleanup
    if (this.hp <= 0) {
      this.hp = 0;
      if (!this.isDowned) {
        this.isDowned = true;
        this.bleedoutTimer = 15;
      }
      this.clearMageChannels();
      this.clearWarriorActiveChannels();
    }

    return { blocked: false, parried: false, absorbedMana, damage: finalAmount, shieldBroken };
  }

  /**
   * Heals player HP up to maxHp.
   * @param {number} amount
   */
  heal(amount) {
    if (this.isDead || this.isDowned) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Adds ammo to specified weapon ID.
   * @param {string} weaponId
   * @param {number} amount
   */
  addAmmo(weaponId, amount) {
    if (this.weapons[weaponId]) {
      const bonus = this.ammoPickupBonus ? Math.round(amount * this.ammoPickupBonus) : amount;
      this.weapons[weaponId].ammo = Math.min(
        this.weapons[weaponId].maxAmmo,
        this.weapons[weaponId].ammo + bonus
      );
    }
  }

  /**
   * Revives a downed player, restoring HP and Armor (for Warrior) or Mana (for Mage).
   */
  revive() {
    this.isDowned = false;
    this.isDead = false;
    this.hp = 40;
    this.bleedoutTimer = 15;
    if (this.character === 'WARRIOR') {
      const restoreAmount = Math.round(this.maxArmor * WARRIOR_ARMOR_CONFIG.REVIVE_RESTORE_RATIO);
      this.armor = Math.min(this.maxArmor, restoreAmount);
    }
    if (this.character === 'MAGE') {
      this.restoreMana(Math.round(this.maxMana * MAGE_MANA_CONFIG.REVIVE_RESTORE_RATIO));
    }
  }

  /**
   * Starts reviving target player.
   * @param {Player} target
   */
  startRevive(target) {
    if (this.isDowned || this.isDead || !target || !target.isDowned || target.isDead) {
      this.revivingTarget = null;
      this.reviveProgress = 0;
      return;
    }
    this.revivingTarget = target;
  }

  /**
   * Advances revive channeling timer.
   * @param {number} dt
   * @returns {Player|false} Revived player or false if still in progress / cancelled
   */
  updateRevive(dt) {
    if (!this.revivingTarget || !this.revivingTarget.isDowned || this.revivingTarget.isDead) {
      this.revivingTarget = null;
      this.reviveProgress = 0;
      return false;
    }

    // Must be in close range (within 75px)
    const dist = Math.hypot(this.x - this.revivingTarget.x, this.y - this.revivingTarget.y);
    if (dist > 75) {
      this.revivingTarget = null;
      this.reviveProgress = 0;
      return false;
    }

    this.reviveProgress += dt;
    if (this.reviveProgress >= this.reviveDuration) {
      const target = this.revivingTarget;
      target.revive();
      this.revivingTarget = null;
      this.reviveProgress = 0;
      return target;
    }
    return false;
  }

  /**
   * Checks if player can perform primary attack / shoot.
   * @param {string|null} [weaponType=null]
   * @returns {boolean}
   */
  canShoot(weaponType = null) {
    if (this.isDowned || this.isDead) return false;
    if (this.fireCooldown > 0) return false;
    if (this.character === 'WARRIOR') {
      return true;
    }
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

  /**
   * Consumes ammo on weapon fire. No-op for WARRIOR and MAGE.
   * @param {string|null} [weaponType=null]
   */
  consumeAmmo(weaponType = null) {
    if (this.character === 'WARRIOR' || this.character === 'MAGE') return;
    const w = this.weapons[this.selectedWeapon];
    const def = WEAPONS[this.selectedWeapon];
    const resolvedType = weaponType || (def ? def.type : null);
    const isPlaceable = resolvedType === 'placeable_wall' || resolvedType === 'placeable_barrel';
    if (this.hasInfiniteAmmo && !isPlaceable) return;
    if (w && w.ammo !== Infinity && w.ammo > 0) {
      w.ammo -= 1;
      if (w.ammo <= 0) {
        this.selectedWeapon = 'PISTOL';
      }
    }
  }

  /**
   * Serializes player state for network synchronization.
   * @returns {object}
   */
  serialize() {
    let warriorStateSummary = null;
    if (this.character === 'WARRIOR' && this.warriorState) {
      const skillsSummary = {};
      for (const key of Object.keys(this.warriorState.skills)) {
        const sk = this.warriorState.skills[key];
        skillsSummary[key] = {
          id: sk.id,
          slot: sk.slot,
          unlocked: sk.unlocked,
          cooldown: Number(sk.cooldown.toFixed(1))
        };
      }
      warriorStateSummary = {
        activeStance: this.warriorState.activeStance,
        furyStacks: this.warriorState.furyStacks,
        furyTimer: Number(this.warriorState.furyTimer.toFixed(1)),
        skills: skillsSummary,
        counterShieldActive: Boolean(this.warriorState.counterShieldActive || this.warriorState.counterShieldTimer > 0),
        counterShieldTimer: Number(this.warriorState.counterShieldTimer.toFixed(1)),
        whirlwindActive: Boolean(
          this.warriorState.whirlwind &&
          (this.warriorState.whirlwind.timer > 0 || this.warriorState.whirlwind.ticksRemaining > 0)
        ),
        dashActive: Boolean(this.warriorState.dash && this.warriorState.dash.timer > 0),
        warCryAuraActive: Boolean(this.warriorState.warCryAuraTimer > 0),
        warCryAuraTimer: Number(this.warriorState.warCryAuraTimer.toFixed(1)),
        avatarActive: Boolean(this.warriorState.avatarActive || this.warriorState.avatarTimer > 0),
        avatarTimer: Number(this.warriorState.avatarTimer.toFixed(1))
      };
    }

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
      id: this.id,
      name: this.name,
      character: this.character,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: Number(this.angle.toFixed(2)),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      armor: Math.round(this.armor || 0),
      maxArmor: this.maxArmor || 0,
      mana: Math.floor(this.mana || 0),
      maxMana: this.maxMana || 0,
      hasWarCryBuff: Boolean(this.hasWarCryBuff),
      hasSanctuaryBuff: Boolean(this.hasSanctuaryBuff),
      warriorState: warriorStateSummary,
      mageState: mageStateSummary,
      isDowned: this.isDowned,
      isDead: this.isDead,
      bleedoutTimer: Math.ceil(this.bleedoutTimer),
      selectedWeapon: this.selectedWeapon,
      score: this.score,
      kills: this.kills,
      combo: this.combo,
      maxCombo: this.maxCombo,
      comboTimer: Number(this.comboTimer.toFixed(1)),
      comboMaxTime: Number(this.comboMaxTime.toFixed(1)),
      weapons: this.weapons,
      isMoving: Boolean(this.input.up || this.input.down || this.input.left || this.input.right),
      ultCharge: Math.floor(this.ultCharge),
      ultMaxCharge: this.ultMaxCharge,
      ultimateId: this.ultimateId,
      hasInfiniteAmmo: this.hasInfiniteAmmo,
      materials: Math.floor(this.materials || 0),
      inventory: this.inventory || []
    };
  }
}

module.exports = { Player, CLASS_CONFIGS };
