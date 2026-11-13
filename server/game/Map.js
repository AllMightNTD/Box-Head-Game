const { getMapConfig, DEFAULT_MAP_ID } = require('./MapConfig.js');

class GameMap {
  constructor(mapIdOrWidth = DEFAULT_MAP_ID, height = 1200) {
    let mapId = DEFAULT_MAP_ID;
    if (typeof mapIdOrWidth === 'string') {
      mapId = mapIdOrWidth;
    }

    const config = getMapConfig(mapId);
    this.id = config.id;
    this.name = config.name;
    this.subtitle = config.subtitle;
    this.desc = config.desc;
    this.badge = config.badge;
    this.badgeColor = config.badgeColor;
    this.theme = config.theme;

    this.width = (typeof mapIdOrWidth === 'number') ? mapIdOrWidth : (config.width || 1600);
    this.height = height || config.height || 1200;
    this.boundaryThickness = config.boundaryThickness || 40;

    this.walls = config.walls.map(w => ({ ...w }));
    this.playerSpawns = config.playerSpawns.map(s => ({ ...s }));
    this.zombieSpawns = config.zombieSpawns.map(s => ({ ...s }));
  }

  isWall(x, y, radius = 0) {
    for (let i = 0; i < this.walls.length; i++) {
      const w = this.walls[i];
      // Closest point on rectangle to circle center
      const closestX = Math.max(w.x, Math.min(x, w.x + w.w));
      const closestY = Math.max(w.y, Math.min(y, w.y + w.h));

      const dx = x - closestX;
      const dy = y - closestY;
      if ((dx * dx + dy * dy) < (radius * radius)) {
        return true;
      }
    }
    return false;
  }

  resolveCircleCollision(x, y, radius) {
    let nextX = x;
    let nextY = y;

    // Check boundary limits
    const minX = this.boundaryThickness + radius;
    const maxX = this.width - this.boundaryThickness - radius;
    const minY = this.boundaryThickness + radius;
    const maxY = this.height - this.boundaryThickness - radius;

    nextX = Math.max(minX, Math.min(nextX, maxX));
    nextY = Math.max(minY, Math.min(nextY, maxY));

    // Check interior pillars
    for (let i = 0; i < this.walls.length; i++) {
      const w = this.walls[i];
      if (w.type === 'boundary') continue;

      const closestX = Math.max(w.x, Math.min(nextX, w.x + w.w));
      const closestY = Math.max(w.y, Math.min(nextY, w.y + w.h));

      const dx = nextX - closestX;
      const dy = nextY - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < radius * radius && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = radius - dist;
        nextX += (dx / dist) * overlap;
        nextY += (dy / dist) * overlap;
      }
    }

    return { x: nextX, y: nextY };
  }

  clampToBounds(x, y, radius = 0) {
    const minX = this.boundaryThickness + radius;
    const maxX = this.width - this.boundaryThickness - radius;
    const minY = this.boundaryThickness + radius;
    const maxY = this.height - this.boundaryThickness - radius;

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY))
    };
  }

  getRandomZombieSpawn() {
    const idx = Math.floor(Math.random() * this.zombieSpawns.length);
    const base = this.zombieSpawns[idx];
    return {
      x: base.x + (Math.random() * 40 - 20),
      y: base.y + (Math.random() * 40 - 20)
    };
  }
}

module.exports = { GameMap };
