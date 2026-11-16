(function () {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  // Preload all Character and Zombie sprite sheets
  if (isBrowser && window.spriteManager) {
    window.spriteManager.preloadAll().catch(err => console.warn('Sprite preload error:', err));
  }

  // Kick off background raw WAV prefetch and capture-phase AudioContext unlock
  if (isBrowser && window.soundManager) {
    if (typeof window.soundManager.bindGestureUnlock === 'function') {
      window.soundManager.bindGestureUnlock(window);
    }
    if (typeof window.soundManager.init === 'function') {
      window.soundManager.init();
    }
    if (typeof window.soundManager.preloadZombieAudio === 'function') {
      const preloadPromise = window.soundManager.preloadZombieAudio();
      if (preloadPromise && typeof preloadPromise.catch === 'function') {
        preloadPromise.catch(err => console.warn('Zombie audio preload error:', err));
      }
    }
  }

  const socket = isBrowser && typeof io === 'function' ? io() : { on: () => {}, emit: () => {} };
  const canvas = isBrowser ? document.getElementById('gameCanvas') : null;
  const renderer = isBrowser && typeof Renderer === 'function' && canvas ? new Renderer(canvas) : null;
  const input = isBrowser && typeof InputHandler === 'function' && canvas ? new InputHandler(canvas) : {
    resetKeys: () => {},
    setWeaponSlot: () => {},
    getInputPayload: () => ({})
  };
  const interpolator = isBrowser && typeof Interpolator === 'function' ? new Interpolator() : {
    snapshots: [],
    addSnapshot: () => {},
    getInterpolatedState: () => null
  };
  const ui = isBrowser && typeof UIController === 'function' ? new UIController() : null;

  let myPlayerId = null;
  let isInGame = false;
  let lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Active Map Configuration
  let currentMapId = (typeof window !== 'undefined' && window.DEFAULT_MAP_ID) || 'THE_ROOMS';
  let currentMap = (typeof window !== 'undefined' && window.MAPS_CONFIG && window.MAPS_CONFIG[currentMapId]) || null;

  function updateActiveMap(mapId) {
    if (!mapId || !window.MAPS_CONFIG) return;
    if (window.MAPS_CONFIG[mapId]) {
      currentMapId = mapId;
      currentMap = window.MAPS_CONFIG[mapId];
    }
  }

  // Window resize
  if (isBrowser && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => renderer && renderer.resize());
    if (renderer) renderer.resize();
  }

  // Weapon slot mapping
  const WEAPON_KEYS = ['PISTOL', 'UZI', 'SHOTGUN', 'BARRICADE', 'BARREL', 'GRENADE', 'ROCKET', 'RAILGUN'];
  const WARRIOR_STANCES = ['BERSERKER_STANCE', 'JUGGERNAUT_STANCE'];

  // Pending local weapon switch (guards against stale server snapshots reverting the choice)
  let pendingWeapon = null; // { id, at }
  const PENDING_WEAPON_TIMEOUT_MS = 600;

  function trySwitchWeapon(slotIndex, weaponId) {
    if (input && input.isMageMode) {
      if (slotIndex >= 2 && slotIndex <= 8) {
        const isPaused = ui && ui.modalPause && !ui.modalPause.classList.contains('hidden');
        const isGameOver = ui && ui.modalGameOver && !ui.modalGameOver.classList.contains('hidden');
        if (isInGame && !isPaused && !isGameOver && socket) {
          if (renderer && renderer.camera && typeof input.updateWorldMouse === 'function') {
            input.updateWorldMouse(renderer.camera.x, renderer.camera.y, 1.15);
          }
          socket.emit('player:skill', {
            slot: slotIndex,
            angle: input.mouse.angle,
            targetX: input.mouse.worldX,
            targetY: input.mouse.worldY
          });
        }
      }
      return;
    }

    if (input && input.isWarriorMode) {
      if (slotIndex >= 3 && slotIndex <= 8) {
        // Direct skill cast click on HUD bar
        const isPaused = ui && ui.modalPause && !ui.modalPause.classList.contains('hidden');
        const isGameOver = ui && ui.modalGameOver && !ui.modalGameOver.classList.contains('hidden');
        if (isInGame && !isPaused && !isGameOver && socket) {
          socket.emit('player:skill', { slot: slotIndex, angle: input.mouse.angle });
        }
        return;
      }

      // Slots 1 and 2: Stance switch
      const stanceId = weaponId || WARRIOR_STANCES[slotIndex - 1];
      if (!stanceId) return;

      const state = interpolator.getInterpolatedState();
      const localPlayer = state && state.players ? (state.players.find(p => p.id === myPlayerId) || state.players[0]) : null;
      if (localPlayer && localPlayer.warriorState) {
        const skillState = localPlayer.warriorState.skills ? localPlayer.warriorState.skills[stanceId] : null;
        const playerMaxCombo = Math.max(localPlayer.maxCombo || 1, localPlayer.combo || 1);
        const def = ui.warriorSkillDefinitions ? ui.warriorSkillDefinitions.find(s => s.id === stanceId) : null;
        const unlockCombo = def ? def.unlockCombo : (slotIndex === 2 ? 5 : 1);
        const isUnlocked = Boolean((skillState && skillState.unlocked) || (playerMaxCombo >= unlockCombo) || stanceId === 'BERSERKER_STANCE');
        if (!isUnlocked) {
          renderer.addFloatingText(`Cần Combo x${unlockCombo} để mở!`, renderer.camera.x, renderer.camera.y + 60, '#ff1744', 22);
          return;
        }
      }

      input.setWeaponSlot(slotIndex, true);
      pendingWeapon = { id: stanceId, at: performance.now() };

      if (isInGame) {
        socket.emit('player:input', input.getInputPayload());
      }
      return;
    }

    // Standard Gun Arsenal switch
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

  if (input) {
    input.onWeaponChange = (slotIndex, weaponId) => {
      trySwitchWeapon(slotIndex, weaponId);
    };

    input.onSkillCast = (slot, angle, targetX, targetY) => {
      const isPaused = ui && ui.modalPause && !ui.modalPause.classList.contains('hidden');
      const isGameOver = ui && ui.modalGameOver && !ui.modalGameOver.classList.contains('hidden');
      if (isInGame && !isPaused && !isGameOver && socket) {
        if (renderer && renderer.camera && typeof input.updateWorldMouse === 'function') {
          input.updateWorldMouse(renderer.camera.x, renderer.camera.y, 1.15);
          targetX = input.mouse.worldX;
          targetY = input.mouse.worldY;
        }
        socket.emit('player:skill', { slot, angle, targetX, targetY });
      }
    };

    // ESC Menu Handling
    input.onTogglePause = () => {
      if (isInGame && ui) {
        const isOpened = ui.togglePauseMenu();
        if (isOpened) {
          input.resetKeys();
        }
      }
    };

    // Ultimate Activation (F or Right-Click)
    input.onUltimate = (angle, targetX, targetY) => {
      if (!isInGame) return;
      if (ui && ui.modalPause && !ui.modalPause.classList.contains('hidden')) return;
      if (ui && ui.modalGameOver && !ui.modalGameOver.classList.contains('hidden')) return;
      if (renderer && renderer.camera && typeof input.updateWorldMouse === 'function') {
        input.updateWorldMouse(renderer.camera.x, renderer.camera.y, 1.15);
        targetX = input.mouse.worldX;
        targetY = input.mouse.worldY;
      }
      socket.emit('player:ultimate', { angle, targetX, targetY });
    };
  }

  if (ui) {
    ui.onSelectWeapon = (slotIndex, weaponId) => {
      trySwitchWeapon(slotIndex, weaponId);
    };

    // Host map change handler
    ui.onSelectMap = (mapId) => {
      socket.emit('room:selectMap', { mapId });
    };

    if (ui.btnResumeGame) {
      ui.btnResumeGame.addEventListener('click', () => {
        ui.togglePauseMenu();
      });
    }

    if (ui.btnPauseLeave) {
      ui.btnPauseLeave.addEventListener('click', () => {
        if (window.soundManager && typeof window.soundManager.stopHorrorAmbience === 'function') {
          window.soundManager.stopHorrorAmbience();
        }
        socket.emit('room:leave');
        isInGame = false;
        if (renderer) renderer.resetSession();
        if (interpolator) interpolator.snapshots = [];
        ui.showScreen('lobby');
      });
    }

    // --- LOBBY ACTIONS ---
    if (ui.btnCreateRoom) {
      ui.btnCreateRoom.addEventListener('click', () => {
        const roomName = ui.roomNameInput.value.trim() || 'Phòng Chiến Đấu';
        const playerName = ui.nicknameInput.value.trim() || 'Hero';
        const mapId = ui.selectedMapId || currentMapId;
        socket.emit('room:create', { roomName, playerName, character: 'HUMAN', mapId });
      });
    }

    if (ui.btnLeaveRoom) {
      ui.btnLeaveRoom.addEventListener('click', () => {
        if (window.soundManager && typeof window.soundManager.stopHorrorAmbience === 'function') {
          window.soundManager.stopHorrorAmbience();
        }
        socket.emit('room:leave');
        isInGame = false;
        if (renderer) renderer.resetSession();
        if (interpolator) interpolator.snapshots = [];
        ui.showScreen('lobby');
      });
    }

    if (ui.btnReady) {
      ui.btnReady.addEventListener('click', () => {
        if (!ui.currentRoom) return;
        const myPlayer = ui.currentRoom.players.find(p => p.id === myPlayerId);
        if (myPlayer) {
          socket.emit('room:ready', { ready: !myPlayer.ready });
        }
      });
    }

    if (ui.btnStartGame) {
      ui.btnStartGame.addEventListener('click', () => {
        socket.emit('room:start');
      });
    }

    if (ui.btnRestartGame) {
      ui.btnRestartGame.addEventListener('click', () => {
        socket.emit('room:restart');
      });
    }

    if (ui.btnBackLobby) {
      ui.btnBackLobby.addEventListener('click', () => {
        if (window.soundManager && typeof window.soundManager.stopHorrorAmbience === 'function') {
          window.soundManager.stopHorrorAmbience();
        }
        socket.emit('room:leave');
        isInGame = false;
        if (renderer) renderer.resetSession();
        if (interpolator) interpolator.snapshots = [];
        ui.showScreen('lobby');
      });
    }

    // Character selection
    if (ui.charButtons) {
      ui.charButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const char = btn.getAttribute('data-char');
          socket.emit('room:selectChar', { character: char });
        });
      });
    }
  }

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
    if (ui) ui.showScreen('game');
    if (renderer) renderer.resetSession();
    if (interpolator) interpolator.snapshots = [];
    if (input) {
      input.resetKeys();
      input.setWeaponSlot(1, true);
    }
    pendingWeapon = null;
    if (typeof window !== 'undefined' && window.soundManager) {
      window.soundManager.ensureContext();
      if (typeof window.soundManager.preloadZombieAudio === 'function') {
        window.soundManager.preloadZombieAudio()
          .then((count) => {
            if (count === 0 && window.soundManager.zombieBank && !window.soundManager.zombieBank.hasAnyBuffers()) {
              console.warn('[Audio] Zombie WAV bank decoded 0 buffers:', window.soundManager.getAudioDiagnostics());
            }
          })
          .catch(err => console.warn('[Audio] Failed to decode zombie audio on game start:', err));
      }
    }
  });

  socket.on('game:snapshot', (snapshot) => {
    if (!interpolator) return;
    interpolator.addSnapshot(snapshot);

    if (snapshot && snapshot.mapId && snapshot.mapId !== currentMapId) {
      updateActiveMap(snapshot.mapId);
    }

    // Sync input handler selected weapon if server changed it (e.g. out of ammo).
    // Ignore stale snapshots while a local switch is still awaiting server confirmation.
    const localPlayer = snapshot && snapshot.players && (snapshot.players.find(p => p.id === myPlayerId) || snapshot.players[0]);
    if (localPlayer) {
      const isMage = localPlayer.character === 'MAGE';
      const isWarrior = localPlayer.character === 'WARRIOR';
      if (input) {
        input.isMageMode = isMage;
        input.isWarriorMode = isWarrior;
      }
      if (ui && typeof ui.setWeaponsBarMode === 'function') {
        const mode = isMage ? 'MAGE' : (isWarrior ? 'WARRIOR' : 'GUN');
        ui.setWeaponsBarMode(mode);
      }

      if (!isMage && localPlayer.selectedWeapon && input) {
        const serverWeapon = localPlayer.selectedWeapon;
        if (pendingWeapon) {
          const expired = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - pendingWeapon.at > PENDING_WEAPON_TIMEOUT_MS;
          if (serverWeapon === pendingWeapon.id || expired) {
            pendingWeapon = null; // confirmed by server (or gave up waiting)
          }
        }
        if (!pendingWeapon) {
          const slotKeys = isWarrior ? WARRIOR_STANCES : WEAPON_KEYS;
          const idx = slotKeys.indexOf(serverWeapon);
          if (idx !== -1 && input.selectedWeaponSlot !== idx + 1) {
            input.setWeaponSlot(idx + 1, true);
          }
        }
      }
    }

    // Process events (Sound effects, particles, floating texts)
    if (snapshot && snapshot.events && snapshot.events.length > 0) {
      for (let i = 0; i < snapshot.events.length; i++) {
        const ev = snapshot.events[i];
        handleGameEvent(ev, snapshot);
      }
    }
  });

  function handleShootEvent(ev, rnd, snd, myId, listenerX) {
    if (snd) snd.playShoot(ev.weapon, ev.x, listenerX);
    if (rnd) rnd.addMuzzleFlash(ev.x, ev.y, ev.angle, ev.weapon);
    if (ev.playerId === myId && ev.weapon !== 'DRONE' && rnd && typeof rnd.triggerScreenShake === 'function') {
      const shakeAmount = ev.weapon === 'SHOTGUN' ? 5 : ((ev.weapon === 'ROCKET' || ev.weapon === 'RAILGUN') ? 8 : 1.5);
      rnd.triggerScreenShake(shakeAmount);
    }
  }

  function handleUltimateEvent(ev, rnd, snd) {
    if (snd && typeof snd.playUltimate === 'function') {
      snd.playUltimate(ev.ultId);
    }
    if (!rnd) return;

    if (ev.ultId === 'AVATAR_OF_WAR') {
      if (typeof rnd.spawnWarriorVfx === 'function') {
        rnd.spawnWarriorVfx(ev);
      }
      if (typeof rnd.addFloatingText === 'function') {
        rnd.addFloatingText('AVATAR OF WAR!', ev.x, ev.y - 40, '#ff3d00', 32);
      }
    } else if (ev.ultId === 'SEISMIC_SLAM') {
      if (typeof rnd.addShockwave === 'function') {
        rnd.addShockwave(ev.x, ev.y, ev.radius || 220, '#ff9800');
      }
      rnd.addFloatingText('SEISMIC SLAM!', ev.x, ev.y - 30, '#ffb74d', 28);
    } else if (ev.ultId === 'BLINK_FROST_NOVA') {
      if (typeof rnd.addBlinkTrail === 'function') {
        rnd.addBlinkTrail(ev.fromX, ev.fromY, ev.toX, ev.toY, '#00e5ff');
      }
      if (typeof rnd.addShockwave === 'function') {
        rnd.addShockwave(ev.fromX, ev.fromY, ev.radius || 140, '#00e5ff');
        rnd.addShockwave(ev.toX, ev.toY, ev.radius || 140, '#00e5ff');
      }
      rnd.addFloatingText('FROST NOVA!', ev.toX, ev.toY - 30, '#80d8ff', 26);
    } else if (ev.ultId === 'TACTICAL_DRONE') {
      if (typeof rnd.addShockwave === 'function') {
        rnd.addShockwave(ev.x, ev.y, 80, '#00e676');
      }
      rnd.addFloatingText('TACTICAL DRONE & AURA!', ev.x, ev.y - 30, '#69f0ae', 26);
    } else if (ev.ultId === 'METEOR_STORM') {
      if (typeof rnd.spawnMageVfx === 'function') {
        rnd.spawnMageVfx(ev);
      }
      if (typeof rnd.addFloatingText === 'function') {
        rnd.addFloatingText('METEOR STORM!', ev.x, ev.y - 35, '#ff5722', 30);
      }
    }
  }

  const WARRIOR_EVENT_LABELS = {
    WARRIOR_COUNTER: { text: 'COUNTER!', yOffset: -35, color: '#00e5ff', size: 28 },
    WARRIOR_AVATAR_END: { text: 'AVATAR NOVA!', yOffset: -30, color: '#ff3d00', size: 28 }
  };

  function handleWarriorEvent(ev, rnd, snd) {
    if (rnd && typeof rnd.spawnWarriorVfx === 'function') {
      rnd.spawnWarriorVfx(ev);
    }
    if (snd && typeof snd.playWarriorSkill === 'function') {
      snd.playWarriorSkill(ev);
    }
    if (!rnd || typeof rnd.addFloatingText !== 'function') return;

    if (ev.type === 'WARRIOR_SKILL' && ev.skillId === 'WAR_CRY') {
      rnd.addFloatingText('WAR CRY!', ev.x, ev.y - 30, '#ffd600', 26);
      return;
    }
    const label = WARRIOR_EVENT_LABELS[ev.type];
    if (label) {
      rnd.addFloatingText(label.text, ev.x, ev.y + label.yOffset, label.color, label.size);
    }
  }

  function handleSessionReset(rnd, snd) {
    const sm = snd || (typeof window !== 'undefined' ? window.soundManager : null);
    if (sm && typeof sm.stopHorrorAmbience === 'function') {
      sm.stopHorrorAmbience();
    }
    if (rnd) rnd.resetSession();
    if (interpolator) interpolator.snapshots = [];
    if (input) {
      input.resetKeys();
      input.setWeaponSlot(1, true);
    }
    pendingWeapon = null;
    if (ui && ui.modalGameOver) ui.modalGameOver.classList.add('hidden');
    if (ui && ui.modalPause) ui.modalPause.classList.add('hidden');
  }

  function handleZombieAudioAndVfx(ev, rnd, snd, listenerX, listenerY) {
    if (ev.type === 'HIT') {
      if (snd) snd.playZombieHit(ev.zType, ev.weapon, ev.x, listenerX, ev.y, listenerY, ev.zombieId);
      if (rnd) rnd.addDirectionalBlood(ev.x, ev.y, typeof ev.angle === 'number' ? ev.angle : 0, ev.weapon, false);
    } else if (ev.type === 'ZOMBIE_DIE') {
      if (snd) snd.playZombieDie(ev.zType, ev.x, listenerX, ev.y, listenerY, ev.zombieId);
      const bloodColor = ev.zType === 'DEVIL' ? '#c62828' : '#7f0000';
      if (rnd) {
        rnd.addDirectionalBlood(ev.x, ev.y, typeof ev.killAngle === 'number' ? ev.killAngle : (ev.angle || 0), 'kill', true, bloodColor);
        rnd.addZombieCorpse(ev);
      }
    } else if (ev.type === 'ZOMBIE_ATTACK') {
      if (snd && typeof snd.playZombieAttack === 'function') {
        snd.playZombieAttack(ev.zType, ev.x, listenerX, ev.y, listenerY, ev.zombieId, ev.attackKind);
      }
    }
  }

  function handleGameEvent(ev, snapshot, context = {}) {
    const snd = context.soundManager !== undefined ? context.soundManager : (typeof window !== 'undefined' ? window.soundManager : null);
    const rnd = context.renderer !== undefined ? context.renderer : renderer;
    const myId = context.myPlayerId !== undefined ? context.myPlayerId : myPlayerId;
    const localPlayer = snapshot && snapshot.players ? (snapshot.players.find(p => p.id === myId) || snapshot.players[0]) : null;
    const listenerX = localPlayer ? localPlayer.x : (rnd && rnd.camera ? rnd.camera.x : 0);
    const listenerY = localPlayer ? localPlayer.y : (rnd && rnd.camera ? rnd.camera.y : 0);

    if (ev.type === 'SHOOT') {
      handleShootEvent(ev, rnd, snd, myId, listenerX);
    } else if (ev.type === 'ULTIMATE') {
      handleUltimateEvent(ev, rnd, snd);
    } else if (ev.type === 'MAGE_SKILL' || ev.type === 'MAGE_SHIELD_BREAK') {
      if (rnd && typeof rnd.spawnMageVfx === 'function') rnd.spawnMageVfx(ev);
      if (snd && typeof snd.playMageSkill === 'function') snd.playMageSkill(ev, listenerX, listenerY);
      if (ev.type === 'MAGE_SHIELD_BREAK' && rnd && typeof rnd.addFloatingText === 'function') {
        rnd.addFloatingText('SHIELD BROKEN!', ev.x, ev.y - 36, '#80d8ff', 22);
      }
    } else if (
      ev.type === 'WARRIOR_SKILL' ||
      ev.type === 'WARRIOR_COUNTER' ||
      ev.type === 'WARRIOR_MARK_EXPLODE' ||
      ev.type === 'WARRIOR_AVATAR_END'
    ) {
      handleWarriorEvent(ev, rnd, snd);
    } else if (ev.type === 'HIT' || ev.type === 'ZOMBIE_DIE' || ev.type === 'ZOMBIE_ATTACK') {
      handleZombieAudioAndVfx(ev, rnd, snd, listenerX, listenerY);
    } else if (ev.type === 'EXPLOSION') {
      if (snd) snd.playExplosion(ev.radius > 120 ? 1.4 : 1.0, ev.x, listenerX);
      if (rnd) rnd.addExplosionParticles(ev.x, ev.y, ev.radius);
    } else if (ev.type === 'UNLOCKED') {
      if (snd) snd.playComboUpgrade();
      const p = snapshot && snapshot.players ? snapshot.players.find(x => x.id === ev.playerId) : null;
      const name = p ? p.name : 'Bạn';
      if (rnd) rnd.addFloatingText(`${name} MỞ KHÓA: ${ev.weapon}!`, p ? p.x : 800, p ? p.y - 40 : 500, '#ffd600', 26);
    } else if (ev.type === 'WAVE_START') {
      if (snd && typeof snd.playWaveStart === 'function') snd.playWaveStart(ev.wave);
      if (rnd) rnd.addFloatingText(`WAVE ${ev.wave} BẮT ĐẦU!`, rnd.camera.x, rnd.camera.y - 80, '#ff3d00', 38);
    } else if (ev.type === 'WAVE_CLEAR') {
      if (snd) snd.playWaveClear();
      if (rnd) rnd.addFloatingText(`WAVE ${ev.wave} HOÀN THÀNH!`, rnd.camera.x, rnd.camera.y - 80, '#00e676', 36);
    } else if (ev.type === 'GAME_OVER') {
      if (snd) snd.playGameOver();
      const sm = snd || (typeof window !== 'undefined' ? window.soundManager : null);
      if (sm && typeof sm.stopHorrorAmbience === 'function') sm.stopHorrorAmbience();
    } else if (ev.type === 'PICKUP') {
      if (snd) snd.playPickup();
    } else if (ev.type === 'REVIVE') {
      if (rnd) rnd.addFloatingText('ĐÃ HỒI SINH ĐỒNG ĐỘI!', rnd.camera.x, rnd.camera.y - 40, '#00e5ff', 24);
    } else if (ev.type === 'SESSION_RESET') {
      handleSessionReset(rnd, snd);
    }
  }

  // Input sending timer (40Hz = 25ms)
  if (isBrowser) {
    const inputTimer = setInterval(() => {
      if (isInGame && input) {
        socket.emit('player:input', input.getInputPayload());
      }
    }, 25);
    if (typeof inputTimer.unref === 'function') {
      inputTimer.unref();
    }
  }

  // --- RENDER GAME LOOP ---
  function gameLoop(now, context = {}) {
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    const interp = context.interpolator || interpolator;
    const rnd = context.renderer || renderer;
    const sm = context.soundManager || (typeof window !== 'undefined' ? window.soundManager : null);
    const uic = context.ui || ui;
    const inGame = context.isInGame !== undefined ? context.isInGame : isInGame;
    const myId = context.myPlayerId !== undefined ? context.myPlayerId : myPlayerId;
    const activeMap = context.currentMap !== undefined ? context.currentMap : currentMap;

    const state = inGame && interp ? interp.getInterpolatedState() : null;
    if (rnd) {
      rnd.updateVisuals(dt, activeMap, state ? state.wave : 1);
    }

    if (inGame && state) {
      const localPlayer = state.players ? (state.players.find(p => p.id === myId) || state.players[0]) : null;
      if (sm && typeof sm.updateHorrorAmbience === 'function') {
        sm.updateHorrorAmbience(dt, {
          isInGame: state.state !== 'GAMEOVER',
          wave: state.wave || 1,
          localPlayer,
          zombies: state.zombies || []
        });
      }
      if (rnd) rnd.render(state, myId, activeMap);
      if (uic) uic.updateHUD(state, myId);
    }

    if (isBrowser && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(gameLoop);
    }
  }

  if (isBrowser && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(gameLoop);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleGameEvent, gameLoop };
  }
  if (typeof window !== 'undefined') {
    window.handleGameEvent = handleGameEvent;
    window.gameLoop = gameLoop;
  }
})();
