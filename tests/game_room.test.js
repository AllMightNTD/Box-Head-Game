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

