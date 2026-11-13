const test = require('node:test');
const assert = require('node:assert');
const { io: ioClient } = require('socket.io-client');
const { startServer } = require('../server/server.js');

test('End-to-End: 4 concurrent LAN players join, select 4 characters, and play game', async (t) => {
  const { server, port } = await startServer(0);
  t.after(() => server.close());

  const serverUrl = `http://localhost:${port}`;

  function createClient(name) {
    return new Promise((resolve, reject) => {
      const socket = ioClient(serverUrl, { reconnection: false });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  // 1. Connect 4 headless clients
  const client1 = await createClient('Player1');
  const client2 = await createClient('Player2');
  const client3 = await createClient('Player3');
  const client4 = await createClient('Player4');

  t.after(() => {
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    client4.disconnect();
  });

  // 2. Client 1 creates a room
  const createRes = await new Promise((resolve) => {
    client1.emit('room:create', {
      roomName: 'Squad 4',
      playerName: 'BamboLeader',
      character: 'BAMBO'
    }, resolve);
  });

  assert.strictEqual(createRes.success, true);
  const roomId = createRes.room.id;

  // 3. Clients 2, 3, 4 join the room
  const join2 = await new Promise((resolve) => {
    client2.emit('room:join', { roomId, playerName: 'RedBon', character: 'BON' }, resolve);
  });
  assert.strictEqual(join2.success, true);

  const join3 = await new Promise((resolve) => {
    client3.emit('room:join', { roomId, playerName: 'BlueBingo', character: 'BINGO' }, resolve);
  });
  assert.strictEqual(join3.success, true);

  const join4 = await new Promise((resolve) => {
    client4.emit('room:join', { roomId, playerName: 'YellowBert', character: 'BERT' }, resolve);
  });
  assert.strictEqual(join4.success, true);

  // 4. Verify 4 distinct characters assigned
  const roomAfterJoins = join4.room;
  assert.strictEqual(roomAfterJoins.players.length, 4);
  const assignedChars = roomAfterJoins.players.map(p => p.character);
  assert.deepStrictEqual(new Set(assignedChars).size, 4, 'All 4 players must have unique characters');

  // 5. Host starts game
  const gameStartPromises = [client1, client2, client3, client4].map(c => {
    return new Promise((resolve) => {
      c.once('room:gameStarted', resolve);
    });
  });

  client1.emit('room:start');
  await Promise.all(gameStartPromises);

  // 6. Verify all 4 clients receive synchronized game snapshots
  const snapshotPromises = [client1, client2, client3, client4].map(c => {
    return new Promise((resolve) => {
      c.once('game:snapshot', (snap) => {
        assert.strictEqual(snap.state, 'PLAYING');
        assert.strictEqual(snap.wave, 1);
        assert.strictEqual(snap.players.length, 4);
        resolve(snap);
      });
    });
  });

  // Client 1 sends input and shoot
  client1.emit('player:input', { up: true, shoot: true, angle: 0 });

  const snapshots = await Promise.all(snapshotPromises);
  assert.strictEqual(snapshots.length, 4);
});
