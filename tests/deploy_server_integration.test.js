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

test('startServer exposes keepAlive controller and stops it during graceful shutdown', async (t) => {
  // Arrange
  const srv = await startServer({
    port: 0,
    env: {
      DEPLOY_PLATFORM: 'render',
      KEEP_ALIVE_URL: 'https://example.onrender.com/healthz',
      AUTO_PING_ENABLED: 'true'
    }
  });
  t.after(() => srv.shutdown());

  // Assert active while running
  assert.ok(srv.keepAlive);
  assert.strictEqual(srv.keepAlive.active, true);

  // Act: shutdown
  await srv.shutdown();

  // Assert stopped cleanly
  assert.strictEqual(srv.keepAlive.getStats().active, false);
  assert.strictEqual(srv.keepAlive.getStats().stopped, true);
});
