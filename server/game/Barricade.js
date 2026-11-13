class Barricade {
  constructor(id, x, y, ownerId = null) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.size = 44;
    this.half = this.size / 2;
    this.maxHp = 300;
    this.hp = this.maxHp;
    this.isDead = false;
    this.type = 'barricade';
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }

  resolveCircleCollision(cx, cy, radius) {
    if (this.isDead) return { x: cx, y: cy };

    const left = this.x - this.half;
    const right = this.x + this.half;
    const top = this.y - this.half;
    const bottom = this.y + this.half;

    const closestX = Math.max(left, Math.min(cx, right));
    const closestY = Math.max(top, Math.min(cy, bottom));

    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < radius * radius) {
      if (distSq <= 0.0001) {
        return { x: cx + radius, y: cy };
      }
      const dist = Math.sqrt(distSq);
      const overlap = radius - dist;
      return {
        x: cx + (dx / dist) * overlap,
        y: cy + (dy / dist) * overlap
      };
    }
    return { x: cx, y: cy };
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      type: this.type,
      hp: Math.round(this.hp),
      maxHp: this.maxHp
    };
  }
}

class Barrel {
  constructor(id, x, y, ownerId = null) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.radius = 20;
    this.maxHp = 40;
    this.hp = this.maxHp;
    this.isDead = false;
    this.isExploding = false;
    this.type = 'barrel';
    this.explosionRadius = 150;
    this.explosionDamage = 250;
  }

  takeDamage(amount, allBarrels = [], onExplode = null) {
    if (this.isDead || this.isExploding) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.detonate(allBarrels, onExplode);
    }
  }

  detonate(allBarrels = [], onExplode = null) {
    if (this.isDead || this.isExploding) return;
    this.isExploding = true;
    this.isDead = true;
    this.hp = 0;

    if (typeof onExplode === 'function') {
      onExplode(this.x, this.y, this.explosionRadius, this.explosionDamage, this.ownerId);
    }

    // Trigger chain reaction on adjacent barrels
    for (let i = 0; i < allBarrels.length; i++) {
      const other = allBarrels[i];
      if (other === this || other.isDead || other.isExploding) continue;
      const dist = Math.hypot(this.x - other.x, this.y - other.y);
      if (dist <= this.explosionRadius) {
        // Chain reaction with small delay or immediate
        other.takeDamage(this.explosionDamage, allBarrels, onExplode);
      }
    }
  }

  resolveCircleCollision(cx, cy, radius) {
    if (this.isDead) return { x: cx, y: cy };
    const dx = cx - this.x;
    const dy = cy - this.y;
    const distSq = dx * dx + dy * dy;
    const totalRadius = radius + this.radius;

    if (distSq < totalRadius * totalRadius && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = totalRadius - dist;
      return {
        x: cx + (dx / dist) * overlap,
        y: cy + (dy / dist) * overlap
      };
    }
    return { x: cx, y: cy };
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      type: this.type,
      hp: Math.round(this.hp),
      maxHp: this.maxHp
    };
  }
}

module.exports = { Barricade, Barrel };
