/**
 * @file keepAlive.js
 * @description Periodic external HTTP keep-alive pinger to prevent free-tier PaaS instances (e.g. Render) from spinning down after 15m of idle traffic.
 */

'use strict';

const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 13 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

/**
 * Validates that a candidate target is a well-formed HTTP or HTTPS URL.
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isValidHttpUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

/**
 * Consumes or cancels a Fetch response body so Node.js undici sockets do not leak across intervals.
 * @param {Response} res
 * @param {{ warn?: Function }} logger
 */
async function safeDrainBody(res, logger) {
  try {
    if (res && res.body && typeof res.body.cancel === 'function') {
      await res.body.cancel();
    } else if (res && typeof res.text === 'function') {
      await res.text();
    }
  } catch (err) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(`[KeepAlive] Failed to drain response body: ${err.message}`);
    }
  }
}

/**
 * Executes a single bounded-timeout GET ping against a public healthcheck URL.
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<{ ok: boolean, status?: number, durationMs?: number, skipped?: boolean, reason?: string, error?: string }>}
 */
async function pingUrl(url, options = {}) {
  const logger = options.logger || console;
  if (!isValidHttpUrl(url)) {
    return { ok: false, skipped: true, reason: 'invalid_url' };
  }

  const fetchFn = options.fetchFn || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    return { ok: false, skipped: true, reason: 'fetch_unavailable' };
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let externalCleanup = null;
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else if (typeof options.signal.addEventListener === 'function') {
      const onExternalAbort = () => controller.abort();
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
      externalCleanup = () => options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();
  try {
    const res = await fetchFn(url.trim(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Boxhead-KeepAlive/1.0',
        ...(options.headers || {})
      }
    });
    await safeDrainBody(res, logger);

    const durationMs = Date.now() - startedAt;
    if (!res.ok) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn(`[KeepAlive] Ping returned HTTP ${res.status} (${durationMs}ms) -> ${url}`);
      }
      return { ok: false, status: res.status, durationMs };
    }
    return { ok: true, status: res.status, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err && err.message ? err.message : String(err);
    if (logger && typeof logger.warn === 'function') {
      logger.warn(`[KeepAlive] Ping failed (${durationMs}ms): ${message}`);
    }
    return { ok: false, error: message, durationMs };
  } finally {
    clearTimeout(timeoutHandle);
    if (externalCleanup) externalCleanup();
  }
}

/**
 * Normalizes KeepAlive configuration passed either as DeployConfig or direct options.
 * @param {object} configOrOptions
 */
function normalizeKeepAliveOptions(configOrOptions = {}) {
  const enabled = configOrOptions.keepAliveEnabled !== undefined
    ? Boolean(configOrOptions.keepAliveEnabled)
    : Boolean(configOrOptions.enabled);
  const url = typeof configOrOptions.keepAliveUrl === 'string'
    ? configOrOptions.keepAliveUrl.trim()
    : (typeof configOrOptions.url === 'string' ? configOrOptions.url.trim() : '');
  const rawInterval = configOrOptions.keepAliveIntervalMs !== undefined
    ? configOrOptions.keepAliveIntervalMs
    : configOrOptions.intervalMs;
  const intervalMs = Number.isFinite(Number(rawInterval)) && Number(rawInterval) >= 1000
    ? Math.trunc(Number(rawInterval))
    : DEFAULT_KEEP_ALIVE_INTERVAL_MS;

  return {
    enabled,
    url,
    intervalMs,
    timeoutMs: configOrOptions.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    runImmediately: Boolean(configOrOptions.runImmediately)
  };
}

/**
 * Starts the background keep-alive interval loop and returns a lifecycle controller.
 * @param {object} configOrOptions
 * @param {object} [deps]
 */
function startKeepAlive(configOrOptions = {}, deps = {}) {
  const opts = normalizeKeepAliveOptions(configOrOptions);
  const logger = deps.logger || console;
  const setIntervalFn = deps.setIntervalFn || setInterval;
  const clearIntervalFn = deps.clearIntervalFn || clearInterval;

  const stats = {
    active: false,
    stopped: false,
    url: opts.url,
    intervalMs: opts.intervalMs,
    totalPings: 0,
    successCount: 0,
    failureCount: 0,
    lastPingAt: null,
    lastStatus: null
  };

  if (!opts.enabled) {
    return {
      active: false,
      reason: 'disabled',
      stop() { stats.stopped = true; },
      triggerPing: async () => ({ ok: false, skipped: true, reason: 'disabled' }),
      getStats: () => ({ ...stats })
    };
  }

  if (!isValidHttpUrl(opts.url)) {
    return {
      active: false,
      reason: 'missing_url',
      stop() { stats.stopped = true; },
      triggerPing: async () => ({ ok: false, skipped: true, reason: 'missing_url' }),
      getStats: () => ({ ...stats })
    };
  }

  let isPinging = false;
  let intervalHandle = null;
  const serviceAbortController = new AbortController();

  async function triggerPing() {
    if (stats.stopped) {
      return { ok: false, skipped: true, reason: 'stopped' };
    }
    if (isPinging) {
      return { ok: false, skipped: true, reason: 'in_flight' };
    }
    isPinging = true;
    try {
      const result = await pingUrl(opts.url, {
        fetchFn: deps.fetchFn,
        timeoutMs: opts.timeoutMs,
        signal: serviceAbortController.signal,
        logger
      });
      if (!stats.stopped) {
        stats.totalPings += 1;
        stats.lastPingAt = new Date().toISOString();
        stats.lastStatus = result.status || null;
        if (result.ok) {
          stats.successCount += 1;
        } else {
          stats.failureCount += 1;
        }
      }
      return result;
    } finally {
      isPinging = false;
    }
  }

  stats.active = true;
  intervalHandle = setIntervalFn(triggerPing, opts.intervalMs);
  // Allow Node.js process to exit cleanly during SIGTERM without waiting for next keep-alive tick.
  if (intervalHandle && typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }

  if (opts.runImmediately) {
    triggerPing();
  }

  function stop() {
    if (stats.stopped) return;
    stats.stopped = true;
    stats.active = false;
    serviceAbortController.abort();
    if (intervalHandle !== null) {
      clearIntervalFn(intervalHandle);
      intervalHandle = null;
    }
  }

  return {
    active: true,
    url: opts.url,
    intervalMs: opts.intervalMs,
    stop,
    triggerPing,
    getStats: () => ({ ...stats })
  };
}

module.exports = {
  DEFAULT_KEEP_ALIVE_INTERVAL_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  isValidHttpUrl,
  pingUrl,
  startKeepAlive
};
