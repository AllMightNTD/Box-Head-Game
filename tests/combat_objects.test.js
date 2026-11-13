const test = require('node:test');
const assert = require('node:assert');
const { Bullet } = require('../server/game/Bullet.js');
const { Barricade, Barrel } = require('../server/game/Barricade.js');

test('Bullet moves and registers hit against target circle', () => {
  const bullet = new Bullet('b1', 'p1', 100, 100, 0, { speed: 800, damage: 25, range: 1000 });
  bullet.update(0.05);
  assert.ok(bullet.x > 100);
  assert.strictEqual(bullet.checkHit({ x: bullet.x, y: bullet.y, radius: 15 }), true);
});

test('Explosive barrels detonate and trigger chain reaction on nearby barrels', () => {
  const barrel1 = new Barrel('bar1', 100, 100);
  const barrel2 = new Barrel('bar2', 150, 100); // within 150 explosion radius
  const barrels = [barrel1, barrel2];

  const explosions = [];
  barrel1.takeDamage(100, barrels, (x, y, radius, damage) => {
    explosions.push({ x, y, radius, damage });
  });

  assert.strictEqual(barrel1.isDead, true);
  assert.strictEqual(barrel2.isDead, true, 'Adjacent barrel should explode from chain reaction');
  assert.ok(explosions.length >= 2, 'Should create 2 explosions in chain');
});

test('Barricade blocks movement and absorbs damage', () => {
  const bar = new Barricade('bar_wood', 300, 300);
  assert.strictEqual(bar.hp, 300);
  bar.takeDamage(100);
  assert.strictEqual(bar.hp, 200);
  assert.strictEqual(bar.isDead, false);

  const col = bar.resolveCircleCollision(300, 300, 20);
  assert.notStrictEqual(col.x, 300);
});

test('Zombie contact with explosive barrel triggers instant detonation and kills zombie', () => {
  const { GameRoom } = require('../server/game/GameRoom.js');
  const { Zombie } = require('../server/game/Zombie.js');
  const { Barrel } = require('../server/game/Barricade.js');

  const emittedEvents = [];
  const mockIo = {
    to: () => ({
      emit: (ev, snap) => {
        if (snap && snap.events) emittedEvents.push(...snap.events);
      }
    }),
    emit: () => {}
  };
  const room = new GameRoom('r_barrel', 'Barrel Test', mockIo);

  const player = room.addPlayer('p1', 'Bomber', 'HUMAN');
  room.startGame();

  // Place barrel at (500, 500) owned by p1
  const barrel = new Barrel('bar_test', 500, 500, 'p1');
  room.barricades.push(barrel);

  // Place zombie at (525, 500) - within contact radius (z.radius 23 + bar.radius 20 + 6 = 49)
  const zombie = new Zombie('z_test', 'NORMAL', 525, 500);
  room.zombies.push(zombie);

  // Tick the room
  room.tick(0.02);

  // Barrel must be detonated and marked dead
  assert.strictEqual(barrel.isDead, true, 'Barrel must detonate on zombie contact');
  // Zombie takes 250 explosion damage (Normal has 80 HP) -> dead
  assert.strictEqual(zombie.isDead, true, 'Zombie must die from barrel explosion');
  // Player p1 must be credited with the kill and score
  assert.strictEqual(player.kills, 1, 'Player who placed barrel gets the kill');
  assert.ok(player.score > 0, 'Player gets score from barrel kill');
  assert.ok(emittedEvents.some(e => e.type === 'EXPLOSION'), 'Must emit EXPLOSION event');

  room.stop();
});

test('Zombie walking towards player triggers barrel detonation in path', () => {
  const { GameRoom } = require('../server/game/GameRoom.js');
  const { Zombie } = require('../server/game/Zombie.js');
  const { Barrel } = require('../server/game/Barricade.js');

  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_barrel_path', 'Barrel Path Test', mockIo);

  const player = room.addPlayer('p1', 'Target', 'HUMAN');
  player.x = 400;
  player.y = 500;
  room.startGame();

  // Barrel between player and zombie at (460, 500)
  const barrel = new Barrel('bar_path', 460, 500, 'p1');
  room.barricades.push(barrel);

  // Zombie at (490, 500) walking left towards player at (400, 500)
  const zombie = new Zombie('z_walker', 'NORMAL', 490, 500);
  room.zombies.push(zombie);

  // Advance ticks
  for (let i = 0; i < 5; i++) {
    room.tick(0.02);
  }

  assert.strictEqual(barrel.isDead, true, 'Barrel in zombie path must detonate');
  assert.strictEqual(zombie.isDead, true, 'Zombie walking into barrel must die');

  room.stop();
});
