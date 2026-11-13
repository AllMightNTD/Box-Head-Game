const test = require('node:test');
const assert = require('node:assert');
const { Player } = require('../server/game/Player.js');
const { getUltimateConfigForClass, ULT_CHARGE_CONFIG } = require('../server/game/UltimateConfig.js');

test('UltimateConfig maps classes and legacy skins to valid ultimate specs', () => {
  // Arrange & Act
  const humanUlt = getUltimateConfigForClass('HUMAN');
  const warriorUlt = getUltimateConfigForClass('WARRIOR');
  const mageUlt = getUltimateConfigForClass('MAGE');
  const legacyUlt = getUltimateConfigForClass('BAMBO');

  // Assert
  assert.strictEqual(humanUlt.id, 'TACTICAL_DRONE');
  assert.strictEqual(warriorUlt.id, 'SEISMIC_SLAM');
  assert.strictEqual(mageUlt.id, 'BLINK_FROST_NOVA');
  assert.strictEqual(legacyUlt.id, 'TACTICAL_DRONE');
});

test('Player accumulates ultCharge on kills scaled by combo and respects awardUltCharge=false', () => {
  // Arrange
  const player = new Player('p1', 'Soldier', 'HUMAN', 400, 400);
  assert.strictEqual(player.ultCharge, 0);

  // Act: 1 kill at combo 1 -> +4%
  player.recordKill(10);
  assert.strictEqual(player.ultCharge, ULT_CHARGE_CONFIG.KILL_BASE);

  // Boost combo to 21 (2.0x multiplier) and verify cap
  player.combo = 21;
  player.recordKill(10);
  assert.strictEqual(player.ultCharge, 12); // 4 + (4 * 2.0)

  // Kill from ultimate must NOT award ultCharge, but still increments kills & combo
  const killsBefore = player.kills;
  player.recordKill(10, { awardUltCharge: false });
  assert.strictEqual(player.ultCharge, 12);
  assert.strictEqual(player.kills, killsBefore + 1);

  // Clamp at 100
  player.addUltCharge(500);
  assert.strictEqual(player.ultCharge, 100);
});

test('Player hasInfiniteAmmo bypasses ammo checks for guns only, never placeables', () => {
  // Arrange
  const player = new Player('p1', 'Soldier', 'HUMAN', 400, 400);
  player.weapons.ROCKET.unlocked = true;
  player.weapons.ROCKET.ammo = 0;
  player.weapons.BARRICADE.unlocked = true;
  player.weapons.BARRICADE.ammo = 0;
  player.hasInfiniteAmmo = true;

  // Act & Assert: ROCKET allowed at 0 ammo while buffed
  player.selectedWeapon = 'ROCKET';
  assert.strictEqual(player.canShoot('rocket'), true);
  player.consumeAmmo('rocket');
  assert.strictEqual(player.weapons.ROCKET.ammo, 0);

  // Act & Assert: BARRICADE NOT free while buffed
  player.selectedWeapon = 'BARRICADE';
  assert.strictEqual(player.canShoot('placeable_wall'), false);
});

const { Zombie } = require('../server/game/Zombie.js');
const { Bullet } = require('../server/game/Bullet.js');
const { GameMap } = require('../server/game/Map.js');

test('Zombie stun and freeze prevent movement, attacks, and Devil fireballs', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS');
  const player = new Player('p1', 'Alice', 'WARRIOR', 220, 200);
  const zombie = new Zombie('z1', 'NORMAL', 200, 200);
  const devil = new Zombie('d1', 'DEVIL', 400, 200);
  devil.attackCooldown = 0;
  zombie.attackCooldown = 0;
  const bulletsQueue = [];

  // Act: Stun normal zombie, freeze devil (1.5s freeze + 1.5s 0.5x slow)
  zombie.applyStun(2.5);
  devil.applyFreeze(1.5, 1.5, 0.5);

  zombie.update(0.5, [player], [], map, bulletsQueue);
  devil.update(0.5, [player], [], map, bulletsQueue);

  // Assert: Neither moved nor attacked nor fired fireball
  assert.strictEqual(zombie.x, 200);
  assert.strictEqual(player.hp, player.maxHp);
  assert.strictEqual(bulletsQueue.length, 0);
  assert.strictEqual(zombie.serialize().isStunned, true);
  assert.strictEqual(devil.serialize().isFrozen, true);

  // Act: Advance past freeze (1.5s total) into chill window
  devil.update(1.1, [player], [], map, bulletsQueue);
  assert.strictEqual(devil.serialize().isFrozen, false);
  assert.strictEqual(devil.serialize().isChilled, true);
});

test('Zombie knockback respects map boundaries instead of clipping outside walls', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS'); // width 1600, boundaryThickness 40
  const zombie = new Zombie('z1', 'NORMAL', 70, 200); // near left wall (minX = 40 + 23 = 63)

  // Act: Apply massive leftward knockback
  zombie.applyKnockback(Math.PI, 2000);
  zombie.update(0.2, [], [], map, []);

  // Assert: Clamped inside boundary wall
  assert.ok(zombie.x >= map.boundaryThickness + zombie.radius, `Expected zombie.x >= 63, got ${zombie.x}`);
});

test('Bullet stores fromUlt flag cleanly', () => {
  const normalBullet = new Bullet('b1', 'p1', 0, 0, 0);
  const droneBullet = new Bullet('b2', 'p1', 0, 0, 0, { type: 'drone', fromUlt: true });
  assert.strictEqual(normalBullet.fromUlt, false);
  assert.strictEqual(droneBullet.fromUlt, true);
  assert.strictEqual(droneBullet.serialize().type, 'drone');
});

const { TacticalDrone } = require('../server/game/TacticalDrone.js');
const { resolveBlinkDestination } = require('../server/game/UltimateAbilities.js');
const { Barricade } = require('../server/game/Barricade.js');

test('TacticalDrone targets nearest zombie, fires fromUlt bullets, and detects aura players', () => {
  // Arrange
  const drone = new TacticalDrone('dr_1', 'p1', 500, 500);
  const insidePlayer = new Player('p2', 'Ally', 'WARRIOR', 650, 500); // dist 150 <= 200
  const outsidePlayer = new Player('p3', 'Far', 'MAGE', 800, 500); // dist 300 > 200
  const downedPlayer = new Player('p4', 'Down', 'HUMAN', 510, 500);
  downedPlayer.isDowned = true;

  const farZombie = new Zombie('z1', 'NORMAL', 800, 500);
  const nearZombie = new Zombie('z2', 'NORMAL', 600, 500);
  const bullets = [];

  // Act
  const shot = drone.update(0.25, [farZombie, nearZombie], bullets);

  // Assert: Aura checks
  assert.strictEqual(drone.isPlayerInAura(insidePlayer), true);
  assert.strictEqual(drone.isPlayerInAura(outsidePlayer), false);
  assert.strictEqual(drone.isPlayerInAura(downedPlayer), false);

  // Assert: Fired at nearZombie with fromUlt=true
  assert.ok(shot && shot.fired);
  assert.strictEqual(bullets.length, 1);
  assert.strictEqual(bullets[0].ownerId, 'p1');
  assert.strictEqual(bullets[0].fromUlt, true);
  assert.strictEqual(bullets[0].type, 'drone');
});

test('resolveBlinkDestination crosses interior pillars & barricades and never gets stuck inside thick pillars', () => {
  // Arrange: VOLCANO has central 180x220 pillar at x=710..890, y=490..710
  const volcano = new GameMap('VOLCANO');
  const radius = 16;

  // Case 1: Blink rightwards across a 140px pillar in THE_ROOMS (x=420..560, y=320..460)
  const rooms = new GameMap('THE_ROOMS');
  const crossed = resolveBlinkDestination(400, 390, 0, 240, radius, rooms, []);
  assert.ok(crossed.x > 560, `Should land on far side of pillar, got x=${crossed.x}`);
  assert.strictEqual(rooms.isWall(crossed.x, crossed.y, radius), false);

  // Case 2: Blinking into center of Giant 180x220 Volcano Caldera must resolve cleanly outside wall
  const safeDest = resolveBlinkDestination(680, 600, 0, 120, radius, volcano, []);
  assert.strictEqual(volcano.isWall(safeDest.x, safeDest.y, radius), false, 'Mage must never be trapped inside Volcano pillar');

  // Case 3: Blinking across a player Barricade
  const bar = new Barricade('bar1', 500, 500);
  const acrossBar = resolveBlinkDestination(450, 500, 0, 240, radius, rooms, [bar]);
  assert.ok(acrossBar.x > 540);

  // Case 4: Blinking toward outer map boundary clamps inside arena
  const clamped = resolveBlinkDestination(1500, 600, 0, 240, radius, rooms, []);
  assert.ok(clamped.x <= rooms.width - rooms.boundaryThickness - radius);
});

const { io: ioClient } = require('socket.io-client');
const { GameRoom } = require('../server/game/GameRoom.js');
const { startServer } = require('../server/server.js');

test('GameRoom: Warrior Seismic Slam stuns zombies, clears fireballs, spares barricades', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_war', 'Warrior Test', mockIo);
  t.after(() => room.stop());

  const warrior = room.addPlayer('w1', 'Tank', 'WARRIOR');
  room.startGame();
  warrior.x = 500;
  warrior.y = 500;
  warrior.ultCharge = 100;

  const zNear = new Zombie('zn', 'NORMAL', 620, 500);
  const zBoss = new Zombie('zb', 'TANK', 650, 500);
  const fireball = new Bullet('fb1', 'devil_1', 560, 500, Math.PI, { type: 'fireball', isFireball: true });
  room.zombies.push(zNear, zBoss);
  room.bullets.push(fireball);

  // Place friendly barricade inside slam radius
  warrior.weapons.BARRICADE.unlocked = true;
  warrior.selectedWeapon = 'BARRICADE';
  warrior.fireCooldown = 0;
  room.handlePlaceItem('w1');
  const barHpBefore = room.barricades[0].hp;

  const res = room.handleUltimate('w1', { angle: 0 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(warrior.ultCharge, 0);
  assert.strictEqual(zNear.isDead, true); // 120 dmg kills 80 HP Normal zombie
  assert.strictEqual(zBoss.stunTimer, 1.5);
  assert.strictEqual(room.bullets.length, 0); // fireball destroyed
  assert.strictEqual(room.barricades[0].hp, barHpBefore); // barricade unharmed
});

test('GameRoom: Human Tactical Drone shoots zombies and grants Infinite Ammo inside aura', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_hum', 'Human Test', mockIo);
  t.after(() => room.stop());

  const human = room.addPlayer('h1', 'Spec', 'HUMAN');
  const ally = room.addPlayer('a1', 'Ally', 'MAGE');
  room.startGame();
  human.x = 500;
  human.y = 500;
  ally.x = 580; // inside 200px aura
  ally.y = 500;
  ally.weapons.ROCKET.unlocked = true;
  ally.weapons.ROCKET.ammo = 0;
  ally.selectedWeapon = 'ROCKET';

  human.ultCharge = 100;
  const z = new Zombie('zt', 'TANK', 700, 500);
  room.zombies.push(z);

  const res = room.handleUltimate('h1');
  assert.strictEqual(res.activated, true);
  assert.strictEqual(room.drones.length, 1);

  // Advance ticks so aura updates & drone shoots
  for (let i = 0; i < 15; i++) {
    room.tick(0.02);
  }

  assert.strictEqual(ally.hasInfiniteAmmo, true);
  assert.strictEqual(ally.canShoot(), true);
  room.handleShoot('a1');
  assert.strictEqual(ally.weapons.ROCKET.ammo, 0); // did not consume ammo
  assert.ok(z.hp < z.maxHp, 'Drone should have shot the zombie');
  assert.strictEqual(human.ultCharge, 0, 'Drone shots must not recharge ultCharge');
});

test('GameRoom: Mage Blink & Frost Nova freezes at both origin and destination', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_mag', 'Mage Test', mockIo);
  t.after(() => room.stop());

  const mage = room.addPlayer('m1', 'Wiz', 'MAGE');
  room.startGame();
  mage.x = 400;
  mage.y = 600;
  mage.ultCharge = 100;

  const zOrigin = new Zombie('zo', 'TANK', 430, 600);
  const zDest = new Zombie('zd', 'TANK', 650, 600);
  room.zombies.push(zOrigin, zDest);

  const res = room.handleUltimate('m1', { angle: 0 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.x, 640);
  assert.ok(zOrigin.freezeTimer > 0, 'Origin zombie must be frozen');
  assert.ok(zDest.freezeTimer > 0, 'Destination zombie must be frozen');
});

test('GameRoom: Reviving teammate grants +15 ultCharge and bullet hits grant hit charge', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_chg', 'Charge Test', mockIo);
  t.after(() => room.stop());

  const p1 = room.addPlayer('p1', 'Medic', 'HUMAN');
  const p2 = room.addPlayer('p2', 'Downed', 'WARRIOR');
  room.startGame();
  p1.x = 500;
  p1.y = 500;
  p2.x = 520;
  p2.y = 500;
  p2.takeDamage(500); // downed
  p1.applyInput({ revive: true });

  // Simulate 2.1s of ticking
  for (let i = 0; i < 105; i++) {
    room.tick(0.02);
  }
  assert.strictEqual(p2.isDowned, false);
  assert.strictEqual(p1.ultCharge, 15);
});

test('E2E Socket: client emits player:ultimate through socketHandler and updates snapshot', async (t) => {
  // 1. Unit-verify socketHandler listener dispatches player:ultimate -> GameRoom.handleUltimate
  const { socketHandler } = require('../server/socketHandler.js');
  const handlers = {};
  const mockSocket = {
    id: 'sock_1',
    emit: () => {},
    join: () => {},
    leave: () => {},
    on: (ev, fn) => { handlers[ev] = fn; }
  };
  let connectionCb = null;
  const mockIo = {
    on: (ev, fn) => { if (ev === 'connection') connectionCb = fn; },
    to: () => ({ emit: () => {} }),
    emit: () => {}
  };
  const { rooms } = socketHandler(mockIo);
  connectionCb(mockSocket);

  let createdRoomId = null;
  handlers['room:create']({ roomName: 'SockUlt', playerName: 'Wiz', character: 'MAGE' }, (res) => {
    createdRoomId = res.room.id;
  });
  const createdRoom = rooms.get(createdRoomId);
  t.after(() => createdRoom.gameRoom.stop());
  handlers['room:start']();
  const gamePlayer = createdRoom.gameRoom.players.get('sock_1');
  gamePlayer.x = 500;
  gamePlayer.y = 500;
  gamePlayer.ultCharge = 100;

  handlers['player:ultimate']({ angle: 0 });
  assert.strictEqual(gamePlayer.ultCharge, 0, 'Socket event player:ultimate must trigger ultimate');
  assert.strictEqual(gamePlayer.x, 740, 'Mage must blink 240px east');

  // 2. Real TCP Socket.IO server snapshot structure check
  const { server, port } = await startServer(0);
  t.after(() => server.close());

  const socket = ioClient(`http://localhost:${port}`, { reconnection: false });
  await new Promise((resolve) => socket.on('connect', resolve));
  t.after(() => socket.disconnect());

  const createRes = await new Promise((resolve) => {
    socket.emit('room:create', { roomName: 'UltRoom', playerName: 'Wiz', character: 'MAGE' }, resolve);
  });
  assert.strictEqual(createRes.success, true);

  await new Promise((resolve) => {
    socket.once('room:gameStarted', resolve);
    socket.emit('room:start');
  });

  // Verify snapshot includes ultCharge and drones array
  const firstSnap = await new Promise((resolve) => socket.once('game:snapshot', resolve));
  assert.strictEqual(firstSnap.players[0].ultCharge, 0);
  assert.strictEqual(firstSnap.players[0].ultimateId, 'BLINK_FROST_NOVA');
  assert.ok(Array.isArray(firstSnap.drones));
});

test('Interpolator snaps player position on Blink jumps (>150px) instead of lerping through walls', () => {
  // Minimal browser global shim for Interpolator
  global.window = {};
  require('../client/js/interpolation.js');
  const Interpolator = global.window.Interpolator;
  const interp = new Interpolator();

  const players = interp.interpolatePlayers(
    [{ id: 'p1', x: 400, y: 500, angle: 0 }],
    [{ id: 'p1', x: 640, y: 500, angle: 0 }],
    0.5
  );
  assert.strictEqual(players[0].x, 640, 'Blink jump >150px must snap immediately');

  const walkPlayers = interp.interpolatePlayers(
    [{ id: 'p1', x: 400, y: 500, angle: 0 }],
    [{ id: 'p1', x: 410, y: 500, angle: 0 }],
    0.5
  );
  assert.strictEqual(walkPlayers[0].x, 405, 'Normal movement <=150px must interpolate smoothly');
});
