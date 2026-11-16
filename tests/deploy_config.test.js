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
  assert.strictEqual('keepAliveUrl' in clientConfig, false);
  assert.strictEqual('keepAliveEnabled' in clientConfig, false);
  assert.ok(script.startsWith('window.BOXHEAD_DEPLOY_CONFIG = Object.freeze('));
  assert.ok(script.includes('"backendUrl":"https://boxhead-api.onrender.com"'));
});

test('resolveDeployConfig resolves keepAlive settings from RENDER_EXTERNAL_URL, KEEP_ALIVE_URL, and AUTO_PING_ENABLED', () => {
  // Arrange & Act 1: Render auto-detects RENDER_EXTERNAL_URL + healthCheckPath
  const renderConfig = resolveDeployConfig({
    RENDER: 'true',
    RENDER_EXTERNAL_URL: 'https://boxhead-game.onrender.com/'
  });

  // Assert 1
  assert.strictEqual(renderConfig.keepAliveEnabled, true);
  assert.strictEqual(renderConfig.keepAliveUrl, 'https://boxhead-game.onrender.com/healthz');
  assert.strictEqual(renderConfig.keepAliveIntervalMs, 780000);

  // Arrange & Act 2: Explicit KEEP_ALIVE_URL overrides and auto-enables on docker preset
  const dockerCustom = resolveDeployConfig({
    DEPLOY_PLATFORM: 'docker',
    KEEP_ALIVE_URL: 'https://my-koyeb-app.koyeb.app/healthz',
    KEEP_ALIVE_INTERVAL_MS: '600000'
  });

  // Assert 2
  assert.strictEqual(dockerCustom.keepAliveEnabled, true);
  assert.strictEqual(dockerCustom.keepAliveUrl, 'https://my-koyeb-app.koyeb.app/healthz');
  assert.strictEqual(dockerCustom.keepAliveIntervalMs, 600000);

  // Arrange & Act 3: Explicit AUTO_PING_ENABLED=false disables keep-alive even on Render
  const disabledRender = resolveDeployConfig({
    RENDER: 'true',
    RENDER_EXTERNAL_URL: 'https://boxhead-game.onrender.com',
    AUTO_PING_ENABLED: 'false'
  });

  // Assert 3
  assert.strictEqual(disabledRender.keepAliveEnabled, false);

  // Arrange & Act 4: LAN disables keep-alive by default and rejects invalid URLs/intervals
  const lanInvalid = resolveDeployConfig({
    KEEP_ALIVE_URL: 'ftp://invalid.local',
    KEEP_ALIVE_INTERVAL_MS: '50'
  });

  // Assert 4
  assert.strictEqual(lanInvalid.keepAliveEnabled, false);
  assert.strictEqual(lanInvalid.keepAliveUrl, '');
  assert.strictEqual(lanInvalid.keepAliveIntervalMs, 780000);
});
