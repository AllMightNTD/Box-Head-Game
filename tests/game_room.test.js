const test = require('node:test');
const assert = require('node:assert');
const { GameRoom } = require('../server/game/GameRoom.js');

test('GameRoom runs loop, advances wave and serializes snapshot', (t) => {
  const mockIo = {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  };
  const room = new GameRoom('room-1', 'Survival 1', mockIo);
  t.after(() => room.stop());

  room.addPlayer('s1', 'Alice', 'BAMBO');
  room.addPlayer('s2', 'Bob', 'BON');
  assert.strictEqual(room.players.size, 2);

  room.startGame();
  assert.strictEqual(room.state, 'PLAYING');
  assert.strictEqual(room.wave, 1);

  // Simulate tick
  room.tick(0.016);
  const snapshot = room.getSnapshot();
  assert.ok(snapshot.players.length === 2);
  assert.ok(Array.isArray(snapshot.zombies));
  assert.ok(Array.isArray(snapshot.bullets));
  assert.ok(Array.isArray(snapshot.barricades));
});

test('GameRoom handles shooting and weapon placement', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('room-2', 'Survival 2', mockIo);
  t.after(() => room.stop());

  room.addPlayer('p1', 'Alice', 'BAMBO');
  room.startGame();

  // Test pistol shoot
  room.handleShoot('p1');
  assert.strictEqual(room.bullets.length, 1);

  // Give player Barricade and place it
  const player = room.players.get('p1');
  player.weapons.BARRICADE.unlocked = true;
  player.selectedWeapon = 'BARRICADE';
  player.fireCooldown = 0;
  room.handlePlaceItem('p1');
  assert.strictEqual(room.barricades.length, 1);
});

test('GameRoom cleanly resets previous session when starting a new game', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('room-reset-test', 'Reset Test', mockIo);
  t.after(() => room.stop());

  room.addPlayer('p1', 'Alice', 'BAMBO');
  room.startGame();

  // Dirty the session
  const player = room.players.get('p1');
  player.combo = 45;
  player.maxCombo = 50;
  player.score = 5000;
  player.kills = 120;
  player.hp = 10;
  player.isDowned = true;
  player.weapons.RAILGUN.unlocked = true;
  player.weapons.RAILGUN.ammo = 10;
  player.selectedWeapon = 'RAILGUN';
  player.ultCharge = 90;
  player.hasInfiniteAmmo = true;
  room.wave = 9;
  room.zombies.push({ id: 'z1' });
  room.bullets.push({ id: 'b1' });
  room.barricades.push({ id: 'bar1' });
  room.pickups.push({ id: 'drop1' });
  if (room.drones) room.drones.push({ id: 'd1' });

  // Now start new game / restart
  room.startGame();

  assert.strictEqual(room.wave, 1, 'Wave must reset to 1');
  assert.strictEqual(room.zombies.length, 0, 'Zombies must be cleared');
  assert.strictEqual(room.bullets.length, 0, 'Bullets must be cleared');
  assert.strictEqual(room.barricades.length, 0, 'Barricades must be cleared');
  assert.strictEqual(room.pickups.length, 0, 'Pickups must be cleared');
  assert.strictEqual(room.drones ? room.drones.length : 0, 0, 'Drones must be cleared');
  assert.ok(room.eventsBuffer.some(e => e.type === 'SESSION_RESET'), 'Must emit SESSION_RESET event');

  assert.strictEqual(player.hp, player.maxHp, 'HP must be restored');
  assert.strictEqual(player.isDowned, false, 'Downed state must reset');
  assert.strictEqual(player.ultCharge, 0, 'Ultimate charge must reset to 0');
  assert.strictEqual(player.hasInfiniteAmmo, false, 'Infinite ammo buff must reset');
  assert.strictEqual(player.combo, 1, 'Combo must reset to 1');
  assert.strictEqual(player.maxCombo, 1, 'MaxCombo must reset to 1');
  assert.strictEqual(player.kills, 0, 'Kills must reset to 0');
  assert.strictEqual(player.score, 0, 'Score must reset to 0');
  assert.strictEqual(player.selectedWeapon, 'PISTOL', 'Selected weapon must be PISTOL');
  assert.strictEqual(player.weapons.PISTOL.unlocked, true, 'Pistol must be unlocked');
  assert.strictEqual(player.weapons.RAILGUN.unlocked, false, 'Railgun must be locked on session reset');
});

test('GameRoom emits enriched HIT and ZOMBIE_DIE events with angle, weapon, and zType', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('room-hit-meta', 'Hit Meta', mockIo);
  t.after(() => room.stop());

  const p = room.addPlayer('p1', 'Alice', 'HUMAN');
  room.startGame();
  room.eventsBuffer = [];

  // Place a zombie directly in front of player p1
  p.x = 500;
  p.y = 500;
  p.angle = 0.5;
  const { Zombie } = require('../server/game/Zombie.js');
  const z = new Zombie('z_test', 'RUNNER', 530, 515);
  z.hp = 10; // Dies in 1 pistol shot (25 dmg)
  room.zombies.push(z);

  room.handleShoot('p1');
  // Advance tick until bullet hits zombie
  for (let i = 0; i < 5; i++) {
    room.tick(0.02);
  }

  // Capture emitted events by intercepting emit on a fresh shot
  const emittedSnapshots = [];
  room.io = {
    to: () => ({
      emit: (evName, data) => {
        if (evName === 'game:snapshot') emittedSnapshots.push(data);
      }
    })
  };

  const z2 = new Zombie('z_test_2', 'TANK', 525, 500);
  z2.hp = 20;
  p.angle = 0.25;
  p.fireCooldown = 0;
  room.zombies.push(z2);
  room.handleShoot('p1');
  room.tick(0.02);

  const allEvents = emittedSnapshots.flatMap(s => s.events);
  const hitEv = allEvents.find(e => e.type === 'HIT');
  const dieEv = allEvents.find(e => e.type === 'ZOMBIE_DIE');

  assert.ok(hitEv, 'Expected HIT event to be emitted');
  assert.strictEqual(typeof hitEv.angle, 'number');
  assert.strictEqual(hitEv.weapon, 'bullet');
  assert.strictEqual(hitEv.zType, 'TANK');

  assert.ok(dieEv, 'Expected ZOMBIE_DIE event to be emitted');
  assert.strictEqual(dieEv.zType, 'TANK');
  assert.strictEqual(typeof dieEv.killAngle, 'number');
});

test('GameRoom triggerExplosion emits ZOMBIE_DIE with killAngle', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('room-exp-meta', 'Exp Meta', mockIo);
  t.after(() => room.stop());
  room.startGame();

  const { Zombie } = require('../server/game/Zombie.js');
  const z = new Zombie('z_exp', 'RUNNER', 100, 100);
  z.hp = 10;
  room.zombies.push(z);

  room.eventsBuffer = [];
  room.triggerExplosion(90, 100, 50, 100, null);

  const dieEv = room.eventsBuffer.find(e => e.type === 'ZOMBIE_DIE');
  assert.ok(dieEv, 'Expected ZOMBIE_DIE on explosion death');
  assert.strictEqual(dieEv.zType, 'RUNNER');
  assert.strictEqual(typeof dieEv.killAngle, 'number');
});

test('GameRoom triggerExplosion includes source tag in EXPLOSION event', () => {
  const room = new GameRoom('test_room', 'host_id', 'Host');
  if (room.initGame) room.initGame('hospital');
  room.triggerExplosion(300, 300, 150, 200, 'host_id', 'ROCKET');

  const expEvent = room.eventsBuffer.find(e => e.type === 'EXPLOSION');
  assert.ok(expEvent, 'EXPLOSION event must be emitted');
  assert.strictEqual(expEvent.source, 'ROCKET');
});

test('GameRoom triggerExplosion defaults to GENERIC source when unspecified', () => {
  const room = new GameRoom('test_room_default', 'host_id', 'Host');
  room.triggerExplosion(100, 100, 80, 50, 'host_id');

  const expEvent = room.eventsBuffer.find(e => e.type === 'EXPLOSION');
  assert.ok(expEvent, 'EXPLOSION event must be emitted');
  assert.strictEqual(expEvent.source, 'GENERIC');
});

test('Bullet update returns source for grenade, rocket wall hit, and out-of-range', () => {
  const { Bullet } = require('../server/game/Bullet.js');

  // Grenade fuse explosion
  const grenade = new Bullet('g1', 'p1', 100, 100, 0, {
    type: 'grenade',
    fuseTime: 0.1,
    explosionRadius: 120,
    explosionDamage: 150
  });
  const res1 = grenade.update(0.15);
  assert.ok(res1 && res1.exploded, 'Grenade should explode when fuse expires');
  assert.strictEqual(res1.source, 'GRENADE');

  // Rocket out of range explosion
  const rocket = new Bullet('r1', 'p1', 100, 100, 0, {
    type: 'rocket',
    speed: 1000,
    range: 100,
    explosionRadius: 160,
    explosionDamage: 200
  });
  const res2 = rocket.update(0.2); // travels 200 >= 100
  assert.ok(res2 && res2.exploded, 'Rocket should explode when out of range');
  assert.strictEqual(res2.source, 'ROCKET');

  // Rocket wall hit explosion
  const mockMap = { isWall: () => true };
  const rocketWall = new Bullet('r2', 'p1', 50, 50, 0, {
    type: 'rocket',
    speed: 500,
    range: 1000
  });
  const res3 = rocketWall.update(0.01, mockMap);
  assert.ok(res3 && res3.exploded, 'Rocket should explode on wall collision');
  assert.strictEqual(res3.source, 'ROCKET');
});

test('GameRoom tick routes bullet, barrel, and fireball explosions with correct source tags', (t) => {
  const emittedSnapshots = [];
  const mockIo = {
    to: () => ({
      emit: (evName, data) => {
        if (evName === 'game:snapshot') emittedSnapshots.push(data);
      }
    }),
    emit: () => {}
  };
  const room = new GameRoom('room-audio-src', 'Audio Source Test', mockIo);
  t.after(() => room.stop());
  room.state = 'PLAYING';

  const { Bullet } = require('../server/game/Bullet.js');
  const { Barrel } = require('../server/game/Barricade.js');

  // 1. Grenade exploding in tick
  const grenade = new Bullet('g_tick', 'p1', 200, 200, 0, {
    type: 'grenade',
    fuseTime: 0.05
  });
  room.bullets.push(grenade);
  room.tick(0.1);

  const allEvents1 = emittedSnapshots.flatMap(s => s.events);
  const grenadeExp = allEvents1.find(e => e.type === 'EXPLOSION' && e.source === 'GRENADE');
  assert.ok(grenadeExp, 'Expected EXPLOSION event with source GRENADE');

  // 2. Barrel exploding from bullet hit in tick
  emittedSnapshots.length = 0;
  const barrel = new Barrel('bar_tick', 300, 300);
  room.barricades.push(barrel);
  const bullet = new Bullet('b_tick', 'p1', 300, 300, 0, {
    type: 'pistol',
    damage: 100 // barrel has 100 hp, should detonate
  });
  room.bullets.push(bullet);
  room.tick(0.01);

  const allEvents2 = emittedSnapshots.flatMap(s => s.events);
  const barrelExp = allEvents2.find(e => e.type === 'EXPLOSION' && e.source === 'BARREL');
  assert.ok(barrelExp, 'Expected EXPLOSION event with source BARREL');

  // 3. Fireball hitting player in tick
  emittedSnapshots.length = 0;
  const player = room.addPlayer('p_target', 'Target', 'HUMAN');
  player.x = 740;
  player.y = 550;
  const fireball = new Bullet('fb_tick', null, 740, 550, 0, {
    type: 'fireball',
    isFireball: true,
    explosionRadius: 55,
    explosionDamage: 45
  });
  room.bullets.push(fireball);
  room.tick(0.01);

  const allEvents3 = emittedSnapshots.flatMap(s => s.events);
  const fbExp = allEvents3.find(e => e.type === 'EXPLOSION' && e.source === 'FIREBALL');
  assert.ok(fbExp, 'Expected EXPLOSION event with source FIREBALL');
});





