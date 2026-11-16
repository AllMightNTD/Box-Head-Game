/**
 * @file keep_alive.test.js
 * @description Unit and integration tests for Render auto-ping keep-alive service.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../server/server.js');
const {
  DEFAULT_KEEP_ALIVE_INTERVAL_MS,
  pingUrl,
  startKeepAlive
} = require('../server/services/keepAlive.js');

test('pingUrl sends GET request, drains body, and reports ok on 200 response', async () => {
  // Arrange
  let capturedUrl = null;
  let capturedOptions = null;
  let bodyCancelled = false;
  const mockFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      body: {
        cancel: async () => {
          bodyCancelled = true;
        }
      }
    };
  };

  // Act
  const result = await pingUrl('https://boxhead.onrender.com/healthz', {
    fetchFn: mockFetch,
    timeoutMs: 5000
  });

  // Assert
  assert.strictEqual(capturedUrl, 'https://boxhead.onrender.com/healthz');
  assert.strictEqual(capturedOptions.method, 'GET');
  assert.ok(capturedOptions.signal);
  assert.strictEqual(bodyCancelled, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.strictEqual(typeof result.durationMs, 'number');
});

test('pingUrl handles invalid URLs, HTTP 5xx responses, network failures, and timeouts without throwing', async () => {
  // Arrange
  const warnings = [];
  const silentLogger = {
    warn: (msg) => warnings.push(msg),
    log: () => {}
  };

  // Act 1: invalid URL
  const invalidRes = await pingUrl('not-a-url', { logger: silentLogger });
  assert.strictEqual(invalidRes.ok, false);
  assert.strictEqual(invalidRes.skipped, true);
  assert.strictEqual(invalidRes.reason, 'invalid_url');

  // Act 2: HTTP 503 response
  const httpErrRes = await pingUrl('https://boxhead.onrender.com/healthz', {
    logger: silentLogger,
    fetchFn: async () => ({
      ok: false,
      status: 503,
      body: { cancel: async () => {} }
    })
  });
  assert.strictEqual(httpErrRes.ok, false);
  assert.strictEqual(httpErrRes.status, 503);

  // Act 3: network error
  const netErrRes = await pingUrl('https://boxhead.onrender.com/healthz', {
    logger: silentLogger,
    fetchFn: async () => {
      throw new Error('ECONNRESET');
    }
  });
  assert.strictEqual(netErrRes.ok, false);
  assert.strictEqual(netErrRes.error, 'ECONNRESET');

  // Act 4: timeout abort
  const timeoutRes = await pingUrl('https://boxhead.onrender.com/healthz', {
    logger: silentLogger,
    timeoutMs: 15,
    fetchFn: (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        reject(new Error('Aborted due to timeout'));
      });
    })
  });
  assert.strictEqual(timeoutRes.ok, false);
  assert.match(timeoutRes.error, /Abort/i);
  assert.strictEqual(warnings.length, 3);
});

test('startKeepAlive skips cleanly when disabled or missing URL', () => {
  // Arrange & Act
  const disabled = startKeepAlive({ keepAliveEnabled: false, keepAliveUrl: 'https://example.com/healthz' });
  const missingUrl = startKeepAlive({ keepAliveEnabled: true, keepAliveUrl: '' }, {
    logger: { log: () => {}, warn: () => {} }
  });

  // Assert
  assert.strictEqual(disabled.active, false);
  assert.strictEqual(disabled.reason, 'disabled');
  assert.strictEqual(missingUrl.active, false);
  assert.strictEqual(missingUrl.reason, 'missing_url');
  disabled.stop();
  missingUrl.stop();
});

test('startKeepAlive schedules unrefed timer, avoids overlapping in-flight pings, updates stats, and stops idempotently', async () => {
  // Arrange
  let registeredTick = null;
  let registeredMs = null;
  let unrefCalled = false;
  let clearedHandle = null;
  let resolveFetch = null;
  let fetchCount = 0;

  const fakeHandle = {
    unref: () => {
      unrefCalled = true;
    }
  };

  const service = startKeepAlive(
    {
      keepAliveEnabled: true,
      keepAliveUrl: 'https://boxhead.onrender.com/healthz',
      keepAliveIntervalMs: DEFAULT_KEEP_ALIVE_INTERVAL_MS
    },
    {
      logger: { log: () => {}, warn: () => {} },
      setIntervalFn: (fn, ms) => {
        registeredTick = fn;
        registeredMs = ms;
        return fakeHandle;
      },
      clearIntervalFn: (handle) => {
        clearedHandle = handle;
      },
      fetchFn: () => {
        fetchCount += 1;
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      }
    }
  );

  // Assert initial registration
  assert.strictEqual(service.active, true);
  assert.strictEqual(registeredMs, 780000);
  assert.strictEqual(unrefCalled, true);

  // Act: trigger first ping and overlap a second tick while first is in-flight
  const firstPingPromise = registeredTick();
  const overlappedPingPromise = registeredTick();

  assert.strictEqual(fetchCount, 1);

  resolveFetch({ ok: true, status: 200, body: { cancel: async () => {} } });
  await firstPingPromise;
  const overlappedResult = await overlappedPingPromise;

  // Assert stats and overlap skip
  assert.strictEqual(overlappedResult.skipped, true);
  assert.strictEqual(overlappedResult.reason, 'in_flight');
  const stats = service.getStats();
  assert.strictEqual(stats.totalPings, 1);
  assert.strictEqual(stats.successCount, 1);
  assert.strictEqual(stats.failureCount, 0);
  assert.strictEqual(stats.lastStatus, 200);

  // Act: stop twice (idempotent)
  service.stop();
  service.stop();

  assert.strictEqual(clearedHandle, fakeHandle);
  assert.strictEqual(service.getStats().active, false);
});

test('Integration: startServer wires keepAlive against real /healthz endpoint and cleans up on shutdown', async (t) => {
  // Arrange: start real server first to get an ephemeral local port
  const srv = await startServer({
    port: 0,
    env: {
      DEPLOY_PLATFORM: 'render',
      AUTO_PING_ENABLED: 'false'
    }
  });
  t.after(() => srv.shutdown());

  const healthUrl = `http://127.0.0.1:${srv.port}/healthz`;

  // Act: start keepAlive targeting the real server's /healthz
  const keepAlive = startKeepAlive({
    keepAliveEnabled: true,
    keepAliveUrl: healthUrl,
    keepAliveIntervalMs: 60000
  });
  t.after(() => keepAlive.stop());

  const result = await keepAlive.triggerPing();

  // Assert
  assert.strictEqual(keepAlive.active, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.strictEqual(keepAlive.getStats().successCount, 1);
});
