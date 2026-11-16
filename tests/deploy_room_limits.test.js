/**
 * @file deploy_room_limits.test.js
 * @description Tests for decoupled simulation/snapshot rates in GameRoom and MAX_ROOMS enforcement in socketHandler.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const { GameRoom } = require('../server/game/GameRoom.js');
const { socketHandler } = require('../server/socketHandler.js');

test('GameRoom decouples 50Hz simulation from 25Hz snapshot broadcast while preserving direct tick() emits', () => {
  // Arrange
  let snapshotCount = 0;
  const mockIo = {
    to: () => ({
      emit: (eventName) => {
        if (eventName === 'game:snapshot') snapshotCount += 1;
      }
    }),
    emit: () => {}
  };

  const room = new GameRoom('room-hz', 'Throttle Test', mockIo, 'THE_ROOMS', {
    simulationHz: 50,
    snapshotHz: 25
  });

  // Act & Assert: Verify configuration ratio
  assert.strictEqual(room.simulationHz, 50);
  assert.strictEqual(room.snapshotHz, 25);
  assert.strictEqual(room.snapshotIntervalTicks, 2);

  // Direct tick() with default options still emits for backward compatibility
  room.addPlayer('p1', 'Tester', 'HUMAN');
  room.state = 'PLAYING';
  room.tick(0.02);
  assert.strictEqual(snapshotCount, 1);

  // Explicit emitSnapshot: false skips network emit while preserving simulation
  room.tick(0.02, { emitSnapshot: false });
  assert.strictEqual(snapshotCount, 1);

  room.tick(0.02, { emitSnapshot: true });
  assert.strictEqual(snapshotCount, 2);
});

test('socketHandler enforces MAX_ROOMS limit and guards against malformed room:create payloads', () => {
  // Arrange
  const mockIo = new EventEmitter();
  mockIo.to = () => ({ emit: () => {} });
  const { rooms } = socketHandler(mockIo, {
    maxRooms: 1,
    roomOptions: { simulationHz: 50, snapshotHz: 25 }
  });

  const makeSocket = (id) => {
    const s = new EventEmitter();
    s.id = id;
    s.joined = [];
    s.emitted = [];
    s.join = (roomId) => s.joined.push(roomId);
    s.leave = () => {};
    const origEmit = s.emit.bind(s);
    s.trigger = origEmit;
    s.emit = (ev, data) => s.emitted.push({ ev, data });
    return s;
  };

  const s1 = makeSocket('sock-1');
  const s2 = makeSocket('sock-2');
  mockIo.emit('connection', s1);
  mockIo.emit('connection', s2);

  // Act 1: Malformed null payload does not crash and creates default room up to limit
  let res1 = null;
  s1.trigger('room:create', null, (res) => { res1 = res; });

  // Assert 1
  assert.strictEqual(res1.success, true);
  assert.strictEqual(rooms.size, 1);
  const firstRoom = rooms.get(res1.room.id);
  assert.strictEqual(firstRoom.gameRoom.snapshotHz, 25);

  // Act 2: Second room exceeds maxRooms=1
  let res2 = null;
  s2.trigger('room:create', { roomName: 'Overflow', playerName: 'P2' }, (res) => { res2 = res; });

  // Assert 2
  assert.strictEqual(res2.success, false);
  assert.match(res2.error, /đầy/i);
  assert.strictEqual(rooms.size, 1);
  assert.ok(s2.emitted.some(e => e.ev === 'room:error'));
});
