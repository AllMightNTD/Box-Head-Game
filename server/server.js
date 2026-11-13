const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const { socketHandler } = require('./socketHandler.js');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function startServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: { origin: '*' }
    });

    const clientPath = path.join(__dirname, '../client');
    app.use(express.static(clientPath));

    app.get('/api/info', (req, res) => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      res.json({
        lanIp: getLanIp(),
        port: actualPort
      });
    });

    const { getMapList } = require('./game/MapConfig.js');
    app.get('/api/maps', (req, res) => {
      res.json(getMapList());
    });

    // Attach socket lobby/game handler
    socketHandler(io);

    server.listen(port, '0.0.0.0', () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({ app, server, io, port: actualPort, getLanIp });
    });

    server.on('error', reject);
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  startServer(PORT).then(({ port, getLanIp }) => {
    const lanIp = getLanIp();
    console.log('====================================================');
    console.log('   BOXHEAD MULTIPLAYER LAN SERVER (1-4 PLAYERS)    ');
    console.log('====================================================');
    console.log(`[Host] Local Machine:     http://localhost:${port}`);
    console.log(`[LAN]  Cac may cung mang: http://${lanIp}:${port}`);
    console.log('====================================================');
    console.log('San sang chien zombie! Mo trinh duyet de vao choi...');
  }).catch((err) => {
    console.error('Loi khoi dong server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, getLanIp };
