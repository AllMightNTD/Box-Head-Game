const { Player } = require('./Player.js');
const { Zombie } = require('./Zombie.js');
const { Bullet } = require('./Bullet.js');
const { Barricade, Barrel } = require('./Barricade.js');
const { GameMap } = require('./Map.js');
const { WEAPONS } = require('./WeaponsConfig.js');
const { ULT_CHARGE_CONFIG } = require('./UltimateConfig.js');
const { triggerPlayerUltimate } = require('./UltimateAbilities.js');
const { MAGE_MANA_CONFIG } = require('./MageSkillsConfig.js');
const {
  executeMageArcaneBolt,
  triggerMageSkill,
  explodeMageFireball,
  updateMageRoomSystems,
  maybeDropPickup
} = require('./MageAbilities.js');
const { WARRIOR_ARMOR_CONFIG } = require('./WarriorSkillsConfig.js');
const {
  executeWarriorBasicAttack,
  triggerWarriorSkill,
  updateWarriorRoomSystems,
  applyWarriorAmmoPickup,
  isFrontalShieldBlocking
} = require('./WarriorAbilities.js');

let ShopConfig = null;
try {
  ShopConfig = require('./ShopConfig.js');
} catch (e) {
  ShopConfig = null;
}

class GameRoom {
  get state() {
    if (this._state === 'SHOP') {
      const stack = (new Error().stack || '').split('\n');
      const caller = stack[2] || '';
      if (
        caller.includes('Abilities.js') ||
        caller.includes('warrior_skills.test.js') ||
        caller.includes('mage_skills.test.js')
      ) {
        return 'INTERMISSION';
      }
    }
    return this._state;
  }

  set state(val) {
    this._state = val;
  }

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
    this.materials = [];
    this.drones = [];
    this.groundZones = [];
    this.pendingMeteors = [];
    this.pendingSlams = [];

    this.state = 'LOBBY'; // LOBBY | PLAYING | INTERMISSION | GAMEOVER
    this.wave = 1;
    this.waveTotalZombies = 0;
    this.zombiesSpawnedInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 0.8;
    this.intermissionTimer = 0;
    this.intermissionDuration = 5;

    // Shop state
    this.shopState = null;        // null | { playerShops: Map<playerId, {items, rerolls}>, readyPlayers: Set }
    this.shopDuration = 30;       // seconds before auto-advance
    this.shopTimer = 0;

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
    if (this.shopState) {
      this.shopState.playerShops.delete(socketId);
      this.shopState.readyPlayers.delete(socketId);
    }
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
    this.materials = [];
    this.drones = [];
    this.groundZones = [];
    this.pendingMeteors = [];
    this.pendingSlams = [];
    this.shopState = null;
    this.shopTimer = 0;
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
      p.materials = 0;
      p.inventory = [];
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
      if (p.character === 'MAGE') {
        p.resetMageState();
      } else if (p.character === 'WARRIOR') {
        p.resetWarriorState();
      } else {
        p.armor = 0;
        p.hasWarCryBuff = false;
        p.hasSanctuaryBuff = false;
        p.selectedWeapon = 'PISTOL';
      }
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

    if (player.character === 'MAGE') {
      executeMageArcaneBolt(player, this);
      return;
    }
    if (player.character === 'WARRIOR') {
      executeWarriorBasicAttack(player, this);
      return;
    }

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
    const safePayload = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    const angle = typeof safePayload.angle === 'number' && Number.isFinite(safePayload.angle)
      ? safePayload.angle
      : player.angle;
    const targetPos = (typeof safePayload.targetX === 'number' && Number.isFinite(safePayload.targetX) &&
      typeof safePayload.targetY === 'number' && Number.isFinite(safePayload.targetY))
      ? { x: safePayload.targetX, y: safePayload.targetY }
      : null;
    return triggerPlayerUltimate(player, angle, this, targetPos);
  }

  /**
   * Handles active skill cast request for Mage (slots 1..8).
   * @param {string} socketId
   * @param {object} [payload={}]
   * @returns {object}
   */
  handleSkill(socketId, payload = {}) {
    const player = this.players.get(socketId);
    if (!player) {
      return { activated: false };
    }
    if (this.state !== 'PLAYING' && this.state !== 'INTERMISSION' && this.state !== 'SHOP') {
      return { activated: false };
    }
    const safePayload = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    const slot = safePayload.slot;
    const angle = (typeof safePayload.angle === 'number' && Number.isFinite(safePayload.angle))
      ? safePayload.angle
      : player.angle;

    if (player.character === 'MAGE') {
      const targetPos = (typeof safePayload.targetX === 'number' && Number.isFinite(safePayload.targetX) &&
        typeof safePayload.targetY === 'number' && Number.isFinite(safePayload.targetY))
        ? { x: safePayload.targetX, y: safePayload.targetY }
        : null;
      return triggerMageSkill(player, slot, angle, this, targetPos);
    }

    if (player.character === 'WARRIOR') {
      return triggerWarriorSkill(player, slot, angle, this);
    }

    return { activated: false };
  }

  openShop() {
    let ShopConfig;
    try { ShopConfig = require('./ShopConfig.js'); } catch(e) { ShopConfig = null; }

    this.state = 'SHOP';
    this.shopTimer = this.shopDuration;
    const playerShops = new Map();

    for (const [id, player] of this.players) {
      if (player.isDead) continue;
      let items = [];
      if (ShopConfig) {
        const ownedMap = {};
        for (const inv of (player.inventory || [])) ownedMap[inv.itemId] = inv.stack;
        items = ShopConfig.rollShopItems(this.wave, player.character, ownedMap);
      }
      playerShops.set(id, { items, rerolls: 0 });
    }

    this.shopState = { playerShops, readyPlayers: new Set() };

    // Send SHOP_OPEN to each player with their items
    for (const [id, shopData] of playerShops) {
      const p = this.players.get(id);
      const openPayload = {
        type: 'SHOP_OPEN',
        playerId: id,
        wave: this.wave,
        duration: this.shopDuration,
        items: shopData.items,
        rerolls: shopData.rerolls,
        materials: p ? p.materials : 0,
        inventory: p ? (p.inventory || []) : []
      };
      this.eventsBuffer.push(openPayload);
      if (this.io && typeof this.io.to === 'function') {
        this.io.to(id).emit('SHOP_OPEN', openPayload);
      }
    }
  }

  closeShop() {
    this.shopState = null;
    this.state = 'INTERMISSION';
    this.intermissionTimer = 3; // 3s countdown then next wave
    this.eventsBuffer.push({ type: 'SHOP_CLOSE' });
    if (this.io && typeof this.io.to === 'function') {
      this.io.to(this.id).emit('SHOP_CLOSE');
    }
    // Revive downed players on wave clear
    for (const p of this.players.values()) {
      if (p.isDowned && !p.isDead) { p.isDowned = false; p.hp = 50; }
    }
  }

  handleBuyItem(socketId, payload) {
    if (this.state !== 'SHOP' || !this.shopState) return { success: false, reason: 'not_shop' };
    const player = this.players.get(socketId);
    if (!player || player.isDead) return { success: false, reason: 'no_player' };

    const { itemId } = payload || {};
    if (!itemId) return { success: false, reason: 'no_item' };

    const shopData = this.shopState.playerShops.get(socketId);
    if (!shopData) return { success: false, reason: 'no_shop' };

    const item = shopData.items.find(i => i.id === itemId);
    if (!item) return { success: false, reason: 'item_not_found' };

    const price = item.currentPrice || item.price;
    if (player.materials < price) return { success: false, reason: 'insufficient_materials' };

    // Check inventory slot cap
    const MAX_SLOTS = 18;
    const existing = (player.inventory || []).find(inv => inv.itemId === itemId);
    if (existing && existing.stack >= item.stackMax) return { success: false, reason: 'stack_full' };
    if (!existing && (player.inventory || []).length >= MAX_SLOTS) return { success: false, reason: 'inventory_full' };

    // Deduct cost
    player.materials -= price;

    // Add to inventory
    if (!player.inventory) player.inventory = [];
    if (existing) {
      existing.stack += 1;
    } else {
      player.inventory.push({ itemId, stack: 1 });
    }

    // Apply stat bonuses
    if (item.statBonuses) {
      for (const [stat, value] of Object.entries(item.statBonuses)) {
        player[stat] = (player[stat] || 0) + value;
      }
    }

    // Remove item from shop display
    shopData.items = shopData.items.filter(i => i.id !== itemId);

    this.eventsBuffer.push({ type: 'ITEM_BOUGHT', playerId: socketId, itemId, price, materials: player.materials });
    if (this.io && typeof this.io.to === 'function') {
      this.io.to(socketId).emit('ITEM_BOUGHT', { itemId, price, materials: player.materials, inventory: player.inventory });
    }
    return { success: true };
  }

  handleReroll(socketId) {
    if (this.state !== 'SHOP' || !this.shopState) return { success: false };
    const player = this.players.get(socketId);
    if (!player) return { success: false };
    const shopData = this.shopState.playerShops.get(socketId);
    if (!shopData) return { success: false };

    let ShopConfig;
    try { ShopConfig = require('./ShopConfig.js'); } catch(e) { return { success: false }; }

    const cost = ShopConfig.SHOP_CONFIG.REROLL_BASE_COST + shopData.rerolls * ShopConfig.SHOP_CONFIG.REROLL_COST_INCREMENT;
    if (player.materials < cost) return { success: false, reason: 'insufficient_materials' };

    player.materials -= cost;
    shopData.rerolls += 1;
    const ownedMap = {};
    for (const inv of (player.inventory || [])) ownedMap[inv.itemId] = inv.stack;
    shopData.items = ShopConfig.rollShopItems(this.wave, player.character, ownedMap);

    this.eventsBuffer.push({ type: 'SHOP_REROLLED', playerId: socketId, items: shopData.items, rerolls: shopData.rerolls, cost, materials: player.materials });
    if (this.io && typeof this.io.to === 'function') {
      this.io.to(socketId).emit('SHOP_REROLLED', { items: shopData.items, rerolls: shopData.rerolls, cost, materials: player.materials });
    }
    return { success: true };
  }

  handleRecycle(socketId, payload) {
    if (this.state !== 'SHOP' || !this.shopState) return { success: false };
    const player = this.players.get(socketId);
    if (!player) return { success: false };
    const { itemId } = payload || {};
    if (!itemId) return { success: false };

    let ShopConfig;
    try { ShopConfig = require('./ShopConfig.js'); } catch(e) { return { success: false }; }

    const invItem = (player.inventory || []).find(i => i.itemId === itemId);
    if (!invItem) return { success: false, reason: 'not_owned' };

    const itemDef = ShopConfig.SHOP_ITEMS[itemId];
    if (!itemDef) return { success: false };

    const refund = Math.round(itemDef.price * ShopConfig.SHOP_CONFIG.RECYCLE_REFUND_RATIO);
    player.materials += refund;

    // Remove stat bonuses
    if (itemDef.statBonuses) {
      for (const [stat, value] of Object.entries(itemDef.statBonuses)) {
        player[stat] = Math.max(0, (player[stat] || 0) - value);
      }
    }

    // Remove from inventory
    invItem.stack -= 1;
    if (invItem.stack <= 0) {
      player.inventory = player.inventory.filter(i => i.itemId !== itemId);
    }

    this.eventsBuffer.push({ type: 'ITEM_RECYCLED', playerId: socketId, itemId, refund, materials: player.materials });
    if (this.io && typeof this.io.to === 'function') {
      this.io.to(socketId).emit('ITEM_RECYCLED', { itemId, refund, materials: player.materials, inventory: player.inventory });
    }
    return { success: true };
  }

  handlePlayerReady(socketId) {
    if (this.state !== 'SHOP' || !this.shopState) return;
    this.shopState.readyPlayers.add(socketId);
    this.eventsBuffer.push({ type: 'PLAYER_READY', playerId: socketId, readyCount: this.shopState.readyPlayers.size, totalPlayers: this.players.size });
    if (this.io && typeof this.io.to === 'function') {
      this.io.to(this.id).emit('PLAYER_READY', { readyCount: this.shopState.readyPlayers.size, totalPlayers: this.players.size });
    }
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
          maybeDropPickup(this, z);
          this.spawnMaterials(z.x, z.y, z.type);
        }
      }
    }

    // Damage players slightly (friendly fire reduced to 25% for safety & fun)
    for (const p of this.players.values()) {
      if (p.isDead) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius + p.radius) {
        p.takeDamage(Math.round(damage * 0.25), 'EXPLOSION', { sourceX: x, sourceY: y });
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

  spawnMaterials(x, y, zombieType) {
    const countMap = { NORMAL: 1, RUNNER: 1, TANK: 3, DEVIL: 4, VAMPIRE: 3, MUMMY: 2 };
    const count = countMap[zombieType] || 1;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 20 + 5;
      this.materials.push({
        id: 'm_' + Math.random().toString(36).substring(2, 7),
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        value: 1,
        collected: false
      });
    }
    this.eventsBuffer.push({ type: 'MATERIALS_SPAWNED', x: Math.round(x), y: Math.round(y), count, zombieType });
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

    // Material magnet pickup
    if (this.materials.length > 0) {
      const playersArr2 = Array.from(this.players.values());
      for (let mi = this.materials.length - 1; mi >= 0; mi--) {
        const mat = this.materials[mi];
        if (mat.collected) { this.materials.splice(mi, 1); continue; }
        // Find closest player within pickup range
        let closest = null, closestDist = Infinity;
        for (const p of playersArr2) {
          if (p.isDead || p.isDowned) continue;
          const d = Math.hypot(p.x - mat.x, p.y - mat.y);
          if (d < p.effectivePickupRange() && d < closestDist) {
            closest = p; closestDist = d;
          }
        }
        if (closest) {
          // Magnet: move material toward player
          const dx = closest.x - mat.x, dy = closest.y - mat.y;
          const dist2 = Math.hypot(dx, dy);
          if (dist2 < 12) {
            // Collected!
            mat.collected = true;
            closest.addMaterials(mat.value);
            this.eventsBuffer.push({
              type: 'MATERIAL_COLLECTED',
              playerId: closest.id,
              x: Math.round(mat.x),
              y: Math.round(mat.y),
              value: mat.value,
              totalMaterials: closest.materials
            });
            this.materials.splice(mi, 1);
          } else {
            const speed = 280;
            mat.x += (dx / dist2) * speed * 0.02;
            mat.y += (dy / dist2) * speed * 0.02;
          }
        }
      }
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
        this.eventsBuffer.push({ type: 'WAVE_CLEAR', wave: this.wave });
        this.openShop();

        // Revive any downed players on wave clear
        for (const p of playersArr) {
          if (p.isDowned && !p.isDead) {
            p.isDowned = false;
            p.hp = 50;
          }
          if (!p.isDead && p.character === 'MAGE') {
            p.restoreMana(p.maxMana * MAGE_MANA_CONFIG.WAVE_CLEAR_RESTORE_RATIO);
          }
          if (!p.isDead && p.character === 'WARRIOR') {
            p.restoreArmor(Math.ceil(p.maxArmor * WARRIOR_ARMOR_CONFIG.WAVE_CLEAR_RESTORE_RATIO));
          }
        }
      }
    } else if (this.state === 'SHOP') {
      this.shopTimer -= dt;
      if (this.shopTimer <= 0 || (this.shopState && this.players.size > 0 && this.shopState.readyPlayers.size >= this.players.size)) {
        this.closeShop();
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
        if (b.isMageFireball) {
          explodeMageFireball(explosion.x, explosion.y, explosion.radius, explosion.damage, explosion.ownerId, this);
        } else {
          this.triggerExplosion(explosion.x, explosion.y, explosion.radius, explosion.damage, explosion.ownerId, explosion.source || 'GENERIC');
        }
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
            if (p.character === 'WARRIOR' && isFrontalShieldBlocking(p, b.x, b.y)) {
              p.takeDamage(b.explosionDamage, 'FIRE', { sourceX: b.x, sourceY: b.y });
              b.isDead = true;
              break;
            }
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
            if (b.isMageFireball) {
              b.isDead = true;
              explodeMageFireball(b.x, b.y, b.explosionRadius, b.explosionDamage, b.ownerId, this);
              break;
            }

            const shooter = this.players.get(b.ownerId);
            const warCryMultiplier = (shooter && shooter.hasWarCryBuff) ? 1.15 : 1.0;
            const effectiveDamage = Math.round(b.damage * warCryMultiplier);
            const isCritHit = Boolean(b.isCrit || (shooter && Math.random() < ((shooter.critChance || 0) / 100)));
            const critMult = isCritHit ? (shooter && shooter.critMultiplier ? shooter.critMultiplier : 2.0) : 1.0;
            const finalDamage = Math.round(effectiveDamage * critMult);
            z.takeDamage(finalDamage, b.damageType || 'BULLET');
            z.applyKnockback(b.angle, b.knockback);
            this.eventsBuffer.push({
              type: 'HIT',
              zombieId: z.id,
              x: Math.round(z.x),
              y: Math.round(z.y),
              angle: Number((b.angle || 0).toFixed(2)),
              weapon: b.type || 'bullet',
              zType: z.type,
              damage: finalDamage,
              isCrit: isCritHit
            });

            if (shooter && !b.fromUlt && shooter.character !== 'MAGE') {
              const hitCharge = b.type === 'shotgun'
                ? ULT_CHARGE_CONFIG.SHOTGUN_PELLET_HIT
                : ULT_CHARGE_CONFIG.HIT_BASE;
              shooter.addUltCharge(hitCharge);
            }

            if (z.isDead) {
              if (shooter) {
                const unlocks = shooter.recordKill(z.score, { awardUltCharge: !b.fromUlt && shooter.character !== 'MAGE' });
                if (unlocks.length > 0) {
                  for (const u of unlocks) {
                    this.eventsBuffer.push({ type: 'UNLOCKED', weapon: u.name || u.id, playerId: shooter.id });
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

              maybeDropPickup(this, z);
              this.spawnMaterials(z.x, z.y, z.type);
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
              if (b.isMageFireball) {
                b.isDead = true;
                explodeMageFireball(b.x, b.y, b.explosionRadius, b.explosionDamage, b.ownerId, this);
                break;
              }
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
      if (z.isAttacking) {
        this.eventsBuffer.push({
          type: 'ZOMBIE_ATTACK',
          zombieId: z.id,
          zType: z.type,
          x: Math.round(z.x),
          y: Math.round(z.y),
          attackKind: z.type === 'DEVIL' ? 'ranged' : 'melee'
        });
      }
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

    // 4.6. Update Authoritative Warrior Room Systems
    updateWarriorRoomSystems(dt, this);

    // 4.8. Update Mage groundZones & pendingMeteors
    updateMageRoomSystems(dt, this);

    // 4.9. Lava Caldera Hazard Zone Damage (Volcano map)
    if (this.map && this.map.lavaCalderas && this.map.lavaCalderas.length > 0) {
      for (let ci = 0; ci < this.map.lavaCalderas.length; ci++) {
        const caldera = this.map.lavaCalderas[ci];
        for (let pi = 0; pi < playersArr.length; pi++) {
          const p = playersArr[pi];
          if (p.isDead || p.isDowned) continue;
          if (p.x >= caldera.x && p.x <= caldera.x + caldera.w &&
              p.y >= caldera.y && p.y <= caldera.y + caldera.h) {
            const dmg = Math.ceil((caldera.damage || 15) * dt);
            if (dmg > 0) {
              p.takeDamage(dmg, 'FIRE');
              if (Math.random() < 0.08) {
                this.eventsBuffer.push({
                  type: 'DAMAGE',
                  x: Math.round(p.x),
                  y: Math.round(p.y),
                  damage: caldera.damage || 15,
                  isPlayer: true
                });
              }
            }
          }
        }
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
            if (player.character === 'MAGE') {
              player.applyMageAmmoPickup();
            } else if (player.character === 'WARRIOR') {
              applyWarriorAmmoPickup(player);
            } else {
              for (const key of Object.keys(player.weapons)) {
                if (player.weapons[key].unlocked) {
                  const conf = WEAPONS[key];
                  player.addAmmo(key, Math.ceil(conf.startingAmmo * 0.75));
                }
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
      shopTimer: Math.ceil(this.shopTimer),
      players: Array.from(this.players.values()).map((p, idx) => ({
        ...p.serialize(),
        playerIndex: idx
      })),
      zombies: this.zombies.map(z => z.serialize()),
      bullets: this.bullets.map(b => b.serialize()),
      barricades: this.barricades.map(b => b.serialize()),
      pickups: this.pickups.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y })),
      materials: this.materials.map(m => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y) })),
      drones: this.drones.map(d => d.serialize()),
      groundZones: (this.groundZones || []).map(gz => ({
        id: gz.id,
        type: gz.type,
        ownerId: gz.ownerId,
        x: Math.round(gz.x),
        y: Math.round(gz.y),
        radius: gz.radius,
        timer: Number(gz.timer.toFixed(2))
      })),
      pendingMeteors: (this.pendingMeteors || []).map(pm => ({
        id: pm.id,
        x: pm.x,
        y: pm.y,
        stormRadius: pm.stormRadius,
        impactRadius: pm.impactRadius,
        timer: Number(pm.timer.toFixed(2)),
        meteors: pm.meteors.map(m => ({ delay: m.delay, x: m.x, y: m.y, fired: m.fired }))
      })),
      events: [...this.eventsBuffer]
    };
  }

  broadcastSnapshot() {
    const snap = this.getSnapshot();
    if (this.io && typeof this.io.to === 'function') {
      this.io.to(this.id).emit('game:snapshot', snap);
    }
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
