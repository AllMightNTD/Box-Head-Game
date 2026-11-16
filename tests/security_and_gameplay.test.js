'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const { socketHandler } = require('../server/socketHandler.js');

function createMockSocket(id) {
  const s = new EventEmitter();
  s.id = id;
  s.joined = [];
  s.emitted = [];
  s.join = (roomId) => s.joined.push(roomId);
  s.leave = (roomId) => {
    s.joined = s.joined.filter(r => r !== roomId);
  };
  const origEmit = s.emit.bind(s);
  s.trigger = origEmit;
  s.emit = (ev, data) => s.emitted.push({ ev, data });
  return s;
}

test('Task 1: socketHandler survives malformed and null payloads before and inside room', (t) => {
  const mockIo = new EventEmitter();
  mockIo.to = () => ({ emit: () => {} });
  const { rooms } = socketHandler(mockIo);
  t.after(() => {
    for (const r of rooms.values()) {
      if (r.gameRoom) r.gameRoom.stop();
    }
  });

  const socket = createMockSocket('sock-malformed');
  mockIo.emit('connection', socket);

  const malformedInputs = [null, undefined, 123, 'bad-string', [], true];

  // Outside room
  for (const bad of malformedInputs) {
    assert.doesNotThrow(() => {
      socket.trigger('room:create', bad, () => {});
    }, `room:create should not throw outside room: ${JSON.stringify(bad)}`);
  }

  // Inside an active room so currentRoomId is populated and handlers run deep logic
  let createdRes = null;
  socket.trigger('room:create', { roomName: 'SafeRoom', playerName: 'Tester', character: 'HUMAN' }, (res) => {
    createdRes = res;
  });
  assert.strictEqual(createdRes.success, true);

  for (const bad of malformedInputs) {
    assert.doesNotThrow(() => {
      socket.trigger('room:join', bad, () => {});
      socket.trigger('room:selectChar', bad);
      socket.trigger('room:ready', bad);
      socket.trigger('room:selectMap', bad);
      socket.trigger('player:input', bad);
      socket.trigger('player:ultimate', bad);
      socket.trigger('player:skill', bad);
    }, `Should not throw inside room on input: ${JSON.stringify(bad)}`);
  }
});

test('Task 2: room:selectChar, room:ready, and room:selectMap are blocked when game is in progress', (t) => {
  const mockIo = new EventEmitter();
  mockIo.to = () => ({ emit: () => {} });
  const { rooms } = socketHandler(mockIo);
  t.after(() => {
    for (const r of rooms.values()) {
      if (r.gameRoom) r.gameRoom.stop();
    }
  });

  const socket = createMockSocket('sock-exploit');
  mockIo.emit('connection', socket);

  let createRes = null;
  socket.trigger('room:create', { roomName: 'Arena', playerName: 'Cheater', character: 'HUMAN' }, (res) => {
    createRes = res;
  });
  const room = rooms.get(createRes.room.id);

  // Start game -> state transitions to PLAYING
  socket.trigger('room:start');
  assert.strictEqual(room.state, 'PLAYING');

  const gamePlayer = room.gameRoom.players.get(socket.id);
  gamePlayer.hp = 10;
  gamePlayer.armor = 0;

  // Attempt mid-game class switch (full-heal exploit), ready toggle, and map switch
  socket.trigger('room:selectChar', { character: 'WARRIOR' });
  socket.trigger('room:ready', { ready: false });
  socket.trigger('room:selectMap', { mapId: 'VOLCANO' });

  assert.strictEqual(gamePlayer.hp, 10, 'Mid-game selectChar must not restore HP');
  assert.strictEqual(gamePlayer.character, 'HUMAN', 'Mid-game selectChar must not change character');
  assert.strictEqual(room.players.get(socket.id).ready, true, 'Mid-game ready toggle must be ignored');
  assert.strictEqual(room.mapId, 'THE_ROOMS', 'Mid-game selectMap must be ignored');
});

test('Task 3: socket auto-leaves previous room on create/join and preserves room on failed join', (t) => {
  const mockIo = new EventEmitter();
  mockIo.to = () => ({ emit: () => {} });
  const { rooms } = socketHandler(mockIo, { maxRooms: 2 });
  t.after(() => {
    for (const r of rooms.values()) {
      if (r.gameRoom) r.gameRoom.stop();
    }
  });

  const s1 = createMockSocket('sock-1');
  const s2 = createMockSocket('sock-2');
  mockIo.emit('connection', s1);
  mockIo.emit('connection', s2);

  // 1. s1 creates Room 1, then creates Room 2 -> Room 1 must be deleted (preventing ghost player)
  let r1Res = null;
  s1.trigger('room:create', { roomName: 'Room1', playerName: 'S1' }, (res) => { r1Res = res; });
  const r1Id = r1Res.room.id;

  let r2Res = null;
  s1.trigger('room:create', { roomName: 'Room2', playerName: 'S1' }, (res) => { r2Res = res; });
  const r2Id = r2Res.room.id;

  assert.strictEqual(rooms.has(r1Id), false, 'Room 1 should be deleted after solo host creates Room 2');
  assert.strictEqual(rooms.has(r2Id), true);
  assert.strictEqual(rooms.get(r2Id).players.size, 1);

  // 2. s2 creates Room 3 (maxRooms=2: Room 2 & Room 3), then s1 joins Room 3 -> Room 2 deleted, Room 3 has 2 players
  let r3Res = null;
  s2.trigger('room:create', { roomName: 'Room3', playerName: 'S2' }, (res) => { r3Res = res; });
  const r3Id = r3Res.room.id;

  let joinRes = null;
  s1.trigger('room:join', { roomId: r3Id, playerName: 'S1' }, (res) => { joinRes = res; });
  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(rooms.has(r2Id), false, 'Room 2 should be deleted after s1 moves to Room 3');
  assert.strictEqual(rooms.get(r3Id).players.size, 2);

  // 3. s1 tries to join non-existent room -> must stay in Room 3
  let badJoinRes = null;
  s1.trigger('room:join', { roomId: 'non_existent', playerName: 'S1' }, (res) => { badJoinRes = res; });
  assert.strictEqual(badJoinRes.success, false);
  assert.strictEqual(rooms.get(r3Id).players.has(s1.id), true, 'Failed join must not kick player from current room');
});

test('Task 4: escapeHtml and sanitizeCssColor prevent HTML/attribute/CSS injection', () => {
  const { escapeHtml, sanitizeCssColor } = require('../client/js/ui.js');

  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(
    escapeHtml('<script>alert("x")</script>\'&'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;&amp;'
  );

  assert.strictEqual(sanitizeCssColor('#ff3d00'), '#ff3d00');
  assert.strictEqual(sanitizeCssColor('var(--accent)'), 'var(--accent)');
  assert.strictEqual(
    sanitizeCssColor('red; background: url(https://evil.test)'),
    '#00e5ff'
  );
  assert.strictEqual(sanitizeCssColor(null, '#ffffff'), '#ffffff');
});

test('Task 5: High-speed bullets use CCD (no zombie/wall tunneling) and penetrating bullets do not double-hit same zombie', (t) => {
  const { Bullet } = require('../server/game/Bullet.js');
  const { GameMap } = require('../server/game/Map.js');
  const { GameRoom } = require('../server/game/GameRoom.js');
  const { Zombie } = require('../server/game/Zombie.js');

  // 1. Railgun bullet hits target in path at +30px during 60px step
  const bullet = new Bullet('b_rail', 'p1', 100, 200, 0, {
    speed: 3000,
    damage: 100,
    range: 1000,
    type: 'railgun',
    penetration: true
  });
  bullet.update(0.02, null);
  assert.strictEqual(bullet.x, 160);
  assert.strictEqual(bullet.checkHit({ x: 130, y: 200, radius: 15 }), true, 'Railgun should hit point-blank target in travel path');

  // 2. Railgun bullet stops at thin 40px wall (boundary x=0..40 or pillar) instead of tunneling across
  const mockWallMap = {
    isWall: (x, y) => x >= 115 && x <= 145
  };
  const wallBullet = new Bullet('b_wall', 'p1', 100, 200, 0, {
    speed: 3000,
    damage: 100,
    range: 1000,
    type: 'railgun'
  });
  wallBullet.update(0.02, mockWallMap);
  assert.strictEqual(wallBullet.isDead, true, 'High-speed railgun must collide with wall instead of tunneling past it');
  assert.ok(wallBullet.x <= 145, `Bullet should stop at or inside wall, got x=${wallBullet.x}`);

  // 3. Penetrating bullet hits zombie once without double-hitting across ticks
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_ccd', 'CCD Room', mockIo);
  t.after(() => room.stop());
  const shooter = room.addPlayer('p1', 'Sniper', 'HUMAN');
  room.startGame();

  const z = new Zombie('z_tank', 'TANK', 240, 200);
  z.hp = 500;
  z.maxHp = 500;
  room.zombies.push(z);

  const rail = new Bullet('b_pierce', shooter.id, 200, 200, 0, {
    speed: 3000,
    damage: 100,
    range: 1000,
    type: 'railgun',
    penetration: true
  });
  room.bullets.push(rail);

  room.tick(0.02); // advances 200 -> 260, passes through z at 240
  const hpAfterTick1 = z.hp;
  assert.strictEqual(hpAfterTick1, 400, 'Penetrating bullet should deal 100 damage on first pass');

  // Move zombie directly onto new bullet position and tick again -> must NOT hit again
  z.x = rail.x + 10;
  room.tick(0.02);
  assert.strictEqual(z.hp, 400, 'Penetrating bullet must not hit the same zombie twice');
  assert.ok(new GameMap('THE_ROOMS'));
});

test('Task 6: Player.serialize() includes reviving and reviveProgress when channeling revive', () => {
  const { Player } = require('../server/game/Player.js');
  const rescuer = new Player('p1', 'Alice', 'HUMAN', 100, 100);
  const downed = new Player('p2', 'Bob', 'HUMAN', 120, 100);
  downed.isDowned = true;

  const snapIdle = rescuer.serialize();
  assert.strictEqual(snapIdle.reviving, false);
  assert.strictEqual(snapIdle.reviveProgress, 0);

  rescuer.startRevive(downed);
  rescuer.updateRevive(0.8);

  const snapChannel = rescuer.serialize();
  assert.strictEqual(snapChannel.reviving, true);
  assert.strictEqual(snapChannel.reviveProgress, 0.8);
});

test('Task 7: GameRoom stops 50Hz gameLoopInterval on GAMEOVER and restarts cleanly on startGame', (t) => {
  const { GameRoom } = require('../server/game/GameRoom.js');
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_over', 'GameOver Room', mockIo, 'THE_ROOMS');
  t.after(() => room.stop());

  room.addPlayer('p1', 'Solo', 'HUMAN');
  room.startGame();
  assert.ok(room.gameLoopInterval !== null, 'gameLoopInterval must be running after startGame');

  const p = room.players.get('p1');
  p.isDead = true;
  room.tick(0.02);

  assert.strictEqual(room.state, 'GAMEOVER');
  assert.strictEqual(room.gameLoopInterval, null, 'gameLoopInterval must be cleared on GAMEOVER');

  room.startGame();
  assert.strictEqual(room.state, 'PLAYING');
  assert.ok(room.gameLoopInterval !== null, 'gameLoopInterval must restart cleanly on startGame');
});

test('Task 8: UIController Game Over modal displays total team score and peak maxCombo instead of decayed combo', async () => {
  const prevWindow = global.window;
  const prevDocument = global.document;
  const prevFetch = global.fetch;

  try {
    const elements = {};
    const makeEl = (id) => {
      const classes = new Set();
      return {
        id,
        style: {},
        children: [],
        textContent: '',
        innerHTML: '',
        classList: {
          add: (...c) => c.forEach(x => classes.add(x)),
          remove: (...c) => c.forEach(x => classes.delete(x)),
          contains: (c) => classes.has(c),
          toggle: (c, f) => (f ? classes.add(c) : classes.delete(c))
        },
        appendChild: (ch) => { elements[id].children.push(ch); return ch; },
        addEventListener: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
      };
    };
    const mockDoc = {
      getElementById: (id) => (elements[id] ||= makeEl(id)),
      createElement: () => makeEl(''),
      querySelectorAll: () => []
    };
    global.document = mockDoc;
    global.window = { location: { origin: 'http://localhost:3000', protocol: 'http:' }, document: mockDoc };
    global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ lanIp: '127.0.0.1', port: 3000 }) });

    delete require.cache[require.resolve('../client/js/ui.js')];
    const { UIController } = require('../client/js/ui.js');
    const ui = new UIController();

    ui.updateHUD({
      state: 'GAMEOVER',
      wave: 7,
      zombiesLeft: 0,
      players: [
        { id: 'p1', name: 'Hero', hp: 0, maxHp: 100, isDowned: false, isDead: true, kills: 12, score: 1450, combo: 1, maxCombo: 24 },
        { id: 'p2', name: 'Ally', hp: 0, maxHp: 100, isDowned: false, isDead: true, kills: 8, score: 950, combo: 1, maxCombo: 11 }
      ]
    }, 'p1');

    assert.strictEqual(elements['go-wave-reached'].textContent, 'Wave 7');
    assert.strictEqual(elements['go-total-score'].textContent, '2400 (20 Kills)');
    assert.strictEqual(elements['go-best-combo'].textContent, 'x24');

    // Flush fetchLanIp promise chain before restoring globals
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    global.window = prevWindow;
    global.document = prevDocument;
    global.fetch = prevFetch;
    delete require.cache[require.resolve('../client/js/ui.js')];
  }
});

test('Task 14: Renderer offscreen radial light cache and cutout drawing', () => {
  const prevDoc = global.document;
  try {
    const createdCanvases = [];
    global.document = {
      createElement: (tag) => {
        if (tag === 'canvas') {
          const cvs = {
            width: 0,
            height: 0,
            getContext: () => ({
              createRadialGradient: () => ({ addColorStop: () => {} }),
              beginPath: () => {},
              arc: () => {},
              fill: () => {}
            })
          };
          createdCanvases.push(cvs);
          return cvs;
        }
        return {};
      }
    };

    delete require.cache[require.resolve('../client/js/renderer.js')];
    const { Renderer } = require('../client/js/renderer.js');
    const mockMainCanvas = {
      getContext: () => ({
        save: () => {},
        restore: () => {},
        drawImage: () => {}
      })
    };
    const renderer = new Renderer(mockMainCanvas);

    // Call getRadialLightCanvas
    const c1 = renderer.getRadialLightCanvas(0.24); // quantizes to 0.25 (5/20)
    const c2 = renderer.getRadialLightCanvas(0.26); // quantizes to 0.25 (5/20)
    assert.strictEqual(c1, c2, 'Same quantized ratio should return identical cached offscreen canvas');
    assert.strictEqual(c1.width, 256);
    assert.strictEqual(c1.height, 256);

    const drawCalls = [];
    const drawCtx = {
      save: () => drawCalls.push('save'),
      restore: () => drawCalls.push('restore'),
      drawImage: (img, dx, dy, dw, dh) => drawCalls.push({ img, dx, dy, dw, dh }),
      globalAlpha: 1
    };

    renderer.cutoutRadialLight(drawCtx, 100, 200, 25, 100, 0.8);
    assert.strictEqual(drawCtx.globalAlpha, 0.8);
    assert.strictEqual(drawCalls.length, 3);
    assert.strictEqual(drawCalls[0], 'save');
    assert.deepStrictEqual(drawCalls[1], { img: c1, dx: 0, dy: 100, dw: 200, dh: 200 });
    assert.strictEqual(drawCalls[2], 'restore');
  } finally {
    global.document = prevDoc;
    delete require.cache[require.resolve('../client/js/renderer.js')];
  }
});

test('Task 15: GameRoom collectActiveBarrels and squared distance checks', () => {
  const { GameRoom } = require('../server/game/GameRoom.js');
  const { Barricade, Barrel } = require('../server/game/Barricade.js');

  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('r_perf', 'Perf Test', mockIo);
  room.startGame();

  const bar1 = new Barrel('b1', 100, 100, 'p1');
  const bar2 = new Barrel('b2', 200, 200, 'p1');
  const wall = new Barricade('w1', 300, 300, 'p1');
  bar2.isDead = true;

  room.barricades.push(bar1, bar2, wall);

  const collected = room.collectActiveBarrels();
  assert.strictEqual(collected.length, 1);
  assert.strictEqual(collected[0], bar1);

  const targetArr = [];
  room.collectActiveBarrels(targetArr);
  assert.strictEqual(targetArr.length, 1);
  assert.strictEqual(targetArr[0], bar1);

  // Test placeItem distance check avoids duplicate placement within 36px (distSq < 1296)
  const p = room.addPlayer('p1', 'Builder', 'HUMAN');
  p.x = 100;
  p.y = 88;
  p.angle = 0;
  p.selectedWeapon = 'BARREL';
  p.weapons['BARREL'].unlocked = true;
  p.weapons['BARREL'].ammo = 10;
  p.fireCooldown = 0;

  // Place bar1 at the exact spot player will place: px = 176, py = 88
  bar1.x = 176;
  bar1.y = 88;

  // Attempt placement directly over existing barrel (distance 0 < 36px)
  room.handlePlaceItem('p1');
  assert.strictEqual(room.barricades.length, 3, 'Placement within 36px must be rejected');

  // Move bar1 40px away (dx = 40, dy = 0 -> distSq = 1600 > 1296)
  bar1.x = 176 + 40;
  room.handlePlaceItem('p1');
  assert.strictEqual(room.barricades.length, 4, 'Placement beyond 36px must succeed');

  room.stop();
});




