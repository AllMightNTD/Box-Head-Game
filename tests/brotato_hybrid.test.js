'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { GameRoom } = require('../server/game/GameRoom.js');
const { Player } = require('../server/game/Player.js');
const { Zombie } = require('../server/game/Zombie.js');
const {
  SHOP_ITEMS,
  WAVE_RARITY_TABLE,
  SHOP_CONFIG,
  getRarityForWave,
  rollShopItems
} = require('../server/game/ShopConfig.js');
const { getMapConfig, MAPS } = require('../server/game/MapConfig.js');

test('Brotato Hybrid: ShopConfig exports 18 valid items with balanced stats and rarity tiers', () => {
  assert.strictEqual(Object.keys(SHOP_ITEMS).length, 18, 'Must have exactly 18 items');

  const rarities = new Set(['Common', 'Rare', 'Epic', 'Legendary']);
  for (const [id, item] of Object.entries(SHOP_ITEMS)) {
    assert.strictEqual(item.id, id, `Item id must match key ${id}`);
    assert.ok(item.name && typeof item.name === 'string', `${id} has valid name`);
    assert.ok(item.icon && typeof item.icon === 'string', `${id} has valid icon`);
    assert.ok(rarities.has(item.rarity), `${id} has valid rarity: ${item.rarity}`);
    assert.ok(item.price > 0, `${id} has positive price`);
    assert.ok(item.stackMax >= 1 && item.stackMax <= 5, `${id} stackMax is between 1 and 5`);
    assert.ok(Array.isArray(item.classes) && item.classes.length > 0, `${id} has valid classes`);
    assert.ok(item.statBonuses && typeof item.statBonuses === 'object', `${id} has statBonuses`);
  }

  // Wave rarity table
  assert.strictEqual(WAVE_RARITY_TABLE.length, 20, 'Rarity table has 20 waves');
  for (let i = 0; i < 20; i++) {
    const entry = WAVE_RARITY_TABLE[i];
    const sum = entry.Common + entry.Rare + entry.Epic + entry.Legendary;
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Wave ${i + 1} rarity probabilities sum to 1.0`);
  }
});

test('Brotato Hybrid: rollShopItems respects player class and stackMax limits', () => {
  // Human rolling shop
  const humanItems = rollShopItems(1, 'HUMAN', {});
  assert.strictEqual(humanItems.length, 4, 'Rolls exactly 4 item cards');
  for (const item of humanItems) {
    const allowed = item.classes.includes('HUMAN') || item.classes.includes('ALL');
    assert.ok(allowed, `Item ${item.id} must be allowed for HUMAN or ALL`);
    assert.ok(item.currentPrice >= item.price, 'Current price has wave inflation applied');
  }

  // Stacking: If an item is max stacked, it should be excluded from pool
  const maxedOwned = { BANDOLIER: SHOP_ITEMS.BANDOLIER.stackMax };
  for (let i = 0; i < 10; i++) {
    const rolled = rollShopItems(1, 'HUMAN', maxedOwned);
    const hasMaxed = rolled.some(it => it.id === 'BANDOLIER');
    assert.strictEqual(hasMaxed, false, 'Fully stacked item must not appear in shop');
  }
});

test('Brotato Hybrid: Player entity initializes RPG stats and correctly computes magnet range', () => {
  const p = new Player('p1', 'Hero', 'HUMAN', 400, 300);
  assert.strictEqual(p.materials, 0, 'Starts with 0 materials');
  assert.strictEqual(p.pickupRange, 80, 'Default pickupRange is 80px');
  assert.strictEqual(p.effectivePickupRange(), 80, 'Initial effectivePickupRange is 80px');

  p.pickupRange_bonus = 50;
  assert.strictEqual(p.effectivePickupRange(), 130, 'Effective pickup range includes bonus');

  // Materials with bonus
  p.addMaterials(10);
  assert.strictEqual(p.materials, 10, 'Adds base materials');

  p.materialBonus = 50; // +50%
  p.addMaterials(10);
  assert.strictEqual(p.materials, 10 + 15, 'Material bonus +50% yields 15 materials');
});

test('Brotato Hybrid: GameRoom spawns materials on zombie kill and pulls towards player', () => {
  const room = new GameRoom('test_room', 'Test', null, 'THE_ROOMS');
  const player = room.addPlayer('p1', 'Hero', 'HUMAN');
  player.x = 500;
  player.y = 500;
  player.materials = 0;

  // Spawn materials at 520, 500 (within 80px range)
  room.spawnMaterials(520, 500, 'NORMAL');
  assert.ok(room.materials.length >= 1, 'Materials spawned');

  const mat = room.materials[0];
  const initialDist = Math.hypot(player.x - mat.x, player.y - mat.y);
  assert.ok(initialDist <= player.effectivePickupRange(), 'Material is within pickup range');

  // Tick room: magnet moves material toward player
  room.tick(0.02);

  // If collected directly or moved closer
  if (room.materials.length > 0) {
    const newDist = Math.hypot(player.x - room.materials[0].x, player.y - room.materials[0].y);
    assert.ok(newDist <= initialDist, 'Material moves closer to player via magnet pull');
  } else {
    assert.ok(player.materials > 0, 'Material collected directly');
  }
});

test('Brotato Hybrid: Inter-Wave Shop buying, rerolling, recycling, and stat application', () => {
  const room = new GameRoom('test_shop', 'Shop Room', null, 'THE_ROOMS');
  const player = room.addPlayer('p1', 'Hero', 'HUMAN');
  player.materials = 200;

  room.openShop();
  assert.ok(room.shopState, 'Shop state initialized');
  assert.ok(room.shopState.playerShops.has('p1'), 'Player has personal shop roll');

  const shopData = room.shopState.playerShops.get('p1');
  assert.strictEqual(shopData.items.length, 4, 'Shop has 4 items');
  const targetItem = shopData.items[0];

  // Buy item
  const buyRes = room.handleBuyItem('p1', { itemId: targetItem.id });
  assert.strictEqual(buyRes.success, true, 'Item bought successfully');
  assert.strictEqual(player.inventory.length, 1, 'Item added to inventory');
  assert.strictEqual(player.inventory[0].itemId, targetItem.id);
  assert.strictEqual(player.inventory[0].stack, 1);
  assert.ok(player.materials < 200, 'Materials deducted');

  // Recycle item
  const initialMaterials = player.materials;
  const recycleRes = room.handleRecycle('p1', { itemId: targetItem.id });
  assert.strictEqual(recycleRes.success, true, 'Recycle succeeded');
  assert.strictEqual(player.inventory.length, 0, 'Item removed from inventory on stack 0');
  assert.ok(player.materials > initialMaterials, 'Refund received on recycle');

  // Player ready advances / closes shop
  room.handlePlayerReady('p1');
  assert.strictEqual(room.shopState.readyPlayers.has('p1'), true, 'Player marked ready');

  // Tick room closes shop when all ready
  room.tick(0.02);
  assert.strictEqual(room.shopState, null, 'Shop closed when all players are ready');
});

test('Brotato Hybrid: All 4 Maps have Octagonal Chamfers, Supply Cysts, and Volcano Caldera', () => {
  const mapIds = ['THE_ROOMS', 'DESERT', 'SNOW', 'VOLCANO'];

  for (const mapId of mapIds) {
    const config = getMapConfig(mapId);
    assert.ok(config, `Map ${mapId} exists`);

    // Must have chamfer walls (45 degree corner anti-stuck)
    const chamfers = config.walls.filter(w => w.type === 'chamfer');
    assert.strictEqual(chamfers.length, 4, `${mapId} has 4 corner chamfers`);

    // Must have supply cysts (loot pods in 4 corners)
    assert.ok(Array.isArray(config.supplyCysts), `${mapId} has supplyCysts array`);
    assert.strictEqual(config.supplyCysts.length, 4, `${mapId} has 4 supply cysts`);

    // Spawn grates
    assert.ok(config.zombieSpawns.length >= 8, `${mapId} has at least 8 zombie spawn points`);
  }

  // Volcano Caldera hazard zone
  const volcano = getMapConfig('VOLCANO');
  assert.ok(Array.isArray(volcano.lavaCalderas), 'Volcano has lavaCalderas array');
  assert.ok(volcano.lavaCalderas.length >= 1, 'Volcano has central lava hazard caldera');
  assert.strictEqual(volcano.lavaCalderas[0].damage, 15, 'Caldera deals 15 damage/s');
});

