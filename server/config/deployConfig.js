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
