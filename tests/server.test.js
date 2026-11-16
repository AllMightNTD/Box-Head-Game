const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { startServer } = require('../server/server.js');

test('Server starts and responds with LAN IP info', async (t) => {
  const { server, port, getLanIp } = await startServer(0);
  t.after(() => server.close());

  const lanIp = getLanIp();
  assert.ok(lanIp, 'LAN IP should be resolved');

  const res = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/api/info`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.lanIp, lanIp);
  assert.strictEqual(res.body.port, port);
});

test('Server serves weapon audio WAV assets statically', async () => {
  const instance = await startServer(0);
  const port = instance.port;

  try {
    const status = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/assets/audio/weapons/pistol/fire_1.wav`, res => {
        res.resume();
        resolve(res.statusCode);
      }).on('error', reject);
    });
    assert.strictEqual(status, 200);
  } finally {
    await new Promise(resolve => instance.server.close(resolve));
  }
});

test('Server statically serves zombie WAV audio assets and zombieAudio.js script', async (t) => {
  const { server, port } = await startServer(0);
  t.after(() => server.close());

  const wavRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/assets/audio/zombies/rotten/idle_1.wav`, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });

  assert.strictEqual(wavRes.statusCode, 200);
  assert.strictEqual(wavRes.body.subarray(0, 4).toString('ascii'), 'RIFF');

  const jsRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/js/zombieAudio.js`, (res) => {
      res.resume();
      res.on('end', () => resolve({ statusCode: res.statusCode }));
    }).on('error', reject);
  });
  assert.strictEqual(jsRes.statusCode, 200);
});

