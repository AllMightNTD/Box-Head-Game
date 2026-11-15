class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Camera
    this.camera = {
      x: 800,
      y: 600,
      shake: 0,
      shakeX: 0,
      shakeY: 0
    };

    // Off-screen canvas for persistent blood splatters and progressive darkness lighting
    if (typeof document !== 'undefined') {
      this.bloodCanvas = document.createElement('canvas');
      this.bloodCanvas.width = 1600;
      this.bloodCanvas.height = 1200;
      this.bloodCtx = this.bloodCanvas.getContext('2d');

      this.darknessCanvas = document.createElement('canvas');
      this.darknessCanvas.width = 1600;
      this.darknessCanvas.height = 1200;
      this.darknessCtx = this.darknessCanvas.getContext('2d');
    }

    // Progressive wave darkness
    this.currentDarknessAlpha = 0.18;
    this.targetDarknessAlpha = 0.18;

    // Visual particles and floating texts
    this.particles = [];
    this.floatingTexts = [];
    this.muzzleFlashes = [];
    this.ambientParticles = [];
    this.shockwaves = [];
    this.blinkTrails = [];

    // Zombie corpses array (blood pools & held death frames, capped at 60)
    this.corpses = [];

    // Color palettes for characters
    this.characterPalettes = {
      HUMAN:   { shirt: '#2e7d32', shirtSide: '#1b5e20', pants: '#37474f', band: '#81c784', skin: '#f5c69b' },
      WARRIOR: { shirt: '#b71c1c', shirtSide: '#7f0000', pants: '#212121', band: '#ff8a80', skin: '#f5c69b' },
      MAGE:    { shirt: '#0d47a1', shirtSide: '#002171', pants: '#263238', band: '#80d8ff', skin: '#f5c69b' },
      BAMBO:   { shirt: '#f5f5f5', shirtSide: '#d0d0d0', pants: '#37474f', band: '#d32f2f', skin: '#f5c69b' },
      BON:     { shirt: '#d32f2f', shirtSide: '#9a0007', pants: '#212121', band: '#111111', skin: '#f5c69b' },
      BINGO:   { shirt: '#1976d2', shirtSide: '#004ba0', pants: '#263238', band: '#ffffff', skin: '#f5c69b' },
      BERT:    { shirt: '#f57c00', shirtSide: '#bb4d00', pants: '#1a237e', band: '#212121', skin: '#f5c69b' }
    };
  }

  resetSession() {
    if (this.bloodCtx && this.bloodCanvas) {
      this.bloodCtx.clearRect(0, 0, this.bloodCanvas.width, this.bloodCanvas.height);
    }
    this.currentDarknessAlpha = 0.18;
    this.targetDarknessAlpha = 0.18;
    this.corpses = [];
    this.particles = [];
    this.floatingTexts = [];
    this.muzzleFlashes = [];
    this.ambientParticles = [];
    this.shockwaves = [];
    this.blinkTrails = [];
    this.camera.shake = 0;
    this.camera.shakeX = 0;
    this.camera.shakeY = 0;
  }

  getTargetWaveDarkness(wave) {
    if (typeof wave !== 'number' || !Number.isFinite(wave) || wave <= 1) return 0.18;
    const table = { 1: 0.18, 2: 0.32, 3: 0.48, 4: 0.62, 5: 0.75 };
    if (table[wave]) return table[wave];
    return Math.min(0.88, Number((0.75 + (wave - 5) * 0.065).toFixed(3)));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  triggerScreenShake(magnitude = 10) {
    this.camera.shake = Math.min(25, this.camera.shake + magnitude);
  }

  addBlood(x, y, count = 6, color = '#8a0303') {
    this.bloodCtx.save();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 32;
      const bx = x + Math.cos(angle) * dist;
      const by = y + Math.sin(angle) * dist;
      const r = Math.random() * 5 + 2;

      this.bloodCtx.fillStyle = color;
      this.bloodCtx.globalAlpha = Math.random() * 0.4 + 0.5;
      this.bloodCtx.beginPath();
      this.bloodCtx.arc(bx, by, r, 0, Math.PI * 2);
      this.bloodCtx.fill();

      // Splatter drip
      if (Math.random() < 0.3) {
        this.bloodCtx.beginPath();
        this.bloodCtx.moveTo(bx, by);
        this.bloodCtx.lineTo(bx + Math.cos(angle) * (r * 3), by + Math.sin(angle) * (r * 3));
        this.bloodCtx.strokeStyle = color;
        this.bloodCtx.lineWidth = Math.random() * 2 + 1;
        this.bloodCtx.stroke();
      }
    }
    this.bloodCtx.restore();
  }

  addExplosionParticles(x, y, radius = 120) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (radius * 3) + 50;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 12 + 6,
        color: ['#ffeb3b', '#ff9800', '#f44336', '#424242'][Math.floor(Math.random() * 4)],
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8
      });
    }
    this.triggerScreenShake(radius > 120 ? 18 : 10);
  }

  addFloatingText(text, x, y, color = '#ffeb3b', size = 22) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      size,
      life: 1.2,
      maxLife: 1.2
    });
  }

  addMuzzleFlash(x, y, angle) {
    this.muzzleFlashes.push({
      x,
      y,
      angle,
      life: 0.05
    });
  }

  addShockwave(x, y, maxRadius = 200, color = '#ff9800') {
    this.shockwaves.push({
      x,
      y,
      radius: 12,
      maxRadius,
      color,
      alpha: 1.0,
      speed: (maxRadius - 12) / 0.35
    });
    this.triggerScreenShake(Math.min(12, maxRadius * 0.05));
  }

  addBlinkTrail(fromX, fromY, toX, toY, color = '#00e5ff') {
    this.blinkTrails.push({
      fromX,
      fromY,
      toX,
      toY,
      color,
      alpha: 1.0,
      duration: 0.35,
      elapsed: 0
    });
  }

  addZombieCorpse(zombie) {
    if (!this.corpses) this.corpses = [];
    if (this.corpses.length >= 60) {
      this.corpses.shift(); // FIFO: cap at 60 to prevent FPS drop
    }
    this.corpses.push({
      x: zombie.x,
      y: zombie.y,
      zType: zombie.zType || zombie.type || 'NORMAL',
      angle: typeof zombie.angle === 'number' ? zombie.angle : 0,
      frame: 11, // First death animation frame (cols 11..15)
      animTimer: 0,
      age: 0,
      fadeStart: 8, // Persist on ground for 8 seconds
      maxLife: 10   // Complete fade out at 10 seconds
    });
  }

  drawCorpses(ctx, dt = 0.016) {
    if (!this.corpses || this.corpses.length === 0) return;
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.age += dt;

      // Advance death animation through cols 11..15
      if (c.frame < 15) {
        c.animTimer += dt;
        if (c.animTimer >= 0.08) {
          c.animTimer = 0;
          c.frame++;
        }
      }

      // Fade out
      let alpha = 1.0;
      if (c.age > c.fadeStart) {
        alpha = Math.max(0, 1 - (c.age - c.fadeStart) / 2);
      }

      if (c.age >= c.maxLife || alpha <= 0) {
        this.corpses.splice(i, 1);
        continue;
      }

      const spriteInfo = (window.spriteManager && window.spriteManager.getSprite('zombies', c.zType)) || null;
      if (spriteInfo && spriteInfo.image && spriteInfo.image.complete && spriteInfo.image.naturalWidth > 0) {
        const dirRow = (window.spriteManager && window.spriteManager.angleToDirectionRow(c.angle)) || 0;
        const scale = (c.zType === 'TANK' ? 3.0 : (c.zType === 'DEVIL' ? 2.8 : 2.0));
        const dw = Math.round(32 * scale);
        const dh = Math.round(32 * scale);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha;
        ctx.translate(Math.round(c.x), Math.round(c.y));

        ctx.drawImage(
          spriteInfo.image,
          c.frame * 32, dirRow * 32, 32, 32,
          -Math.round(dw / 2), -Math.round(dh / 2), dw, dh
        );

        ctx.restore();
      }
    }
  }

  updateVisuals(dt, map, wave) {
    if (typeof wave === 'number' && Number.isFinite(wave)) {
      this.targetDarknessAlpha = this.getTargetWaveDarkness(wave);
    }
    this.currentDarknessAlpha += (this.targetDarknessAlpha - this.currentDarknessAlpha) * Math.min(1, dt * 1.5);

    // Camera shake decay
    if (this.camera.shake > 0) {
      this.camera.shakeX = (Math.random() * 2 - 1) * this.camera.shake;
      this.camera.shakeY = (Math.random() * 2 - 1) * this.camera.shake;
      this.camera.shake = Math.max(0, this.camera.shake - dt * 25);
    } else {
      this.camera.shakeX = 0;
      this.camera.shakeY = 0;
    }

    // Ambient Weather Particles (Snow, Sand, Embers)
    const ambientType = (map && map.theme && map.theme.ambient) || 'normal';
    if (ambientType !== 'normal') {
      const w = map ? map.width : 1600;
      const h = map ? map.height : 1200;

      if (this.ambientParticles.length < 50 && Math.random() < 0.7) {
        if (ambientType === 'snow') {
          this.ambientParticles.push({
            type: 'snow',
            x: Math.random() * (w + 400) - 200,
            y: -10,
            vx: Math.random() * 25 + 15,
            vy: Math.random() * 50 + 40,
            size: Math.random() * 3 + 1.5,
            alpha: Math.random() * 0.6 + 0.3,
            life: 10
          });
        } else if (ambientType === 'sand') {
          this.ambientParticles.push({
            type: 'sand',
            x: -20,
            y: Math.random() * h,
            vx: Math.random() * 120 + 80,
            vy: (Math.random() * 30 - 15),
            size: Math.random() * 2.5 + 1,
            alpha: Math.random() * 0.45 + 0.2,
            life: 8
          });
        } else if (ambientType === 'embers') {
          this.ambientParticles.push({
            type: 'embers',
            x: Math.random() * w,
            y: h + 15,
            vx: (Math.random() * 30 - 15),
            vy: -(Math.random() * 65 + 35),
            size: Math.random() * 3 + 1,
            color: Math.random() < 0.6 ? '#ff3d00' : '#ffd600',
            alpha: 1,
            life: Math.random() * 4 + 3
          });
        }
      }
    }

    // Update ambient particles
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const ap = this.ambientParticles[i];
      ap.x += ap.vx * dt;
      ap.y += ap.vy * dt;
      ap.life -= dt;
      if (ap.life <= 0) this.ambientParticles.splice(i, 1);
    }

    // Weapon Particles & Explosions
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 40 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Muzzle flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      mf.life -= dt;
      if (mf.life <= 0) this.muzzleFlashes.splice(i, 1);
    }

    // Shockwaves (Seismic Slam, Frost Nova, Drone deploy)
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += s.speed * dt;
      s.alpha = Math.max(0, 1 - (s.radius / s.maxRadius));
      if (s.radius >= s.maxRadius || s.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Blink Trails (Mage Blink)
    for (let i = this.blinkTrails.length - 1; i >= 0; i--) {
      const bt = this.blinkTrails[i];
      bt.elapsed += dt;
      bt.alpha = Math.max(0, 1 - (bt.elapsed / bt.duration));
      if (bt.elapsed >= bt.duration || bt.alpha <= 0) {
        this.blinkTrails.splice(i, 1);
      }
    }
  }

  render(gameState, localPlayerId, map) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!gameState) return;

    if (typeof gameState.wave === 'number' && Number.isFinite(gameState.wave)) {
      this.targetDarknessAlpha = this.getTargetWaveDarkness(gameState.wave);
    }

    // Follow local player
    const localPlayer = gameState.players.find(p => p.id === localPlayerId);
    if (localPlayer) {
      this.camera.x += (localPlayer.x - this.camera.x) * 0.15;
      this.camera.y += (localPlayer.y - this.camera.y) * 0.15;
    }

    ctx.save();
    // Center camera on screen + zoom (1.15x) + shake
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(1.15, 1.15);
    ctx.translate(
      Math.round(-this.camera.x + this.camera.shakeX),
      Math.round(-this.camera.y + this.camera.shakeY)
    );

    // 1. Draw Floor Tile Grid
    this.drawFloor(ctx, map);

    // 2. Draw Persistent Blood Splatters
    if (this.bloodCanvas) {
      ctx.drawImage(this.bloodCanvas, 0, 0);
    }

    // 2.5 Draw Zombie Corpses (Blood pools and decaying remains)
    this.drawCorpses(ctx, 0.016);

    // 3. Draw Ambient Weather Particles (Behind actors for depth)
    this.drawAmbientParticles(ctx);

    // 4. Draw Pickups (Ammo & Medkits)
    this.drawPickups(ctx, gameState.pickups || []);

    // 4.5 Draw Tactical Drones & Infinite Ammo Aura
    this.drawDrones(ctx, gameState.drones || []);

    // 5. Draw Barricades & Barrels
    this.drawBarricades(ctx, gameState.barricades || []);

    // 6. Draw Zombies
    const zombies = gameState.zombies || [];
    for (let i = 0; i < zombies.length; i++) {
      this.drawBoxyZombie(ctx, zombies[i]);
    }

    // 7. Draw Players
    const players = gameState.players || [];
    for (let i = 0; i < players.length; i++) {
      this.drawBoxyPlayer(ctx, players[i], players[i].id === localPlayerId);
    }

    // 8. Draw Bullets & Projectiles
    this.drawBullets(ctx, gameState.bullets || []);

    // 9. Draw Muzzle Flashes
    this.drawMuzzleFlashes(ctx);

    // 10. Draw Map Walls & Pillars (Over entities for 2.5D depth)
    this.drawMapStructures(ctx, map);

    // 10.5 Draw Ultimates VFX (Shockwaves & Blink Trails)
    this.drawBlinkTrails(ctx);
    this.drawShockwaves(ctx);

    // 11. Draw Particles & Explosions
    this.drawParticles(ctx);

    // 11.5 Draw Progressive Darkness, Tactical Lighting & Glowing Zombie Eyes
    this.drawDarknessAndLights(ctx, gameState, localPlayerId, map);
    this.drawZombieEyesInDark(ctx, gameState.zombies || [], gameState.players || []);

    // 12. Draw Floating Texts
    this.drawFloatingTexts(ctx);

    ctx.restore();
  }

  drawAmbientParticles(ctx) {
    for (let i = 0; i < this.ambientParticles.length; i++) {
      const ap = this.ambientParticles[i];
      ctx.save();
      if (ap.type === 'snow') {
        ctx.fillStyle = `rgba(255, 255, 255, ${ap.alpha})`;
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, ap.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (ap.type === 'sand') {
        ctx.fillStyle = `rgba(244, 162, 97, ${ap.alpha})`;
        ctx.fillRect(ap.x, ap.y, ap.size * 2, ap.size);
      } else if (ap.type === 'embers') {
        ctx.fillStyle = ap.color;
        ctx.shadowColor = ap.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, ap.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawFloor(ctx, map) {
    const w = map ? map.width : 1600;
    const h = map ? map.height : 1200;
    const theme = (map && map.theme) || {
      floorColor: '#22252a',
      gridColor: '#2b2f36',
      ambient: 'normal'
    };

    // Floor base
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, 0, w, h);

    // Checkerboard subtle grid
    const tileSize = 80;
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += tileSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += tileSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Map-specific terrain accents
    if (theme.ambient === 'sand') {
      ctx.strokeStyle = 'rgba(140, 88, 54, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 160; y < h; y += 220) {
        ctx.moveTo(60, y);
        ctx.bezierCurveTo(450, y - 40, 950, y + 40, w - 60, y - 10);
      }
      ctx.stroke();
    } else if (theme.ambient === 'snow') {
      ctx.strokeStyle = 'rgba(129, 212, 250, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(250, 200); ctx.lineTo(290, 240); ctx.lineTo(280, 270);
      ctx.moveTo(1250, 850); ctx.lineTo(1300, 880); ctx.lineTo(1340, 860);
      ctx.moveTo(850, 300); ctx.lineTo(890, 340);
      ctx.stroke();
    } else if (theme.ambient === 'embers') {
      ctx.strokeStyle = 'rgba(255, 61, 0, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(550, 480); ctx.lineTo(600, 520); ctx.lineTo(580, 560);
      ctx.moveTo(980, 680); ctx.lineTo(1030, 720); ctx.lineTo(1060, 760);
      ctx.stroke();
    }
  }

  drawMapStructures(ctx, map) {
    if (!map || !map.walls) return;
    const theme = map.theme || {
      wallSide: '#2e343d',
      wallTop: '#454d59',
      wallBorder: '#181b20',
      pillarSide: '#3d444f',
      pillarTop: '#5a6372',
      pillarBorder: '#181b20'
    };

    for (let i = 0; i < map.walls.length; i++) {
      const wall = map.walls[i];

      // Drop shadow for 2.5D depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(wall.x + 8, wall.y + 8, wall.w, wall.h);

      // Wall body (side)
      ctx.fillStyle = wall.type === 'pillar' ? theme.pillarSide : theme.wallSide;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

      // Wall top (highlighted block surface)
      const topHeight = Math.min(14, wall.h / 3);
      ctx.fillStyle = wall.type === 'pillar' ? theme.pillarTop : theme.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, topHeight);

      // Stone border
      ctx.strokeStyle = wall.type === 'pillar' ? theme.pillarBorder : theme.wallBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }
  }

  drawPlayerRing(ctx, player) {
    const ringColors = ['#00e676', '#ff3d00', '#2979ff', '#ffc400'];
    const pIdx = (typeof player.playerIndex === 'number') ? player.playerIndex : 0;
    const ringColor = ringColors[pIdx % 4];

    ctx.save();
    ctx.translate(Math.round(player.x), Math.round(player.y) + 24);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawWeapon360(ctx, player) {
    ctx.save();
    ctx.translate(Math.round(player.x), Math.round(player.y));
    ctx.rotate(player.angle);

    // If facing leftwards, flip vertically so weapon isn't upside down
    if (Math.cos(player.angle) < 0) {
      ctx.scale(1, -1);
    }

    const weaponId = player.selectedWeapon || 'PISTOL';
    this.drawWeaponInHand(ctx, weaponId);

    ctx.restore();
  }

  drawDownedPlayer(ctx, player) {
    let drawn = false;
    const spriteManager = typeof window !== 'undefined' ? window.spriteManager : null;
    if (spriteManager) {
      const spriteInfo = spriteManager.getSprite('characters', player.character || 'HUMAN');
      if (spriteInfo && spriteInfo.image && spriteInfo.image.complete && spriteInfo.image.naturalWidth > 0) {
        const dirRow = spriteManager.angleToDirectionRow(player.angle);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          spriteInfo.image,
          15 * 32, dirRow * 32, 32, 32,
          Math.round(player.x - 32), Math.round(player.y - 32), 64, 64
        );
        ctx.restore();
        drawn = true;
      }
    }

    if (!drawn) {
      // Fallback downed
      ctx.save();
      ctx.translate(Math.round(player.x), Math.round(player.y));
      ctx.rotate(player.angle);
      ctx.fillStyle = '#616161';
      ctx.fillRect(-24, -16, 48, 32);
      ctx.restore();
    }

    // Distress beacon
    ctx.save();
    const flash = Math.sin(Date.now() / 150) > 0;
    ctx.fillStyle = flash ? '#ff1744' : '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REVIVE (' + player.bleedoutTimer + 's)', Math.round(player.x), Math.round(player.y - 40));
    ctx.restore();
  }

  drawBoxyPlayerFallback(ctx, player) {
    ctx.save();
    ctx.translate(Math.round(player.x), Math.round(player.y));
    const palette = this.characterPalettes[player.character] || this.characterPalettes.HUMAN || this.characterPalettes.BAMBO;

    ctx.rotate(player.angle);

    // Boxy Body (Shoulders / Torso)
    ctx.fillStyle = palette.shirtSide;
    ctx.fillRect(-20, -22, 40, 44);
    ctx.fillStyle = palette.shirt;
    ctx.fillRect(-18, -20, 36, 40);

    // Boxy Head (Cube with front face and top highlight)
    const headSize = 36;
    const hHalf = headSize / 2;

    // Head base (Skin)
    ctx.fillStyle = palette.skin;
    ctx.fillRect(-hHalf, -hHalf, headSize, headSize);

    // Headband (Signature Boxhead style)
    ctx.fillStyle = palette.band;
    ctx.fillRect(-hHalf, -hHalf + 8, headSize, 8);

    // Eyes (Two dark dots facing forward right)
    ctx.fillStyle = '#111111';
    ctx.fillRect(hHalf - 6, -8, 6, 6);
    ctx.fillRect(hHalf - 6, 4, 6, 6);

    ctx.restore();
  }

  drawBoxyPlayer(ctx, player, isLocal) {
    // 1. Draw Player Ring on ground
    this.drawPlayerRing(ctx, player);

    // 2. Downed state
    if (player.isDowned) {
      this.drawDownedPlayer(ctx, player);
      this.drawPlayerTag(ctx, player, isLocal);
      return;
    }

    // 3. Shadow under player (fitted cleanly inside the 18x9 player ring at y + 24)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(Math.round(player.x), Math.round(player.y + 24), 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const spriteManager = typeof window !== 'undefined' ? window.spriteManager : null;
    const dirRow = (spriteManager && spriteManager.angleToDirectionRow(player.angle)) || 0;

    // 4. Draw Player Sprite (or fallback)
    let drawnWithSprite = false;
    if (spriteManager) {
      const spriteInfo = spriteManager.getSprite('characters', player.character || 'HUMAN');
      if (spriteInfo && spriteInfo.image && spriteInfo.image.complete && spriteInfo.image.naturalWidth > 0) {
        const action = player.isMoving ? 'walk' : 'idle';
        const animTime = Date.now() / 1000;
        const src = (action === 'idle')
          ? { sx: 0, sy: dirRow * 32, sWidth: 32, sHeight: 32 }
          : spriteManager.getFrameSource('characters', player.character || 'HUMAN', 'walk', dirRow, animTime);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          spriteInfo.image,
          src.sx, src.sy, src.sWidth, src.sHeight,
          Math.round(player.x - 32), Math.round(player.y - 32), 64, 64
        );
        ctx.restore();
        drawnWithSprite = true;
      }
    }

    if (!drawnWithSprite) {
      this.drawBoxyPlayerFallback(ctx, player);
      this.drawWeapon360(ctx, player);
    }

    // 5. Draw Player HUD over head
    this.drawPlayerTag(ctx, player, isLocal);
  }

  drawWeaponInHand(ctx, weaponId) {
    ctx.fillStyle = '#212121';
    if (weaponId === 'UZI') {
      ctx.fillRect(16, 6, 26, 9);
      ctx.fillRect(20, 15, 8, 12);
    } else if (weaponId === 'SHOTGUN') {
      ctx.fillRect(12, 6, 42, 10);
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(4, 8, 16, 7);
    } else if (weaponId === 'ROCKET') {
      ctx.fillStyle = '#37474f';
      ctx.fillRect(10, 4, 52, 16);
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(58, 6, 10, 12);
    } else if (weaponId === 'RAILGUN') {
      ctx.fillStyle = '#00bcd4';
      ctx.fillRect(12, 6, 48, 11);
      ctx.fillStyle = '#e0f7fa';
      ctx.fillRect(30, 8, 22, 7);
    } else if (weaponId === 'GRENADE') {
      ctx.fillStyle = '#33691e';
      ctx.beginPath();
      ctx.arc(26, 10, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (weaponId === 'BARRICADE' || weaponId === 'BARREL') {
      ctx.fillStyle = weaponId === 'BARREL' ? '#c62828' : '#8d6e63';
      ctx.fillRect(20, -14, 30, 30);
    } else {
      // Pistol default
      ctx.fillRect(16, 6, 24, 7);
    }
  }

  drawPlayerTag(ctx, player, isLocal) {
    ctx.save();
    ctx.translate(player.x, player.y - 44);

    // Infinite Ammo indicator if buffed by drone
    if (player.hasInfiniteAmmo) {
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#ffd600';
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 6;
      ctx.fillText('⚡ ∞ AMMO', 0, -12);
    }

    // Name
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = isLocal ? '#00e676' : '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(player.name, 0, 0);

    // Health bar
    const barW = 36;
    const barH = 5;
    const hpRatio = Math.max(0, player.hp / player.maxHp);

    ctx.fillStyle = '#111111';
    ctx.fillRect(-barW / 2 - 1, 4, barW + 2, barH + 2);
    ctx.fillStyle = hpRatio > 0.5 ? '#00e676' : (hpRatio > 0.25 ? '#ffeb3b' : '#ff1744');
    ctx.fillRect(-barW / 2, 5, barW * hpRatio, barH);

    // Revive progress bar if active
    if (player.reviving) {
      const revRatio = player.reviveProgress / 2.0;
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-barW / 2, 12, barW * revRatio, 4);
    }

    ctx.restore();
  }

  drawZombieHpBar(ctx, zombie, scale = 2.0) {
    const headOffset = (zombie.type === 'TANK' || zombie.type === 'DEVIL') ? 56 : 40;
    ctx.save();
    ctx.translate(Math.round(zombie.x), Math.round(zombie.y - headOffset));
    const bw = Math.round(20 * scale);
    ctx.fillStyle = '#111111';
    ctx.fillRect(-bw / 2 - 1, 0, bw + 2, 6);
    ctx.fillStyle = (zombie.type === 'DEVIL' || zombie.type === 'TANK') ? '#ff1744' : '#e53935';
    ctx.fillRect(-bw / 2, 1, Math.max(0, bw * (zombie.hp / zombie.maxHp)), 4);
    ctx.restore();
  }

  drawBoxyZombie(ctx, zombie) {
    const scale = (zombie.type === 'TANK' ? 3.0 : (zombie.type === 'DEVIL' ? 2.8 : 2.0));
    const dw = Math.round(32 * scale);
    const dh = Math.round(32 * scale);

    // 1. Dynamic shadow scaled to footprint
    ctx.save();
    const shadowColor = (zombie.type === 'DEVIL') ? 'rgba(70, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)';
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.ellipse(Math.round(zombie.x), Math.round(zombie.y + 12 * (scale / 2)), Math.round(24 * (scale / 2)), Math.round(14 * (scale / 2)), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Sprite Sheet rendering
    let drawnWithSprite = false;
    const spriteManager = typeof window !== 'undefined' ? window.spriteManager : null;
    if (spriteManager) {
      const spriteInfo = spriteManager.getSprite('zombies', zombie.type);
      if (spriteInfo && spriteInfo.image && spriteInfo.image.complete && spriteInfo.image.naturalWidth > 0) {
        const dirRow = spriteManager.angleToDirectionRow(zombie.angle);
        const action = zombie.isHit ? 'hit' : (zombie.isAttacking ? 'attack' : 'walk');
        const animTime = Date.now() / 1000;
        const src = spriteManager.getFrameSource('zombies', zombie.type, action, dirRow, animTime);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          spriteInfo.image,
          src.sx, src.sy, src.sWidth, src.sHeight,
          Math.round(zombie.x - dw / 2), Math.round(zombie.y - dh / 2), dw, dh
        );
        ctx.restore();
        drawnWithSprite = true;
      }
    }

    if (!drawnWithSprite) {
      ctx.save();
      const fbScale = (zombie.type === 'TANK' ? 1.5 : (zombie.type === 'DEVIL' ? 1.4 : 1.3));
      ctx.translate(zombie.x, zombie.y);
      ctx.scale(fbScale, fbScale);
      ctx.translate(-zombie.x, -zombie.y);
      this.drawBoxyZombieFallback(ctx, zombie);
      ctx.restore();
    }

    // 3. HP Bar for Boss / damaged zombies
    if (zombie.type === 'TANK' || zombie.type === 'DEVIL' || zombie.hp < zombie.maxHp) {
      this.drawZombieHpBar(ctx, zombie, scale);
    }

    // 4. Freeze / Chill / Stun Status Effects
    if (zombie.isFrozen) {
      // Ice block encasing zombie
      ctx.save();
      ctx.fillStyle = 'rgba(128, 222, 234, 0.45)';
      ctx.strokeStyle = '#e0f7fa';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      const ibw = dw * 0.75;
      const ibh = dh * 0.85;
      ctx.strokeRect(Math.round(zombie.x - ibw / 2), Math.round(zombie.y - ibh / 2), ibw, ibh);
      ctx.fillRect(Math.round(zombie.x - ibw / 2), Math.round(zombie.y - ibh / 2), ibw, ibh);
      // Small frost text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('❄ FROZEN ❄', zombie.x, zombie.y - dh / 2 - 4);
      ctx.restore();
    } else if (zombie.isChilled) {
      // Frost mist aura
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, zombie.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (zombie.isStunned) {
      // Stunned spinning stars over head
      ctx.save();
      const t = Date.now() / 200;
      const starCount = 3;
      const starRadius = 14;
      const headY = zombie.y - dh / 2 - 6;
      ctx.fillStyle = '#ffd600';
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 6;
      for (let s = 0; s < starCount; s++) {
        const angle = t + (s * Math.PI * 2) / starCount;
        const sx = zombie.x + Math.cos(angle) * starRadius;
        const sy = headY + Math.sin(angle) * (starRadius * 0.4);
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#fff59d';
      ctx.textAlign = 'center';
      ctx.fillText('★ STUNNED ★', zombie.x, headY - 8);
      ctx.restore();
    }
  }

  drawBoxyZombieFallback(ctx, zombie) {
    ctx.save();
    ctx.translate(zombie.x, zombie.y);

    const time = Date.now() * 0.005;
    const zSeed = (zombie.x * 0.13 + zombie.y * 0.17) % 100;

    // Dynamic shadow scaled to zombie's visual footprint
    let shadowRx = 18;
    let shadowRy = 12;
    let shadowColor = 'rgba(0, 0, 0, 0.4)';

    if (zombie.type === 'TANK') {
      shadowRx = 28;
      shadowRy = 18;
      shadowColor = 'rgba(0, 0, 0, 0.55)';
    } else if (zombie.type === 'DEVIL') {
      shadowRx = 24;
      shadowRy = 16;
      shadowColor = 'rgba(70, 0, 0, 0.6)';
    } else if (zombie.type === 'RUNNER') {
      shadowRx = 16;
      shadowRy = 10;
    }

    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.ellipse(0, 5, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(zombie.angle);

    if (zombie.type === 'DEVIL') {
      // DEVIL BOSS: Hellfire Arch-Demon (Molten fissures, huge obsidian horns, blazing eyes)
      const bw = 38;
      const bh = 30;
      const bHalfW = bw / 2;
      const bHalfH = bh / 2;

      // Heavy muscular demonic arms with claw reach
      const armSway = Math.sin(time * 1.5 + zSeed) * 2;
      ctx.fillStyle = '#4a0000';
      ctx.fillRect(bHalfW - 8, -bHalfH - 5, 20 + armSway, 7);
      ctx.fillRect(bHalfW - 8, bHalfH - 2, 20 - armSway, 7);

      // Claws (charcoal razor talons)
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(bHalfW + 10 + armSway, -bHalfH - 6, 5, 4);
      ctx.fillRect(bHalfW + 10 - armSway, bHalfH + 1, 5, 4);

      // Torso & Shoulders (Obsidian-red demon bulk)
      ctx.fillStyle = '#5c0000';
      ctx.fillRect(-bHalfW, -bHalfH, bw, bh);

      // 3D Bevel Top
      ctx.fillStyle = '#8e0000';
      ctx.fillRect(-bHalfW, -bHalfH, bw, 6);

      // Molten magma fissures across chest
      ctx.fillStyle = '#ff3d00';
      ctx.fillRect(-6, -8, 14, 3);
      ctx.fillRect(-10, -2, 20, 3);
      ctx.fillRect(-4, 4, 12, 3);
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(-2, -7, 6, 2);
      ctx.fillRect(-6, -1, 10, 2);

      // Head (Demonic horned skull)
      const hw = 22;
      const hh = 20;
      ctx.fillStyle = '#7f0000';
      ctx.fillRect(bHalfW - 14, -hh / 2, hw, hh);

      // Sweeping obsidian curved horns
      ctx.fillStyle = '#111111';
      // Left horn
      ctx.beginPath();
      ctx.moveTo(bHalfW - 6, -hh / 2);
      ctx.lineTo(bHalfW - 18, -hh / 2 - 12);
      ctx.lineTo(bHalfW - 12, -hh / 2 - 16);
      ctx.lineTo(bHalfW - 2, -hh / 2 - 3);
      ctx.closePath();
      ctx.fill();
      // Right horn
      ctx.beginPath();
      ctx.moveTo(bHalfW - 6, hh / 2);
      ctx.lineTo(bHalfW - 18, hh / 2 + 12);
      ctx.lineTo(bHalfW - 12, hh / 2 + 16);
      ctx.lineTo(bHalfW - 2, hh / 2 + 3);
      ctx.closePath();
      ctx.fill();

      // Blazing hellfire eyes
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(bHalfW + 4, -5, 5, 4);
      ctx.fillRect(bHalfW + 4, 2, 5, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bHalfW + 6, -4, 2, 2);
      ctx.fillRect(bHalfW + 6, 3, 2, 2);

      // Snarl mouth / fangs
      ctx.fillStyle = '#111111';
      ctx.fillRect(bHalfW + 5, -2, 3, 4);
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(bHalfW + 6, -1, 2, 2);

    } else if (zombie.type === 'TANK') {
      // TANK ZOMBIE: Enormous Goliath Juggernaut (Broad hulking shoulders, metal/bone plating, red optics)
      const bw = 46;
      const bh = 36;
      const bHalfW = bw / 2;
      const bHalfH = bh / 2;

      // Giant gorilla sledgehammer arms (reaching forward)
      const armReach = Math.sin(time + zSeed) * 2;
      ctx.fillStyle = '#1c2833';
      ctx.fillRect(bHalfW - 12, -bHalfH - 8, 24 + armReach, 12);
      ctx.fillRect(bHalfW - 12, bHalfH - 4, 24 - armReach, 12);

      // Heavy spiked knuckles
      ctx.fillStyle = '#78909c';
      ctx.fillRect(bHalfW + 8 + armReach, -bHalfH - 7, 6, 10);
      ctx.fillRect(bHalfW + 8 - armReach, bHalfH - 3, 6, 10);
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(bHalfW + 13 + armReach, -bHalfH - 5, 3, 3);
      ctx.fillRect(bHalfW + 13 - armReach, bHalfH - 1, 3, 3);

      // Massive Torso / Back Plate
      ctx.fillStyle = '#263238';
      ctx.fillRect(-bHalfW, -bHalfH, bw, bh);

      // Armor plating bevels
      ctx.fillStyle = '#37474f';
      ctx.fillRect(-bHalfW, -bHalfH, bw, 8);
      ctx.fillRect(-bHalfW, bHalfH - 6, bw, 6);

      // Reinforced spinal spikes on back
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(-bHalfW - 4, -10, 6, 6);
      ctx.fillRect(-bHalfW - 5, -2, 7, 5);
      ctx.fillRect(-bHalfW - 4, 5, 6, 6);

      // Heavy Cranial Head (embedded into shoulders)
      const hw = 24;
      const hh = 22;
      ctx.fillStyle = '#1e272c';
      ctx.fillRect(bHalfW - 14, -hh / 2, hw, hh);

      // Bolted iron brow plate
      ctx.fillStyle = '#78909c';
      ctx.fillRect(bHalfW - 4, -hh / 2, 8, hh);

      // Furious burning red eyes
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(bHalfW + 4, -7, 5, 4);
      ctx.fillRect(bHalfW + 4, 3, 5, 4);
      ctx.fillStyle = '#ff8a80';
      ctx.fillRect(bHalfW + 6, -6, 2, 2);
      ctx.fillRect(bHalfW + 6, 4, 2, 2);

      // Clenched metallic jaw
      ctx.fillStyle = '#102027';
      ctx.fillRect(bHalfW + 4, -2, 5, 4);
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(bHalfW + 6, -1, 3, 2);

    } else if (zombie.type === 'RUNNER') {
      // RUNNER ZOMBIE: Feral Blood Stalker (Sinewy, twitching razor claws, foaming fangs)
      const bw = 24;
      const bh = 20;
      const bHalfW = bw / 2;
      const bHalfH = bh / 2;

      // Twitching hyper-extended razor claw arms
      const twitch = Math.sin(time * 3 + zSeed) * 3;
      ctx.fillStyle = '#8e0000';
      ctx.fillRect(bHalfW - 6, -bHalfH - 4, 22 + twitch, 5);
      ctx.fillRect(bHalfW - 6, bHalfH - 1, 22 - twitch, 5);

      // Dripping blood claws
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(bHalfW + 14 + twitch, -bHalfH - 5, 5, 3);
      ctx.fillRect(bHalfW + 14 - twitch, bHalfH, 5, 3);

      // Sleek predatory torso
      ctx.fillStyle = '#b71c1c';
      ctx.fillRect(-bHalfW, -bHalfH, bw, bh);

      // Muscle sinew highlight
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(-bHalfW, -bHalfH, bw, 4);
      ctx.fillStyle = '#5c0000';
      ctx.fillRect(-4, -6, 12, 12);

      // Head
      const hw = 18;
      const hh = 16;
      ctx.fillStyle = '#c62828';
      ctx.fillRect(bHalfW - 8, -hh / 2, hw, hh);

      // Piercing orange-yellow predator eyes
      ctx.fillStyle = '#ff9100';
      ctx.fillRect(bHalfW + 5, -5, 4, 3);
      ctx.fillRect(bHalfW + 5, 2, 4, 3);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(bHalfW + 7, -4, 2, 2);
      ctx.fillRect(bHalfW + 7, 3, 2, 2);

      // Gaping bloody maw with razor fangs
      ctx.fillStyle = '#111111';
      ctx.fillRect(bHalfW + 6, -2, 3, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bHalfW + 7, -2, 2, 1);
      ctx.fillRect(bHalfW + 7, 1, 2, 1);

    } else {
      // NORMAL ZOMBIE: Enhanced Rotten Undead (Broader shoulders, necrotic flesh, jagged teeth, glowing eyes)
      const bw = 30;
      const bh = 24;
      const bHalfW = bw / 2;
      const bHalfH = bh / 2;

      // Aggressive outstretched arms with shambling claw sway
      const armSway = Math.sin(time * 1.2 + zSeed) * 2.5;
      ctx.fillStyle = '#1b5e20';
      ctx.fillRect(bHalfW - 6, -bHalfH - 4, 18 + armSway, 6);
      ctx.fillRect(bHalfW - 6, bHalfH - 2, 18 - armSway, 6);

      // Bloody hands / claws
      ctx.fillStyle = '#5c1d1d';
      ctx.fillRect(bHalfW + 10 + armSway, -bHalfH - 4, 4, 5);
      ctx.fillRect(bHalfW + 10 - armSway, bHalfH - 2, 4, 5);

      // Hunched Torso / Shoulders
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(-bHalfW, -bHalfH, bw, bh);

      // Tattered clothing remnants (dark shredded jacket)
      ctx.fillStyle = '#1b3a1e';
      ctx.fillRect(-bHalfW, -bHalfH + 4, bw - 6, bh - 8);

      // Top shoulder bevel
      ctx.fillStyle = '#43a047';
      ctx.fillRect(-bHalfW, -bHalfH, bw, 4);

      // Head (Necrotic decaying green cube)
      const hw = 20;
      const hh = 18;
      ctx.fillStyle = '#388e3c';
      ctx.fillRect(bHalfW - 10, -hh / 2, hw, hh);

      // Bloody cranial wound / rotting patch
      ctx.fillStyle = '#8a0303';
      ctx.fillRect(bHalfW - 6, -hh / 2, 6, 5);

      // Glowing sunken undead eyes
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(bHalfW + 4, -5, 4, 3);
      ctx.fillRect(bHalfW + 4, 2, 4, 3);
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(bHalfW + 5, -4, 2, 2);
      ctx.fillRect(bHalfW + 5, 3, 2, 2);

      // Open maw with jagged teeth
      ctx.fillStyle = '#111111';
      ctx.fillRect(bHalfW + 6, -2, 3, 4);
      ctx.fillStyle = '#fff9c4';
      ctx.fillRect(bHalfW + 7, -2, 2, 1);
      ctx.fillRect(bHalfW + 7, 1, 2, 1);
    }

    ctx.restore();

    // Zombie HP Bar (Positioned above larger heads)
    if (zombie.hp < zombie.maxHp) {
      ctx.save();
      const headOffset = zombie.type === 'TANK' ? 32 : (zombie.type === 'DEVIL' ? 28 : (zombie.type === 'RUNNER' ? 18 : 22));
      ctx.translate(zombie.x, zombie.y - headOffset);
      const bw = zombie.type === 'TANK' ? 44 : (zombie.type === 'DEVIL' ? 36 : 28);
      ctx.fillStyle = '#111111';
      ctx.fillRect(-bw / 2 - 1, 0, bw + 2, 5);
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(-bw / 2, 1, bw * (zombie.hp / zombie.maxHp), 3);
      ctx.restore();
    }
  }

  drawBarricades(ctx, barricades) {
    for (let i = 0; i < barricades.length; i++) {
      const b = barricades[i];
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.type === 'barrel') {
        // Red Explosive Barrel
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(3, 3, 20, 0, Math.PI * 2);
        ctx.fill();

        // Barrel cylinder body
        ctx.fillStyle = '#c62828';
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Warning Hazard Symbol / Flame
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 1);

      } else {
        // Wooden Barricade crate
        const half = 22;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-half + 4, -half + 4, 44, 44);

        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-half, -half, 44, 44);

        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(-half + 3, -half + 3, 38, 38);

        // Crossed wooden planks
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-half + 4, -half + 4);
        ctx.lineTo(half - 4, half - 4);
        ctx.moveTo(half - 4, -half + 4);
        ctx.lineTo(-half + 4, half - 4);
        ctx.stroke();

        // HP crack indicator if damaged
        if (b.hp < b.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(-half + 2, half - 6, 40 * (1 - b.hp / b.maxHp), 4);
        }
      }

      ctx.restore();
    }
  }

  drawBullets(ctx, bullets) {
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.isFireball) {
        // Swirling Devil Fireball
        ctx.rotate(Date.now() / 80);
        ctx.fillStyle = '#ff9800';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();

      } else if (b.type === 'rocket') {
        ctx.rotate(b.angle);
        ctx.fillStyle = '#424242';
        ctx.fillRect(-10, -4, 18, 8);
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(14, 0);
        ctx.lineTo(8, 4);
        ctx.fill();

      } else if (b.type === 'railgun') {
        ctx.rotate(b.angle);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();

      } else {
        // Standard tracer bullet
        ctx.rotate(b.angle);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(-6, -2, 12, 4);
      }

      ctx.restore();
    }
  }

  drawPickups(ctx, pickups) {
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      ctx.save();
      ctx.translate(p.x, p.y);

      const pulse = 1 + Math.sin(Date.now() / 180) * 0.12;
      ctx.scale(pulse, pulse);

      if (p.type === 'MEDKIT') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = '#b0bec5';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);

        // Red cross
        ctx.fillStyle = '#d32f2f';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        // Ammo crate
        ctx.fillStyle = '#33691e';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = '#558b2f';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);

        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AMMO', 0, 0);
      }

      ctx.restore();
    }
  }

  drawMuzzleFlashes(ctx) {
    for (let i = 0; i < this.muzzleFlashes.length; i++) {
      const mf = this.muzzleFlashes[i];
      ctx.save();
      ctx.translate(mf.x, mf.y);
      ctx.rotate(mf.angle);
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(16, -7);
      ctx.lineTo(24, 0);
      ctx.lineTo(16, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawFloatingTexts(ctx) {
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.font = '900 ' + ft.size + 'px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  drawDrones(ctx, drones = []) {
    if (!drones || drones.length === 0) return;
    const now = Date.now();

    for (let i = 0; i < drones.length; i++) {
      const drone = drones[i];

      // 1. Draw 200px Infinite Ammo Aura circle
      ctx.save();
      const auraPulse = Math.sin(now / 250) * 0.05 + 0.12;
      ctx.fillStyle = `rgba(105, 240, 174, ${auraPulse})`;
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -now / 50;
      ctx.beginPath();
      ctx.arc(drone.x, drone.y, drone.auraRadius || 200, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 2. Shadow under drone
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(drone.x, drone.y + 12, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Drone Body (hovering slightly, spinning rotors)
      ctx.save();
      ctx.translate(drone.x, drone.y);

      // Rotors (spinning cross)
      const rotorAngle = (now / 40) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 230, 201, 0.7)';
      ctx.lineWidth = 2;
      for (let r = 0; r < 4; r++) {
        const ra = rotorAngle + (r * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ra) * 18, Math.sin(ra) * 18);
        ctx.stroke();
      }

      // Drone Central Chassis
      ctx.fillStyle = '#263238';
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glowing Center Core
      ctx.fillStyle = '#00e676';
      ctx.shadowColor = '#69f0ae';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Turret Barrel pointing at drone.angle
      ctx.rotate(drone.angle || 0);
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(4, -2.5, 12, 5);

      ctx.restore();
    }
  }

  drawShockwaves(ctx) {
    if (!this.shockwaves || this.shockwaves.length === 0) return;
    for (let i = 0; i < this.shockwaves.length; i++) {
      const s = this.shockwaves[i];
      ctx.save();
      ctx.strokeStyle = s.color || '#ff9800';
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.lineWidth = Math.max(1, 6 * s.alpha);
      ctx.shadowColor = s.color || '#ff9800';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBlinkTrails(ctx) {
    if (!this.blinkTrails || this.blinkTrails.length === 0) return;
    for (let i = 0; i < this.blinkTrails.length; i++) {
      const bt = this.blinkTrails[i];
      ctx.save();
      ctx.strokeStyle = bt.color || '#00e5ff';
      ctx.globalAlpha = Math.max(0, bt.alpha);
      ctx.lineWidth = 4;
      ctx.shadowColor = bt.color || '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.setLineDash([12, 6]);
      ctx.beginPath();
      ctx.moveTo(bt.fromX, bt.fromY);
      ctx.lineTo(bt.toX, bt.toY);
      ctx.stroke();

      // Origin and destination flash points
      ctx.fillStyle = bt.color || '#00e5ff';
      ctx.beginPath();
      ctx.arc(bt.fromX, bt.fromY, 6, 0, Math.PI * 2);
      ctx.arc(bt.toX, bt.toY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawDarknessAndLights(ctx, gameState, localPlayerId, map) {
    if (!this.darknessCanvas || !this.darknessCtx) {
      this.drawFlashlightWarmSheen(ctx, (gameState && gameState.players) || []);
      return;
    }

    const ambient = (map && map.theme && map.theme.ambient) || 'normal';
    const baseColor = ambient === 'snow' ? '#040914' :
      ambient === 'embers' ? '#120604' :
      ambient === 'sand' ? '#0e0905' : '#05070d';

    const dCtx = this.darknessCtx;
    dCtx.save();
    dCtx.clearRect(0, 0, 1600, 1200);
    dCtx.globalCompositeOperation = 'source-over';
    dCtx.globalAlpha = this.currentDarknessAlpha;
    dCtx.fillStyle = baseColor;
    dCtx.fillRect(0, 0, 1600, 1200);

    dCtx.globalCompositeOperation = 'destination-out';
    dCtx.globalAlpha = 1.0;
    this.cutoutLightingSources(dCtx, gameState, localPlayerId);
    dCtx.restore();

    ctx.drawImage(this.darknessCanvas, 0, 0);
    this.drawFlashlightWarmSheen(ctx, (gameState && gameState.players) || []);
  }

  cutoutLightingSources(dCtx, gameState, localPlayerId) {
    if (!gameState) return;

    // Players: personal aura & tactical flashlight cone
    const players = gameState.players || [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.isDead) continue;
      const isDowned = !!p.isDowned;
      const outerR = isDowned ? 75 : (p.id === localPlayerId ? 140 : 115);
      this.cutoutRadialLight(dCtx, p.x, p.y, 25, outerR, isDowned ? 0.6 : 1.0);
      if (!isDowned) this.cutoutFlashlightCone(dCtx, p);
    }

    // Muzzle flashes
    const flashes = this.muzzleFlashes || [];
    for (let i = 0; i < flashes.length; i++) {
      const mf = flashes[i];
      const maxL = mf.maxLife || 0.06;
      this.cutoutRadialLight(dCtx, mf.x, mf.y, 10, mf.lightRadius || 180, Math.min(1, (mf.life / maxL) * 0.95));
    }

    this.cutoutEntityLights(dCtx, gameState);
  }

  cutoutEntityLights(dCtx, gameState) {
    const bullets = gameState.bullets || [];
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (b.isFireball) this.cutoutRadialLight(dCtx, b.x, b.y, 15, 135, 0.85);
      else if (b.type === 'rocket') this.cutoutRadialLight(dCtx, b.x, b.y, 15, 120, 0.85);
      else this.cutoutRadialLight(dCtx, b.x, b.y, 5, 45, 0.45);
    }

    const barricades = gameState.barricades || [];
    for (let i = 0; i < barricades.length; i++) {
      if (barricades[i].type === 'barrel') {
        this.cutoutRadialLight(dCtx, barricades[i].x, barricades[i].y, 10, 65, 0.45);
      }
    }

    const drones = gameState.drones || [];
    for (let i = 0; i < drones.length; i++) {
      this.cutoutRadialLight(dCtx, drones[i].x, drones[i].y, 20, drones[i].auraRadius || 200, 0.75);
    }

    const shockwaves = this.shockwaves || [];
    for (let i = 0; i < shockwaves.length; i++) {
      const s = shockwaves[i];
      this.cutoutRadialLight(dCtx, s.x, s.y, 0, s.radius * 1.35, typeof s.alpha === 'number' ? s.alpha : 0.5);
    }
  }

  cutoutRadialLight(ctx, x, y, innerR = 0, outerR = 100, alpha = 1.0) {
    if (outerR <= 0 || alpha <= 0) return;
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, Math.max(0, innerR), x, y, outerR);
    grad.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, outerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  cutoutFlashlightCone(ctx, p) {
    const mx = p.x + Math.cos(p.angle) * 18;
    const my = p.y + Math.sin(p.angle) * 18;
    const dist = 420;

    ctx.save();
    // Soft outer penumbra cone
    const penumbraGrad = ctx.createRadialGradient(mx, my, 20, mx, my, dist);
    penumbraGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    penumbraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = penumbraGrad;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.arc(mx, my, dist, p.angle - 0.58, p.angle + 0.58);
    ctx.closePath();
    ctx.fill();

    // Bright core cone
    const coreGrad = ctx.createRadialGradient(mx, my, 15, mx, my, dist);
    coreGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.arc(mx, my, dist, p.angle - 0.42, p.angle + 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawFlashlightWarmSheen(ctx, players) {
    if (!players || !players.length) return;
    ctx.save();
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.isDead || p.isDowned) continue;
      const mx = p.x + Math.cos(p.angle) * 18;
      const my = p.y + Math.sin(p.angle) * 18;
      const dist = 420;
      const grad = ctx.createRadialGradient(mx, my, 20, mx, my, dist);
      grad.addColorStop(0, 'rgba(255, 248, 220, 0.07)');
      grad.addColorStop(1, 'rgba(255, 248, 220, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.arc(mx, my, dist, p.angle - 0.42, p.angle + 0.42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawZombieEyesInDark(ctx, zombies, players) {
    if (this.currentDarknessAlpha < 0.30 || !zombies || !players || !zombies.length || !players.length) return;

    const alivePlayers = players.filter(p => !p.isDead);
    if (!alivePlayers.length) return;

    const eyeColors = {
      DEVIL: '#ff6d00',
      VAMPIRE: '#ff1744',
      MUMMY: '#c6ff00',
      RUNNER: '#ff5252',
      TANK: '#ffab00',
      NORMAL: '#ff1744'
    };

    ctx.save();
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i];
      if (z.isDead || z.hp <= 0) continue;

      let minDistSq = Infinity;
      for (let j = 0; j < alivePlayers.length; j++) {
        const dx = z.x - alivePlayers[j].x;
        const dy = z.y - alivePlayers[j].y;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistSq) minDistSq = dSq;
      }

      if (minDistSq <= 400 * 400) {
        const minDist = Math.sqrt(minDistSq);
        const eyeColor = eyeColors[z.type] || '#ff1744';
        const alpha = Math.max(0.2, (1 - minDist / 400)) * Math.min(1, this.currentDarknessAlpha / 0.7);
        const hx = z.x + Math.cos(z.angle) * 8;
        const hy = z.y + Math.sin(z.angle) * 8;
        const px = -Math.sin(z.angle) * 4;
        const py = Math.cos(z.angle) * 4;

        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = eyeColor;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(hx + px, hy + py, 1.8, 0, Math.PI * 2);
        ctx.arc(hx - px, hy - py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Renderer };
}
if (typeof window !== 'undefined') {
  window.Renderer = Renderer;
}
