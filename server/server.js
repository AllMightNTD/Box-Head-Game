const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Server } = require('socket.io');
const { socketHandler } = require('./socketHandler.js');
const { getMapList } = require('./game/MapConfig.js');
const { resolveDeployConfig, renderClientConfigScript } = require('./config/deployConfig.js');

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

function resolveSocketIoClientDist() {
  try {
    const serverEntry = require.resolve('socket.io');
    const clientDist = path.resolve(path.dirname(serverEntry), '../client-dist');
    if (fs.existsSync(path.join(clientDist, 'socket.io.min.js'))) {
      return clientDist;
    }
  } catch {}
  try {
    const clientEntry = require.resolve('socket.io-client');
    const clientDist = path.resolve(path.dirname(clientEntry), '../../dist');
    if (fs.existsSync(path.join(clientDist, 'socket.io.min.js'))) {
      return clientDist;
    }
  } catch {}
  return path.join(__dirname, '../node_modules/socket.io/client-dist');
}

function resolveAllowedOriginHeader(requestOrigin, corsOrigin) {
  if (corsOrigin === '*') return '*';
  if (!requestOrigin || !Array.isArray(corsOrigin)) return null;
  return corsOrigin.includes(requestOrigin) ? requestOrigin : null;
}

function createCorsMiddleware(corsOrigin) {
  return (req, res, next) => {
    const allowed = resolveAllowedOriginHeader(req.headers.origin, corsOrigin);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      if (allowed !== '*') {
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

function parseStartArgs(portOrOptions, extraOptions) {
  if (portOrOptions && typeof portOrOptions === 'object') {
    const { port, env, overrides } = portOrOptions;
    return {
      explicitPort: port,
      env: env || process.env,
      overrides: overrides || {}
    };
  }
  const safeExtra = extraOptions && typeof extraOptions === 'object' ? extraOptions : {};
  return {
    explicitPort: portOrOptions,
    env: safeExtra.env || process.env,
    overrides: safeExtra.overrides || {}
  };
}

function startServer(portOrOptions = 3000, extraOptions = {}) {
  const { explicitPort, env, overrides } = parseStartArgs(portOrOptions, extraOptions);
  const config = resolveDeployConfig(env, {
    ...overrides,
    ...(explicitPort !== undefined ? { port: explicitPort } : {})
  });

  return new Promise((resolve, reject) => {
    const app = express();
    if (config.trustProxy) {
      app.set('trust proxy', 1);
    }

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST']
      },
      transports: [...config.socketTransports],
      pingInterval: config.pingIntervalMs,
      pingTimeout: config.pingTimeoutMs
    });

    app.use(createCorsMiddleware(config.corsOrigin));

    const roomRegistry = socketHandler(io, {
      maxRooms: config.maxRooms,
      roomOptions: {
        simulationHz: config.simulationHz,
        snapshotHz: config.snapshotHz
      }
    });

    app.get(config.healthCheckPath, (req, res) => {
      res.status(200).json({
        status: 'ok',
        platform: config.platform,
        mode: config.mode,
        uptimeSec: Math.floor(process.uptime()),
        rooms: roomRegistry.rooms.size
      });
    });

    app.get('/config.js', (req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(renderClientConfigScript(config));
    });

    const socketIoClientDist = resolveSocketIoClientDist();
    app.use('/vendor', express.static(socketIoClientDist, {
      maxAge: config.staticMaxAgeSec * 1000
    }));

    app.get('/api/info', (req, res) => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : config.port;
      res.json({
        lanIp: config.exposeLanIp ? getLanIp() : null,
        port: actualPort,
        platform: config.platform,
        mode: config.mode,
        exposeLanIp: config.exposeLanIp
      });
    });

    app.get('/api/maps', (req, res) => {
      res.json(getMapList());
    });

    if (config.serveStatic) {
      const clientPath = path.join(__dirname, '../client');
      app.use(express.static(clientPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('config.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (config.staticMaxAgeSec > 0) {
            res.setHeader('Cache-Control', `public, max-age=${config.staticMaxAgeSec}`);
          }
        }
      }));
    } else {
      app.get('/', (req, res) => {
        res.json({
          service: 'boxhead-multiplayer-backend',
          status: 'ok',
          platform: config.platform,
          mode: config.mode,
          healthCheckPath: config.healthCheckPath
        });
      });
    }

    let isShuttingDown = false;
    function shutdown() {
      if (isShuttingDown) return Promise.resolve();
      isShuttingDown = true;

      for (const room of roomRegistry.rooms.values()) {
        if (room.gameRoom && typeof room.gameRoom.stop === 'function') {
          room.gameRoom.stop();
        }
      }
      roomRegistry.rooms.clear();

      return new Promise((closeResolve) => {
        io.close(() => {
          if (server.listening) {
            server.close(() => closeResolve());
          } else {
            closeResolve();
          }
        });
      });
    }

    server.listen(config.port, config.host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : config.port;
      resolve({ app, server, io, port: actualPort, getLanIp, config, shutdown });
    });

    server.on('error', reject);
  });
}

if (require.main === module) {
  const bootConfig = resolveDeployConfig(process.env);
  startServer({ env: process.env }).then(({ port, getLanIp: resolveLanIp, config, shutdown }) => {
    const lanIp = resolveLanIp();
    console.log('====================================================');
    console.log(`   BOXHEAD MULTIPLAYER SERVER (${config.platform.toUpperCase()} / ${config.mode})`);
    console.log('====================================================');
    console.log(`[Server] Listening:       http://${config.host}:${port}`);
    if (config.exposeLanIp) {
      console.log(`[LAN]    Cac may cung mang: http://${lanIp}:${port}`);
    }
    console.log(`[Config] Sim ${config.simulationHz}Hz | Snap ${config.snapshotHz}Hz | MaxRooms ${config.maxRooms}`);
    console.log(`[Health] Endpoint:        ${config.healthCheckPath}`);
    console.log('====================================================');

    const handleSignal = (signal) => {
      console.log(`[Server] Received ${signal}, shutting down cleanly...`);
      shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
    };
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
  }).catch((err) => {
    console.error('Loi khoi dong server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, getLanIp };
