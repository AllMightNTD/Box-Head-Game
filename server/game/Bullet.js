function distToSegmentSquared(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

class Bullet {
  constructor(id, ownerId, x, y, angle, options = {}) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.angle = angle;

    this.speed = options.speed || 900;
    this.damage = options.damage || 25;
    this.range = options.range || 1200;
    this.distanceTraveled = 0;
    this.isDead = false;

    this.type = options.type || (options.isFireball ? 'fireball' : 'bullet'); // bullet | shotgun | rocket | grenade | railgun | fireball | wind_blade | fire_slash | arcane_bolt | mage_fireball
    this.isFireball = Boolean(options.isFireball);
    this.isMageFireball = Boolean(options.isMageFireball || options.type === 'mage_fireball');
    this.isExplosive = options.type === 'rocket' || options.type === 'grenade' || this.isFireball || this.isMageFireball;
    this.explosionRadius = options.explosionRadius || (this.isFireball ? 90 : (this.isMageFireball ? 140 : 160));
    this.explosionDamage = options.explosionDamage || this.damage;
    this.damageType = options.damageType || (this.isMageFireball || options.type === 'fire_slash' ? 'FIRE' : (this.type === 'arcane_bolt' ? 'MAGIC' : 'BULLET'));
    this.penetration = options.penetration !== undefined
      ? Boolean(options.penetration)
      : (options.type === 'wind_blade' || options.type === 'fire_slash');
    this.hitTargets = this.penetration ? new Set() : null;
    this.knockback = options.knockback !== undefined ? options.knockback : (options.type === 'shotgun' ? 180 : 50);
    this.fromUlt = Boolean(options.fromUlt);

    // Fuse time for grenades
    this.fuseTime = options.fuseTime || 0;
    this.life = 0;
    this.radius = options.radius || (
      this.isMageFireball ? 14 :
      (this.isFireball ? 12 :
      (options.type === 'wind_blade' || options.type === 'fire_slash' ? 16 :
      (options.type === 'rocket' ? 8 :
      (options.type === 'arcane_bolt' ? 7 : 4))))
    );
  }

  createExplosionPayload() {
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

  update(dt, map) {
    if (this.isDead) return null;

    this.life += dt;
    if (this.type === 'grenade') {
      // Grenades slow down due to friction
      this.speed = Math.max(0, this.speed - 300 * dt);
      if (this.life >= this.fuseTime) {
        this.isDead = true;
        return this.createExplosionPayload();
      }
    }

    this.prevX = this.x;
    this.prevY = this.y;

    const totalDist = this.speed * dt;
    const maxSubStep = 20;
    const steps = (totalDist > maxSubStep && map) ? Math.max(1, Math.ceil(totalDist / maxSubStep)) : 1;
    const stepDist = totalDist / steps;
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);

    for (let s = 0; s < steps; s++) {
      this.x += cosA * stepDist;
      this.y += sinA * stepDist;
      this.distanceTraveled += stepDist;

      if (map && map.isWall(this.x, this.y, this.radius)) {
        this.isDead = true;
        return this.isExplosive ? this.createExplosionPayload() : null;
      }

      if (this.distanceTraveled >= this.range) {
        this.isDead = true;
        return this.isExplosive ? this.createExplosionPayload() : null;
      }
    }

    return null;
  }

  checkHit(targetCircle) {
    if (this.isDead) return false;
    const hitRadius = targetCircle.radius + this.radius;
    const hitRadiusSq = hitRadius * hitRadius;

    const dx = this.x - targetCircle.x;
    const dy = this.y - targetCircle.y;
    if ((dx * dx + dy * dy) <= hitRadiusSq) {
      return true;
    }

    if (this.prevX !== this.x || this.prevY !== this.y) {
      return distToSegmentSquared(targetCircle.x, targetCircle.y, this.prevX, this.prevY, this.x, this.y) <= hitRadiusSq;
    }

    return false;
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

module.exports = { Bullet, distToSegmentSquared };
