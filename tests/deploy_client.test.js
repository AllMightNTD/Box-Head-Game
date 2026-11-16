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
