const { Bullet } = require('./Bullet.js');
const { ULTIMATE_CONFIGS } = require('./UltimateConfig.js');

class TacticalDrone {
  constructor(id, ownerId, x, y, config = ULTIMATE_CONFIGS.HUMAN) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.angle = 0;

    this.maxLife = config.duration || 8.0;
    this.life = this.maxLife;
    this.auraRadius = config.auraRadius || 200;
    this.range = config.range || 480;
    this.fireDelay = 1 / (config.fireRate || 5.0);
    this.fireCooldown = 0;
    this.damage = config.bulletDamage || 22;
    this.bulletSpeed = config.bulletSpeed || 1000;
    this.knockback = config.knockback || 25;
  }

  isDead() {
    return this.life <= 0;
  }

  isPlayerInAura(player) {
    if (!player || player.isDead || player.isDowned) return false;
    return Math.hypot(player.x - this.x, player.y - this.y) <= this.auraRadius;
  }

  update(dt, zombies = [], bulletsQueue = []) {
    this.life -= dt;
    if (this.life <= 0) {
      this.life = 0;
      return null;
    }

    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    // Acquire nearest alive zombie within range
    let nearest = null;
    let minDist = this.range;
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i];
      if (!z || z.isDead) continue;
      const d = Math.hypot(z.x - this.x, z.y - this.y);
      if (d <= minDist) {
        minDist = d;
        nearest = z;
      }
    }

    if (!nearest) return null;

    this.angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
    if (this.fireCooldown > 0) return null;

    this.fireCooldown = this.fireDelay;
    const muzzleX = this.x + Math.cos(this.angle) * 18;
    const muzzleY = this.y + Math.sin(this.angle) * 18;
    const bullet = new Bullet(
      'db_' + Math.random().toString(36).substring(2, 8),
      this.ownerId,
      muzzleX,
      muzzleY,
      this.angle,
      {
        speed: this.bulletSpeed,
        damage: this.damage,
        range: this.range + 60,
        type: 'drone',
        knockback: this.knockback,
        fromUlt: true
      }
    );
    bulletsQueue.push(bullet);
    return { fired: true, x: Math.round(muzzleX), y: Math.round(muzzleY), angle: this.angle };
  }

  serialize() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: Number(this.angle.toFixed(2)),
      auraRadius: this.auraRadius,
      life: Number(this.life.toFixed(2)),
      maxLife: this.maxLife
    };
  }
}

module.exports = { TacticalDrone };

