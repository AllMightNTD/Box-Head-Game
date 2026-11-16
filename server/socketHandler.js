const { GameRoom } = require('./game/GameRoom.js');
const { MAPS, DEFAULT_MAP_ID, getMapConfig } = require('./game/MapConfig.js');

const CHARACTERS = ['HUMAN', 'WARRIOR', 'MAGE', 'BAMBO', 'BON', 'BINGO', 'BERT'];

function socketHandler(io, options = {}) {
  const rooms = new Map();
  const maxRooms = Number.isFinite(options.maxRooms) && options.maxRooms > 0
    ? Math.floor(options.maxRooms)
    : 50;
  const roomOptions = options.roomOptions && typeof options.roomOptions === 'object'
    ? options.roomOptions
    : {};

  function getRoomList() {
    const list = [];
    for (const [id, room] of rooms.entries()) {
      const mapConf = getMapConfig(room.mapId);
      list.push({
        id,
        name: room.name,
        mapId: room.mapId || DEFAULT_MAP_ID,
        mapName: mapConf.name,
        mapBadge: mapConf.badge,
        playerCount: room.players.size,
        maxPlayers: 4,
        state: room.gameRoom ? room.gameRoom.state : room.state
      });
    }
    return list;
  }

  function getAvailableCharacter(room) {
    return 'HUMAN';
  }

  io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.emit('lobby:roomList', getRoomList());

    socket.on('lobby:listRooms', () => {
      socket.emit('lobby:roomList', getRoomList());
    });

    socket.on('room:create', (payload, callback) => {
      if (rooms.size >= maxRooms) {
        const error = `Máy chủ đang đầy (${maxRooms} phòng tối đa), vui lòng thử lại sau!`;
        if (typeof callback === 'function') {
          callback({ success: false, error });
        }
        socket.emit('room:error', { error });
        return;
      }

      const safePayload = payload && typeof payload === 'object' ? payload : {};
      const { roomName, playerName, character, mapId } = safePayload;
      const roomId = 'room_' + Math.random().toString(36).substring(2, 8);
      const name = (typeof roomName === 'string' && roomName.trim() ? roomName : 'Phong ' + roomId).trim().substring(0, 24);
      const playerNick = (typeof playerName === 'string' && playerName.trim() ? playerName : 'Hero').trim().substring(0, 16);
      const chosenMapId = MAPS[mapId] ? mapId : DEFAULT_MAP_ID;

      const gameRoom = new GameRoom(roomId, name, io, chosenMapId, roomOptions);
      const room = {
        id: roomId,
        name,
        mapId: chosenMapId,
        hostId: socket.id,
        state: 'LOBBY',
        players: new Map(),
        gameRoom
      };

      const selectedChar = CHARACTERS.includes(character) ? character : 'HUMAN';
      const player = {
        id: socket.id,
        name: playerNick,
        character: selectedChar,
        ready: true,
        isHost: true
      };

      room.players.set(socket.id, player);
      rooms.set(roomId, room);
      currentRoomId = roomId;

      gameRoom.addPlayer(socket.id, playerNick, selectedChar);

      socket.join(roomId);

      const roomData = serializeRoom(room);
      if (typeof callback === 'function') {
        callback({ success: true, room: roomData, playerId: socket.id });
      }

      socket.emit('room:joined', { room: roomData, playerId: socket.id });
      io.emit('lobby:roomList', getRoomList());
    });

    socket.on('room:join', ({ roomId, playerName, character }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng không tồn tại!' });
        return;
      }

      if (room.players.size >= 4) {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng đã đầy (Tối đa 4 người)!' });
        return;
      }

      const playerNick = (playerName || 'Hero').trim().substring(0, 16);
      let chosenChar = CHARACTERS.includes(character) ? character : 'HUMAN';

      const player = {
        id: socket.id,
        name: playerNick,
        character: chosenChar,
        ready: false,
        isHost: false
      };

      room.players.set(socket.id, player);
      currentRoomId = roomId;
      socket.join(roomId);

      if (room.gameRoom) {
        room.gameRoom.addPlayer(socket.id, playerNick, chosenChar);
      }

      const roomData = serializeRoom(room);
      if (typeof callback === 'function') {
        callback({ success: true, room: roomData, playerId: socket.id });
      }

      socket.emit('room:joined', { room: roomData, playerId: socket.id });
      io.to(roomId).emit('room:update', roomData);
      io.emit('lobby:roomList', getRoomList());
    });

    socket.on('room:selectChar', ({ character }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const player = room.players.get(socket.id);
      if (!player) return;

      if (CHARACTERS.includes(character)) {
        player.character = character;
        if (room.gameRoom) {
          const gameP = room.gameRoom.players.get(socket.id);
          if (gameP) {
            gameP.applyClassConfig(character);
          }
        }
        io.to(currentRoomId).emit('room:update', serializeRoom(room));
      }
    });

    socket.on('room:ready', ({ ready }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const player = room.players.get(socket.id);
      if (!player) return;

      player.ready = Boolean(ready);
      io.to(currentRoomId).emit('room:update', serializeRoom(room));
    });

    socket.on('room:selectMap', ({ mapId }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== socket.id) return;
      if (!MAPS[mapId]) return;

      room.mapId = mapId;
      if (room.gameRoom) {
        room.gameRoom.setMap(mapId);
      }
      io.to(currentRoomId).emit('room:update', serializeRoom(room));
      io.emit('lobby:roomList', getRoomList());
    });

    socket.on('room:start', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== socket.id) return;

      room.state = 'PLAYING';
      if (room.gameRoom) {
        room.gameRoom.startGame();
      }

      io.to(currentRoomId).emit('room:gameStarted', {
        roomId: currentRoomId,
        mapId: room.mapId,
        players: Array.from(room.players.values())
      });
      io.emit('lobby:roomList', getRoomList());
    });

    socket.on('room:restart', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const isGameOver = room.gameRoom && room.gameRoom.state === 'GAMEOVER';
      if (room.hostId !== socket.id && !isGameOver) return;

      room.state = 'PLAYING';
      if (room.gameRoom) {
        room.gameRoom.startGame();
      }
      io.to(currentRoomId).emit('room:gameStarted', {
        roomId: currentRoomId,
        mapId: room.mapId,
        players: Array.from(room.players.values())
      });
      io.emit('lobby:roomList', getRoomList());
    });

    // In-game real-time events
    socket.on('player:input', (input) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.gameRoom) {
        const player = room.gameRoom.players.get(socket.id);
        if (player) {
          player.applyInput(input);
        }
      }
    });

    socket.on('player:shoot', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.gameRoom) {
        room.gameRoom.handleShoot(socket.id);
      }
    });

    socket.on('player:placeItem', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.gameRoom) {
        room.gameRoom.handlePlaceItem(socket.id);
      }
    });

    socket.on('player:ultimate', (payload) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.gameRoom) {
        room.gameRoom.handleUltimate(socket.id, payload);
      }
    });

    socket.on('player:skill', (payload) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.gameRoom) {
        const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        room.gameRoom.handleSkill(socket.id, safePayload);
      }
    });

    function handleLeave() {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      room.players.delete(socket.id);
      if (room.gameRoom) {
        room.gameRoom.removePlayer(socket.id);
      }
      socket.leave(currentRoomId);

      if (room.players.size === 0) {
        if (room.gameRoom) room.gameRoom.stop();
        rooms.delete(currentRoomId);
      } else {
        if (room.hostId === socket.id) {
          const nextHost = room.players.values().next().value;
          if (nextHost) {
            nextHost.isHost = true;
            nextHost.ready = true;
            room.hostId = nextHost.id;
          }
        }
        io.to(currentRoomId).emit('room:update', serializeRoom(room));
      }

      currentRoomId = null;
      io.emit('lobby:roomList', getRoomList());
    }

    socket.on('room:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });

  function serializeRoom(room) {
    const mapConf = getMapConfig(room.mapId);
    return {
      id: room.id,
      name: room.name,
      mapId: room.mapId || DEFAULT_MAP_ID,
      mapName: mapConf.name,
      mapSubtitle: mapConf.subtitle,
      mapDesc: mapConf.desc,
      mapBadge: mapConf.badge,
      mapBadgeColor: mapConf.badgeColor,
      hostId: room.hostId,
      state: room.gameRoom ? room.gameRoom.state : room.state,
      players: Array.from(room.players.values()).map((p, idx) => ({
        ...p,
        playerIndex: idx
      }))
    };
  }

  return { rooms };
}

module.exports = { socketHandler, CHARACTERS };
