class Bullet {
  constructor(id, ownerId, x, y, angle, options = {}) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.angle = angle;

    this.speed = options.speed || 900;
    this.damage = options.damage || 25;
    this.range = options.range || 1200;
    this.distanceTraveled = 0;
    this.isDead = false;

    this.isFireball = Boolean(options.isFireball);
    this.type = options.type || (this.isFireball ? 'fireball' : 'bullet'); // bullet | shotgun | rocket | grenade | railgun | fireball
    this.isExplosive = options.type === 'rocket' || options.type === 'grenade' || this.isFireball;
    this.explosionRadius = options.explosionRadius || (this.isFireball ? 90 : 160);
    this.explosionDamage = options.explosionDamage || this.damage;
    this.penetration = Boolean(options.penetration);
    this.knockback = options.knockback || (options.type === 'shotgun' ? 180 : 50);
    this.fromUlt = Boolean(options.fromUlt);

    // Fuse time for grenades
    this.fuseTime = options.fuseTime || 0;
    this.life = 0;
    this.radius = this.isFireball ? 12 : (options.type === 'rocket' ? 8 : 4);
  }

  update(dt, map) {
    if (this.isDead) return null;

    this.life += dt;
    if (this.type === 'grenade') {
      // Grenades slow down due to friction
      this.speed = Math.max(0, this.speed - 300 * dt);
      if (this.life >= this.fuseTime) {
        this.isDead = true;
        return {
          exploded: true,
          x: this.x,
          y: this.y,
          radius: this.explosionRadius,
          damage: this.explosionDamage,
          ownerId: this.ownerId,
          source: (this.type || 'generic').toUpperCase()
        };
      }
    }

    const dist = this.speed * dt;
    this.x += Math.cos(this.angle) * dist;
    this.y += Math.sin(this.angle) * dist;
    this.distanceTraveled += dist;

    // Check boundary or wall hit
    if (map && map.isWall(this.x, this.y, this.radius)) {
      this.isDead = true;
      if (this.isExplosive) {
        return {
          exploded: true,
          x: this.x,
          y: this.y,
          radius: this.explosionRadius,
          damage: this.explosionDamage,
          ownerId: this.ownerId,
          source: (this.type || 'generic').toUpperCase()
        };
      }
      return null;
    }

    // Out of range
    if (this.distanceTraveled >= this.range) {
      this.isDead = true;
      if (this.isExplosive) {
        return {
          exploded: true,
          x: this.x,
          y: this.y,
          radius: this.explosionRadius,
          damage: this.explosionDamage,
          ownerId: this.ownerId,
          source: (this.type || 'generic').toUpperCase()
        };
      }
      return null;
    }

    return null;
  }

  checkHit(targetCircle) {
    if (this.isDead) return false;
    const hitRadius = targetCircle.radius + this.radius;
    const dx = this.x - targetCircle.x;
    const dy = this.y - targetCircle.y;
    return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: Number(this.angle.toFixed(2)),
      type: this.type,
      isFireball: this.isFireball
    };
  }
}

module.exports = { Bullet };
