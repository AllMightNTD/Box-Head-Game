(function () {
  // Preload all Character and Zombie sprite sheets
  if (window.spriteManager) {
    window.spriteManager.preloadAll().catch(err => console.warn('Sprite preload error:', err));
  }

  const socket = io();
  const canvas = document.getElementById('gameCanvas');
  const renderer = new Renderer(canvas);
  const input = new InputHandler(canvas);
  const interpolator = new Interpolator();
  const ui = new UIController();

  let myPlayerId = null;
  let isInGame = false;
  let lastFrameTime = performance.now();

  // Active Map Configuration
  let currentMapId = window.DEFAULT_MAP_ID || 'THE_ROOMS';
  let currentMap = (window.MAPS_CONFIG && window.MAPS_CONFIG[currentMapId]) || null;

  function updateActiveMap(mapId) {
    if (!mapId || !window.MAPS_CONFIG) return;
    if (window.MAPS_CONFIG[mapId]) {
      currentMapId = mapId;
      currentMap = window.MAPS_CONFIG[mapId];
    }
  }

  // Window resize
  window.addEventListener('resize', () => renderer.resize());
  renderer.resize();

  // Weapon slot mapping
  const WEAPON_KEYS = ['PISTOL', 'UZI', 'SHOTGUN', 'BARRICADE', 'BARREL', 'GRENADE', 'ROCKET', 'RAILGUN'];

  // Pending local weapon switch (guards against stale server snapshots reverting the choice)
  let pendingWeapon = null; // { id, at }
  const PENDING_WEAPON_TIMEOUT_MS = 600;

  function trySwitchWeapon(slotIndex, weaponId) {
    const wid = weaponId || WEAPON_KEYS[slotIndex - 1];
    if (!wid) return;

    // Check if unlocked before attempting to switch
    const state = interpolator.getInterpolatedState();
    const localPlayer = state && state.players ? (state.players.find(p => p.id === myPlayerId) || state.players[0]) : null;
    const def = ui.weaponDefinitions.find(w => w.id === wid);

    if (localPlayer && def) {
      const pw = localPlayer.weapons ? localPlayer.weapons[wid] : null;
      const maxP = Math.max(localPlayer.maxCombo || 1, localPlayer.combo || 1);
      const isUnlocked = Boolean((pw && pw.unlocked) || (maxP >= def.unlockCombo) || wid === 'PISTOL');
      if (!isUnlocked) {
        renderer.addFloatingText(`Cần Combo x${def.unlockCombo} để mở!`, renderer.camera.x, renderer.camera.y + 60, '#ff1744', 22);
        return;
      }
    }

    // Silent update: do NOT re-trigger onWeaponChange (prevents infinite recursion)
    input.setWeaponSlot(slotIndex, true);
    pendingWeapon = { id: wid, at: performance.now() };

    // Send the FULL input payload so movement keys are preserved while switching
    if (isInGame) {
      socket.emit('player:input', input.getInputPayload());
    }
  }

  input.onWeaponChange = (slotIndex, weaponId) => {
    trySwitchWeapon(slotIndex, weaponId);
  };

  ui.onSelectWeapon = (slotIndex, weaponId) => {
    trySwitchWeapon(slotIndex, weaponId);
  };

  // Host map change handler
  ui.onSelectMap = (mapId) => {
    socket.emit('room:selectMap', { mapId });
  };

  // ESC Menu Handling
  input.onTogglePause = () => {
    if (isInGame) {
      const isOpened = ui.togglePauseMenu();
      if (isOpened) {
        input.resetKeys();
      }
    }
  };

  // Ultimate Activation (F or Right-Click)
  input.onUltimate = (angle) => {
    if (!isInGame) return;
    if (ui.modalPause && !ui.modalPause.classList.contains('hidden')) return;
    if (ui.modalGameOver && !ui.modalGameOver.classList.contains('hidden')) return;
    socket.emit('player:ultimate', { angle });
  };

  if (ui.btnResumeGame) {
    ui.btnResumeGame.addEventListener('click', () => {
      ui.togglePauseMenu();
    });
  }

  if (ui.btnPauseLeave) {
    ui.btnPauseLeave.addEventListener('click', () => {
      socket.emit('room:leave');
      isInGame = false;
      renderer.resetSession();
      interpolator.snapshots = [];
      ui.showScreen('lobby');
    });
  }

  // --- LOBBY ACTIONS ---
  ui.btnCreateRoom.addEventListener('click', () => {
    const roomName = ui.roomNameInput.value.trim() || 'Phòng Chiến Đấu';
    const playerName = ui.nicknameInput.value.trim() || 'Hero';
    const mapId = ui.selectedMapId || currentMapId;
    socket.emit('room:create', { roomName, playerName, character: 'HUMAN', mapId });
  });

  ui.btnLeaveRoom.addEventListener('click', () => {
    socket.emit('room:leave');
    isInGame = false;
    renderer.resetSession();
    interpolator.snapshots = [];
    ui.showScreen('lobby');
  });

  ui.btnReady.addEventListener('click', () => {
    if (!ui.currentRoom) return;
    const myPlayer = ui.currentRoom.players.find(p => p.id === myPlayerId);
    if (myPlayer) {
      socket.emit('room:ready', { ready: !myPlayer.ready });
    }
  });

  ui.btnStartGame.addEventListener('click', () => {
    socket.emit('room:start');
  });

  ui.btnRestartGame.addEventListener('click', () => {
    socket.emit('room:restart');
  });

  ui.btnBackLobby.addEventListener('click', () => {
    socket.emit('room:leave');
    isInGame = false;
    renderer.resetSession();
    interpolator.snapshots = [];
    ui.showScreen('lobby');
  });

  // Character selection
  ui.charButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const char = btn.getAttribute('data-char');
      socket.emit('room:selectChar', { character: char });
    });
  });

  function handleJoinRoom(roomId) {
    const playerName = ui.nicknameInput.value.trim() || 'Hero';
    socket.emit('room:join', { roomId, playerName }, (res) => {
      if (res && !res.success) {
        alert(res.error || 'Không thể vào phòng!');
      }
    });
  }

  // URL Hash Auto-join support (e.g. #room=xxxx or ?room=xxxx)
  let autoJoinAttempted = false;
  function getTargetRoomFromUrl() {
    const hash = window.location.hash;
    const match = hash.match(/#room=([^&]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
    const search = new URLSearchParams(window.location.search);
    return search.get('room');
  }

  // --- SOCKET LISTENERS ---
  socket.on('lobby:roomList', (rooms) => {
    ui.renderRoomsList(rooms, handleJoinRoom);

    // Auto join room if invited by URL link
    if (!autoJoinAttempted && !isInGame && (!ui.currentRoom || !myPlayerId)) {
      const targetId = getTargetRoomFromUrl();
      if (targetId) {
        const targetRoom = rooms.find(r => r.id === targetId);
        if (targetRoom && targetRoom.playerCount < 4 && targetRoom.state !== 'PLAYING') {
          autoJoinAttempted = true;
          handleJoinRoom(targetId);
        }
      }
    }
  });

  socket.on('room:joined', ({ room, playerId }) => {
    myPlayerId = playerId;
    if (room && room.mapId) {
      updateActiveMap(room.mapId);
      ui.selectedMapId = room.mapId;
    }
    ui.showScreen('room');
    ui.renderRoomLobby(room, myPlayerId);
  });

  socket.on('room:update', (room) => {
    if (ui.currentRoom && ui.currentRoom.id === room.id) {
      if (room && room.mapId) {
        updateActiveMap(room.mapId);
        ui.selectedMapId = room.mapId;
      }
      ui.renderRoomLobby(room, myPlayerId);
    }
  });

  socket.on('room:gameStarted', (data) => {
    isInGame = true;
    if (data && data.mapId) {
      updateActiveMap(data.mapId);
    }
    ui.showScreen('game');
    renderer.resetSession();
    interpolator.snapshots = [];
    input.resetKeys();
    input.setWeaponSlot(1, true);
    pendingWeapon = null;
    if (window.soundManager) window.soundManager.ensureContext();
  });

  socket.on('game:snapshot', (snapshot) => {
    interpolator.addSnapshot(snapshot);

    if (snapshot && snapshot.mapId && snapshot.mapId !== currentMapId) {
      updateActiveMap(snapshot.mapId);
    }

    // Sync input handler selected weapon if server changed it (e.g. out of ammo).
    // Ignore stale snapshots while a local switch is still awaiting server confirmation.
    const localPlayer = snapshot.players && (snapshot.players.find(p => p.id === myPlayerId) || snapshot.players[0]);
    if (localPlayer && localPlayer.selectedWeapon) {
      const serverWeapon = localPlayer.selectedWeapon;
      if (pendingWeapon) {
        const expired = performance.now() - pendingWeapon.at > PENDING_WEAPON_TIMEOUT_MS;
        if (serverWeapon === pendingWeapon.id || expired) {
          pendingWeapon = null; // confirmed by server (or gave up waiting)
        }
      }
      if (!pendingWeapon) {
        const idx = WEAPON_KEYS.indexOf(serverWeapon);
        if (idx !== -1 && input.selectedWeaponSlot !== idx + 1) {
          input.setWeaponSlot(idx + 1, true);
        }
      }
    }

    // Process events (Sound effects, particles, floating texts)
    if (snapshot.events && snapshot.events.length > 0) {
      for (let i = 0; i < snapshot.events.length; i++) {
        const ev = snapshot.events[i];
        handleGameEvent(ev, snapshot);
      }
    }
  });

  function handleGameEvent(ev, snapshot) {
    const snd = window.soundManager;

    if (ev.type === 'SHOOT') {
      if (snd) snd.playShoot(ev.weapon);
      renderer.addMuzzleFlash(ev.x, ev.y, ev.angle);

    } else if (ev.type === 'ULTIMATE') {
      if (snd && typeof snd.playUltimate === 'function') {
        snd.playUltimate(ev.ultId);
      }
      if (renderer) {
        if (ev.ultId === 'SEISMIC_SLAM') {
          if (typeof renderer.addShockwave === 'function') {
            renderer.addShockwave(ev.x, ev.y, ev.radius || 220, '#ff9800');
          }
          renderer.addFloatingText('SEISMIC SLAM!', ev.x, ev.y - 30, '#ffb74d', 28);
        } else if (ev.ultId === 'BLINK_FROST_NOVA') {
          if (typeof renderer.addBlinkTrail === 'function') {
            renderer.addBlinkTrail(ev.fromX, ev.fromY, ev.toX, ev.toY, '#00e5ff');
          }
          if (typeof renderer.addShockwave === 'function') {
            renderer.addShockwave(ev.fromX, ev.fromY, ev.radius || 140, '#00e5ff');
            renderer.addShockwave(ev.toX, ev.toY, ev.radius || 140, '#00e5ff');
          }
          renderer.addFloatingText('FROST NOVA!', ev.toX, ev.toY - 30, '#80d8ff', 26);
        } else if (ev.ultId === 'TACTICAL_DRONE') {
          if (typeof renderer.addShockwave === 'function') {
            renderer.addShockwave(ev.x, ev.y, 80, '#00e676');
          }
          renderer.addFloatingText('TACTICAL DRONE & AURA!', ev.x, ev.y - 30, '#69f0ae', 26);
        }
      }

    } else if (ev.type === 'HIT') {
      if (snd) snd.playZombieHit();
      renderer.addBlood(ev.x, ev.y, 4);

    } else if (ev.type === 'ZOMBIE_DIE') {
      if (snd) snd.playZombieDie();
      renderer.addBlood(ev.x, ev.y, 10, ev.zType === 'DEVIL' ? '#c62828' : '#33691e');
      renderer.addZombieCorpse(ev);

    } else if (ev.type === 'EXPLOSION') {
      if (snd) snd.playExplosion(ev.radius > 120 ? 1.4 : 1.0);
      renderer.addExplosionParticles(ev.x, ev.y, ev.radius);

    } else if (ev.type === 'UNLOCKED') {
      if (snd) snd.playComboUpgrade();
      const p = snapshot.players.find(x => x.id === ev.playerId);
      const name = p ? p.name : 'Bạn';
      renderer.addFloatingText(`${name} MỞ KHÓA: ${ev.weapon}!`, p ? p.x : 800, p ? p.y - 40 : 500, '#ffd600', 26);

    } else if (ev.type === 'WAVE_START') {
      renderer.addFloatingText(`WAVE ${ev.wave} BẮT ĐẦU!`, renderer.camera.x, renderer.camera.y - 80, '#ff3d00', 38);

    } else if (ev.type === 'WAVE_CLEAR') {
      if (snd) snd.playWaveClear();
      renderer.addFloatingText(`WAVE ${ev.wave} HOÀN THÀNH!`, renderer.camera.x, renderer.camera.y - 80, '#00e676', 36);

    } else if (ev.type === 'GAME_OVER') {
      if (snd) snd.playGameOver();

    } else if (ev.type === 'PICKUP') {
      if (snd) snd.playPickup();

    } else if (ev.type === 'REVIVE') {
      renderer.addFloatingText('ĐÃ HỒI SINH ĐỒNG ĐỘI!', renderer.camera.x, renderer.camera.y - 40, '#00e5ff', 24);

    } else if (ev.type === 'SESSION_RESET') {
      renderer.resetSession();
      interpolator.snapshots = [];
      input.resetKeys();
      input.setWeaponSlot(1, true);
      pendingWeapon = null;
      if (ui.modalGameOver) ui.modalGameOver.classList.add('hidden');
      if (ui.modalPause) ui.modalPause.classList.add('hidden');
    }
  }

  // Input sending timer (40Hz = 25ms)
  setInterval(() => {
    if (isInGame) {
      socket.emit('player:input', input.getInputPayload());
    }
  }, 25);

  // --- RENDER GAME LOOP ---
  function gameLoop(now) {
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    renderer.updateVisuals(dt, currentMap);

    if (isInGame) {
      const state = interpolator.getInterpolatedState();
      if (state) {
        renderer.render(state, myPlayerId, currentMap);
        ui.updateHUD(state, myPlayerId);
      }
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
