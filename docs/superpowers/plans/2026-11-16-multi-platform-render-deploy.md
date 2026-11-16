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
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `server/config/deployConfig.js`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: Decouple Snapshot Broadcast Rate in `GameRoom` & Enforce `MAX_ROOMS` in `socketHandler`

**Files:**
- Modify: `server/game/GameRoom.js`
- Modify: `server/socketHandler.js`
- Test: `tests/deploy_room_limits.test.js`

**Interfaces:**
- Consumes: `simulationHz`, `snapshotHz`, `maxRooms` numbers resolved by `deployConfig`
- Produces:
  - `new GameRoom(id, name, io, mapId = 'THE_ROOMS', options = {})` where `options` supports `{ simulationHz?: number, snapshotHz?: number }`
  - `room.tick(dt, options = {})` where `options` supports `{ emitSnapshot?: boolean }` (defaults `true` for direct test calls)
  - `socketHandler(io, options = {})` where `options` supports `{ maxRooms?: number, roomOptions?: { simulationHz?: number, snapshotHz?: number } }`, rejecting `room:create` when `rooms.size >= maxRooms` with both `callback({ success: false, error })` and `socket.emit('room:error', { error })`

- [ ] **Step 1: Write the failing tests for snapshot throttling and `MAX_ROOMS` cap**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Update `server/game/GameRoom.js` and `server/socketHandler.js`**
- [ ] **Step 4: Run tests to verify pass and confirm zero regressions**
- [ ] **Step 5: Commit**

---

### Task 3: Integrate Unified Deploy Config, `/healthz`, `/config.js`, `/vendor`, CORS & Graceful Shutdown into `server/server.js`

**Files:**
- Modify: `server/server.js`
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
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Update `server/server.js`**
- [ ] **Step 4: Run server & E2E tests to verify pass**
- [ ] **Step 5: Commit**

---

### Task 4: Client Multi-Platform Runtime Config, URL Fix, Interpolation Buffer & Render Cold-Start UX

**Files:**
- Create: `client/js/deployClient.js`
- Modify: `client/js/interpolation.js`
- Modify: `client/js/ui.js`
- Modify: `client/js/main.js`
- Modify: `client/index.html`
- Modify: `client/css/style.css`
- Test: `tests/deploy_client.test.js`

**Interfaces:**
- Consumes: `window.BOXHEAD_DEPLOY_CONFIG` from `/config.js` (or `dist/config.js`)
- Produces in `client/js/deployClient.js`:
  - `getDeployConfig(win?: WindowLike) -> ClientRuntimeConfig`
  - `resolveBackendUrl(config: ClientRuntimeConfig, win?: WindowLike) -> string`
  - `resolveApiUrl(apiPath: string, config: ClientRuntimeConfig, win?: WindowLike) -> string`
  - `resolveRoomInviteBaseUrl(params) -> string`
  - `buildSocketOptions(config: ClientRuntimeConfig) -> object`
- Produces in `client/js/ui.js`:
  - `ui.setConnectionStatus(state, message)`
- Produces in `client/js/interpolation.js`:
  - `interpolator.setBufferTime(ms: number)`

- [ ] **Step 1: Write the failing unit tests for `client/js/deployClient.js` and `Interpolator` buffer config**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Create `client/js/deployClient.js` and update `interpolation.js`, `ui.js`, `main.js`, `index.html`, `style.css`**
- [ ] **Step 4: Run client + existing tests to verify pass**
- [ ] **Step 5: Commit**

---

### Task 5: Static Client Builder (`scripts/build-client.js`), Multi-Platform Manifests (`render.yaml`, `Dockerfile`, `.env.example`), & Docs

**Files:**
- Create: `scripts/build-client.js`
- Create: `render.yaml`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `deploy.presets.json`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `README.md`
- Test: `tests/build_client.test.js`

- [ ] **Step 1: Write the failing test for `scripts/build-client.js`**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `scripts/build-client.js`, platform manifests, `.env.example`, and docs**
- [ ] **Step 4: Run full test suite & verify static build output**
- [ ] **Step 5: Commit**
