# Multi-Platform & Render Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor server/client configuration and networking so Boxhead Multiplayer can be deployed seamlessly to Render (Free Tier) and other platforms (Docker PaaS like Koyeb/Zeabur/Back4App/Hugging Face Spaces, split static frontends like Cloudflare Pages/Vercel, VPS, and local LAN) from a single unified deployment configuration.

**Architecture:** Introduce a single source of truth in `server/config/deployConfig.js` that resolves platform presets (`lan`, `render`, `docker`, `huggingface`, `split-backend`, `static-client`) merged with environment variables. In Monolith mode (Render / Docker / VPS / LAN), Express dynamically serves `/config.js`, `/vendor/socket.io.min.js`, `/healthz`, and `client/` while tuning Socket.IO + snapshot broadcast frequency (`SNAPSHOT_HZ`) separately from 50 Hz physics simulation (`SIMULATION_HZ`). In Split mode (Cloudflare Pages / Vercel static client + Render backend), `scripts/build-client.js` generates a static `dist/` bundle with baked `config.js` (`BACKEND_URL`) and local `vendor/socket.io.min.js` so the UI loads instantaneously and displays Render Free cold-start status while waking the backend.

**Tech Stack:** Node.js `>=20` (CommonJS, `node --test`, `node:assert/strict`), Express `^4.19.2`, Socket.IO `^4.7.5`, Vanilla JS/HTML/CSS, Docker, Render Blueprint (`render.yaml`).

## Global Constraints

- **Single Unified Config Source:** All platform presets (`lan`, `render`, `docker`, `huggingface`, `split-backend`, `static-client`) and env overrides (`DEPLOY_PLATFORM`, `DEPLOY_MODE`, `PORT`, `HOST`, `CORS_ORIGIN`, `BACKEND_URL`, `PUBLIC_URL`, `SIMULATION_HZ`, `SNAPSHOT_HZ`, `MAX_ROOMS`, `SOCKET_TRANSPORTS`, `TRUST_PROXY`, `STATIC_MAX_AGE_SEC`, `HEALTHCHECK_PATH`) must be resolved through `server/config/deployConfig.js` without duplicating parsing logic.
- **Zero Heavy Bundler Dependencies:** Keep `package.json` runtime dependencies strictly limited to `express` and `socket.io` (do not add `dotenv`, `webpack`, `vite`, or `cors`).
- **Dual-Mode Compatibility:**
  - Monolith (`render.yaml`, `Dockerfile`, LAN `npm start`) serves both API/Socket.IO and static `client/` from one Express process.
  - Split Static (`npm run build:client` -> `dist/` for Cloudflare Pages / Vercel) serves static `dist/` with `dist/config.js` and `dist/vendor/socket.io.min.js` pointing to `BACKEND_URL` (Render/Docker/VPS), while backend can run with `DEPLOY_PLATFORM=split-backend` (or `monolith`).
- **Backward Compatibility for Existing APIs & Tests:**
  - `startServer(0)` / `startServer(3000)` must preserve existing return shape `{ app, server, io, port, getLanIp }` (plus `config`, `shutdown`).
  - `new GameRoom(id, name, io, mapId)` and `room.tick(dt)` without extra options must preserve existing 50 Hz behavior so all existing unit tests pass unmodified.
  - When `exposeLanIp` is `true` (default `lan` platform), `GET /api/info` returns `{ lanIp, port, ... }` matching `tests/server.test.js`.
- **Cloud UX & Security (`GEMINI.md`):**
  - Never expose container internal IPs in invite links (`copyRoomLink()`) on HTTPS or non-LAN cloud hosts; always use `window.location.origin` when `showLanBanner` is `false` or protocol is `https:`.
  - Validate all env vars and socket payloads (`room:create` non-object guard, `MAX_ROOMS` enforcement, `CORS_ORIGIN` list or `*`, XSS-safe `renderClientConfigScript`).
  - Never create or read `.env` files in tooling; ship `.env.example` with non-secret placeholder defaults only.
  - Follow AAA (`Arrange / Act / Assert`) test structure covering happy and unhappy paths.

---

### Task 1: Unified Multi-Platform Configuration (`server/config/deployConfig.js`)

**Files:**
- Create: `server/config/deployConfig.js`
- Test: `tests/deploy_config.test.js`

**Interfaces:**
- Produces in `server/config/deployConfig.js`:
  - `PLATFORM_PRESETS`: frozen object with keys `lan`, `render`, `docker`, `huggingface`, `split-backend`, `static-client`
  - `detectPlatform(env?: Record<string, string | undefined>) -> string`
  - `parseCorsOrigin(raw?: string, fallback?: string | string[]) -> string | string[]`
  - `parsePositiveInt(raw: unknown, fallback: number, min?: number, max?: number, allowZero?: boolean) -> number`
  - `parseSocketTransports(raw?: string, fallback?: string[]) -> string[]`
  - `normalizeHttpUrl(raw?: string) -> string`
  - `resolveDeployConfig(env?: Record<string, string | undefined>, overrides?: Record<string, unknown>) -> Readonly<DeployConfig>`
  - `buildClientRuntimeConfig(config: DeployConfig) -> ClientRuntimeConfig`
  - `renderClientConfigScript(config: DeployConfig) -> string`

- [ ] **Step 1: Write the failing tests for `deployConfig.js`**

Create `tests/deploy_config.test.js`:

```javascript
/**
 * @file deploy_config.test.js
 * @description Unit tests for multi-platform deployment config resolution and validation.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PLATFORM_PRESETS,
  detectPlatform,
  parseCorsOrigin,
  parsePositiveInt,
  parseSocketTransports,
  normalizeHttpUrl,
  resolveDeployConfig,
  buildClientRuntimeConfig,
  renderClientConfigScript
} = require('../server/config/deployConfig.js');

test('detectPlatform identifies explicit DEPLOY_PLATFORM and cloud environment markers', () => {
  // Arrange & Act & Assert
  assert.strictEqual(detectPlatform({}), 'lan');
  assert.strictEqual(detectPlatform({ RENDER: 'true' }), 'render');
  assert.strictEqual(detectPlatform({ SPACE_ID: 'user/boxhead' }), 'huggingface');
  assert.strictEqual(detectPlatform({ KOYEB_SERVICE_ID: 'svc_123' }), 'docker');
  assert.strictEqual(detectPlatform({ ZEABUR: 'true' }), 'docker');
  assert.strictEqual(detectPlatform({ CF_PAGES: '1' }), 'static-client');
  assert.strictEqual(detectPlatform({ VERCEL: '1' }), 'static-client');
  assert.strictEqual(detectPlatform({ RENDER: 'true', DEPLOY_PLATFORM: 'split-backend' }), 'split-backend');
  assert.strictEqual(detectPlatform({ DEPLOY_PLATFORM: 'UNKNOWN_PLATFORM' }), 'lan');
});

test('parseCorsOrigin, parsePositiveInt, parseSocketTransports, and normalizeHttpUrl validate happy and unhappy inputs', () => {
  // Arrange & Act & Assert: CORS origins
  assert.strictEqual(parseCorsOrigin('*'), '*');
  assert.strictEqual(parseCorsOrigin(''), '*');
  assert.deepStrictEqual(
    parseCorsOrigin(' https://game.pages.dev , http://localhost:3000 '),
    ['https://game.pages.dev', 'http://localhost:3000']
  );

  // Positive integers with bounds and zero handling
  assert.strictEqual(parsePositiveInt('25', 50, 5, 120), 25);
  assert.strictEqual(parsePositiveInt('999', 50, 5, 120), 120);
  assert.strictEqual(parsePositiveInt('-10', 50, 5, 120), 50);
  assert.strictEqual(parsePositiveInt('abc', 50, 5, 120), 50);
  assert.strictEqual(parsePositiveInt(0, 3000, 1, 65535, true), 0);
  assert.strictEqual(parsePositiveInt(0, 3000, 1, 65535, false), 3000);

  // Socket transports
  assert.deepStrictEqual(parseSocketTransports('websocket'), ['websocket']);
  assert.deepStrictEqual(parseSocketTransports('polling,websocket,invalid'), ['polling', 'websocket']);
  assert.deepStrictEqual(parseSocketTransports('invalid_only', ['websocket']), ['websocket']);

  // URL normalization
  assert.strictEqual(normalizeHttpUrl('https://boxhead.onrender.com///'), 'https://boxhead.onrender.com');
  assert.strictEqual(normalizeHttpUrl('ftp://invalid.example.com'), '');
  assert.strictEqual(normalizeHttpUrl('not a url'), '');
  assert.strictEqual(normalizeHttpUrl(''), '');
});

test('resolveDeployConfig merges Render preset with env overrides and computes interpolationBufferMs', () => {
  // Arrange
  const env = {
    RENDER: 'true',
    PORT: '10000',
    CORS_ORIGIN: 'https://boxhead.pages.dev',
    SNAPSHOT_HZ: '20',
    MAX_ROOMS: '15'
  };

  // Act
  const config = resolveDeployConfig(env);

  // Assert
  assert.strictEqual(config.platform, 'render');
  assert.strictEqual(config.mode, 'monolith');
  assert.strictEqual(config.port, 10000);
  assert.strictEqual(config.simulationHz, 50);
  assert.strictEqual(config.snapshotHz, 20);
  assert.strictEqual(config.interpolationBufferMs, 75);
  assert.deepStrictEqual(config.corsOrigin, ['https://boxhead.pages.dev']);
  assert.strictEqual(config.maxRooms, 15);
  assert.strictEqual(config.trustProxy, true);
  assert.strictEqual(config.exposeLanIp, false);
  assert.strictEqual(config.showColdStartHint, true);
  assert.strictEqual(Object.isFrozen(config), true);
  assert.ok(PLATFORM_PRESETS.huggingface.port === 7860);
});

test('buildClientRuntimeConfig and renderClientConfigScript only expose safe client properties', () => {
  // Arrange
  const config = resolveDeployConfig({
    DEPLOY_PLATFORM: 'static-client',
    BACKEND_URL: 'https://boxhead-api.onrender.com/',
    PUBLIC_URL: 'https://boxhead.pages.dev/'
  });

  // Act
  const clientConfig = buildClientRuntimeConfig(config);
  const script = renderClientConfigScript(config);

  // Assert
  assert.strictEqual(clientConfig.platform, 'static-client');
  assert.strictEqual(clientConfig.mode, 'static-client');
  assert.strictEqual(clientConfig.backendUrl, 'https://boxhead-api.onrender.com');
  assert.strictEqual(clientConfig.publicUrl, 'https://boxhead.pages.dev');
  assert.strictEqual(clientConfig.showLanBanner, false);
  assert.strictEqual(clientConfig.showColdStartHint, true);
  assert.strictEqual('maxRooms' in clientConfig, false);
  assert.strictEqual('corsOrigin' in clientConfig, false);
  assert.ok(script.startsWith('window.BOXHEAD_DEPLOY_CONFIG = Object.freeze('));
  assert.ok(script.includes('"backendUrl":"https://boxhead-api.onrender.com"'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/deploy_config.test.js`
Expected: FAIL with `Cannot find module '../server/config/deployConfig.js'`

- [ ] **Step 3: Implement `server/config/deployConfig.js`**

Create `server/config/deployConfig.js`:

```javascript
/**
 * @file deployConfig.js
 * @description Unified deployment configuration resolver for LAN, Render, Docker PaaS, Hugging Face Spaces, and split static clients.
 */

'use strict';

const ALLOWED_TRANSPORTS = new Set(['websocket', 'polling']);

const PLATFORM_PRESETS = Object.freeze({
  lan: Object.freeze({
    mode: 'monolith',
    host: '0.0.0.0',
    port: 3000,
    simulationHz: 50,
    snapshotHz: 50,
    socketTransports: Object.freeze(['polling', 'websocket']),
    corsOrigin: '*',
    maxRooms: 50,
    trustProxy: false,
    staticMaxAgeSec: 0,
    exposeLanIp: true,
    serveStatic: true,
    showColdStartHint: false,
    pingIntervalMs: 25000,
    pingTimeoutMs: 20000,
    healthCheckPath: '/healthz'
  }),
  render: Object.freeze({
    mode: 'monolith',
    host: '0.0.0.0',
    port: 10000,
    simulationHz: 50,
    snapshotHz: 25,
    socketTransports: Object.freeze(['websocket', 'polling']),
    corsOrigin: '*',
    maxRooms: 20,
    trustProxy: true,
    staticMaxAgeSec: 86400,
    exposeLanIp: false,
    serveStatic: true,
    showColdStartHint: true,
    pingIntervalMs: 25000,
    pingTimeoutMs: 20000,
    healthCheckPath: '/healthz'
  }),
  docker: Object.freeze({
    mode: 'monolith',
    host: '0.0.0.0',
    port: 3000,
    simulationHz: 50,
    snapshotHz: 25,
    socketTransports: Object.freeze(['websocket', 'polling']),
    corsOrigin: '*',
    maxRooms: 25,
    trustProxy: true,
    staticMaxAgeSec: 86400,
    exposeLanIp: false,
    serveStatic: true,
    showColdStartHint: true,
    pingIntervalMs: 25000,
    pingTimeoutMs: 20000,
    healthCheckPath: '/healthz'
  }),
  huggingface: Object.freeze({
    mode: 'monolith',
    host: '0.0.0.0',
    port: 7860,
    simulationHz: 50,
    snapshotHz: 30,
    socketTransports: Object.freeze(['websocket', 'polling']),
    corsOrigin: '*',
    maxRooms: 30,
    trustProxy: true,
    staticMaxAgeSec: 86400,
    exposeLanIp: false,
    serveStatic: true,
    showColdStartHint: true,
    pingIntervalMs: 25000,
    pingTimeoutMs: 20000,
    healthCheckPath: '/healthz'
  }),
  'split-backend': Object.freeze({
    mode: 'backend',
    host: '0.0.0.0',
    port: 10000,
    simulationHz: 50,
    snapshotHz: 25,
    socketTransports: Object.freeze(['websocket', 'polling']),
    corsOrigin: '*',
    maxRooms: 20,
    trustProxy: true,
    staticMaxAgeSec: 86400,
    exposeLanIp: false,
    serveStatic: false,
    showColdStartHint: true,
    pingIntervalMs: 25000,
    pingTimeoutMs: 20000,
    healthCheckPath: '/healthz'
  }),
  'static-client': Object.freeze({
    mode: 'static-client',
    host: '0.0.0.0',
    port: 3000,
    simulationHz: 50,
    snapshotHz: 25,
    socketTransports: Object.freeze(['websocket', 'polling']),
    corsOrigin: '*',
    maxRooms: 20,
    trustProxy: true,
    staticMaxAgeSec: 86400,
    exposeLanIp: false,
    serveStatic: false,
    showColdStartHint: true,
    pingIntervalMs: 25000,
    pingTimeoutMs: 20000,
    healthCheckPath: '/healthz'
  })
});

function detectPlatform(env = process.env) {
  const safeEnv = env || {};
  const explicit = typeof safeEnv.DEPLOY_PLATFORM === 'string'
    ? safeEnv.DEPLOY_PLATFORM.trim().toLowerCase()
    : '';
  if (explicit && Object.prototype.hasOwnProperty.call(PLATFORM_PRESETS, explicit)) {
    return explicit;
  }
  if (safeEnv.RENDER) return 'render';
  if (safeEnv.SPACE_ID) return 'huggingface';
  if (safeEnv.KOYEB_SERVICE_ID || safeEnv.KOYEB_APP_NAME || safeEnv.ZEABUR) return 'docker';
  if (safeEnv.CF_PAGES || safeEnv.VERCEL) return 'static-client';
  return 'lan';
}

function parseCorsOrigin(raw, fallback = '*') {
  if (Array.isArray(raw)) {
    const cleaned = raw.map(v => String(v).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*') return '*';
  const list = trimmed.split(',').map(item => item.trim()).filter(Boolean);
  return list.length > 0 ? list : fallback;
}

function parsePositiveInt(raw, fallback, min = 1, max = Number.MAX_SAFE_INTEGER, allowZero = false) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  const intVal = Math.trunc(num);
  if (allowZero && intVal === 0) return 0;
  if (intVal < min) return fallback;
  return Math.min(max, intVal);
}

function parseBoolean(raw, fallback) {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function parseSocketTransports(raw, fallback = ['websocket', 'polling']) {
  const source = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string' ? raw.split(',') : []);
  const filtered = [];
  for (const item of source) {
    const t = String(item).trim().toLowerCase();
    if (ALLOWED_TRANSPORTS.has(t) && !filtered.includes(t)) {
      filtered.push(t);
    }
  }
  return filtered.length > 0 ? filtered : [...fallback];
}

function normalizeHttpUrl(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function normalizeHealthPath(raw, fallback = '/healthz') {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function resolveDeployConfig(env = process.env, overrides = {}) {
  const safeEnv = env || {};
  const safeOverrides = overrides && typeof overrides === 'object' ? overrides : {};
  const mergedEnv = { ...safeEnv, ...safeOverrides };
  const platform = detectPlatform(mergedEnv);
  const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.lan;

  const modeRaw = typeof mergedEnv.DEPLOY_MODE === 'string' ? mergedEnv.DEPLOY_MODE.trim().toLowerCase() : '';
  const mode = (modeRaw === 'monolith' || modeRaw === 'backend' || modeRaw === 'static-client')
    ? modeRaw
    : preset.mode;

  const simulationHz = parsePositiveInt(mergedEnv.SIMULATION_HZ, preset.simulationHz, 10, 120);
  const requestedSnapshotHz = parsePositiveInt(mergedEnv.SNAPSHOT_HZ, preset.snapshotHz, 5, 120);
  const snapshotHz = Math.min(simulationHz, requestedSnapshotHz);
  const interpolationBufferMs = Math.max(40, Math.round((1000 / snapshotHz) * 1.5));

  const serveStatic = mode === 'backend'
    ? parseBoolean(mergedEnv.SERVE_STATIC, false)
    : parseBoolean(mergedEnv.SERVE_STATIC, preset.serveStatic);

  const portInput = safeOverrides.port !== undefined ? safeOverrides.port : mergedEnv.PORT;

  return Object.freeze({
    platform,
    mode,
    host: typeof mergedEnv.HOST === 'string' && mergedEnv.HOST.trim() ? mergedEnv.HOST.trim() : preset.host,
    port: parsePositiveInt(portInput, preset.port, 1, 65535, true),
    simulationHz,
    snapshotHz,
    interpolationBufferMs,
    socketTransports: Object.freeze(parseSocketTransports(mergedEnv.SOCKET_TRANSPORTS, preset.socketTransports)),
    corsOrigin: parseCorsOrigin(mergedEnv.CORS_ORIGIN, preset.corsOrigin),
    maxRooms: parsePositiveInt(mergedEnv.MAX_ROOMS, preset.maxRooms, 1, 1000),
    trustProxy: parseBoolean(mergedEnv.TRUST_PROXY, preset.trustProxy),
    staticMaxAgeSec: parsePositiveInt(mergedEnv.STATIC_MAX_AGE_SEC, preset.staticMaxAgeSec, 0, 31536000, true),
    exposeLanIp: parseBoolean(mergedEnv.EXPOSE_LAN_IP, preset.exposeLanIp),
    serveStatic,
    showColdStartHint: parseBoolean(mergedEnv.SHOW_COLD_START_HINT, preset.showColdStartHint),
    backendUrl: normalizeHttpUrl(mergedEnv.BACKEND_URL),
    publicUrl: normalizeHttpUrl(mergedEnv.PUBLIC_URL),
    pingIntervalMs: parsePositiveInt(mergedEnv.PING_INTERVAL_MS, preset.pingIntervalMs, 5000, 120000),
    pingTimeoutMs: parsePositiveInt(mergedEnv.PING_TIMEOUT_MS, preset.pingTimeoutMs, 5000, 120000),
    healthCheckPath: normalizeHealthPath(mergedEnv.HEALTHCHECK_PATH, preset.healthCheckPath)
  });
}

function buildClientRuntimeConfig(config) {
  const safeConfig = config || resolveDeployConfig();
  return Object.freeze({
    platform: safeConfig.platform,
    mode: safeConfig.mode,
    backendUrl: safeConfig.backendUrl || '',
    publicUrl: safeConfig.publicUrl || '',
    snapshotHz: safeConfig.snapshotHz,
    interpolationBufferMs: safeConfig.interpolationBufferMs,
    socketTransports: [...safeConfig.socketTransports],
    showLanBanner: Boolean(safeConfig.exposeLanIp && safeConfig.mode === 'monolith'),
    showColdStartHint: Boolean(safeConfig.showColdStartHint)
  });
}

function renderClientConfigScript(config) {
  const payload = buildClientRuntimeConfig(config);
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `window.BOXHEAD_DEPLOY_CONFIG = Object.freeze(${safeJson});\n`;
}

module.exports = {
  PLATFORM_PRESETS,
  detectPlatform,
  parseCorsOrigin,
  parsePositiveInt,
  parseSocketTransports,
  normalizeHttpUrl,
  resolveDeployConfig,
  buildClientRuntimeConfig,
  renderClientConfigScript
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/deploy_config.test.js`
Expected: PASS (all 4 test cases pass)

- [ ] **Step 5: Commit**

```bash
git add server/config/deployConfig.js tests/deploy_config.test.js
git commit -m "feat(deploy): add unified multi-platform deployConfig resolver"
```

---

### Task 2: Decouple Snapshot Broadcast Rate in `GameRoom` & Enforce `MAX_ROOMS` in `socketHandler`

**Files:**
- Modify: `server/game/GameRoom.js:10-36`, `server/game/GameRoom.js:108-115`, `server/game/GameRoom.js:361`, `server/game/GameRoom.js:654-656`
- Modify: `server/socketHandler.js:6-81`
- Test: `tests/deploy_room_limits.test.js`

**Interfaces:**
- Consumes: `simulationHz`, `snapshotHz`, `maxRooms` numbers resolved by `deployConfig`
- Produces:
  - `new GameRoom(id, name, io, mapId = 'THE_ROOMS', options = {})` where `options` supports `{ simulationHz?: number, snapshotHz?: number }`
  - `room.tick(dt, options = {})` where `options` supports `{ emitSnapshot?: boolean }` (defaults `true` for direct test calls)
  - `socketHandler(io, options = {})` where `options` supports `{ maxRooms?: number, roomOptions?: { simulationHz?: number, snapshotHz?: number } }`, rejecting `room:create` when `rooms.size >= maxRooms` with both `callback({ success: false, error })` and `socket.emit('room:error', { error })`

- [ ] **Step 1: Write the failing tests for snapshot throttling and `MAX_ROOMS` cap**

Create `tests/deploy_room_limits.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/deploy_room_limits.test.js`
Expected: FAIL (`room.simulationHz` is `undefined` and `rooms.size` becomes `2` instead of `1`)

- [ ] **Step 3: Update `server/game/GameRoom.js` and `server/socketHandler.js`**

Edit `server/game/GameRoom.js`:
1. Update constructor (`lines 11-36`) to accept `options = {}` and set `simulationHz`, `snapshotHz`, `snapshotIntervalTicks`, `tickCounter`:

```javascript
class GameRoom {
  constructor(id, name, io, mapId = 'THE_ROOMS', options = {}) {
    this.id = id;
    this.name = name;
    this.io = io;

    const simHz = Number.isFinite(options.simulationHz) && options.simulationHz > 0
      ? options.simulationHz
      : 50;
    const snapHz = Number.isFinite(options.snapshotHz) && options.snapshotHz > 0
      ? Math.min(simHz, options.snapshotHz)
      : simHz;

    this.simulationHz = simHz;
    this.snapshotHz = snapHz;
    this.snapshotIntervalTicks = Math.max(1, Math.round(simHz / snapHz));
    this.tickCounter = 0;

    this.mapId = mapId;
    this.map = new GameMap(mapId);
    this.players = new Map();
    this.zombies = [];
    this.bullets = [];
    this.barricades = [];
    this.pickups = [];
    this.drones = [];

    this.state = 'LOBBY'; // LOBBY | PLAYING | INTERMISSION | GAMEOVER
    this.wave = 1;
    this.waveTotalZombies = 0;
    this.zombiesSpawnedInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 0.8;
    this.intermissionTimer = 0;
    this.intermissionDuration = 5;

    this.gameLoopInterval = null;
    this.eventsBuffer = [];
  }
```

2. Update `startGame()` interval (`lines 109-113`):

```javascript
    this.tickCounter = 0;
    if (!this.gameLoopInterval) {
      const tickDt = 1 / this.simulationHz;
      const intervalMs = Math.max(1, Math.round(tickDt * 1000));
      this.gameLoopInterval = setInterval(() => {
        this.tickCounter += 1;
        const shouldEmitSnapshot = (this.tickCounter % this.snapshotIntervalTicks) === 0;
        this.tick(tickDt, { emitSnapshot: shouldEmitSnapshot });
      }, intervalMs);
    }
```

3. Update `tick(dt, options = {})` (`lines 361` and `654-656`):

```javascript
  tick(dt, options = {}) {
    const emitSnapshot = options.emitSnapshot !== false;
    if (this.state === 'GAMEOVER') return;
```

and at the bottom of `tick()` (`lines 654-656`):

```javascript
    // 6. Broadcast Snapshot (throttled to snapshotHz while events remain buffered until emitted)
    if (emitSnapshot) {
      this.broadcastSnapshot();
    }
  }
```

Edit `server/socketHandler.js` (`lines 6-81`):
1. Accept `options = {}` in `socketHandler(io, options = {})`:

```javascript
function socketHandler(io, options = {}) {
  const rooms = new Map();
  const maxRooms = Number.isFinite(options.maxRooms) && options.maxRooms > 0
    ? Math.floor(options.maxRooms)
    : 50;
  const roomOptions = options.roomOptions && typeof options.roomOptions === 'object'
    ? options.roomOptions
    : {};
```

2. Update `room:create` (`lines 40-81`) to guard null/invalid payloads and enforce `maxRooms`:

```javascript
    socket.on('room:create', (payload, callback) => {
      if (rooms.size >= maxRooms) {
        const error = `Máy chủ đang đầy (${maxRooms} phòng tối đa), vui lòng thử lại sau!`;
        if (typeof callback === 'function') {
          callback({ success: false, error });
        }
        socket.emit('room:error', { error });
        return;
      }

      const safePayload = payload && typeof payload === 'object' ? payload : {};
      const { roomName, playerName, character, mapId } = safePayload;
      const roomId = 'room_' + Math.random().toString(36).substring(2, 8);
      const name = (typeof roomName === 'string' && roomName.trim() ? roomName : 'Phong ' + roomId).trim().substring(0, 24);
      const playerNick = (typeof playerName === 'string' && playerName.trim() ? playerName : 'Hero').trim().substring(0, 16);
      const chosenMapId = MAPS[mapId] ? mapId : DEFAULT_MAP_ID;

      const gameRoom = new GameRoom(roomId, name, io, chosenMapId, roomOptions);
      const room = {
        id: roomId,
        name,
        mapId: chosenMapId,
        hostId: socket.id,
        state: 'LOBBY',
        players: new Map(),
        gameRoom
      };

      const selectedChar = CHARACTERS.includes(character) ? character : 'HUMAN';
      const player = {
        id: socket.id,
        name: playerNick,
        character: selectedChar,
        ready: true,
        isHost: true
      };

      room.players.set(socket.id, player);
      rooms.set(roomId, room);
      currentRoomId = roomId;

      gameRoom.addPlayer(socket.id, playerNick, selectedChar);

      socket.join(roomId);

      const roomData = serializeRoom(room);
      if (typeof callback === 'function') {
        callback({ success: true, room: roomData, playerId: socket.id });
      }

      socket.emit('room:joined', { room: roomData, playerId: socket.id });
      io.emit('lobby:roomList', getRoomList());
    });
```

- [ ] **Step 4: Run tests to verify pass and confirm zero regressions**

Run: `node --test tests/deploy_room_limits.test.js tests/game_room.test.js`
Expected: PASS on all tests

- [ ] **Step 5: Commit**

```bash
git add server/game/GameRoom.js server/socketHandler.js tests/deploy_room_limits.test.js
git commit -m "feat(server): decouple snapshot broadcast rate and enforce MAX_ROOMS"
```

---

### Task 3: Integrate Unified Deploy Config, `/healthz`, `/config.js`, `/vendor`, CORS & Graceful Shutdown into `server/server.js`

**Files:**
- Modify: `server/server.js:1-75`
- Test: `tests/deploy_server_integration.test.js`

**Interfaces:**
- Consumes: `resolveDeployConfig`, `renderClientConfigScript` from `server/config/deployConfig.js`; `socketHandler(io, { maxRooms, roomOptions })`
- Produces:
  - `startServer(portOrOptions = 3000, extraOptions = {}) -> Promise<{ app, server, io, port, getLanIp, config, shutdown }>`
  - HTTP endpoints:
    - `GET /healthz` (or `config.healthCheckPath`) -> `200` JSON `{ status: 'ok', platform, mode, uptimeSec, rooms }`
    - `GET /config.js` -> `200` JS (`Cache-Control: no-store`) setting `window.BOXHEAD_DEPLOY_CONFIG`
    - `GET /vendor/socket.io.min.js` -> `200` JS from `node_modules/socket.io/client-dist`
    - `GET /api/info` -> `200` JSON `{ lanIp, port, platform, mode, exposeLanIp }` (`lanIp` is `null` when `config.exposeLanIp === false`)

- [ ] **Step 1: Write the failing integration test for `server/server.js`**

Create `tests/deploy_server_integration.test.js`:

```javascript
/**
 * @file deploy_server_integration.test.js
 * @description Integration tests for multi-platform server config, /healthz, /config.js, /vendor, CORS, and graceful shutdown.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { io: ioClient } = require('socket.io-client');
const { startServer } = require('../server/server.js');

function httpRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body
      }));
    });
    req.on('error', reject);
  });
}

test('Render mode exposes /healthz, /config.js, /vendor/socket.io.min.js and hides internal LAN IP', async (t) => {
  // Arrange
  const srv = await startServer({
    port: 0,
    env: {
      DEPLOY_PLATFORM: 'render',
      CORS_ORIGIN: 'https://boxhead.pages.dev',
      SNAPSHOT_HZ: '25',
      MAX_ROOMS: '12'
    }
  });
  t.after(() => srv.shutdown());

  const base = `http://127.0.0.1:${srv.port}`;

  // Act
  const healthRes = await httpRequest(`${base}/healthz`);
  const infoRes = await httpRequest(`${base}/api/info`, { Origin: 'https://boxhead.pages.dev' });
  const configRes = await httpRequest(`${base}/config.js`);
  const vendorRes = await httpRequest(`${base}/vendor/socket.io.min.js`);

  // Assert: /healthz
  assert.strictEqual(healthRes.statusCode, 200);
  const healthJson = JSON.parse(healthRes.body);
  assert.strictEqual(healthJson.status, 'ok');
  assert.strictEqual(healthJson.platform, 'render');
  assert.strictEqual(healthJson.rooms, 0);

  // Assert: /api/info omits internal IP and sends matching CORS header
  assert.strictEqual(infoRes.statusCode, 200);
  assert.strictEqual(infoRes.headers['access-control-allow-origin'], 'https://boxhead.pages.dev');
  const infoJson = JSON.parse(infoRes.body);
  assert.strictEqual(infoJson.lanIp, null);
  assert.strictEqual(infoJson.exposeLanIp, false);
  assert.strictEqual(infoJson.platform, 'render');

  // Assert: /config.js is uncached and contains snapshotHz=25
  assert.strictEqual(configRes.statusCode, 200);
  assert.match(configRes.headers['cache-control'], /no-store/);
  assert.ok(configRes.body.includes('"snapshotHz":25'));
  assert.ok(configRes.body.includes('"showColdStartHint":true'));

  // Assert: /vendor/socket.io.min.js is served cleanly
  assert.strictEqual(vendorRes.statusCode, 200);
  assert.ok(vendorRes.body.length > 10000);
});

test('split-backend mode disables static HTML serving and shuts down active rooms cleanly', async () => {
  // Arrange
  const srv = await startServer({
    port: 0,
    env: {
      DEPLOY_PLATFORM: 'split-backend',
      CORS_ORIGIN: 'https://boxhead.pages.dev'
    }
  });
  const base = `http://127.0.0.1:${srv.port}`;

  // Act: Root returns JSON status instead of HTML; disallowed origin gets no ACAO header
  const rootRes = await httpRequest(`${base}/`, { Origin: 'https://evil.example.com' });
  assert.strictEqual(rootRes.statusCode, 200);
  assert.strictEqual(rootRes.headers['access-control-allow-origin'], undefined);
  assert.strictEqual(JSON.parse(rootRes.body).mode, 'backend');

  // Connect socket and create an active game loop
  const client = ioClient(base, { transports: ['websocket'], reconnection: false });
  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('connect_error', reject);
  });

  await new Promise((resolve) => {
    client.emit('room:create', { roomName: 'Shutdown Room', playerName: 'Host' }, resolve);
  });
  client.emit('room:start');

  // Act & Assert: shutdown stops room intervals and closes server cleanly
  client.disconnect();
  await srv.shutdown();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/deploy_server_integration.test.js`
Expected: FAIL (`srv.shutdown is not a function` / `/healthz` returns 404)

- [ ] **Step 3: Update `server/server.js`**

Replace `server/server.js`:

```javascript
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const { socketHandler } = require('./socketHandler.js');
const { getMapList } = require('./game/MapConfig.js');
const { resolveDeployConfig, renderClientConfigScript } = require('./config/deployConfig.js');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function resolveAllowedOriginHeader(requestOrigin, corsOrigin) {
  if (corsOrigin === '*') return '*';
  if (!requestOrigin || !Array.isArray(corsOrigin)) return null;
  return corsOrigin.includes(requestOrigin) ? requestOrigin : null;
}

function createCorsMiddleware(corsOrigin) {
  return (req, res, next) => {
    const allowed = resolveAllowedOriginHeader(req.headers.origin, corsOrigin);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      if (allowed !== '*') {
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

function parseStartArgs(portOrOptions, extraOptions) {
  if (portOrOptions && typeof portOrOptions === 'object') {
    const { port, env, overrides } = portOrOptions;
    return {
      explicitPort: port,
      env: env || process.env,
      overrides: overrides || {}
    };
  }
  const safeExtra = extraOptions && typeof extraOptions === 'object' ? extraOptions : {};
  return {
    explicitPort: portOrOptions,
    env: safeExtra.env || process.env,
    overrides: safeExtra.overrides || {}
  };
}

function startServer(portOrOptions = 3000, extraOptions = {}) {
  const { explicitPort, env, overrides } = parseStartArgs(portOrOptions, extraOptions);
  const config = resolveDeployConfig(env, {
    ...overrides,
    ...(explicitPort !== undefined ? { port: explicitPort } : {})
  });

  return new Promise((resolve, reject) => {
    const app = express();
    if (config.trustProxy) {
      app.set('trust proxy', 1);
    }

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST']
      },
      transports: [...config.socketTransports],
      pingInterval: config.pingIntervalMs,
      pingTimeout: config.pingTimeoutMs
    });

    app.use(createCorsMiddleware(config.corsOrigin));

    const roomRegistry = socketHandler(io, {
      maxRooms: config.maxRooms,
      roomOptions: {
        simulationHz: config.simulationHz,
        snapshotHz: config.snapshotHz
      }
    });

    app.get(config.healthCheckPath, (req, res) => {
      res.status(200).json({
        status: 'ok',
        platform: config.platform,
        mode: config.mode,
        uptimeSec: Math.floor(process.uptime()),
        rooms: roomRegistry.rooms.size
      });
    });

    app.get('/config.js', (req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(renderClientConfigScript(config));
    });

    const socketIoClientDist = path.dirname(require.resolve('socket.io/client-dist/socket.io.min.js'));
    app.use('/vendor', express.static(socketIoClientDist, {
      maxAge: config.staticMaxAgeSec * 1000
    }));

    app.get('/api/info', (req, res) => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : config.port;
      res.json({
        lanIp: config.exposeLanIp ? getLanIp() : null,
        port: actualPort,
        platform: config.platform,
        mode: config.mode,
        exposeLanIp: config.exposeLanIp
      });
    });

    app.get('/api/maps', (req, res) => {
      res.json(getMapList());
    });

    if (config.serveStatic) {
      const clientPath = path.join(__dirname, '../client');
      app.use(express.static(clientPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('config.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (config.staticMaxAgeSec > 0) {
            res.setHeader('Cache-Control', `public, max-age=${config.staticMaxAgeSec}`);
          }
        }
      }));
    } else {
      app.get('/', (req, res) => {
        res.json({
          service: 'boxhead-multiplayer-backend',
          status: 'ok',
          platform: config.platform,
          mode: config.mode,
          healthCheckPath: config.healthCheckPath
        });
      });
    }

    let isShuttingDown = false;
    function shutdown() {
      if (isShuttingDown) return Promise.resolve();
      isShuttingDown = true;

      for (const room of roomRegistry.rooms.values()) {
        if (room.gameRoom && typeof room.gameRoom.stop === 'function') {
          room.gameRoom.stop();
        }
      }
      roomRegistry.rooms.clear();

      return new Promise((closeResolve) => {
        io.close(() => {
          if (server.listening) {
            server.close(() => closeResolve());
          } else {
            closeResolve();
          }
        });
      });
    }

    server.listen(config.port, config.host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : config.port;
      resolve({ app, server, io, port: actualPort, getLanIp, config, shutdown });
    });

    server.on('error', reject);
  });
}

if (require.main === module) {
  const bootConfig = resolveDeployConfig(process.env);
  startServer({ env: process.env }).then(({ port, getLanIp: resolveLanIp, config, shutdown }) => {
    const lanIp = resolveLanIp();
    console.log('====================================================');
    console.log(`   BOXHEAD MULTIPLAYER SERVER (${config.platform.toUpperCase()} / ${config.mode})`);
    console.log('====================================================');
    console.log(`[Server] Listening:       http://${config.host}:${port}`);
    if (config.exposeLanIp) {
      console.log(`[LAN]    Cac may cung mang: http://${lanIp}:${port}`);
    }
    console.log(`[Config] Sim ${config.simulationHz}Hz | Snap ${config.snapshotHz}Hz | MaxRooms ${config.maxRooms}`);
    console.log(`[Health] Endpoint:        ${config.healthCheckPath}`);
    console.log('====================================================');

    const handleSignal = (signal) => {
      console.log(`[Server] Received ${signal}, shutting down cleanly...`);
      shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
    };
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
  }).catch((err) => {
    console.error('Loi khoi dong server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, getLanIp };
```

- [ ] **Step 4: Run server & E2E tests to verify pass**

Run: `node --test tests/deploy_server_integration.test.js tests/server.test.js tests/e2e_simulation.test.js`
Expected: PASS on all tests

- [ ] **Step 5: Commit**

```bash
git add server/server.js tests/deploy_server_integration.test.js
git commit -m "feat(server): integrate deployConfig, /healthz, /config.js, CORS, and graceful shutdown"
```

---

### Task 4: Client Multi-Platform Runtime Config, URL Fix, Interpolation Buffer & Render Cold-Start UX

**Files:**
- Create: `client/js/deployClient.js`
- Modify: `client/js/interpolation.js:1-10`, `client/js/interpolation.js:90-100`
- Modify: `client/js/ui.js:1-20`, `client/js/ui.js:108-120`, `client/js/ui.js:491-512`
- Modify: `client/js/main.js:15-35`, `client/js/main.js:149-157`, `client/js/main.js:236-262`
- Modify: `client/index.html:15-30`, `client/index.html:256-271`
- Modify: `client/css/style.css:94-114`
- Test: `tests/deploy_client.test.js`

**Interfaces:**
- Consumes: `window.BOXHEAD_DEPLOY_CONFIG` from `/config.js` (or `dist/config.js`)
- Produces in `client/js/deployClient.js` (exported on both `module.exports` and `window.DeployClient`):
  - `getDeployConfig(win?: WindowLike) -> ClientRuntimeConfig`
  - `resolveBackendUrl(config: ClientRuntimeConfig, win?: WindowLike) -> string`
  - `resolveApiUrl(apiPath: string, config: ClientRuntimeConfig, win?: WindowLike) -> string`
  - `resolveRoomInviteBaseUrl(params: { origin: string, hostname: string, protocol: string, lanIp?: string, lanPort?: number, showLanBanner?: boolean }) -> string`
  - `buildSocketOptions(config: ClientRuntimeConfig) -> { transports: string[], reconnection: boolean, reconnectionAttempts: number, reconnectionDelay: number, reconnectionDelayMax: number }`
- Produces in `client/js/ui.js`:
  - `ui.setConnectionStatus(state: 'connecting' | 'connected' | 'disconnected' | 'error', message: string)`
- Produces in `client/js/interpolation.js`:
  - `interpolator.setBufferTime(ms: number)`

- [ ] **Step 1: Write the failing unit tests for `client/js/deployClient.js` and `Interpolator` buffer config**

Create `tests/deploy_client.test.js`:

```javascript
/**
 * @file deploy_client.test.js
 * @description Tests for client deployment URL resolution, invite link cloud fix, and interpolation buffer sync.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getDeployConfig,
  resolveBackendUrl,
  resolveApiUrl,
  resolveRoomInviteBaseUrl,
  buildSocketOptions
} = require('../client/js/deployClient.js');

test('resolveBackendUrl and resolveApiUrl handle monolith same-origin and split backendUrl modes', () => {
  // Arrange: Monolith (no backendUrl)
  const monoWin = {
    location: { origin: 'https://boxhead.onrender.com', hostname: 'boxhead.onrender.com', protocol: 'https:' },
    BOXHEAD_DEPLOY_CONFIG: { mode: 'monolith', backendUrl: '', snapshotHz: 25, interpolationBufferMs: 60 }
  };
  const monoCfg = getDeployConfig(monoWin);

  // Act & Assert: Monolith
  assert.strictEqual(resolveBackendUrl(monoCfg, monoWin), '');
  assert.strictEqual(resolveApiUrl('/api/info', monoCfg, monoWin), '/api/info');

  // Arrange: Split static (Cloudflare Pages -> Render backend)
  const splitWin = {
    location: { origin: 'https://boxhead.pages.dev', hostname: 'boxhead.pages.dev', protocol: 'https:' },
    BOXHEAD_DEPLOY_CONFIG: {
      mode: 'static-client',
      backendUrl: 'https://boxhead-api.onrender.com/',
      socketTransports: ['websocket', 'polling']
    }
  };
  const splitCfg = getDeployConfig(splitWin);

  // Act & Assert: Split static
  assert.strictEqual(resolveBackendUrl(splitCfg, splitWin), 'https://boxhead-api.onrender.com');
  assert.strictEqual(resolveApiUrl('/api/info', splitCfg, splitWin), 'https://boxhead-api.onrender.com/api/info');
  assert.deepStrictEqual(buildSocketOptions(splitCfg).transports, ['websocket', 'polling']);
});

test('resolveRoomInviteBaseUrl prevents internal container LAN IP leak on HTTPS/cloud domains', () => {
  // Arrange & Act & Assert: Render / Cloudflare Pages MUST use window.location.origin
  const cloudBase = resolveRoomInviteBaseUrl({
    origin: 'https://boxhead.onrender.com',
    hostname: 'boxhead.onrender.com',
    protocol: 'https:',
    lanIp: '10.201.14.8',
    lanPort: 10000,
    showLanBanner: false
  });
  assert.strictEqual(cloudBase, 'https://boxhead.onrender.com');

  // Even if lanIp was returned accidentally, HTTPS or non-LAN mode never downgrades to http://lanIp
  const httpsWithLanFlag = resolveRoomInviteBaseUrl({
    origin: 'https://boxhead.pages.dev',
    hostname: 'boxhead.pages.dev',
    protocol: 'https:',
    lanIp: '10.201.14.8',
    lanPort: 10000,
    showLanBanner: true
  });
  assert.strictEqual(httpsWithLanFlag, 'https://boxhead.pages.dev');

  // Local LAN host on localhost resolves to LAN IP so friends on same Wi-Fi can join
  const lanFromLocalhost = resolveRoomInviteBaseUrl({
    origin: 'http://localhost:3000',
    hostname: 'localhost',
    protocol: 'http:',
    lanIp: '192.168.1.25',
    lanPort: 3000,
    showLanBanner: true
  });
  assert.strictEqual(lanFromLocalhost, 'http://192.168.1.25:3000');

  // Local LAN accessed via LAN IP keeps that origin
  const lanFromIp = resolveRoomInviteBaseUrl({
    origin: 'http://192.168.1.25:3000',
    hostname: '192.168.1.25',
    protocol: 'http:',
    lanIp: '192.168.1.25',
    lanPort: 3000,
    showLanBanner: true
  });
  assert.strictEqual(lanFromIp, 'http://192.168.1.25:3000');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/deploy_client.test.js`
Expected: FAIL with `Cannot find module '../client/js/deployClient.js'`

- [ ] **Step 3: Create `client/js/deployClient.js` and update `interpolation.js`, `ui.js`, `main.js`, `index.html`, `style.css`**

1. Create `client/js/deployClient.js`:

```javascript
/**
 * @file deployClient.js
 * @description Browser/Node shared helper for resolving runtime backend URLs, invite links, and Socket.IO options across platforms.
 */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DeployClient = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DEFAULT_DEPLOY_CONFIG = Object.freeze({
    platform: 'lan',
    mode: 'monolith',
    backendUrl: '',
    publicUrl: '',
    snapshotHz: 50,
    interpolationBufferMs: 40,
    socketTransports: ['polling', 'websocket'],
    showLanBanner: true,
    showColdStartHint: false
  });

  function stripTrailingSlashes(url) {
    return typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
  }

  function getDeployConfig(win) {
    const targetWin = win || (typeof window !== 'undefined' ? window : null);
    const raw = targetWin && targetWin.BOXHEAD_DEPLOY_CONFIG && typeof targetWin.BOXHEAD_DEPLOY_CONFIG === 'object'
      ? targetWin.BOXHEAD_DEPLOY_CONFIG
      : {};
    return {
      ...DEFAULT_DEPLOY_CONFIG,
      ...raw,
      backendUrl: stripTrailingSlashes(raw.backendUrl || ''),
      publicUrl: stripTrailingSlashes(raw.publicUrl || ''),
      socketTransports: Array.isArray(raw.socketTransports) && raw.socketTransports.length > 0
        ? [...raw.socketTransports]
        : [...DEFAULT_DEPLOY_CONFIG.socketTransports]
    };
  }

  function resolveBackendUrl(config, win) {
    const cfg = config || getDeployConfig(win);
    return cfg.backendUrl ? stripTrailingSlashes(cfg.backendUrl) : '';
  }

  function resolveApiUrl(apiPath, config, win) {
    const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const base = resolveBackendUrl(config, win);
    return base ? `${base}${cleanPath}` : cleanPath;
  }

  function isPrivateOrLocalHostname(hostname) {
    if (!hostname) return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return true;
    }
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
  }

  function resolveRoomInviteBaseUrl({ origin, hostname, protocol, lanIp, lanPort, showLanBanner }) {
    const cleanOrigin = stripTrailingSlashes(origin || '');
    if (protocol === 'https:' || showLanBanner === false) {
      return cleanOrigin;
    }
    if (lanIp && lanIp !== '127.0.0.1' && isPrivateOrLocalHostname(hostname)) {
      const port = lanPort || 3000;
      return `http://${lanIp}:${port}`;
    }
    return cleanOrigin;
  }

  function buildSocketOptions(config) {
    const cfg = config || getDeployConfig();
    return {
      transports: [...cfg.socketTransports],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    };
  }

  return {
    DEFAULT_DEPLOY_CONFIG,
    getDeployConfig,
    resolveBackendUrl,
    resolveApiUrl,
    resolveRoomInviteBaseUrl,
    buildSocketOptions
  };
});
```

2. Update `client/js/interpolation.js` (`lines 1-6` and export guard at `line 100`):

```javascript
class Interpolator {
  constructor(bufferTimeMs) {
    this.snapshots = [];
    const configuredBuffer = (typeof window !== 'undefined'
      && window.BOXHEAD_DEPLOY_CONFIG
      && Number.isFinite(window.BOXHEAD_DEPLOY_CONFIG.interpolationBufferMs))
      ? window.BOXHEAD_DEPLOY_CONFIG.interpolationBufferMs
      : 40;
    this.bufferTime = Number.isFinite(bufferTimeMs) && bufferTimeMs > 0 ? bufferTimeMs : configuredBuffer;
  }

  setBufferTime(ms) {
    if (Number.isFinite(ms) && ms > 0) {
      this.bufferTime = ms;
    }
  }
```

And replace line 100 in `client/js/interpolation.js`:

```javascript
if (typeof window !== 'undefined') {
  window.Interpolator = Interpolator;
}
if (typeof module === 'object' && module.exports) {
  module.exports = { Interpolator };
}
```

3. Update `client/index.html` (`lines 20-26` and `lines 259-270`):

Replace lines 20-25 in `client/index.html`:

```html
      <!-- Connection Status Banner (Cold start / Reconnect indicator) -->
      <div id="connection-status-banner" class="connection-banner connecting">
        <span id="connection-status-text">⏳ Đang kết nối máy chủ...</span>
      </div>

      <!-- LAN / Online Invite Banner -->
      <div class="lan-banner">
        <span id="lan-banner-title">🌐 LINK MẠNG LAN CHO BẠN BÈ:</span>
        <span id="lan-ip-display" class="ip-link">Đang tải địa chỉ...</span>
      </div>
```

Replace lines 259-269 in `client/index.html`:

```html
  <!-- Scripts -->
  <script src="config.js"></script>
  <script src="vendor/socket.io.min.js"></script>
  <script src="js/deployClient.js"></script>
  <script src="js/mapsConfig.js"></script>
  <script src="js/sprites.js"></script>
  <script src="js/zombieAudio.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/interpolation.js"></script>
  <script src="js/renderer.js"></script>
  <script src="js/input.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/main.js"></script>
```

4. Update `client/css/style.css` (append after `.lan-banner .ip-link` at line 114):

```css
.connection-banner {
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 0.92rem;
  font-weight: 600;
  text-align: center;
  border: 1px solid var(--border);
  background: rgba(255, 214, 0, 0.1);
  color: var(--accent);
}

.connection-banner.connected {
  background: rgba(0, 230, 118, 0.1);
  border-color: rgba(0, 230, 118, 0.45);
  color: var(--success);
}

.connection-banner.disconnected,
.connection-banner.error {
  background: rgba(255, 23, 68, 0.14);
  border-color: var(--danger);
  color: #ff8a80;
}

.connection-banner.hidden {
  display: none;
}
```

5. Update `client/js/ui.js`:
- In `constructor()` (`lines 11-15`), store:

```javascript
    this.lanBannerTitle = document.getElementById('lan-banner-title');
    this.lanIpDisplay = document.getElementById('lan-ip-display');
    this.connectionStatusBanner = document.getElementById('connection-status-banner');
    this.connectionStatusText = document.getElementById('connection-status-text');
    this.deployConfig = window.DeployClient ? window.DeployClient.getDeployConfig(window) : {
      showLanBanner: true,
      showColdStartHint: false
    };
```

- Replace `fetchLanIp()` (`lines 108-119`):

```javascript
  fetchLanIp() {
    const showLan = this.deployConfig && this.deployConfig.showLanBanner !== false && window.location.protocol !== 'https:';
    if (!showLan) {
      if (this.lanBannerTitle) {
        this.lanBannerTitle.textContent = '🌐 LINK CHƠI ONLINE (CHIA SẺ CHO BẠN BÈ):';
      }
      if (this.lanIpDisplay) {
        this.lanIpDisplay.textContent = window.location.origin;
      }
      return;
    }

    const infoUrl = window.DeployClient
      ? window.DeployClient.resolveApiUrl('/api/info', this.deployConfig, window)
      : '/api/info';

    fetch(infoUrl)
      .then(r => r.json())
      .then(data => {
        if (data && data.exposeLanIp && data.lanIp) {
          this.lanIp = data.lanIp;
          this.lanPort = data.port;
          this.lanIpDisplay.textContent = `http://${data.lanIp}:${data.port}`;
        } else {
          if (this.lanBannerTitle) {
            this.lanBannerTitle.textContent = '🌐 LINK CHƠI ONLINE (CHIA SẺ CHO BẠN BÈ):';
          }
          this.lanIpDisplay.textContent = window.location.origin;
        }
      })
      .catch(() => {
        this.lanIpDisplay.textContent = window.location.origin;
      });
  }

  setConnectionStatus(state, message) {
    if (!this.connectionStatusBanner || !this.connectionStatusText) return;
    this.connectionStatusBanner.classList.remove('connecting', 'connected', 'disconnected', 'error', 'hidden');
    if (state) {
      this.connectionStatusBanner.classList.add(state);
    }
    this.connectionStatusText.textContent = message || '';
  }
```

- Update `copyRoomLink()` (`lines 491-501`):

```javascript
  copyRoomLink() {
    if (!this.currentRoom) {
      this.showToast('⚠ Chưa vào phòng nào để copy link!');
      return;
    }
    const base = window.DeployClient
      ? window.DeployClient.resolveRoomInviteBaseUrl({
          origin: window.location.origin,
          hostname: window.location.hostname,
          protocol: window.location.protocol,
          lanIp: this.lanIp,
          lanPort: this.lanPort,
          showLanBanner: this.deployConfig ? this.deployConfig.showLanBanner : true
        })
      : window.location.origin;
    const inviteUrl = `${base}/#room=${encodeURIComponent(this.currentRoom.id)}`;
```

6. Update `client/js/main.js`:
- Replace socket initialization (`line 17`):

```javascript
  const deployConfig = isBrowser && window.DeployClient ? window.DeployClient.getDeployConfig(window) : null;
  const backendUrl = isBrowser && window.DeployClient ? window.DeployClient.resolveBackendUrl(deployConfig, window) : '';
  const socketOptions = isBrowser && window.DeployClient ? window.DeployClient.buildSocketOptions(deployConfig) : undefined;
  const socket = isBrowser && typeof io === 'function'
    ? (backendUrl ? io(backendUrl, socketOptions) : io(socketOptions))
    : { on: () => {}, emit: () => {} };
```

- Update initial status + `room:create` callback (`lines 149-157`) and add Socket lifecycle listeners before `lobby:roomList` (`line 236`):

```javascript
  if (isBrowser && ui) {
    const initialMsg = deployConfig && deployConfig.showColdStartHint
      ? '⏳ Đang đánh thức máy chủ... (Lần đầu trên Free Tier có thể mất 30–60 giây)'
      : '⏳ Đang kết nối tới máy chủ...';
    ui.setConnectionStatus('connecting', initialMsg);
  }
```

Update `btnCreateRoom` (`lines 149-157`):

```javascript
    if (ui.btnCreateRoom) {
      ui.btnCreateRoom.addEventListener('click', () => {
        const roomName = ui.roomNameInput.value.trim() || 'Phòng Chiến Đấu';
        const playerName = ui.nicknameInput.value.trim() || 'Hero';
        const mapId = ui.selectedMapId || currentMapId;
        socket.emit('room:create', { roomName, playerName, character: 'HUMAN', mapId }, (res) => {
          if (res && !res.success) {
            ui.showToast(`⚠ ${res.error || 'Không thể tạo phòng!'}`);
          }
        });
      });
    }
```

Add Socket lifecycle listeners above `socket.on('lobby:roomList', ...)`:

```javascript
  socket.on('connect', () => {
    if (ui) {
      const label = deployConfig && deployConfig.platform ? deployConfig.platform.toUpperCase() : 'ONLINE';
      ui.setConnectionStatus('connected', `🟢 Đã kết nối máy chủ (${label})`);
    }
  });

  socket.on('connect_error', () => {
    if (ui) {
      const msg = deployConfig && deployConfig.showColdStartHint
        ? '⏳ Server đang khởi động lại (Cold Start 30–60s), đang tự thử lại...'
        : '⚠ Không thể kết nối máy chủ, đang thử kết nối lại...';
      ui.setConnectionStatus('disconnected', msg);
    }
  });

  socket.on('disconnect', (reason) => {
    if (ui) {
      ui.setConnectionStatus('disconnected', `⚠ Mất kết nối (${reason}). Đang kết nối lại...`);
      if (isInGame) {
        ui.showToast('⚠ Mất kết nối tới máy chủ, đang tự kết nối lại...');
      }
    }
  });

  socket.on('room:error', ({ error } = {}) => {
    if (ui && error) {
      ui.showToast(`⚠ ${error}`);
    }
  });
```

- [ ] **Step 4: Run client + existing tests to verify pass**

Run: `node --test tests/deploy_client.test.js tests/server.test.js`
Expected: PASS on all tests

- [ ] **Step 5: Commit**

```bash
git add client/js/deployClient.js client/js/interpolation.js client/js/ui.js client/js/main.js client/index.html client/css/style.css tests/deploy_client.test.js
git commit -m "feat(client): add deployClient runtime config, fix cloud invite URL, and add cold-start UX"
```

---

### Task 5: Static Client Builder (`scripts/build-client.js`), Multi-Platform Manifests (`render.yaml`, `Dockerfile`, `.env.example`), & Docs

**Files:**
- Create: `scripts/build-client.js`
- Create: `render.yaml`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `deploy.presets.json`
- Create: `.env.example`
- Modify: `package.json:1-17`
- Modify: `.gitignore:95-100`
- Modify: `README.md:1-30`
- Test: `tests/build_client.test.js`

**Interfaces:**
- Consumes: `resolveDeployConfig`, `renderClientConfigScript`, `normalizeHttpUrl`, `PLATFORM_PRESETS` from `server/config/deployConfig.js`
- Produces in `scripts/build-client.js`:
  - `buildClient({ rootDir?: string, outDir?: string, env?: Record<string, string | undefined>, overrides?: Record<string, unknown> }) -> { outDir: string, backendUrl: string, filesCount: number }`
  - Generates `dist/config.js`, `dist/vendor/socket.io.min.js`, `dist/_headers`, and copies all `client/` static assets.

- [ ] **Step 1: Write the failing test for `scripts/build-client.js`**

Create `tests/build_client.test.js`:

```javascript
/**
 * @file build_client.test.js
 * @description Tests for static client bundle generation (Cloudflare Pages / Vercel).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildClient } = require('../scripts/build-client.js');

test('buildClient exports static dist bundle with baked config.js, vendor socket.io, and _headers', (t) => {
  // Arrange
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boxhead-dist-'));
  const outDir = path.join(tmpRoot, 'dist');
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  // Act
  const result = buildClient({
    outDir,
    env: {
      DEPLOY_PLATFORM: 'static-client',
      BACKEND_URL: 'https://boxhead-game.onrender.com/',
      SNAPSHOT_HZ: '25'
    }
  });

  // Assert
  assert.strictEqual(result.backendUrl, 'https://boxhead-game.onrender.com');
  assert.ok(result.filesCount > 5);
  assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
  assert.ok(fs.existsSync(path.join(outDir, 'js/deployClient.js')));
  assert.ok(fs.existsSync(path.join(outDir, 'vendor/socket.io.min.js')));
  assert.ok(fs.existsSync(path.join(outDir, '_headers')));

  const configJs = fs.readFileSync(path.join(outDir, 'config.js'), 'utf8');
  assert.ok(configJs.includes('"backendUrl":"https://boxhead-game.onrender.com"'));
  assert.ok(configJs.includes('"snapshotHz":25'));

  const headersTxt = fs.readFileSync(path.join(outDir, '_headers'), 'utf8');
  assert.ok(headersTxt.includes('/config.js'));
  assert.ok(headersTxt.includes('no-store'));
});

test('buildClient rejects invalid non-empty BACKEND_URL values', (t) => {
  // Arrange
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boxhead-bad-dist-'));
  const outDir = path.join(tmpRoot, 'dist');
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  // Act & Assert
  assert.throws(
    () => buildClient({ outDir, env: { BACKEND_URL: 'not-a-valid-url' } }),
    /Invalid BACKEND_URL/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build_client.test.js`
Expected: FAIL with `Cannot find module '../scripts/build-client.js'`

- [ ] **Step 3: Implement `scripts/build-client.js`, platform manifests, `.env.example`, and docs**

1. Create `scripts/build-client.js`:

```javascript
/**
 * @file build-client.js
 * @description Builds a static client distribution (dist/) for Cloudflare Pages, Vercel, or any static CDN.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  resolveDeployConfig,
  renderClientConfigScript,
  normalizeHttpUrl
} = require('../server/config/deployConfig.js');

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(full);
    } else {
      count += 1;
    }
  }
  return count;
}

function buildClient(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const clientSrcDir = path.join(rootDir, 'client');
  const outDir = options.outDir || path.join(rootDir, 'dist');
  const env = options.env || process.env;
  const overrides = options.overrides || {};

  const rawBackendUrl = overrides.BACKEND_URL !== undefined ? overrides.BACKEND_URL : env.BACKEND_URL;
  if (typeof rawBackendUrl === 'string' && rawBackendUrl.trim() && !normalizeHttpUrl(rawBackendUrl)) {
    throw new Error(`Invalid BACKEND_URL: "${rawBackendUrl}". Expected an http:// or https:// URL.`);
  }

  const config = resolveDeployConfig(env, {
    DEPLOY_PLATFORM: env.DEPLOY_PLATFORM || 'static-client',
    ...overrides
  });

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(clientSrcDir, outDir, { recursive: true });

  const vendorDir = path.join(outDir, 'vendor');
  fs.mkdirSync(vendorDir, { recursive: true });
  const socketIoMinPath = require.resolve('socket.io/client-dist/socket.io.min.js');
  fs.copyFileSync(socketIoMinPath, path.join(vendorDir, 'socket.io.min.js'));

  fs.writeFileSync(path.join(outDir, 'config.js'), renderClientConfigScript(config), 'utf8');

  const cloudflareHeaders = [
    '/config.js',
    '  Cache-Control: no-store',
    '',
    '/index.html',
    '  Cache-Control: no-cache',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=86400',
    '',
    '/vendor/*',
    '  Cache-Control: public, max-age=604800',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(outDir, '_headers'), cloudflareHeaders, 'utf8');

  return {
    outDir,
    backendUrl: config.backendUrl,
    filesCount: countFiles(outDir)
  };
}

if (require.main === module) {
  try {
    const result = buildClient();
    console.log(`[build-client] Built static client to ${result.outDir} (${result.filesCount} files)`);
    console.log(`[build-client] BACKEND_URL=${result.backendUrl || '(same-origin)'}`);
  } catch (err) {
    console.error('[build-client] Error:', err.message);
    process.exit(1);
  }
}

module.exports = { buildClient };
```

2. Create `render.yaml`:

```yaml
services:
  - type: web
    name: boxhead-multiplayer-game
    runtime: node
    region: singapore
    plan: free
    buildCommand: npm ci --omit=dev
    startCommand: npm start
    healthCheckPath: /healthz
    envVars:
      - key: NODE_ENV
        value: production
      - key: DEPLOY_PLATFORM
        value: render
      - key: DEPLOY_MODE
        value: monolith
      - key: SIMULATION_HZ
        value: "50"
      - key: SNAPSHOT_HZ
        value: "25"
      - key: MAX_ROOMS
        value: "20"
      - key: CORS_ORIGIN
        value: "*"
```

3. Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY client ./client

ENV NODE_ENV=production
ENV DEPLOY_PLATFORM=docker
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
```

4. Create `.dockerignore`:

```text
node_modules
dist
.git
.worktrees
.superpowers
docs
tests
character
zom_bie_model
pain_model.py
*.log
.env
.env.*
```

5. Create `deploy.presets.json`:

```json
{
  "platforms": {
    "lan": {
      "DEPLOY_PLATFORM": "lan",
      "DEPLOY_MODE": "monolith",
      "PORT": "3000",
      "SIMULATION_HZ": "50",
      "SNAPSHOT_HZ": "50",
      "MAX_ROOMS": "50",
      "CORS_ORIGIN": "*"
    },
    "render": {
      "DEPLOY_PLATFORM": "render",
      "DEPLOY_MODE": "monolith",
      "SIMULATION_HZ": "50",
      "SNAPSHOT_HZ": "25",
      "MAX_ROOMS": "20",
      "CORS_ORIGIN": "*"
    },
    "render-split-backend": {
      "DEPLOY_PLATFORM": "split-backend",
      "DEPLOY_MODE": "backend",
      "SIMULATION_HZ": "50",
      "SNAPSHOT_HZ": "25",
      "MAX_ROOMS": "20",
      "CORS_ORIGIN": "https://your-game.pages.dev"
    },
    "cloudflare-pages-client": {
      "buildCommand": "npm run build:client",
      "outputDirectory": "dist",
      "DEPLOY_PLATFORM": "static-client",
      "BACKEND_URL": "https://your-render-backend.onrender.com",
      "SNAPSHOT_HZ": "25"
    },
    "docker-paas": {
      "DEPLOY_PLATFORM": "docker",
      "DEPLOY_MODE": "monolith",
      "PORT": "3000",
      "SNAPSHOT_HZ": "25",
      "MAX_ROOMS": "25"
    },
    "huggingface-spaces": {
      "DEPLOY_PLATFORM": "huggingface",
      "DEPLOY_MODE": "monolith",
      "PORT": "7860",
      "SNAPSHOT_HZ": "30",
      "MAX_ROOMS": "30"
    }
  }
}
```

6. Create `.env.example`:

```dotenv
# Multi-platform preset: lan | render | docker | huggingface | split-backend | static-client
DEPLOY_PLATFORM=lan
# Mode override (optional): monolith | backend | static-client
DEPLOY_MODE=monolith

HOST=0.0.0.0
PORT=3000

# Physics tick rate vs network broadcast rate (lower SNAPSHOT_HZ saves CPU & bandwidth on free tiers)
SIMULATION_HZ=50
SNAPSHOT_HZ=50
MAX_ROOMS=50

# Comma-separated allowed origins (e.g. https://your-game.pages.dev) or *
CORS_ORIGIN=*
SOCKET_TRANSPORTS=websocket,polling

# Set BACKEND_URL when building static client (npm run build:client) for Cloudflare Pages / Vercel
BACKEND_URL=
PUBLIC_URL=

# Reverse proxy & static cache settings
TRUST_PROXY=false
STATIC_MAX_AGE_SEC=0
EXPOSE_LAN_IP=true
SHOW_COLD_START_HINT=false
HEALTHCHECK_PATH=/healthz
```

7. Update `package.json`:

```json
{
  "name": "boxhead-lan-game",
  "version": "1.0.0",
  "description": "Boxhead LAN & Online Multiplayer Co-op Zombie Shooter (1-4 Players)",
  "main": "server/server.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "node server/server.js",
    "start:render": "DEPLOY_PLATFORM=render node server/server.js",
    "build:client": "node scripts/build-client.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "socket.io-client": "^4.7.5"
  }
}
```

8. Update `.gitignore` (append `dist/` under `# Build / Deploy Output`):

```gitignore
# Build / Deploy Output
dist/
```

9. Update `README.md` (add a new `## ☁️ HƯỚNG DẪN DEPLOY ĐA NỀN TẢNG (RENDER / CLOUDFLARE PAGES / DOCKER)` section at the end documenting Render Blueprint, Split Cloudflare Pages + Render, Docker PaaS, and the env table from `deploy.presets.json` / `.env.example`).

- [ ] **Step 4: Run full test suite & verify static build output**

Run: `node --test tests/*.test.js`
Expected: PASS on all existing and new test files (`deploy_config.test.js`, `deploy_room_limits.test.js`, `deploy_server_integration.test.js`, `deploy_client.test.js`, `build_client.test.js`, plus all existing game/audio/server tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-client.js render.yaml Dockerfile .dockerignore deploy.presets.json .env.example package.json .gitignore README.md tests/build_client.test.js
git commit -m "feat(deploy): add Render Blueprint, Dockerfile, static client builder, and multi-platform presets"
```

---

## Self-Review & Verification Checklist

1. **Dual-mode topology:** Monolith works out-of-the-box on Render (`render.yaml`), Docker (`Dockerfile`), and LAN (`npm start`); Split Static works via `npm run build:client` (`dist/`) on Cloudflare Pages / Vercel pointing to `BACKEND_URL` with `CORS_ORIGIN` configured on backend.
2. **Single unified config:** All platform defaults and env overrides live exclusively in `server/config/deployConfig.js` and flow cleanly to `server/server.js`, `GameRoom`, `socketHandler`, `/config.js`, and `scripts/build-client.js`.
3. **Free-tier tuning:** `SIMULATION_HZ=50` decouples cleanly from `SNAPSHOT_HZ=25` on cloud presets (`render`, `docker`, `split-backend`), auto-scaling `Interpolator.bufferTime` to `60ms` so gameplay remains smooth while halving Socket.IO CPU & bandwidth usage.
4. **Cloud UX & bug fixes:** `copyRoomLink()` uses `DeployClient.resolveRoomInviteBaseUrl()` so Render/Cloudflare Pages links never leak internal container `10.x.x.x` IPs, and `connection-status-banner` informs players during Render's 30–60s cold start.
5. **Security & operational hygiene:** `CORS_ORIGIN` list validation, `MAX_ROOMS` cap, malformed `room:create` payload guard, `GET /healthz`, `SIGTERM`/`SIGINT` graceful shutdown, and `.env.example` with non-secret defaults only.
