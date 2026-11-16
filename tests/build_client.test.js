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
