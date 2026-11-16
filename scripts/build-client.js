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

function resolveSocketIoClientMinPath() {
  try {
    const serverEntry = require.resolve('socket.io');
    const p1 = path.resolve(path.dirname(serverEntry), '../client-dist/socket.io.min.js');
    if (fs.existsSync(p1)) return p1;
  } catch {}
  try {
    const clientEntry = require.resolve('socket.io-client');
    const p2 = path.resolve(path.dirname(clientEntry), '../../dist/socket.io.min.js');
    if (fs.existsSync(p2)) return p2;
  } catch {}
  return path.resolve(__dirname, '../node_modules/socket.io/client-dist/socket.io.min.js');
}

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
  const socketIoMinPath = resolveSocketIoClientMinPath();
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
