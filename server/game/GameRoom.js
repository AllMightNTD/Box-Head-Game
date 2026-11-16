const { Player } = require('./Player.js');
const { Zombie } = require('./Zombie.js');
const { Bullet } = require('./Bullet.js');
const { Barricade, Barrel } = require('./Barricade.js');
const { GameMap } = require('./Map.js');
const { WEAPONS } = require('./WeaponsConfig.js');
const { ULT_CHARGE_CONFIG } = require('./UltimateConfig.js');
const { triggerPlayerUltimate } = require('./UltimateAbilities.js');

class GameRoom {
  constructor(id, name, io, mapId = 'THE_ROOMS') {
    this.id = id;
    this.name = name;
    this.io = io;

    this.mapId = mapId;
    this.map = new GameMap(mapId);
    this.players = new Map();
    this.zombies = [];
    this.bullets = [];
    this.barricades = [];
    this.pickups = [];
    this.drones = [];

    this.state = 'LOBBY'; // LOBBY | PLAYING | INTERMISSION | GAMEOVER
    this.wave = 1;
    this.waveTotalZombies = 0;
    this.zombiesSpawnedInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 0.8;
    this.intermissionTimer = 0;
    this.intermissionDuration = 5;

    this.gameLoopInterval = null;
    this.eventsBuffer = [];
  }

  setMap(mapId) {
    if (this.state === 'PLAYING') return;
    this.mapId = mapId;
    this.map = new GameMap(mapId);
    let idx = 0;
    for (const p of this.players.values()) {
      const sp = this.map.playerSpawns[idx % this.map.playerSpawns.length];
      p.x = sp.x;
      p.y = sp.y;
      idx++;
    }
  }

  initGame(mapId = 'THE_ROOMS') {
    if (mapId) this.setMap(mapId);
  }

  addPlayer(socketId, name, character) {
    const spawnIndex = this.players.size % this.map.playerSpawns.length;
    const spawn = this.map.playerSpawns[spawnIndex];
    const player = new Player(socketId, name, character, spawn.x, spawn.y);
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.players.size === 0) {
      this.stop();
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.wave = 1;
    this.zombies = [];
    this.bullets = [];
    this.barricades = [];
    this.pickups = [];
    this.drones = [];
    this.eventsBuffer = [{ type: 'SESSION_RESET' }];

    // Reset player positions & health
    let idx = 0;
    for (const p of this.players.values()) {
      const sp = this.map.playerSpawns[idx % this.map.playerSpawns.length];
      p.x = sp.x;
      p.y = sp.y;
      p.hp = p.maxHp;
      p.isDowned = false;
      p.isDead = false;
      p.ultCharge = 0;
      p.hasInfiniteAmmo = false;
      p.revivingTarget = null;
      p.reviveProgress = 0;
      p.combo = 1;
      p.maxCombo = 1;
      p.comboTimer = 0;
      p.score = 0;
      p.kills = 0;
      for (const key of Object.keys(WEAPONS)) {
        const w = WEAPONS[key];
        p.weapons[key] = {
          id: w.id,
          unlocked: w.unlockCombo === 1,
          ammo: w.startingAmmo,
          maxAmmo: w.maxAmmo
        };
      }
      p.selectedWeapon = 'PISTOL';
      idx++;
    }

    this.startWave(1);

    if (!this.gameLoopInterval) {
      this.gameLoopInterval = setInterval(() => {
        this.tick(0.02); // 50 Hz tick rate
      }, 20);
    }
  }

  startWave(waveNum) {
    this.wave = waveNum;
    this.waveTotalZombies = 12 + waveNum * 8;
    this.zombiesSpawnedInWave = 0;
    this.spawnInterval = Math.max(0.2, 1.2 - waveNum * 0.05);
    this.spawnTimer = 0.5;

    this.eventsBuffer.push({
      type: 'WAVE_START',
      wave: this.wave,
      totalZombies: this.waveTotalZombies
    });
  }

  spawnZombie() {
    if (this.zombiesSpawnedInWave >= this.waveTotalZombies) return;

    // Pick zombie type based on wave
    let type = 'NORMAL';
    const rand = Math.random();

    if (this.wave >= 6 && rand < 0.12) {
      type = 'VAMPIRE';
    } else if (this.wave >= 5 && rand < 0.22) {
      type = 'MUMMY';
    } else if (this.wave >= 4 && rand < 0.32) {
      type = 'DEVIL';
    } else if (this.wave >= 3 && rand < 0.45) {
      type = 'TANK';
    } else if (rand < Math.min(0.55, 0.15 + this.wave * 0.04)) {
      type = 'RUNNER';
    }

    const spawn = this.map.getRandomZombieSpawn();
    const id = 'z_' + Math.random().toString(36).substring(2, 7);
    const zombie = new Zombie(id, type, spawn.x, spawn.y);
    this.zombies.push(zombie);
    this.zombiesSpawnedInWave++;
  }

  handleShoot(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    const weapon = WEAPONS[player.selectedWeapon];
    if (!weapon) return;

    // If placeable, route to placeItem
    if (weapon.type === 'placeable_wall' || weapon.type === 'placeable_barrel') {
      this.handlePlaceItem(socketId);
      return;
    }

    if (!player.canShoot(weapon.type)) return;

    player.fireCooldown = weapon.fireDelay;
    player.consumeAmmo(weapon.type);

    // Muzzle position slightly forward for 2x weapon
    const muzzleDist = player.radius + 22;
    const mx = player.x + Math.cos(player.angle) * muzzleDist;
    const my = player.y + Math.sin(player.angle) * muzzleDist;

    this.eventsBuffer.push({
      type: 'SHOOT',
      playerId: player.id,
      weapon: weapon.id,
      x: Math.round(mx),
      y: Math.round(my),
      angle: Number(player.angle.toFixed(2))
    });

    if (weapon.type === 'shotgun') {
      for (let i = 0; i < weapon.pellets; i++) {
        const spreadAngle = player.angle + (Math.random() * weapon.spread - weapon.spread / 2);
        const b = new Bullet(
          'b_' + Math.random().toString(36).substring(2, 7),
          player.id,
          mx,
          my,
          spreadAngle,
          {
            speed: weapon.bulletSpeed + (Math.random() * 80 - 40),
            damage: weapon.damage,
            range: weapon.range,
            type: 'shotgun',
            knockback: weapon.knockback
          }
        );
        this.bullets.push(b);
      }
    } else if (weapon.type === 'railgun') {
      // Instant beam line check
      const b = new Bullet(
        'b_' + Math.random().toString(36).substring(2, 7),
        player.id,
        mx,
        my,
        player.angle,
        {
          speed: 3000,
          damage: weapon.damage,
          range: weapon.range,
          type: 'railgun',
          penetration: true
        }
      );
      this.bullets.push(b);
    } else {
      // Standard bullet or rocket or grenade
      const spread = weapon.spread ? (Math.random() * weapon.spread - weapon.spread / 2) : 0;
      const b = new Bullet(
        'b_' + Math.random().toString(36).substring(2, 7),
        player.id,
        mx,
        my,
        player.angle + spread,
        {
          speed: weapon.bulletSpeed || weapon.throwSpeed,
          damage: weapon.damage,
          range: weapon.range || 800,
          type: weapon.type,
          fuseTime: weapon.fuseTime,
          explosionRadius: weapon.explosionRadius,
          knockback: weapon.knockback
        }
      );
      this.bullets.push(b);
    }
  }

  handlePlaceItem(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.isDowned || player.isDead || player.fireCooldown > 0) return;

    const weapon = WEAPONS[player.selectedWeapon];
    if (!weapon || !player.canShoot(weapon.type)) return;

    // Place 55px ahead of player
    const placeDist = 55;
    const px = Math.round((player.x + Math.cos(player.angle) * placeDist) / 44) * 44;
    const py = Math.round((player.y + Math.sin(player.angle) * placeDist) / 44) * 44;

    // Check if place position intersects map walls
    if (this.map.isWall(px, py, 20)) return;

    // Check collision with existing barricades
    for (let i = 0; i < this.barricades.length; i++) {
      const existing = this.barricades[i];
      if (Math.hypot(existing.x - px, existing.y - py) < 36) return;
    }

    player.fireCooldown = weapon.fireDelay;
    player.consumeAmmo(weapon.type);

    const id = 'bar_' + Math.random().toString(36).substring(2, 7);
    if (weapon.id === 'BARREL') {
      const barrel = new Barrel(id, px, py, player.id);
      this.barricades.push(barrel);
    } else {
      const barricade = new Barricade(id, px, py, player.id);
      this.barricades.push(barricade);
    }

    this.eventsBuffer.push({
      type: 'PLACE_ITEM',
      itemType: weapon.id,
      x: px,
      y: py
    });
  }

  handleUltimate(socketId, payload = {}) {
    const player = this.players.get(socketId);
    if (!player) return { activated: false };
    const angle = payload && typeof payload.angle === 'number' && Number.isFinite(payload.angle)
      ? payload.angle
      : player.angle;
    return triggerPlayerUltimate(player, angle, this);
  }

  triggerExplosion(x, y, radius, damage, ownerId, source = 'GENERIC') {
    const resolvedSource = (source ? String(source) : 'GENERIC').toUpperCase();
    this.eventsBuffer.push({
      type: 'EXPLOSION',
      x: Math.round(x),
      y: Math.round(y),
      radius: Math.round(radius),
      source: resolvedSource
    });

    // Damage zombies
    for (let i = 0; i < this.zombies.length; i++) {
      const z = this.zombies[i];
      if (z.isDead) continue;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d <= radius + z.radius) {
        const falloff = 1 - (d / (radius + z.radius));
        const effectiveDamage = Math.round(damage * Math.max(0.3, falloff));
        z.takeDamage(effectiveDamage, 'EXPLOSION');
        const knockAngle = Math.atan2(z.y - y, z.x - x);
        z.applyKnockback(knockAngle, 220);

        if (z.isDead) {
          if (ownerId) {
            const killer = this.players.get(ownerId);
            if (killer) killer.recordKill(z.score);
          }
          this.eventsBuffer.push({
            type: 'ZOMBIE_DIE',
            x: z.x,
            y: z.y,
            zType: z.type,
            angle: z.angle,
            killAngle: Number(knockAngle.toFixed(2))
          });
        }
      }
    }

    // Damage players slightly (friendly fire reduced to 25% for safety & fun)
    for (const p of this.players.values()) {
      if (p.isDead) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius + p.radius) {
        p.takeDamage(Math.round(damage * 0.25));
      }
    }

    // Damage and trigger other barrels/barricades
    const barrels = this.barricades.filter(b => b.type === 'barrel');
    for (let i = 0; i < this.barricades.length; i++) {
      const b = this.barricades[i];
      if (b.isDead) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d <= radius + 22) {
        if (b.type === 'barrel') {
          b.takeDamage(damage, barrels, (bx, by, br, bd, bo) => {
            this.triggerExplosion(bx, by, br, bd, bo, 'BARREL');
          });
        } else {
          b.takeDamage(damage);
        }
      }
    }
  }

  tick(dt) {
    if (this.state === 'GAMEOVER') return;

    const playersArr = Array.from(this.players.values());

    // 0. Update Tactical Drones & compute Infinite Ammo Aura
    const droneBullets = [];
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const drone = this.drones[i];
      const shot = drone.update(dt, this.zombies, droneBullets);
      if (shot && shot.fired) {
        this.eventsBuffer.push({
          type: 'SHOOT',
          playerId: drone.ownerId,
          weapon: 'DRONE',
          x: shot.x,
          y: shot.y,
          angle: Number(shot.angle.toFixed(2))
        });
      }
      if (drone.isDead()) {
        this.drones.splice(i, 1);
      }
    }
    for (let i = 0; i < droneBullets.length; i++) {
      this.bullets.push(droneBullets[i]);
    }

    for (let i = 0; i < playersArr.length; i++) {
      const p = playersArr[i];
      p.hasInfiniteAmmo = this.drones.some(d => d.isPlayerInAura(p));
    }

    // 1. Update Players & Revive interactions
    for (let i = 0; i < playersArr.length; i++) {
      const p = playersArr[i];
      p.update(dt, this.map, this.barricades);

      if (p.input.shoot) {
        this.handleShoot(p.id);
      }

      if (p.input.revive) {
        // Look for downed teammate nearby
        for (let j = 0; j < playersArr.length; j++) {
          const other = playersArr[j];
          if (other !== p && other.isDowned && !other.isDead) {
            p.startRevive(other);
            const revived = p.updateRevive(dt);
            if (revived) {
              p.addUltCharge(ULT_CHARGE_CONFIG.REVIVE_BONUS);
              this.eventsBuffer.push({ type: 'REVIVE', targetId: other.id, rescuerId: p.id });
            }
            break;
          }
        }
      } else if (p.revivingTarget) {
        p.revivingTarget = null;
        p.reviveProgress = 0;
      }
    }

    // Check all players dead/downed -> GAMEOVER
    const anyAlive = playersArr.some(p => !p.isDowned && !p.isDead);
    if (!anyAlive && playersArr.length > 0) {
      this.state = 'GAMEOVER';
      this.eventsBuffer.push({ type: 'GAME_OVER', wave: this.wave });
      this.broadcastSnapshot();
      return;
    }

    // 2. Wave Management
    if (this.state === 'PLAYING') {
      if (this.zombiesSpawnedInWave < this.waveTotalZombies) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnZombie();
          this.spawnTimer = this.spawnInterval;
        }
      } else if (this.zombies.length === 0) {
        // Wave complete!
        this.state = 'INTERMISSION';
        this.intermissionTimer = this.intermissionDuration;
        this.eventsBuffer.push({ type: 'WAVE_CLEAR', wave: this.wave });

        // Revive any downed players on wave clear
        for (const p of playersArr) {
          if (p.isDowned && !p.isDead) {
            p.isDowned = false;
            p.hp = 50;
          }
        }
      }
    } else if (this.state === 'INTERMISSION') {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this.state = 'PLAYING';
        this.startWave(this.wave + 1);
      }
    }

    // 3. Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const explosion = b.update(dt, this.map);
      if (explosion) {
        this.triggerExplosion(explosion.x, explosion.y, explosion.radius, explosion.damage, explosion.ownerId, explosion.source || 'GENERIC');
      }

      if (b.isDead) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Devil Fireball hitting players
      if (b.isFireball) {
        for (let j = 0; j < playersArr.length; j++) {
          const p = playersArr[j];
          if (p.isDead) continue;
          if (b.checkHit(p)) {
            b.isDead = true;
            this.triggerExplosion(b.x, b.y, b.explosionRadius, b.explosionDamage, null, 'FIREBALL');
            break;
          }
        }
      } else {
        // Player bullet hitting zombies
        for (let j = 0; j < this.zombies.length; j++) {
          const z = this.zombies[j];
          if (z.isDead) continue;
          if (b.checkHit(z)) {
            z.takeDamage(b.damage, 'BULLET');
            z.applyKnockback(b.angle, b.knockback);
            this.eventsBuffer.push({
              type: 'HIT',
              x: Math.round(z.x),
              y: Math.round(z.y),
              angle: Number((b.angle || 0).toFixed(2)),
              weapon: b.type || 'bullet',
              zType: z.type
            });

            const shooter = this.players.get(b.ownerId);
            if (shooter && !b.fromUlt) {
              const hitCharge = b.type === 'shotgun'
                ? ULT_CHARGE_CONFIG.SHOTGUN_PELLET_HIT
                : ULT_CHARGE_CONFIG.HIT_BASE;
              shooter.addUltCharge(hitCharge);
            }

            if (z.isDead) {
              if (shooter) {
                const unlocks = shooter.recordKill(z.score, { awardUltCharge: !b.fromUlt });
                if (unlocks.length > 0) {
                  for (const u of unlocks) {
                    this.eventsBuffer.push({ type: 'UNLOCKED', weapon: u.id, playerId: shooter.id });
                  }
                }
              }
              this.eventsBuffer.push({
                type: 'ZOMBIE_DIE',
                x: z.x,
                y: z.y,
                zType: z.type,
                angle: z.angle,
                killAngle: Number((b.angle || 0).toFixed(2))
              });

              // 15% chance to drop ammo or medkit
              if (Math.random() < 0.15) {
                this.pickups.push({
                  id: 'pk_' + Math.random().toString(36).substring(2, 7),
                  type: Math.random() < 0.4 ? 'MEDKIT' : 'AMMO',
                  x: Math.round(z.x),
                  y: Math.round(z.y),
                  life: 25 // 25s decay
                });
              }
            }

            if (!b.penetration) {
              b.isDead = true;
              break;
            }
          }
        }

        // Bullet hitting barrels
        for (let j = 0; j < this.barricades.length; j++) {
          const bar = this.barricades[j];
          if (bar.isDead) continue;
          if (bar.type === 'barrel') {
            const hit = (Math.hypot(b.x - bar.x, b.y - bar.y) <= (b.radius + bar.radius));
            if (hit) {
              const barrels = this.barricades.filter(x => x.type === 'barrel');
              bar.takeDamage(b.damage, barrels, (bx, by, br, bd, bo) => {
                this.triggerExplosion(bx, by, br, bd, b.ownerId, 'BARREL');
              });
              b.isDead = true;
              break;
            }
          }
        }
      }

      if (b.isDead) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. Update Zombies
    const newBulletsFromZombies = [];
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.isDead) {
        this.zombies.splice(i, 1);
        continue;
      }
      z.update(dt, playersArr, this.barricades, this.map, newBulletsFromZombies);
    }
    for (let i = 0; i < newBulletsFromZombies.length; i++) {
      this.bullets.push(newBulletsFromZombies[i]);
    }

    // 4.5. Check Zombie Contact with Explosive Barrels (Instant Detonation)
    const activeBarrels = this.barricades.filter(b => b.type === 'barrel' && !b.isDead);
    for (let i = 0; i < activeBarrels.length; i++) {
      const bar = activeBarrels[i];
      if (bar.isDead) continue;
      for (let j = 0; j < this.zombies.length; j++) {
        const z = this.zombies[j];
        if (z.isDead) continue;
        const contactDist = z.radius + bar.radius + 6;
        const dist = Math.hypot(z.x - bar.x, z.y - bar.y);
        if (dist <= contactDist) {
          const allBarrels = this.barricades.filter(x => x.type === 'barrel');
          bar.detonate(allBarrels, (bx, by, br, bd, bo) => {
            this.triggerExplosion(bx, by, br, bd, bar.ownerId, 'BARREL');
          });
          break;
        }
      }
    }

    // Clean up dead barricades
    for (let i = this.barricades.length - 1; i >= 0; i--) {
      if (this.barricades[i].isDead) {
        this.barricades.splice(i, 1);
      }
    }

    // 5. Update Pickups & Check collection
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }

      for (let j = 0; j < playersArr.length; j++) {
        const player = playersArr[j];
        if (player.isDead || player.isDowned) continue;
        if (Math.hypot(player.x - p.x, player.y - p.y) < player.radius + 26) {
          if (p.type === 'MEDKIT') {
            player.heal(40);
          } else {
            // Restore ammo to current weapon & others
            for (const key of Object.keys(player.weapons)) {
              if (player.weapons[key].unlocked) {
                const conf = WEAPONS[key];
                player.addAmmo(key, Math.ceil(conf.startingAmmo * 0.75));
              }
            }
          }
          this.eventsBuffer.push({ type: 'PICKUP', itemType: p.type, playerId: player.id });
          this.pickups.splice(i, 1);
          break;
        }
      }
    }

    // 6. Broadcast Snapshot
    this.broadcastSnapshot();
  }

  getSnapshot() {
    return {
      roomId: this.id,
      mapId: this.mapId,
      state: this.state,
      wave: this.wave,
      zombiesLeft: this.zombies.length + (this.waveTotalZombies - this.zombiesSpawnedInWave),
      intermissionTimer: Math.ceil(this.intermissionTimer),
      players: Array.from(this.players.values()).map((p, idx) => ({
        ...p.serialize(),
        playerIndex: idx
      })),
      zombies: this.zombies.map(z => z.serialize()),
      bullets: this.bullets.map(b => b.serialize()),
      barricades: this.barricades.map(b => b.serialize()),
      pickups: this.pickups.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y })),
      drones: this.drones.map(d => d.serialize()),
      events: [...this.eventsBuffer]
    };
  }

  broadcastSnapshot() {
    const snap = this.getSnapshot();
    this.io.to(this.id).emit('game:snapshot', snap);
    this.eventsBuffer = [];
  }

  stop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
}

module.exports = { GameRoom };
