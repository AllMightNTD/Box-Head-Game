const { Bullet } = require('./Bullet.js');

const ZOMBIE_TYPES = {
  NORMAL: {
    hp: 80,
    speed: 110,
    damage: 15,
    radius: 23,
    score: 10,
    color: '#388e3c',
    attackCooldown: 0.9
  },
  RUNNER: {
    hp: 45,
    speed: 190,
    damage: 12,
    radius: 21,
    score: 15,
    color: '#d32f2f',
    attackCooldown: 0.7
  },
  TANK: {
    hp: 400,
    speed: 70,
    damage: 35,
    radius: 34,
    score: 40,
    color: '#455a64',
    attackCooldown: 1.2
  },
  DEVIL: {
    hp: 250,
    speed: 95,
    damage: 20,
    radius: 28,
    score: 50,
    color: '#b71c1c',
    attackCooldown: 2.2,
    preferredDistance: 320
  },
  VAMPIRE: {
    hp: 65,
    speed: 130,
    damage: 18,
    radius: 22,
    score: 35,
    color: '#880e4f',
    attackCooldown: 0.8
  },
  MUMMY: {
    hp: 140,
    speed: 55,
    damage: 22,
    radius: 25,
    score: 25,
    color: '#d7ccc8',
    attackCooldown: 1.0
  }
};

class Zombie {
  constructor(id, type = 'NORMAL', x = 0, y = 0) {
    this.id = id;
    this.type = type;
    const config = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.NORMAL;

    this.maxHp = config.hp;
    this.hp = this.maxHp;
    this.speed = config.speed;
    this.damage = config.damage;
    this.radius = config.radius;
    this.score = config.score;
    this.color = config.color;
    this.attackInterval = config.attackCooldown;
    this.preferredDistance = config.preferredDistance || 0;

    this.x = x;
    this.y = y;
    this.angle = 0;
    this.isDead = false;

    this.attackCooldown = Math.random() * 0.5;
    this.knockbackX = 0;
    this.knockbackY = 0;

    // Vampire special: sidestep dash timer
    this.dashTimer = 3.5;
    this.isDashing = 0;

    // Special states / Crowd Control (CC)
    this.stunTimer = 0;
    this.freezeTimer = 0;
    this.slowTimer = 0;
    this.slowFactor = 1.0;

    // Transient flags for client animations
    this.isAttacking = false;
    this.isHit = false;
  }

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

  applyStun(duration) {
    if (this.isDead || typeof duration !== 'number' || duration <= 0) return;
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  applyFreeze(freezeDuration, slowDuration = 0, slowFactor = 0.5) {
    if (this.isDead || typeof freezeDuration !== 'number' || freezeDuration <= 0) return;
    this.freezeTimer = Math.max(this.freezeTimer, freezeDuration);
    if (slowDuration > 0) {
      this.slowTimer = Math.max(this.slowTimer, freezeDuration + slowDuration);
      this.slowFactor = Math.min(this.slowFactor, slowFactor);
    }
  }

  applyKnockback(angle, force) {
    this.knockbackX += Math.cos(angle) * force;
    this.knockbackY += Math.sin(angle) * force;
    this.isHit = true;
  }

  takeDamage(amount, sourceType = 'BULLET') {
    if (this.isDead) return;
    let actualAmount = amount;
    if (this.type === 'MUMMY') {
      if (sourceType === 'BULLET') {
        actualAmount = Math.max(1, Math.round(amount * 0.7)); // -30% bullet resistance
      } else if (sourceType === 'EXPLOSION' || sourceType === 'FIRE') {
        actualAmount = Math.round(amount * 1.5); // +50% explosive/fire vulnerability
      }
    }
    this.hp -= actualAmount;
    this.isHit = true;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }

  update(dt, players = [], barricades = [], map = null, bulletsQueue = []) {
    if (this.isDead) return;

    this.isAttacking = false;
    this.isHit = false;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // Decay knockback with wall/barricade collision
    if (Math.abs(this.knockbackX) > 0.1 || Math.abs(this.knockbackY) > 0.1) {
      this.moveWithCollision(this.knockbackX * dt, this.knockbackY * dt, map, barricades);
    }
    this.knockbackX *= Math.max(0, 1 - 10 * dt);
    this.knockbackY *= Math.max(0, 1 - 10 * dt);

    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer === 0) this.slowFactor = 1.0;
    }

    // Stunned or frozen zombies cannot act, move, or attack
    if (this.stunTimer > 0 || this.freezeTimer > 0) {
      return;
    }

    const speedMult = this.slowTimer > 0 ? this.slowFactor : 1.0;

    // Find nearest alive player
    let target = null;
    let minDist = Infinity;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.isDead) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < minDist) {
        minDist = d;
        target = p;
      }
    }

    if (!target) return;

    const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
    this.angle = angleToTarget;

    // 1. Devil Boss AI
    if (this.type === 'DEVIL') {
      if (this.attackCooldown <= 0 && minDist < 800) {
        this.attackCooldown = this.attackInterval;
        this.isAttacking = true;
        const fireball = new Bullet(
          'fb_' + Math.random().toString(36).substring(2, 7),
          'devil_' + this.id,
          this.x + Math.cos(this.angle) * (this.radius + 15),
          this.y + Math.sin(this.angle) * (this.radius + 15),
          this.angle,
          {
            speed: 260,
            damage: 25,
            range: 800,
            radius: 12,
            type: 'fireball',
            isFireball: true,
            explosionRadius: 55,
            explosionDamage: 45
          }
        );
        bulletsQueue.push(fireball);
      }

      let moveDir = 0;
      if (minDist > this.preferredDistance + 40) {
        moveDir = 1;
      } else if (minDist < this.preferredDistance - 40) {
        moveDir = -1;
      }

      if (moveDir !== 0) {
        let vx = Math.cos(this.angle) * this.speed * speedMult * moveDir * dt;
        let vy = Math.sin(this.angle) * this.speed * speedMult * moveDir * dt;
        this.moveWithCollision(vx, vy, map, barricades);
      }
      return;
    }

    // 2. Vampire Special Dash
    if (this.type === 'VAMPIRE') {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0 && minDist > 100 && minDist < 450) {
        this.dashTimer = 3.5;
        this.isDashing = 0.2; // 200ms burst
      }
      if (this.isDashing > 0) {
        this.isDashing -= dt;
        // Dash orthogonally/diagonally towards player
        const dashAngle = this.angle + (Math.sin(this.x) > 0 ? 0.6 : -0.6);
        const vx = Math.cos(dashAngle) * 360 * speedMult * dt;
        const vy = Math.sin(dashAngle) * 360 * speedMult * dt;
        this.moveWithCollision(vx, vy, map, barricades);
        return;
      }
    }

    // 3. Melee Attack Check
    const meleeRange = this.radius + target.radius + 8;
    if (minDist <= meleeRange) {
      if (this.attackCooldown <= 0) {
        this.isAttacking = true;
        target.takeDamage(this.damage, 'MELEE');
        if (this.type === 'VAMPIRE') {
          this.hp = Math.min(this.maxHp, this.hp + 15); // Lifesteal
        }
        this.attackCooldown = this.attackInterval;
      }
      return;
    }

    // 4. Barricade / Barrel obstacle attack
    let obstacleInWay = null;
    for (let i = 0; i < barricades.length; i++) {
      const b = barricades[i];
      if (b.isDead) continue;
      const distToB = Math.hypot(b.x - this.x, b.y - this.y);
      if (distToB <= (this.radius + 30)) {
        obstacleInWay = b;
        break;
      }
    }

    if (obstacleInWay) {
      if (obstacleInWay.type === 'barrel') {
        // Barrels detonate instantly on contact in GameRoom tick
      } else if (this.attackCooldown <= 0) {
        this.isAttacking = true;
        obstacleInWay.takeDamage(this.damage);
        this.attackCooldown = this.attackInterval;
      }
    }

    // 5. Standard movement towards target
    const vx = Math.cos(this.angle) * this.speed * speedMult * dt;
    const vy = Math.sin(this.angle) * this.speed * speedMult * dt;
    this.moveWithCollision(vx, vy, map, barricades);
  }

  moveWithCollision(vx, vy, map, barricades) {
    let nextX = this.x + vx;
    let nextY = this.y + vy;

    if (map) {
      const resolved = map.resolveCircleCollision(nextX, nextY, this.radius);
      nextX = resolved.x;
      nextY = resolved.y;
    }

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

  serialize() {
    return {
      id: this.id,
      type: this.type,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: Number(this.angle.toFixed(2)),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      isAttacking: this.isAttacking,
      isHit: this.isHit,
      isStunned: this.stunTimer > 0,
      isFrozen: this.freezeTimer > 0,
      isChilled: this.slowTimer > 0 && this.freezeTimer <= 0
    };
  }
}

module.exports = { Zombie, ZOMBIE_TYPES };
