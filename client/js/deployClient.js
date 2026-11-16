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
