const { test } = require('node:test');
const assert = require('node:assert');
const { MAPS, DEFAULT_MAP_ID, getMapConfig, getMapList } = require('../server/game/MapConfig.js');
const { GameMap } = require('../server/game/Map.js');
const { GameRoom } = require('../server/game/GameRoom.js');

test('MapConfig defines all 4 maps with proper structure and properties', () => {
  const expectedMaps = ['THE_ROOMS', 'DESERT', 'SNOW', 'VOLCANO'];
  assert.strictEqual(Object.keys(MAPS).length, 4);

  expectedMaps.forEach(mapId => {
    const config = getMapConfig(mapId);
    assert.ok(config, `Map ${mapId} should exist`);
    assert.strictEqual(config.id, mapId);
    assert.ok(config.name && config.name.length > 0, `Map ${mapId} must have name`);
    assert.ok(config.badge && config.badge.length > 0, `Map ${mapId} must have badge`);
    assert.ok(config.badgeColor && config.badgeColor.startsWith('#'), `Map ${mapId} must have hex badgeColor`);
    assert.strictEqual(config.width, 1600);
    assert.strictEqual(config.height, 1200);
    assert.ok(Array.isArray(config.walls) && config.walls.length >= 4, `Map ${mapId} must have walls`);
    assert.ok(config.theme && config.theme.floorColor, `Map ${mapId} must have theme`);
    assert.ok(Array.isArray(config.playerSpawns) && config.playerSpawns.length >= 4, `Map ${mapId} must have player spawns`);
    assert.ok(Array.isArray(config.zombieSpawns) && config.zombieSpawns.length >= 4, `Map ${mapId} must have zombie spawns`);
  });

  // Invalid map falls back to default
  const fallback = getMapConfig('NON_EXISTENT');
  assert.strictEqual(fallback.id, DEFAULT_MAP_ID);

  // Map list contains summary objects
  const list = getMapList();
  assert.strictEqual(list.length, 4);
  assert.strictEqual(list[0].id, 'THE_ROOMS');
});

test('GameMap can instantiate any of the 4 maps and player spawns are obstacle-free', () => {
  const mapIds = ['THE_ROOMS', 'DESERT', 'SNOW', 'VOLCANO'];

  mapIds.forEach(mapId => {
    const map = new GameMap(mapId);
    assert.strictEqual(map.id, mapId);
    assert.strictEqual(map.width, 1600);
    assert.strictEqual(map.height, 1200);
    assert.ok(map.walls.length > 4, `${mapId} should have obstacles`);

    // Verify player spawns are free from wall collision
    const spawns = map.playerSpawns;
    assert.strictEqual(spawns.length, 4);

    spawns.forEach((spawn, idx) => {
      const colliding = map.isWall(spawn.x, spawn.y, 20);
      assert.strictEqual(colliding, false, `Player spawn ${idx} on ${mapId} at (${spawn.x}, ${spawn.y}) must not collide with wall`);
    });
  });

  // Backward compatibility with legacy constructor without args
  const defaultMap = new GameMap();
  assert.strictEqual(defaultMap.id, 'THE_ROOMS');
});

test('GameRoom accepts mapId and host can change map dynamically', () => {
  const mockIo = {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  };

  const room = new GameRoom('test_map_room', 'Room With Desert', mockIo, 'DESERT');
  assert.strictEqual(room.mapId, 'DESERT');
  assert.strictEqual(room.map.id, 'DESERT');

  const snapshot = room.getSnapshot();
  assert.strictEqual(snapshot.mapId, 'DESERT');

  // Change to SNOW
  room.setMap('SNOW');
  assert.strictEqual(room.mapId, 'SNOW');
  assert.strictEqual(room.map.id, 'SNOW');

  // Change to VOLCANO
  room.setMap('VOLCANO');
  assert.strictEqual(room.mapId, 'VOLCANO');
  assert.strictEqual(room.map.id, 'VOLCANO');
});

test('E2E Socket: Map selection at room creation, dynamic map change in lobby, and game start synchronization', async (t) => {
  const { io: ioClient } = require('socket.io-client');
  const { startServer } = require('../server/server.js');

  const { server, port } = await startServer(0);
  t.after(() => server.close());

  const serverUrl = `http://localhost:${port}`;
  function createClient() {
    return new Promise((resolve, reject) => {
      const socket = ioClient(serverUrl, { reconnection: false });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  const host = await createClient();
  const peer = await createClient();
  t.after(() => {
    host.disconnect();
    peer.disconnect();
  });

  // 1. Host creates room with DESERT map
  const createRes = await new Promise((resolve) => {
    host.emit('room:create', {
      roomName: 'Desert Squad',
      playerName: 'HostBambo',
      character: 'BAMBO',
      mapId: 'DESERT'
    }, resolve);
  });

  assert.strictEqual(createRes.success, true);
  assert.strictEqual(createRes.room.mapId, 'DESERT');
  assert.strictEqual(createRes.room.mapBadge, '🏜️ SA MẠC');
  const roomId = createRes.room.id;

  // 2. Peer joins room - wait for host to receive the peer join update
  const hostJoinUpdatePromise = new Promise(resolve => host.once('room:update', resolve));
  const joinRes = await new Promise((resolve) => {
    peer.emit('room:join', { roomId, playerName: 'PeerBon', character: 'BON' }, resolve);
  });
  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(joinRes.room.mapId, 'DESERT');
  await hostJoinUpdatePromise;

  // 3. Host changes map to VOLCANO
  const updatePromises = [host, peer].map(c => new Promise(resolve => c.once('room:update', resolve)));
  host.emit('room:selectMap', { mapId: 'VOLCANO' });
  const [hostUpdate, peerUpdate] = await Promise.all(updatePromises);

  assert.strictEqual(hostUpdate.mapId, 'VOLCANO');
  assert.strictEqual(hostUpdate.mapBadge, '🌋 NÚI LỬA');
  assert.strictEqual(peerUpdate.mapId, 'VOLCANO');

  // 4. Host starts game
  const startPromises = [host, peer].map(c => new Promise(resolve => c.once('room:gameStarted', resolve)));
  host.emit('room:start');
  const [hostStart, peerStart] = await Promise.all(startPromises);

  assert.strictEqual(hostStart.mapId, 'VOLCANO');
  assert.strictEqual(peerStart.mapId, 'VOLCANO');

  // 5. Verify game snapshot includes mapId: 'VOLCANO'
  const snapshot = await new Promise(resolve => host.once('game:snapshot', resolve));
  assert.strictEqual(snapshot.mapId, 'VOLCANO');
});

test('Client MAPS_CONFIG matches server MAPS for walls, spawns, and theme across all 4 maps', () => {
  const { MAPS_CONFIG } = require('../client/js/mapsConfig.js');
  const mapIds = ['THE_ROOMS', 'DESERT', 'SNOW', 'VOLCANO'];

  assert.deepStrictEqual(Object.keys(MAPS_CONFIG).sort(), [...mapIds].sort());
  for (const mapId of mapIds) {
    assert.deepStrictEqual(MAPS_CONFIG[mapId].walls, MAPS[mapId].walls, `${mapId} walls mismatch`);
    assert.deepStrictEqual(MAPS_CONFIG[mapId].playerSpawns, MAPS[mapId].playerSpawns, `${mapId} playerSpawns mismatch`);
    assert.deepStrictEqual(MAPS_CONFIG[mapId].zombieSpawns, MAPS[mapId].zombieSpawns, `${mapId} zombieSpawns mismatch`);
    assert.deepStrictEqual(MAPS_CONFIG[mapId].theme, MAPS[mapId].theme, `${mapId} theme mismatch`);
  }
});
