const { WEAPONS, getUnlockedWeapons } = require('./WeaponsConfig.js');
const { ULT_CHARGE_CONFIG, getUltimateConfigForClass } = require('./UltimateConfig.js');

const CLASS_CONFIGS = {
  HUMAN: {
    maxHp: 100,
    speed: 160, // 1.0x (160 px/s)
    ammoPickupBonus: 1.25,
    reloadSpeedMultiplier: 1.15,
    meleeResistance: 0,
    knockbackImmune: false,
    comboDecayMultiplier: 1.0
  },
  WARRIOR: {
    maxHp: 150,
    speed: 144, // 0.9x (144 px/s)
    ammoPickupBonus: 1.0,
    reloadSpeedMultiplier: 1.0,
    meleeResistance: 0.25, // -25% melee damage
    knockbackImmune: true,
    comboDecayMultiplier: 1.0
  },
  MAGE: {
    maxHp: 85,
    speed: 188, // 1.18x (188 px/s)
    ammoPickupBonus: 1.0,
    reloadSpeedMultiplier: 1.0,
    meleeResistance: 0,
    knockbackImmune: false,
    comboDecayMultiplier: 0.8 // combo decay is 20% slower
  }
};

class Player {
  constructor(id, name, character = 'HUMAN', x = 800, y = 600) {
    this.id = id;
    this.name = name || 'Hero';
    this.character = character || 'HUMAN';
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.angle = 0;

    // Apply class configuration if exists, else fallback to standard human
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

    // Weapons setup
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
    this.selectedWeapon = 'PISTOL';
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
  }

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

    if (input.weaponId && this.weapons[input.weaponId] && this.weapons[input.weaponId].unlocked) {
      this.selectedWeapon = input.weaponId;
    }
  }

  update(dt, map, barricades = []) {
    if (this.isDead) return;

    if (this.isDowned) {
      this.bleedoutTimer -= dt;
      if (this.bleedoutTimer <= 0) {
        this.isDead = true;
        this.isDowned = false;
        this.hp = 0;
      }
      return;
    }

    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt * (this.reloadSpeedMultiplier || 1.0);
    }

    // Update combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt * (this.comboDecayMultiplier || 1.0);
    }
    if (this.comboTimer <= 0) {
      this.combo = 1;
      this.comboTimer = 0;
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
  }

  applyClassConfig(character) {
    this.character = character || 'HUMAN';
    const cConf = CLASS_CONFIGS[this.character] || CLASS_CONFIGS.HUMAN;
    const ultConf = getUltimateConfigForClass(this.character);
    this.maxHp = cConf.maxHp;
    this.hp = this.maxHp;
    this.baseSpeed = cConf.speed;
    this.speed = this.baseSpeed;
    this.ammoPickupBonus = cConf.ammoPickupBonus;
    this.reloadSpeedMultiplier = cConf.reloadSpeedMultiplier;
    this.meleeResistance = cConf.meleeResistance;
    this.knockbackImmune = cConf.knockbackImmune;
    this.comboDecayMultiplier = cConf.comboDecayMultiplier;
    this.ultimateId = ultConf.id;
  }

  addUltCharge(amount) {
    if (this.isDead || this.isDowned || typeof amount !== 'number' || amount <= 0) {
      return this.ultCharge;
    }
    this.ultCharge = Math.min(this.ultMaxCharge, Number((this.ultCharge + amount).toFixed(2)));
    return this.ultCharge;
  }

  recordKill(points = 10, options = {}) {
    const { awardUltCharge = true } = options;
    if (awardUltCharge) {
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

    // Check newly unlocked weapons
    const newlyUnlocked = [];
    const maxProgression = Math.max(this.combo, this.maxCombo);
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

  takeDamage(amount, sourceType = 'MELEE') {
    if (this.isDead || this.isDowned) return;
    let finalAmount = amount;
    if (sourceType === 'MELEE' && this.meleeResistance > 0) {
      finalAmount = Math.max(1, Math.round(amount * (1 - this.meleeResistance)));
    }
    this.hp -= finalAmount;
    if (this.hp <= 0) {
      this.hp = 0;
      if (!this.isDowned) {
        this.isDowned = true;
        this.bleedoutTimer = 15;
      }
    }
  }

  heal(amount) {
    if (this.isDead || this.isDowned) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addAmmo(weaponId, amount) {
    if (this.weapons[weaponId]) {
      const bonus = this.ammoPickupBonus ? Math.round(amount * this.ammoPickupBonus) : amount;
      this.weapons[weaponId].ammo = Math.min(
        this.weapons[weaponId].maxAmmo,
        this.weapons[weaponId].ammo + bonus
      );
    }
  }

  startRevive(target) {
    if (this.isDowned || this.isDead || !target || !target.isDowned || target.isDead) {
      this.revivingTarget = null;
      this.reviveProgress = 0;
      return;
    }
    this.revivingTarget = target;
  }

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
      this.revivingTarget.isDowned = false;
      this.revivingTarget.hp = 40;
      this.revivingTarget.bleedoutTimer = 15;
      const target = this.revivingTarget;
      this.revivingTarget = null;
      this.reviveProgress = 0;
      return target;
    }
    return false;
  }

  canShoot(weaponType = null) {
    if (this.isDowned || this.isDead) return false;
    if (this.fireCooldown > 0) return false;
    const w = this.weapons[this.selectedWeapon];
    if (!w || !w.unlocked) return false;
    const def = WEAPONS[this.selectedWeapon];
    const resolvedType = weaponType || (def ? def.type : null);
    const isPlaceable = resolvedType === 'placeable_wall' || resolvedType === 'placeable_barrel';
    if (this.hasInfiniteAmmo && !isPlaceable) return true;
    return w.ammo > 0;
  }

  consumeAmmo(weaponType = null) {
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

  serialize() {
    return {
      id: this.id,
      name: this.name,
      character: this.character,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: Number(this.angle.toFixed(2)),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
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
      hasInfiniteAmmo: this.hasInfiniteAmmo
    };
  }
}

module.exports = { Player, CLASS_CONFIGS };
