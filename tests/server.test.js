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
