# Boxhead Multiplayer Refactoring & Full-System Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Eliminate DoS crash vectors, block mid-game full-heal cheat exploits, prevent ghost player leaks, resolve projectile tunneling and revive sync bugs, eliminate code duplication into CombatUtils, and optimize 60 FPS client rendering and 50Hz server loop.

**Architecture:** Authoritative 50Hz Node.js/Socket.IO backend with strict payload type guards, continuous collision detection for fast projectiles, unified combat math utilities, and an optimized Canvas 2D/DOM client with offscreen light caching and DOM pooling.

**Tech Stack:** Node.js (v18+), Socket.IO, Vanilla JavaScript (ES6+), Canvas 2D API, WebAudio API, Node.js built-in test runner (`node:test`, `node:assert`).

## Global Constraints
- All existing 181 tests in `npm test` must continue to pass 100% after every task.
- Strictly observe OWASP Top 10 security standards and sanitize all inputs.
- No breaking changes to client-server event contracts or network snapshot serialization format.
- Zero tolerance for placeholders (`TODO`, `TBD`, etc.) in implementation code.
- No destructive terminal commands (`rm -rf`, `git reset --hard`).

---

## File Structure

```
server/
  socketHandler.js               (Modify: payload guards, room state check, auto-leave)
  game/
    Bullet.js                    (Modify: continuous collision detection for fast projectiles)
    Player.js                    (Modify: serialize reviving and reviveProgress)
    GameRoom.js                  (Modify: stop loop on GAMEOVER, use CombatUtils, distSq, barrel cache)
    CombatUtils.js               (Create: shared combat math, drop pickups, credit kill)
    WarriorAbilities.js          (Modify: delegate to CombatUtils, 25% drop rate alignment)
    MageAbilities.js             (Modify: delegate to CombatUtils)
    UltimateAbilities.js         (Modify: prune dead seismic slam code)
    MapConfig.js                 (Source of truth for map definitions)

client/js/
  ui.js                          (Modify: DOM pooling, escapeHtml XSS fixes, score/maxCombo bugfix)
  renderer.js                    (Modify: offscreen radial gradient light caching)
  mapsConfig.js                  (Modify: sync player and zombie spawn points from server)

tests/
  security_and_gameplay.test.js  (Create: comprehensive tests for DoS, Anti-Cheat, Ghosting, CCD, Revive)
  combat_utils.test.js           (Create: unit tests for CombatUtils functions)
```

---

## Phase 1: An ninh, Ổn định Máy chủ & Chống gian lận (Security, DoS & Anti-Cheat)

### Task 1: Payload Type Guards & Crash DoS Prevention in `server/socketHandler.js`

**Files:**
- Modify: `server/socketHandler.js:100-185`
- Test: `tests/security_and_gameplay.test.js`

**Interfaces:**
- Consumes: Socket events (`room:join`, `room:selectChar`, `room:ready`, `room:selectMap`, `player:input`, `player:skill`)
- Produces: Safe payload extractor functions `safeObject(val)`, guarded socket handlers that reject non-object or null payloads without throwing uncaught TypeError.

- [x] **Step 1: Write the failing test for malformed socket payloads**

Create `tests/security_and_gameplay.test.js`:
```javascript
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

test('socketHandler survives malformed and null payloads without crashing Node.js process', () => {
  const mockIo = new EventEmitter();
  mockIo.to = () => ({ emit: () => {} });
  const { rooms } = socketHandler(mockIo);

  const socket = createMockSocket('sock-malformed');
  mockIo.emit('connection', socket);

  // Trigger each event with null, undefined, number, string
  const malformedInputs = [null, undefined, 123, 'bad-string', [], true];

  for (const bad of malformedInputs) {
    assert.doesNotThrow(() => {
      socket.trigger('room:join', bad, () => {});
      socket.trigger('room:selectChar', bad);
      socket.trigger('room:ready', bad);
      socket.trigger('room:selectMap', bad);
      socket.trigger('player:input', bad);
      socket.trigger('player:skill', bad);
    }, `Should not throw on input: ${JSON.stringify(bad)}`);
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: FAIL with `TypeError: Cannot destructure property 'roomId' of 'undefined' or 'null'`.

- [x] **Step 3: Implement safe payload helpers and guards in `server/socketHandler.js`**

In `server/socketHandler.js`, add helper function at top:
```javascript
function safeObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val) ? val : {};
}
```

Update handlers:
```javascript
    socket.on('room:join', (payload, callback) => {
      const safePayload = safeObject(payload);
      const { roomId, playerName, character } = safePayload;
      if (!roomId || typeof roomId !== 'string') {
        if (typeof callback === 'function') callback({ success: false, error: 'Mã phòng không hợp lệ!' });
        return;
      }
      const room = rooms.get(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng không tồn tại!' });
        return;
      }
      // ... continue join logic
```

For `room:selectChar`:
```javascript
    socket.on('room:selectChar', (payload) => {
      if (!currentRoomId) return;
      const safePayload = safeObject(payload);
      const { character } = safePayload;
      if (!character || typeof character !== 'string') return;
      // ...
```

For `room:ready`:
```javascript
    socket.on('room:ready', (payload) => {
      if (!currentRoomId) return;
      const safePayload = safeObject(payload);
      const { ready } = safePayload;
      const room = rooms.get(currentRoomId);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;
      player.ready = Boolean(ready);
      io.to(currentRoomId).emit('room:update', serializeRoom(room));
    });
```

For `room:selectMap`:
```javascript
    socket.on('room:selectMap', (payload) => {
      if (!currentRoomId) return;
      const safePayload = safeObject(payload);
      const { mapId } = safePayload;
      if (!mapId || typeof mapId !== 'string') return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== socket.id) return;
      if (!MAPS[mapId]) return;
      // ...
```

For `player:input`:
```javascript
    socket.on('player:input', (input) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.gameRoom) {
        const player = room.gameRoom.players.get(socket.id);
        if (player) {
          player.applyInput(safeObject(input));
        }
      }
    });
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/socketHandler.js tests/security_and_gameplay.test.js
git commit -m "fix(security): guard socket event handlers against malformed and null payloads"
```

---

### Task 2: State Guard for `room:selectChar` (Anti-Cheat: Mid-Game Full-Heal Exploit)

**Files:**
- Modify: `server/socketHandler.js:141-160`
- Test: `tests/security_and_gameplay.test.js`

**Interfaces:**
- Consumes: `room.state`, `room.gameRoom.state`
- Produces: Guard that rejects `room:selectChar` if the room is already in `PLAYING` or `INTERMISSION` state, preventing mid-game stat resets.

- [x] **Step 1: Write the failing test for mid-game class switch exploit**

In `tests/security_and_gameplay.test.js`, add:
```javascript
test('room:selectChar is blocked when game is already in progress (prevents mid-game full heal exploit)', () => {
  const mockIo = new EventEmitter();
  mockIo.to = () => ({ emit: () => {} });
  const { rooms } = socketHandler(mockIo);

  const socket = createMockSocket('sock-exploit');
  mockIo.emit('connection', socket);

  let joinRes = null;
  socket.trigger('room:create', { roomName: 'TestRoom', playerName: 'Cheater', character: 'HUMAN' }, (res) => {
    joinRes = res;
  });
  const room = rooms.get(joinRes.room.id);

  // Start game
  socket.trigger('room:start');
  assert.strictEqual(room.state, 'PLAYING');

  const gamePlayer = room.gameRoom.players.get(socket.id);
  // Simulate player taking damage down to 10 HP
  gamePlayer.hp = 10;
  gamePlayer.armor = 0;

  // Attempt exploit: switch character to WARRIOR mid-game
  socket.trigger('room:selectChar', { character: 'WARRIOR' });

  // Player must NOT be healed and character in GameRoom should not change
  assert.strictEqual(gamePlayer.hp, 10, 'Player HP should not be restored mid-game');
  assert.strictEqual(gamePlayer.character, 'HUMAN', 'Player character should not change mid-game');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: FAIL because `gamePlayer.hp` was restored to 140 (WARRIOR maxHp).

- [x] **Step 3: Implement state check in `server/socketHandler.js`**

In `server/socketHandler.js`:
```javascript
    socket.on('room:selectChar', (payload) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      // Only allow character selection during LOBBY state
      const isLobby = room.state === 'LOBBY' && (!room.gameRoom || room.gameRoom.state === 'LOBBY');
      if (!isLobby) return;

      const safePayload = safeObject(payload);
      const { character } = safePayload;
      if (!character || typeof character !== 'string') return;

      const player = room.players.get(socket.id);
      if (!player) return;

      if (CHARACTERS.includes(character)) {
        player.character = character;
        if (room.gameRoom) {
          const gameP = room.gameRoom.players.get(socket.id);
          if (gameP) {
            gameP.applyClassConfig(character);
          }
        }
        io.to(currentRoomId).emit('room:update', serializeRoom(room));
      }
    });
```
Also add a similar lobby check for `room:selectMap`:
```javascript
      const isLobby = room.state === 'LOBBY' && (!room.gameRoom || room.gameRoom.state === 'LOBBY');
      if (!isLobby) return;
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/socketHandler.js tests/security_and_gameplay.test.js
git commit -m "fix(anti-cheat): forbid class and map changes when game is not in lobby"
```

---

### Task 3: Automatic Room Cleanup on Multi-Room Creation & Join

**Files:**
- Modify: `server/socketHandler.js:46-139`
- Test: `tests/security_and_gameplay.test.js`

**Interfaces:**
- Consumes: `currentRoomId`, `handleLeave()`
- Produces: Guaranteed clean leave of previous room before joining or creating another room on the same socket connection.

- [x] **Step 1: Write the failing test for multi-room ghost player leak**

In `tests/security_and_gameplay.test.js`, add:
```javascript
test('socket joining or creating a new room automatically leaves previous room, preventing ghost players', () => {
  const mockIo = new EventEmitter();
  mockIo.to = () => ({ emit: () => {} });
  const { rooms } = socketHandler(mockIo);

  const socket = createMockSocket('sock-multi');
  mockIo.emit('connection', socket);

  // 1. Create first room
  let res1 = null;
  socket.trigger('room:create', { roomName: 'Room 1', playerName: 'Player1' }, (res) => { res1 = res; });
  const room1Id = res1.room.id;
  assert.strictEqual(rooms.has(room1Id), true);
  assert.strictEqual(rooms.get(room1Id).players.size, 1);

  // 2. Create second room on same socket without calling room:leave explicitly
  let res2 = null;
  socket.trigger('room:create', { roomName: 'Room 2', playerName: 'Player1' }, (res) => { res2 = res; });
  const room2Id = res2.room.id;

  // Room 1 had only 1 player, so leaving it must delete room 1
  assert.strictEqual(rooms.has(room1Id), false, 'Empty Room 1 should be destroyed when player moves to Room 2');
  assert.strictEqual(rooms.has(room2Id), true);
  assert.strictEqual(rooms.get(room2Id).players.size, 1);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: FAIL because Room 1 still exists with 1 player in `rooms`.

- [x] **Step 3: Call `handleLeave()` before room creation and join in `server/socketHandler.js`**

In `server/socketHandler.js`:
Move `handleLeave` definition or declare `leaveCurrentRoom()`:
```javascript
    function leaveCurrentRoom() {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) {
        currentRoomId = null;
        return;
      }

      room.players.delete(socket.id);
      if (room.gameRoom) {
        room.gameRoom.removePlayer(socket.id);
      }
      socket.leave(currentRoomId);

      if (room.players.size === 0) {
        if (room.gameRoom) room.gameRoom.stop();
        rooms.delete(currentRoomId);
      } else {
        if (room.hostId === socket.id) {
          const nextHost = room.players.values().next().value;
          if (nextHost) {
            nextHost.isHost = true;
            nextHost.ready = true;
            room.hostId = nextHost.id;
          }
        }
        io.to(currentRoomId).emit('room:update', serializeRoom(room));
      }

      currentRoomId = null;
      io.emit('lobby:roomList', getRoomList());
    }
```
In `room:create`:
```javascript
      if (currentRoomId) {
        leaveCurrentRoom();
      }
```
In `room:join`:
```javascript
      if (currentRoomId) {
        if (currentRoomId === roomId) {
          // Already in this room
          return;
        }
        leaveCurrentRoom();
      }
```
And wire `socket.on('room:leave', leaveCurrentRoom);` and `socket.on('disconnect', leaveCurrentRoom);`.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/socketHandler.js tests/security_and_gameplay.test.js
git commit -m "fix(rooms): auto-leave previous room on create or join to prevent ghost players"
```

---

### Task 4: XSS Sanitization in `client/js/ui.js`

**Files:**
- Modify: `client/js/ui.js:449-455, 688-705`
- Test: Manual / Inspection & verify `escapeHtml` covers all interpolations.

**Interfaces:**
- Consumes: `escapeHtml(str)`
- Produces: Safe HTML strings for `selectedMapNameLabel`, `roomMapBadge`, and room list items.

- [x] **Step 1: Check existing `escapeHtml` usage in `client/js/ui.js`**

Verify `escapeHtml` definition in `client/js/ui.js#L1-L15`:
```javascript
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}
```

- [x] **Step 2: Apply `escapeHtml` to unescaped interpolations in `client/js/ui.js`**

1. In `updateSelectedMapLabel()` (line 453):
```javascript
    if (map) {
      const safeColor = escapeHtml(map.badgeColor || '#00e5ff');
      const safeBadge = escapeHtml(map.badge || '');
      const safeName = escapeHtml(map.name || '');
      this.selectedMapNameLabel.innerHTML = `<span style="color: ${safeColor};">${safeBadge}</span> ${safeName}`;
    }
```
2. In `renderRoomList()` (around line 690-705):
```javascript
    const badgeColor = escapeHtml(r.mapBadgeColor || '#00e5ff');
    const badgeText = escapeHtml(r.mapBadge || 'MAP');
    // Ensure r.id and r.name are escaped
```

- [x] **Step 3: Run full test suite to verify no regressions**

Run: `npm test`
Expected: PASS (all 181 tests pass)

- [x] **Step 4: Commit changes**

```bash
git add client/js/ui.js
git commit -m "fix(security): sanitize map badge and style interpolations to prevent XSS"
```

---

## Phase 2: Sửa lỗi Gameplay, Đồng bộ Mạng & Dọn dẹp Tiến trình

### Task 5: Continuous Collision Detection (CCD) for High-Speed Projectiles in `server/game/Bullet.js`

**Files:**
- Modify: `server/game/Bullet.js:35-110`
- Test: `tests/security_and_gameplay.test.js`

**Interfaces:**
- Consumes: `prevX`, `prevY`, `map.isWall`, line-to-circle distance check
- Produces: Point-blank and high-velocity bullets (e.g. Railgun speed 3000) detect obstacles and targets along their travel segment without skipping.

- [x] **Step 1: Write the failing test for bullet tunneling**

In `tests/security_and_gameplay.test.js`, add:
```javascript
const { Bullet } = require('../server/game/Bullet.js');
const { GameMap } = require('../server/game/Map.js');

test('High-speed Railgun bullet (3000 px/s) hits target in path without tunneling', () => {
  // Target is 30px away directly ahead
  const target = { x: 130, y: 100, radius: 15 };

  // Bullet starts at (100, 100), facing right (angle = 0)
  const bullet = new Bullet('b_test', 'p1', 100, 100, 0, {
    speed: 3000, // 60px in dt=0.02
    damage: 100,
    range: 1000,
    type: 'railgun'
  });

  // Bullet moves 1 tick (dt = 0.02) -> jumps from x=100 to x=160
  bullet.update(0.02, null);

  assert.strictEqual(bullet.x, 160);
  // Target is at x=130 (between 100 and 160)
  // Without CCD, bullet.checkHit(target) would test distance between 160 and 130 (30px > 15px radius -> MISS)
  const hit = bullet.checkHit(target);
  assert.strictEqual(hit, true, 'Bullet should hit target in its movement path');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: FAIL (`assert.strictEqual(hit, true)` received `false`).

- [x] **Step 3: Implement Continuous Collision Detection in `server/game/Bullet.js`**

In `server/game/Bullet.js`:
Add segment distance helper:
```javascript
function distToSegmentSquared(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}
```

In `Bullet` constructor, initialize `this.prevX = x; this.prevY = y;`.
In `Bullet.update(dt, map)`:
```javascript
    this.prevX = this.x;
    this.prevY = this.y;

    const totalDist = this.speed * dt;
    // For high speed bullets (> 1000 px/s), sub-step wall collision in increments <= 20px
    if (this.speed > 1000 && map) {
      const maxSubStep = 20;
      const numSteps = Math.max(1, Math.ceil(totalDist / maxSubStep));
      const stepDist = totalDist / numSteps;
      const cosA = Math.cos(this.angle);
      const sinA = Math.sin(this.angle);

      for (let s = 0; s < numSteps; s++) {
        this.x += cosA * stepDist;
        this.y += sinA * stepDist;
        this.distanceTraveled += stepDist;

        if (map.isWall(this.x, this.y, this.radius)) {
          this.isDead = true;
          if (this.isExplosive) {
            return {
              exploded: true,
              x: this.x,
              y: this.y,
              radius: this.explosionRadius,
              damage: this.explosionDamage,
              ownerId: this.ownerId,
              source: (this.type || 'generic').toUpperCase()
            };
          }
          return null;
        }

        if (this.distanceTraveled >= this.range) {
          this.isDead = true;
          if (this.isExplosive) {
            return {
              exploded: true,
              x: this.x,
              y: this.y,
              radius: this.explosionRadius,
              damage: this.explosionDamage,
              ownerId: this.ownerId,
              source: (this.type || 'generic').toUpperCase()
            };
          }
          return null;
        }
      }
    } else {
      // Normal bullet step
      this.x += Math.cos(this.angle) * totalDist;
      this.y += Math.sin(this.angle) * totalDist;
      this.distanceTraveled += totalDist;

      if (map && map.isWall(this.x, this.y, this.radius)) {
        this.isDead = true;
        if (this.isExplosive) {
          return {
            exploded: true,
            x: this.x,
            y: this.y,
            radius: this.explosionRadius,
            damage: this.explosionDamage,
            ownerId: this.ownerId,
            source: (this.type || 'generic').toUpperCase()
          };
        }
        return null;
      }

      if (this.distanceTraveled >= this.range) {
        this.isDead = true;
        if (this.isExplosive) {
          return {
            exploded: true,
            x: this.x,
            y: this.y,
            radius: this.explosionRadius,
            damage: this.explosionDamage,
            ownerId: this.ownerId,
            source: (this.type || 'generic').toUpperCase()
          };
        }
        return null;
      }
    }
```

In `Bullet.checkHit(targetCircle)`:
```javascript
  checkHit(targetCircle) {
    if (this.isDead) return false;
    const hitRadius = targetCircle.radius + this.radius;
    const hitRadiusSq = hitRadius * hitRadius;

    // Direct endpoint check
    const dx = this.x - targetCircle.x;
    const dy = this.y - targetCircle.y;
    if ((dx * dx + dy * dy) <= hitRadiusSq) {
      return true;
    }

    // Continuous collision check along travel line for fast bullets or recent movement
    if (typeof this.prevX === 'number' && typeof this.prevY === 'number') {
      const dSq = distToSegmentSquared(
        targetCircle.x,
        targetCircle.y,
        this.prevX,
        this.prevY,
        this.x,
        this.y
      );
      if (dSq <= hitRadiusSq) {
        return true;
      }
    }

    return false;
  }
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/game/Bullet.js tests/security_and_gameplay.test.js
git commit -m "fix(physics): add continuous collision detection to eliminate bullet tunneling"
```

---

### Task 6: Teammate Revive State Synchronization in `server/game/Player.js`

**Files:**
- Modify: `server/game/Player.js:1015-1048`
- Test: `tests/security_and_gameplay.test.js`

**Interfaces:**
- Consumes: `this.revivingTarget`, `this.reviveProgress`, `this.reviveDuration`
- Produces: Serialized snapshot contains `reviving: boolean` and `reviveProgress: number`, enabling `Renderer.js` revive progress bar on the canvas.

- [x] **Step 1: Write the failing test for revive progress serialization**

In `tests/security_and_gameplay.test.js`, add:
```javascript
const { Player } = require('../server/game/Player.js');

test('Player.serialize() includes reviving and reviveProgress when channeling revive', () => {
  const rescuer = new Player('p1', 'Alice', 'HUMAN', 100, 100);
  const downed = new Player('p2', 'Bob', 'HUMAN', 120, 100);
  downed.isDowned = true;

  // Initially not reviving
  const snap1 = rescuer.serialize();
  assert.strictEqual(snap1.reviving, false);
  assert.strictEqual(snap1.reviveProgress, 0);

  // Channeling revive
  rescuer.startRevive(downed);
  rescuer.updateRevive(0.8);

  const snap2 = rescuer.serialize();
  assert.strictEqual(snap2.reviving, true);
  assert.strictEqual(snap2.reviveProgress, 0.8);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: FAIL because `snap1.reviving` and `snap1.reviveProgress` are `undefined`.

- [x] **Step 3: Update `serialize()` in `server/game/Player.js`**

In `server/game/Player.js#serialize()`:
```javascript
      isDowned: this.isDowned,
      isDead: this.isDead,
      bleedoutTimer: Math.ceil(this.bleedoutTimer),
      reviving: Boolean(this.revivingTarget && this.reviveProgress > 0),
      reviveProgress: Number(this.reviveProgress.toFixed(2)),
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/game/Player.js tests/security_and_gameplay.test.js
git commit -m "fix(sync): serialize reviving and reviveProgress fields in player snapshot"
```

---

### Task 7: Stop 50Hz Physics Loop on `GAMEOVER` in `server/game/GameRoom.js`

**Files:**
- Modify: `server/game/GameRoom.js:528-536, 175-185`
- Test: `tests/security_and_gameplay.test.js`

**Interfaces:**
- Consumes: `this.loopInterval`, `this.state`
- Produces: Clears interval on `GAMEOVER` to prevent CPU burn on dead rooms, restarts interval if game is restarted.

- [x] **Step 1: Write the failing test for stopping loop on GAMEOVER**

In `tests/security_and_gameplay.test.js`, add:
```javascript
const { GameRoom } = require('../server/game/GameRoom.js');

test('GameRoom pauses 50Hz loopInterval when entering GAMEOVER state', () => {
  const mockIo = {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  };
  const room = new GameRoom('r_over', 'Over Room', mockIo, 'THE_ROOMS');
  room.addPlayer('p1', 'DeadGuy', 'HUMAN');
  room.startGame();

  assert.ok(room.loopInterval !== null, 'Loop should be active after startGame()');

  // Kill player to trigger GAMEOVER
  const p = room.players.get('p1');
  p.isDead = true;
  room.tick(0.02);

  assert.strictEqual(room.state, 'GAMEOVER');
  assert.strictEqual(room.loopInterval, null, 'loopInterval should be cleared on GAMEOVER');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: FAIL because `room.loopInterval` was not cleared.

- [x] **Step 3: Clear interval on GAMEOVER in `server/game/GameRoom.js`**

In `server/game/GameRoom.js`:
At lines 529-535:
```javascript
    // Check all players dead/downed -> GAMEOVER
    const anyAlive = playersArr.some(p => !p.isDowned && !p.isDead);
    if (!anyAlive && playersArr.length > 0) {
      this.state = 'GAMEOVER';
      if (this.loopInterval) {
        clearInterval(this.loopInterval);
        this.loopInterval = null;
      }
      this.eventsBuffer.push({ type: 'GAME_OVER', wave: this.wave });
      this.broadcastSnapshot();
      return;
    }
```
And in `startGame()`:
```javascript
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    // Start simulation loop
    this.loopInterval = setInterval(() => {
      this.tick(1 / this.simulationHz);
    }, 1000 / this.simulationHz);
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/security_and_gameplay.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/game/GameRoom.js tests/security_and_gameplay.test.js
git commit -m "perf(server): clear 50Hz loopInterval on GAMEOVER to free server CPU"
```

---

### Task 8: Fix Game Over Modal Total Score & Max Combo Display in `client/js/ui.js`

**Files:**
- Modify: `client/js/ui.js:1150-1185`
- Test: Manual & Unit test calculation logic

**Interfaces:**
- Consumes: `p.score`, `p.maxCombo`, `p.combo`
- Produces: Correct team total score and individual peak combo in post-game statistics.

- [x] **Step 1: Inspect lines 1150-1185 of `client/js/ui.js`**

Current code:
```javascript
    const totalScore = (gameState.players || []).reduce((sum, p) => sum + (p.kills || 0), 0); // BUG: using kills instead of score
    // ...
    // Combo reads p.combo instead of p.maxCombo
```

- [x] **Step 2: Fix score and combo calculation in `client/js/ui.js`**

```javascript
    const totalScore = (gameState.players || []).reduce((sum, p) => sum + (p.score || 0), 0);
    const totalKills = (gameState.players || []).reduce((sum, p) => sum + (p.kills || 0), 0);
```
And in player leaderboard rows:
```javascript
    const comboDisplay = (p.maxCombo !== undefined && p.maxCombo > 0) ? p.maxCombo : (p.combo || 1);
```

- [x] **Step 3: Run full tests to verify no regressions**

Run: `npm test`
Expected: PASS

- [x] **Step 4: Commit changes**

```bash
git add client/js/ui.js
git commit -m "fix(ui): calculate game over score from player scores and display peak maxCombo"
```

---

## Phase 3: Loại bỏ Hard Code & Tái cấu trúc DRY (Shared Combat Module)

### Task 9: Extract Shared Combat Utilities to `server/game/CombatUtils.js`

**Files:**
- Create: `server/game/CombatUtils.js`
- Create: `tests/combat_utils.test.js`

**Interfaces:**
- Consumes: math utilities, pickup drop configuration
- Produces:
  - `normalizeAngleDiff(targetAngle, currentAngle)`
  - `damageAndCreditZombie(zombie, damage, damageType, killer, room, options)`
  - `maybeDropPickup(room, zombie, options)`

- [x] **Step 1: Write unit tests for `CombatUtils.js`**

Create `tests/combat_utils.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAngleDiff,
  maybeDropPickup,
  damageAndCreditZombie,
  PICKUP_DROP_CONFIG
} = require('../server/game/CombatUtils.js');
const { Zombie } = require('../server/game/Zombie.js');
const { Player } = require('../server/game/Player.js');

test('normalizeAngleDiff normalizes angle difference to [-PI, PI]', () => {
  assert.strictEqual(Number(normalizeAngleDiff(0, 0).toFixed(4)), 0);
  assert.strictEqual(Number(normalizeAngleDiff(Math.PI, -Math.PI).toFixed(4)), 0);
  assert.ok(normalizeAngleDiff(0.5, 0.1) > 0);
});

test('maybeDropPickup rolls drops according to standard config (25% total: 18% AMMO, 7% MEDKIT)', () => {
  assert.strictEqual(PICKUP_DROP_CONFIG.TOTAL_CHANCE, 0.25);
  assert.strictEqual(PICKUP_DROP_CONFIG.AMMO_CHANCE, 0.18);
  assert.strictEqual(PICKUP_DROP_CONFIG.MEDKIT_CHANCE, 0.07);

  const room = { pickups: [] };
  const zombie = { x: 100, y: 200 };

  // Guaranteed drop override for testing
  const dropped = maybeDropPickup(room, zombie, { forceDrop: true, forceType: 'AMMO' });
  assert.strictEqual(room.pickups.length, 1);
  assert.strictEqual(dropped.type, 'AMMO');
  assert.strictEqual(dropped.x, 100);
  assert.strictEqual(dropped.y, 200);
});

test('damageAndCreditZombie damages zombie and awards kill score to player', () => {
  const z = new Zombie('z1', 'NORMAL', 100, 100);
  const p = new Player('p1', 'Hero', 'HUMAN', 100, 100);
  const room = { eventsBuffer: [], pickups: [] };

  damageAndCreditZombie(z, 200, 'BULLET', p, room, { dropPickup: false });
  assert.strictEqual(z.isDead, true);
  assert.strictEqual(p.kills, 1);
  assert.ok(p.score > 0);
  assert.ok(room.eventsBuffer.some(e => e.type === 'ZOMBIE_DIE'));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/combat_utils.test.js`
Expected: FAIL with `Cannot find module '../server/game/CombatUtils.js'`.

- [x] **Step 3: Implement `server/game/CombatUtils.js`**

Create `server/game/CombatUtils.js`:
```javascript
'use strict';

const PICKUP_DROP_CONFIG = {
  TOTAL_CHANCE: 0.25,
  AMMO_CHANCE: 0.18,
  MEDKIT_CHANCE: 0.07,
  MEDKIT_SHARE_OF_DROPS: 0.28 // 0.07 / 0.25
};

function normalizeAngleDiff(targetAngle, currentAngle) {
  let diff = targetAngle - currentAngle;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

function maybeDropPickup(room, zombie, options = {}) {
  if (!room || !Array.isArray(room.pickups) || !zombie) return null;

  let shouldDrop = false;
  let type = null;

  if (options.forceDrop) {
    shouldDrop = true;
    type = options.forceType || 'AMMO';
  } else {
    const roll = Math.random();
    if (roll < PICKUP_DROP_CONFIG.AMMO_CHANCE) {
      shouldDrop = true;
      type = 'AMMO';
    } else if (roll < PICKUP_DROP_CONFIG.TOTAL_CHANCE) {
      shouldDrop = true;
      type = 'MEDKIT';
    }
  }

  if (!shouldDrop || !type) return null;

  const pickup = {
    id: 'pk_' + Math.random().toString(36).substring(2, 7),
    type,
    x: Math.round(zombie.x),
    y: Math.round(zombie.y),
    life: 25
  };
  room.pickups.push(pickup);
  return pickup;
}

function damageAndCreditZombie(zombie, damage, damageType, killer, room, options = {}) {
  if (!zombie || zombie.isDead) return false;

  zombie.takeDamage(damage, damageType || 'GENERIC');

  if (zombie.isDead) {
    if (killer) {
      const awardUlt = options.awardUltCharge !== undefined ? options.awardUltCharge : true;
      const scoreVal = zombie.scoreValue || zombie.score || 10;
      const newlyUnlocked = killer.recordKill(scoreVal, { awardUltCharge: awardUlt });
      if (room && Array.isArray(room.eventsBuffer) && Array.isArray(newlyUnlocked)) {
        for (let i = 0; i < newlyUnlocked.length; i++) {
          const u = newlyUnlocked[i];
          room.eventsBuffer.push({
            type: 'UNLOCKED',
            weapon: u.name || u.id,
            playerId: killer.id,
            slot: u.slot
          });
        }
      }
    }

    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'ZOMBIE_DIE',
        x: Math.round(zombie.x),
        y: Math.round(zombie.y),
        zType: zombie.type,
        angle: Number(zombie.angle.toFixed(2)),
        killAngle: options.killAngle !== undefined ? options.killAngle : Number(zombie.angle.toFixed(2))
      });
    }

    if (options.dropPickup !== false) {
      maybeDropPickup(room, zombie, options);
    }
    return true;
  }
  return false;
}

module.exports = {
  PICKUP_DROP_CONFIG,
  normalizeAngleDiff,
  maybeDropPickup,
  damageAndCreditZombie
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/combat_utils.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/game/CombatUtils.js tests/combat_utils.test.js
git commit -m "feat(combat): extract shared CombatUtils with unified drop rates and angle math"
```

---

### Task 10: Harmonize Pickup Drop Rates & Refactor Abilities to Use `CombatUtils.js`

**Files:**
- Modify: `server/game/GameRoom.js:10-25`
- Modify: `server/game/WarriorAbilities.js:1-165`
- Modify: `server/game/MageAbilities.js:30-60`
- Test: `tests/warrior_skills.test.js`, `tests/mage_skills.test.js`, `tests/game_room.test.js`

**Interfaces:**
- Consumes: `require('./CombatUtils.js')`
- Produces: `GameRoom`, `WarriorAbilities`, and `MageAbilities` use the centralized `maybeDropPickup` and `normalizeAngleDiff`.

- [x] **Step 1: Refactor `WarriorAbilities.js` to import and use `CombatUtils.js`**

Replace duplicated `normalizeAngleDiff` and pickup drop in `damageAndCreditZombie` inside `WarriorAbilities.js` with calls to `CombatUtils.js`.

- [x] **Step 2: Refactor `MageAbilities.js` to re-export `maybeDropPickup` from `CombatUtils.js`**

In `MageAbilities.js`:
```javascript
const { maybeDropPickup, normalizeAngleDiff } = require('./CombatUtils.js');
```
Keep `maybeDropPickup` exported for backward compatibility if other files require it.

- [x] **Step 3: Refactor `GameRoom.js` to import `maybeDropPickup` directly from `CombatUtils.js`**

In `server/game/GameRoom.js`:
```javascript
const { maybeDropPickup } = require('./CombatUtils.js');
```

- [x] **Step 4: Run all warrior and mage test suites**

Run: `node --test tests/warrior_skills.test.js tests/mage_skills.test.js tests/game_room.test.js`
Expected: PASS

- [x] **Step 5: Commit changes**

```bash
git add server/game/WarriorAbilities.js server/game/MageAbilities.js server/game/GameRoom.js
git commit -m "refactor(combat): integrate CombatUtils across GameRoom, Warrior, and Mage systems"
```

---

### Task 11: Synchronize Map Configurations Between Server and Client

**Files:**
- Modify: `client/js/mapsConfig.js:1-158`
- Source: `server/game/MapConfig.js`
- Test: `tests/maps.test.js`

**Interfaces:**
- Consumes: `server/game/MapConfig.js`
- Produces: `client/js/mapsConfig.js` includes `playerSpawns` and `zombieSpawns` for Desert, Snow, and Volcano maps.

- [x] **Step 1: Check existing `tests/maps.test.js`**

Run: `node --test tests/maps.test.js`
Expected: PASS

- [x] **Step 2: Update `client/js/mapsConfig.js`**

Add `playerSpawns` and `zombieSpawns` from `server/game/MapConfig.js` to `THE_ROOMS`, `DESERT`, `SNOW`, and `VOLCANO` in `client/js/mapsConfig.js`.

- [x] **Step 3: Run map tests to verify consistency**

Run: `node --test tests/maps.test.js`
Expected: PASS

- [x] **Step 4: Commit changes**

```bash
git add client/js/mapsConfig.js
git commit -m "fix(maps): synchronize player and zombie spawn coordinates for all maps in client config"
```

---

### Task 12: Prune Dead Code in `server/game/UltimateAbilities.js`

**Files:**
- Modify: `server/game/UltimateAbilities.js:73-112, 157-162`
- Test: `tests/ultimates.test.js`

**Interfaces:**
- Consumes: `getUltimateConfigForClass`
- Produces: Cleaned dispatch table without orphan `executeSeismicSlam`.

- [x] **Step 1: Run `tests/ultimates.test.js` before modification**

Run: `node --test tests/ultimates.test.js`
Expected: PASS

- [x] **Step 2: Remove dead `executeSeismicSlam` function from `server/game/UltimateAbilities.js`**

Verify that `ULTIMATE_CONFIGS` in `UltimateConfig.js` only contains `HUMAN`, `WARRIOR`, and `MAGE`. Safely remove `executeSeismicSlam` and clean up `triggerPlayerUltimate`.

- [x] **Step 3: Run `tests/ultimates.test.js` to ensure zero regressions**

Run: `node --test tests/ultimates.test.js`
Expected: PASS

- [x] **Step 4: Commit changes**

```bash
git add server/game/UltimateAbilities.js
git commit -m "clean(ultimates): prune deprecated seismic slam dead code"
```

---

## Phase 4: Tối ưu hóa Hiệu năng (Performance Engine)

### Task 13: Eliminate DOM Layout Thrashing & Add Element Caching in `client/js/ui.js`

**Files:**
- Modify: `client/js/ui.js:840-898, 970-1010`
- Test: Full integration test suite

**Interfaces:**
- Consumes: `this.teamRowPool = new Map()`
- Produces: In-place DOM node updates for team roster, eliminating `innerHTML = ''` allocation 60 times/sec.

- [x] **Step 1: Add row pooling for team list in `client/js/ui.js`**

In `UI` constructor:
```javascript
    this.teamRowElements = new Map(); // playerId -> { row, hpFill, armorFill, manaFill, ultBadge, statText }
```

In `updateHUD(gameState, localPlayerId)`:
Instead of `this.hudTeamList.innerHTML = '';`, check current player IDs against `teamRowElements`:
- If player ID not in map: create row DOM element once and store references.
- If player left: remove old row and delete from map.
- Update `style.width`, `className`, and `textContent` on the existing elements.

- [x] **Step 2: Cache weapon and skill slot elements**

In `setupWeaponsBar()`, cache DOM references by slot ID in an object `this.hudWeaponSlotElements[id]` so `document.getElementById` is not called every frame.

- [x] **Step 3: Run all tests to ensure full compatibility**

Run: `npm test`
Expected: PASS

- [x] **Step 4: Commit changes**

```bash
git add client/js/ui.js
git commit -m "perf(ui): pool team roster DOM rows and cache weapon slot elements to eliminate 60fps layout thrashing"
```

---

### Task 14: Hardware-Accelerated Radial Light Cache in `client/js/renderer.js`

**Files:**
- Modify: `client/js/renderer.js:2780-2795`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes: Pre-rendered radial gradient texture on offscreen canvas
- Produces: `cutoutRadialLight` scales pre-rendered offscreen canvas with `drawImage` instead of creating 30-80 `createRadialGradient` objects per frame.

- [x] **Step 1: Run `tests/horror_vfx_audio.test.js` before modification**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS

- [x] **Step 2: Pre-render radial light gradient template in `Renderer`**

In `Renderer` constructor:
```javascript
    this.radialLightCanvas = null;
    if (typeof document !== 'undefined') {
      const size = 256;
      const cvs = document.createElement('canvas');
      cvs.width = size;
      cvs.height = size;
      const c = cvs.getContext('2d');
      if (c) {
        const half = size / 2;
        const grad = c.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = grad;
        c.beginPath();
        c.arc(half, half, half, 0, Math.PI * 2);
        c.fill();
        this.radialLightCanvas = cvs;
      }
    }
```

In `cutoutRadialLight(ctx, x, y, innerR = 0, outerR = 100, alpha = 1.0)`:
If `this.radialLightCanvas` is available, draw via `ctx.drawImage` with `globalAlpha = alpha` and `ctx.globalCompositeOperation = 'destination-out'` (or preserve existing composite operation). If innerR > 0 or in headless/test environments, gracefully fall back to `createRadialGradient`.

- [x] **Step 3: Run `tests/horror_vfx_audio.test.js` to ensure rendering tests pass**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS

- [x] **Step 4: Commit changes**

```bash
git add client/js/renderer.js
git commit -m "perf(renderer): cache radial light texture on offscreen canvas to reduce GPU gradient re-allocations"
```

---

### Task 15: Server Hot-Path Optimization (Distance Squared & Barrels Cache) in `server/game/GameRoom.js`

**Files:**
- Modify: `server/game/GameRoom.js:445-455, 605-640, 665-685`
- Test: `tests/game_room.test.js`, `tests/combat_objects.test.js`

**Interfaces:**
- Consumes: `this.barrels` maintained on barricade add/remove
- Produces: O(1) barrel access instead of `filter(x => x.type === 'barrel')` 50 times/sec; distance comparisons using squared distance.

- [x] **Step 1: Cache `this.barrels` in `GameRoom`**

Maintain `this.barrels` array updated when barrels are placed or destroyed. Replace `this.barricades.filter(b => b.type === 'barrel')` in `triggerExplosion` and `tick`.

- [x] **Step 2: Replace `Math.hypot` in bullet and zombie loops with squared distances**

Use `const distSq = dx * dx + dy * dy; const maxDistSq = maxDist * maxDist;` in tight collision loops.

- [x] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (all 181+ tests pass)

- [x] **Step 4: Commit changes**

```bash
git add server/game/GameRoom.js
git commit -m "perf(game): cache barrels array and use squared distance comparisons in 50Hz tick loop"
```

---

## Final Verification Checklist

- [x] Run complete test suite: `npm test` (all tests pass)
- [x] Verify build script: `node scripts/build-client.js`
- [x] Verify zero console errors and zero uncaught exceptions in server start: `node server/server.js` (dry run)
- [x] Confirm no `.env` or sensitive credentials touched or modified.

