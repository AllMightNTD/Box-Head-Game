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
    this.swordTrails = [];
    this.shellCasings = [];
    this.gunSmoke = [];
    this.railgunBeams = [];

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
    this.swordTrails = [];
    this.shellCasings = [];
    this.gunSmoke = [];
    this.railgunBeams = [];
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
    while (this.particles.length > 180) {
      this.particles.shift();
    }
    this.triggerScreenShake(radius > 120 ? 18 : 10);
  }

  addDirectionalBlood(x, y, impactAngle = 0, weapon = 'bullet', isKill = false, color = '#8a0303') {
    if (this.bloodCtx) {
      this.paintDirectionalBloodSplatter(x, y, impactAngle, weapon, isKill, color);
    }
    this.spawnDirectionalGoreParticles(x, y, impactAngle, weapon, isKill, color);
  }

  paintDirectionalBloodSplatter(x, y, impactAngle, weapon, isKill, color) {
    this.bloodCtx.save();
    const isHeavy = weapon === 'SHOTGUN' || weapon === 'shotgun' || weapon === 'RAILGUN' || isKill;
    const count = isKill ? 12 : (isHeavy ? 9 : 5);
    const baseDist = isHeavy ? 55 : 30;

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.9;
      const angle = impactAngle + spread;
      const dist = Math.random() * baseDist + 10;
      const bx = x + Math.cos(angle) * dist;
      const by = y + Math.sin(angle) * dist;
      const r = Math.random() * (isKill ? 4.5 : 3.0) + 1.5;

      this.bloodCtx.fillStyle = color;
      this.bloodCtx.globalAlpha = Math.random() * 0.4 + 0.5;
      this.bloodCtx.beginPath();
      this.bloodCtx.arc(bx, by, r, 0, Math.PI * 2);
      this.bloodCtx.fill();

      if (Math.random() < 0.4) {
        this.bloodCtx.beginPath();
        this.bloodCtx.moveTo(bx, by);
        this.bloodCtx.lineTo(bx + Math.cos(angle) * (r * 3.5), by + Math.sin(angle) * (r * 3.5));
        this.bloodCtx.strokeStyle = color;
        this.bloodCtx.lineWidth = Math.random() * 2 + 1;
        this.bloodCtx.stroke();
      }
    }
    this.bloodCtx.restore();
  }

  spawnDirectionalGoreParticles(x, y, impactAngle, weapon, isKill, color) {
    const isHeavy = weapon === 'SHOTGUN' || weapon === 'shotgun' || weapon === 'RAILGUN' || isKill;
    const count = isKill ? 10 : (isHeavy ? 7 : 4);
    const baseSpeed = isKill ? 260 : (isHeavy ? 200 : 140);

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.0;
      const angle = impactAngle + spread;
      const speed = Math.random() * baseSpeed + 50;
      const isChunk = isKill && Math.random() < 0.4;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: isChunk ? Math.random() * 3 + 3 : Math.random() * 2 + 1.2,
        color: isChunk ? '#4a0000' : color,
        life: Math.random() * 0.25 + 0.15,
        maxLife: 0.4,
        drag: 0.88
      });
    }
    while (this.particles.length > 180) {
      this.particles.shift();
    }
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

  addMuzzleFlash(x, y, angle, weapon = 'PISTOL') {
    const configs = {
      PISTOL:  { life: 0.06,  lightRadius: 170, smoke: 1, eject: 'brass' },
      UZI:     { life: 0.045, lightRadius: 160, smoke: 1, eject: 'brass' },
      SHOTGUN: { life: 0.09,  lightRadius: 250, smoke: 3, eject: 'shotgun' },
      ROCKET:  { life: 0.11,  lightRadius: 260, smoke: 3, eject: null },
      RAILGUN: { life: 0.14,  lightRadius: 300, smoke: 2, eject: null }
    };
    const key = (weapon || 'PISTOL').toUpperCase();
    const cfg = configs[key] || configs.PISTOL;

    this.muzzleFlashes.push({
      x,
      y,
      angle,
      weapon: key,
      life: cfg.life,
      maxLife: cfg.life,
      lightRadius: cfg.lightRadius
    });

    if (cfg.eject) {
      this.spawnShellCasing(x, y, angle, cfg.eject);
    }
    if (cfg.smoke > 0) {
      this.spawnGunSmoke(x, y, angle, cfg.smoke);
    }
    if (key === 'RAILGUN') {
      this.railgunBeams.push({
        x,
        y,
        angle,
        life: 0.25,
        maxLife: 0.25
      });
    }
  }

  spawnShellCasing(x, y, angle, type) {
    if (this.shellCasings.length >= 80) {
      this.shellCasings.shift();
    }
    const ejectAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    const speed = 60 + Math.random() * 70;
    this.shellCasings.push({
      x,
      y,
      z: 12,
      vx: Math.cos(ejectAngle) * speed,
      vy: Math.sin(ejectAngle) * speed,
      vz: 80 + Math.random() * 50,
      vRot: (Math.random() - 0.5) * 16,
      rotation: Math.random() * Math.PI * 2,
      type,
      life: 3.0,
      maxLife: 3.0
    });
  }

  spawnGunSmoke(x, y, angle, count) {
    for (let i = 0; i < count; i++) {
      while (this.gunSmoke.length >= 50) {
        this.gunSmoke.shift();
      }
      const spread = (Math.random() - 0.5) * 0.5;
      const speed = 25 + Math.random() * 35;
      this.gunSmoke.push({
        x: x + Math.cos(angle) * (12 + Math.random() * 8),
        y: y + Math.sin(angle) * (12 + Math.random() * 8),
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed - 10,
        radius: 4 + Math.random() * 3,
        maxRadius: 14 + Math.random() * 6,
        currentRadius: 4,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6
      });
    }
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

  addSwordTrail(x, y, angle, options = {}) {
    const radius = options.radius || 65;
    const arcRad = options.arcRad || Math.PI * 0.75;
    const color = options.color || '#ff3d00';
    const duration = options.duration || 0.2;
    const isFullCircle = Boolean(options.isFullCircle);

    this.swordTrails.push({
      x,
      y,
      angle: angle || 0,
      radius,
      arcRad,
      color,
      duration,
      life: duration,
      maxLife: duration,
      isFullCircle
    });
  }

  addWarriorSkillVfx(ev) {
    if (!ev) return;
    const type = ev.type;

    if (type === 'WARRIOR_SKILL') {
      const skillId = ev.skillId;
      if (skillId === 'BERSERKER_STANCE') {
        this.addSwordTrail(ev.x, ev.y, ev.angle, {
          radius: 65,
          arcRad: Math.PI * 0.75,
          color: '#ff3d00',
          duration: 0.18
        });
        for (let i = 0; i < 6; i++) {
          const a = (ev.angle || 0) + (Math.random() - 0.5) * 0.8;
          const spd = Math.random() * 120 + 80;
          this.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: Math.random() * 3 + 2,
            color: '#ff9100',
            life: 0.2,
            maxLife: 0.2
          });
        }
      } else if (skillId === 'JUGGERNAUT_STANCE') {
        this.addSwordTrail(ev.x, ev.y, ev.angle, {
          radius: 85,
          arcRad: Math.PI * 0.85,
          color: '#ff6d00',
          duration: 0.25
        });
        this.triggerScreenShake(3);
        for (let i = 0; i < 8; i++) {
          const a = (ev.angle || 0) + (Math.random() - 0.5) * 1.0;
          const spd = Math.random() * 140 + 70;
          this.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: Math.random() * 4 + 2,
            color: '#ffab00',
            life: 0.25,
            maxLife: 0.25
          });
        }
      } else if (skillId === 'BLADE_WHIRLWIND') {
        this.addSwordTrail(ev.x, ev.y, 0, {
          radius: ev.radius || 105,
          isFullCircle: true,
          color: '#ff3d00',
          duration: 0.3
        });
        this.triggerScreenShake(4);
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = Math.random() * 160 + 60;
          this.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: Math.random() * 3 + 2,
            color: Math.random() < 0.5 ? '#ff3d00' : '#80d8ff',
            life: 0.28,
            maxLife: 0.28
          });
        }
      } else if (skillId === 'SHADOW_DASH_SLASH') {
        if (typeof ev.toX === 'number' && typeof ev.toY === 'number') {
          this.addBlinkTrail(ev.x, ev.y, ev.toX, ev.toY, '#ff3d00');
          this.addSwordTrail(ev.toX, ev.toY, ev.angle || 0, {
            radius: 75,
            arcRad: Math.PI * 0.8,
            color: '#ff1744',
            duration: 0.22
          });
        } else {
          this.addSwordTrail(ev.x, ev.y, ev.angle || 0, {
            radius: 75,
            arcRad: Math.PI * 0.8,
            color: '#ff1744',
            duration: 0.22
          });
        }
        this.triggerScreenShake(4);
      } else if (skillId === 'SEISMIC_SLAM') {
        this.addShockwave(ev.x, ev.y, 220, '#ff6d00');
        this.triggerScreenShake(8);
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = Math.random() * 180 + 70;
          this.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: Math.random() * 5 + 3,
            color: ['#ff6d00', '#ff9800', '#5d4037', '#212121'][Math.floor(Math.random() * 4)],
            life: 0.45,
            maxLife: 0.45
          });
        }
      } else if (skillId === 'WAR_CRY') {
        this.addShockwave(ev.x, ev.y, ev.radius || 900, '#ffd600');
        this.triggerScreenShake(5);
      } else if (skillId === 'COUNTER_SHIELD_BASH') {
        this.addSwordTrail(ev.x, ev.y, ev.angle || 0, {
          radius: 55,
          arcRad: Math.PI * 0.8,
          color: '#00e5ff',
          duration: 0.25
        });
        this.triggerScreenShake(2);
      }
    } else if (type === 'WARRIOR_COUNTER') {
      this.addShockwave(ev.x, ev.y, 110, '#00e5ff');
      this.addSwordTrail(ev.x, ev.y, ev.angle || 0, {
        radius: 90,
        arcRad: Math.PI * 0.85,
        color: '#00e5ff',
        duration: 0.28
      });
      this.triggerScreenShake(6);
      for (let i = 0; i < 15; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 220 + 90;
        this.particles.push({
          x: ev.x,
          y: ev.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          radius: Math.random() * 4 + 2,
          color: Math.random() < 0.6 ? '#00e5ff' : '#ffd600',
          life: 0.35,
          maxLife: 0.35
        });
      }
    } else if (type === 'WARRIOR_MARK_EXPLODE') {
      this.addShockwave(ev.x, ev.y, ev.radius || 120, '#ff1744');
      this.triggerScreenShake(7);
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 200 + 70;
        this.particles.push({
          x: ev.x,
          y: ev.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          radius: Math.random() * 5 + 2,
          color: '#ff1744',
          life: 0.35,
          maxLife: 0.35
        });
      }
    } else if (type === 'WARRIOR_AVATAR_END') {
      this.addShockwave(ev.x, ev.y, ev.radius || 240, '#ff3d00');
      this.addShockwave(ev.x, ev.y, (ev.radius || 240) * 0.6, '#ffd600');
      this.triggerScreenShake(12);
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 280 + 100;
        this.particles.push({
          x: ev.x,
          y: ev.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          radius: Math.random() * 8 + 4,
          color: ['#ff3d00', '#ff9100', '#ffd600', '#ffeb3b'][Math.floor(Math.random() * 4)],
          life: 0.6,
          maxLife: 0.6
        });
      }
    } else if (type === 'ULTIMATE' && ev.ultId === 'AVATAR_OF_WAR') {
      this.addShockwave(ev.x, ev.y, 160, '#ff3d00');
      this.triggerScreenShake(8);
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 200 + 80;
        this.particles.push({
          x: ev.x,
          y: ev.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          radius: Math.random() * 6 + 3,
          color: ['#ff3d00', '#ff6d00', '#ffd600'][Math.floor(Math.random() * 3)],
          life: 0.45,
          maxLife: 0.45
        });
      }
    }
  }

  spawnWarriorVfx(ev) {
    return this.addWarriorSkillVfx(ev);
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
      const drag = typeof p.drag === 'number' ? p.drag : 0.94;
      p.vx *= drag;
      p.vy *= drag;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Shell casings, gun smoke and railgun plasma beams
    this.updateShellCasings(dt);
    this.updateGunSmoke(dt);
    this.updateRailgunBeams(dt);

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

    // Melee Sword Trails (Warrior slashes & whirlwind)
    for (let i = this.swordTrails.length - 1; i >= 0; i--) {
      const st = this.swordTrails[i];
      st.life -= dt;
      if (st.life <= 0) {
        this.swordTrails.splice(i, 1);
      }
    }
  }

  updateShellCasings(dt) {
    if (!this.shellCasings) return;
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const sc = this.shellCasings[i];
      sc.life -= dt;
      if (sc.life <= 0) {
        this.shellCasings.splice(i, 1);
        continue;
      }
      if (sc.z > 0 || sc.vz > 0) {
        sc.x += sc.vx * dt;
        sc.y += sc.vy * dt;
        sc.z += sc.vz * dt;
        sc.vz -= 420 * dt;
        sc.rotation += sc.vRot * dt;
        if (sc.z <= 0) {
          sc.z = 0;
          sc.vz = -sc.vz * 0.45;
          sc.vx *= 0.6;
          sc.vy *= 0.6;
          sc.vRot *= 0.5;
          if (Math.abs(sc.vz) < 20) sc.vz = 0;
        }
      }
    }
  }

  updateGunSmoke(dt) {
    if (!this.gunSmoke) return;
    for (let i = this.gunSmoke.length - 1; i >= 0; i--) {
      const gs = this.gunSmoke[i];
      gs.life -= dt;
      if (gs.life <= 0) {
        this.gunSmoke.splice(i, 1);
        continue;
      }
      gs.x += gs.vx * dt;
      gs.y += gs.vy * dt;
      gs.vx *= 0.92;
      gs.vy *= 0.92;
      const progress = 1 - (gs.life / gs.maxLife);
      gs.currentRadius = gs.radius + (gs.maxRadius - gs.radius) * progress;
    }
  }

  updateRailgunBeams(dt) {
    if (!this.railgunBeams) return;
    for (let i = this.railgunBeams.length - 1; i >= 0; i--) {
      const rb = this.railgunBeams[i];
      rb.life -= dt;
      if (rb.life <= 0) {
        this.railgunBeams.splice(i, 1);
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

    // 2.6 Draw Ground Zones (Seismic fissures & Slash marks)
    this.drawGroundZones(ctx, gameState.groundZones || []);

    // 2.7 Draw Ejected Shell Casings on Floor
    this.drawShellCasings(ctx);

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

    // 8.5 Draw Railgun Beams
    this.drawRailgunBeams(ctx);

    // 9. Draw Muzzle Flashes
    this.drawMuzzleFlashes(ctx);

    // 9.5 Draw Melee Sword Trails
    this.drawSwordTrails(ctx);

    // 9.6 Draw Gun Smoke
    this.drawGunSmoke(ctx);

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
    const isWarrior = player.character === 'WARRIOR' && Boolean(player.warriorState);
    const isAvatar = isWarrior && Boolean(player.warriorState.avatarActive);

    // 1. Draw Player Ring on ground
    this.drawPlayerRing(ctx, player);

    // 1.5 Warrior Ground Auras (War Cry Foot Aura)
    if (isWarrior && (player.warriorState.warCryAuraActive || player.hasWarCryBuff)) {
      ctx.save();
      const pulse = 1 + 0.1 * Math.sin(Date.now() / 150);
      ctx.strokeStyle = '#ffd600';
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(Math.round(player.x), Math.round(player.y), Math.round(28 * pulse), Math.round(18 * pulse), 0, 0, Math.PI * 2);
      } else if (typeof ctx.arc === 'function') {
        ctx.arc(Math.round(player.x), Math.round(player.y), Math.round(28 * pulse), 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Downed state
    if (player.isDowned) {
      this.drawDownedPlayer(ctx, player);
      this.drawPlayerTag(ctx, player, isLocal);
      return;
    }

    // Wrap body and weapon in Avatar scaling if active
    if (isAvatar) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.scale(1.35, 1.35);
      ctx.translate(-player.x, -player.y);

      // Blazing flame aura under avatar
      ctx.save();
      const flamePulse = 1 + 0.15 * Math.sin(Date.now() / 90);
      ctx.strokeStyle = '#ff3d00';
      ctx.shadowColor = '#ffd600';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(Math.round(player.x), Math.round(player.y + 10), Math.round(32 * flamePulse), Math.round(20 * flamePulse), 0, 0, Math.PI * 2);
      } else if (typeof ctx.arc === 'function') {
        ctx.arc(Math.round(player.x), Math.round(player.y + 10), Math.round(32 * flamePulse), 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
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

    // Warrior Overlays (Counter Shield frontal arc & Whirlwind ring)
    if (isWarrior) {
      if (player.warriorState.counterShieldActive) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        ctx.strokeStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(12, 0, 26, 26, 0, -Math.PI / 3, Math.PI / 3);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(12, 0, 26, -Math.PI / 3, Math.PI / 3);
        }
        ctx.stroke();
        ctx.restore();
      }

      if (player.warriorState.whirlwindActive) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(Date.now() / 80);
        ctx.strokeStyle = '#ff3d00';
        ctx.shadowColor = '#ff6d00';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, 48, 48, 0, 0, Math.PI * 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, 48, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    if (isAvatar) {
      ctx.restore();
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
    } else if (weaponId === 'BERSERKER_STANCE') {
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(12, 5, 4, 10);
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(16, 7, 28, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(16, 7, 28, 2);
    } else if (weaponId === 'JUGGERNAUT_STANCE') {
      ctx.fillStyle = '#ff6d00';
      ctx.fillRect(10, 4, 6, 12);
      ctx.fillStyle = '#37474f';
      ctx.fillRect(16, 5, 32, 10);
      ctx.fillStyle = '#78909c';
      ctx.fillRect(16, 7, 30, 4);
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

    const barW = 36;
    const barH = 5;
    const hpRatio = Math.max(0, player.hp / player.maxHp);
    const hasArmor = (player.maxArmor || 0) > 0;

    if (hasArmor) {
      const armorRatio = Math.max(0, Math.min(1, (player.armor || 0) / player.maxArmor));
      // Armor bar above HP
      ctx.fillStyle = '#111111';
      ctx.fillRect(-barW / 2 - 1, 3, barW + 2, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-barW / 2, 4, barW * armorRatio, 2);

      // HP bar below Armor
      ctx.fillStyle = '#111111';
      ctx.fillRect(-barW / 2 - 1, 8, barW + 2, barH + 2);
      ctx.fillStyle = hpRatio > 0.5 ? '#00e676' : (hpRatio > 0.25 ? '#ffeb3b' : '#ff1744');
      ctx.fillRect(-barW / 2, 9, barW * hpRatio, barH);
    } else {
      // Standard Health bar
      ctx.fillStyle = '#111111';
      ctx.fillRect(-barW / 2 - 1, 4, barW + 2, barH + 2);
      ctx.fillStyle = hpRatio > 0.5 ? '#00e676' : (hpRatio > 0.25 ? '#ffeb3b' : '#ff1744');
      ctx.fillRect(-barW / 2, 5, barW * hpRatio, barH);
    }

    // Revive progress bar if active
    if (player.reviving) {
      const revRatio = player.reviveProgress / 2.0;
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-barW / 2, hasArmor ? 16 : 12, barW * revRatio, 4);
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

    // 5. Taunted & Feared Warrior Status Overlays
    if (zombie.isTaunted) {
      ctx.save();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#ff1744';
      ctx.shadowColor = '#ff5252';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText('💢 TAUNTED', zombie.x, zombie.y - dh / 2 - 20);
      ctx.restore();
    }
    if (zombie.isFeared) {
      ctx.save();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#e040fb';
      ctx.shadowColor = '#ea80fc';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText('😱 FEAR', zombie.x, zombie.y - dh / 2 - (zombie.isTaunted ? 34 : 20));
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
        this.drawFireballBullet(ctx);
      } else if (b.type === 'rocket') {
        this.drawRocketBullet(ctx, b.angle || 0);
      } else if (b.type === 'railgun') {
        this.drawRailgunBullet(ctx, b.angle || 0);
      } else if (b.type === 'shotgun') {
        this.drawShotgunBullet(ctx, b.angle || 0);
      } else if (b.type === 'wind_blade') {
        // Spinning crescent wind blade
        ctx.rotate(b.angle || 0);
        ctx.strokeStyle = '#80d8ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, 16, 7, 0, -Math.PI / 2, Math.PI / 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, 14, -Math.PI / 2, Math.PI / 2);
        }
        ctx.stroke();

      } else if (b.type === 'fire_slash') {
        // Blazing crescent fire slash
        ctx.rotate(b.angle || 0);
        ctx.strokeStyle = '#ff5722';
        ctx.fillStyle = '#ffd600';
        ctx.shadowColor = '#ff3d00';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, 22, 10, 0, -Math.PI / 2, Math.PI / 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, 18, -Math.PI / 2, Math.PI / 2);
        }
        ctx.stroke();
      } else {
        this.drawTracerBullet(ctx, b.angle || 0);
      }

      ctx.restore();
    }
  }

  drawFireballBullet(ctx) {
    ctx.rotate(Date.now() / 80);
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRocketBullet(ctx, angle) {
    ctx.rotate(angle);
    ctx.fillStyle = '#424242';
    ctx.fillRect(-10, -4, 18, 8);
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.lineTo(14, 0);
    ctx.lineTo(8, 4);
    ctx.fill();

    const flameLen = 8 + Math.random() * 8;
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.moveTo(-10, -3);
    ctx.lineTo(-10 - flameLen, 0);
    ctx.lineTo(-10, 3);
    ctx.fill();

    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(-10, -1.5);
    ctx.lineTo(-10 - flameLen * 0.6, 0);
    ctx.lineTo(-10, 1.5);
    ctx.fill();
  }

  drawRailgunBullet(ctx, angle) {
    ctx.rotate(angle);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-45, 0);
    ctx.lineTo(45, 0);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(40, 0);
    ctx.stroke();
  }

  drawShotgunBullet(ctx, angle) {
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-22, 0, 0, 0);
    grad.addColorStop(0, 'rgba(255, 152, 0, 0)');
    grad.addColorStop(1, '#ff9800');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTracerBullet(ctx, angle) {
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-34, 0, 0, 0);
    grad.addColorStop(0, 'rgba(255, 235, 59, 0)');
    grad.addColorStop(1, '#fffde7');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.fillStyle = '#fffde7';
    ctx.fillRect(-4, -1.5, 8, 3);
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

  drawShellCasings(ctx) {
    if (!this.shellCasings || !this.shellCasings.length) return;
    for (let i = 0; i < this.shellCasings.length; i++) {
      const sc = this.shellCasings[i];
      ctx.save();
      ctx.translate(sc.x, sc.y - (sc.z || 0));
      ctx.rotate(sc.rotation || 0);
      const alpha = Math.min(1, sc.life / 0.5);
      ctx.globalAlpha = Math.max(0, alpha);

      if (sc.type === 'shotgun') {
        ctx.fillStyle = '#d32f2f';
        ctx.fillRect(-3, -2, 6, 4);
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(-3, -2, 2, 4);
      } else {
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(-3, -1.5, 6, 3);
        ctx.fillStyle = '#ffb300';
        ctx.fillRect(-3, -1.5, 1.5, 3);
      }
      ctx.restore();
    }
  }

  drawGunSmoke(ctx) {
    if (!this.gunSmoke || !this.gunSmoke.length) return;
    for (let i = 0; i < this.gunSmoke.length; i++) {
      const gs = this.gunSmoke[i];
      const alpha = (gs.life / gs.maxLife) * 0.35;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#b0bec5';
      ctx.beginPath();
      ctx.arc(gs.x, gs.y, gs.currentRadius || gs.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawRailgunBeams(ctx) {
    if (!this.railgunBeams || !this.railgunBeams.length) return;
    for (let i = 0; i < this.railgunBeams.length; i++) {
      const rb = this.railgunBeams[i];
      const alpha = Math.max(0, rb.life / rb.maxLife);
      const length = 1800;
      const x2 = rb.x + Math.cos(rb.angle) * length;
      const y2 = rb.y + Math.sin(rb.angle) * length;

      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(rb.x, rb.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rb.x, rb.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawMuzzleFlashes(ctx) {
    for (let i = 0; i < this.muzzleFlashes.length; i++) {
      const mf = this.muzzleFlashes[i];
      ctx.save();
      ctx.translate(mf.x, mf.y);
      ctx.rotate(mf.angle);
      this.drawWeaponFlashShape(ctx, mf);
      ctx.restore();
    }
  }

  drawWeaponFlashShape(ctx, mf) {
    const weapon = mf.weapon || 'PISTOL';
    if (weapon === 'SHOTGUN') {
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(32, -18);
      ctx.lineTo(48, -8);
      ctx.lineTo(40, 0);
      ctx.lineTo(48, 8);
      ctx.lineTo(32, 18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(22, -10);
      ctx.lineTo(32, 0);
      ctx.lineTo(22, 10);
      ctx.closePath();
      ctx.fill();
    } else if (weapon === 'UZI') {
      ctx.fillStyle = '#ffee58';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, -10);
      ctx.lineTo(26, -3);
      ctx.lineTo(16, 0);
      ctx.lineTo(26, 3);
      ctx.lineTo(14, 10);
      ctx.closePath();
      ctx.fill();
    } else if (weapon === 'ROCKET') {
      ctx.fillStyle = '#f44336';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(54, 0);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(36, 0);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
    } else if (weapon === 'RAILGUN') {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(24, -14);
      ctx.lineTo(64, 0);
      ctx.lineTo(24, 14);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(18, -6);
      ctx.lineTo(44, 0);
      ctx.lineTo(18, 6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, -8);
      ctx.lineTo(28, 0);
      ctx.lineTo(14, 8);
      ctx.closePath();
      ctx.fill();
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

  drawSwordTrails(ctx) {
    if (!this.swordTrails || this.swordTrails.length === 0) return;
    for (let i = 0; i < this.swordTrails.length; i++) {
      const trail = this.swordTrails[i];
      const alpha = Math.max(0, trail.life / (trail.maxLife || trail.duration || 0.2));
      ctx.save();
      ctx.translate(trail.x, trail.y);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = trail.color || '#ff3d00';
      ctx.shadowColor = trail.color || '#ff3d00';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';

      ctx.beginPath();
      if (trail.isFullCircle) {
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, trail.radius, trail.radius, 0, 0, Math.PI * 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, trail.radius, 0, Math.PI * 2);
        }
      } else {
        const start = trail.angle - trail.arcRad / 2;
        const end = trail.angle + trail.arcRad / 2;
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, trail.radius, trail.radius, 0, start, end);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, trail.radius, start, end);
        }
      }
      ctx.stroke();

      // Inner brighter crescent core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (trail.isFullCircle) {
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, trail.radius * 0.92, trail.radius * 0.92, 0, 0, Math.PI * 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, trail.radius * 0.92, 0, Math.PI * 2);
        }
      } else {
        const start = trail.angle - trail.arcRad / 2;
        const end = trail.angle + trail.arcRad / 2;
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, trail.radius * 0.92, trail.radius * 0.92, 0, start, end);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, trail.radius * 0.92, start, end);
        }
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  drawGroundZones(ctx, groundZones) {
    if (!Array.isArray(groundZones) || groundZones.length === 0) return;

    for (let i = 0; i < groundZones.length; i++) {
      const gz = groundZones[i];
      ctx.save();
      ctx.translate(gz.x, gz.y);

      if (gz.type === 'seismic_fissure') {
        const rad = gz.radius || 160;
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 150);

        // Outer glow circle
        ctx.fillStyle = `rgba(255, 87, 34, ${0.15 * pulse})`;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, rad, rad, 0, 0, Math.PI * 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
        }
        ctx.fill();

        // Jagged magma cracks
        ctx.strokeStyle = `rgba(255, 171, 0, ${0.85 * pulse})`;
        ctx.shadowColor = '#ff6d00';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;

        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const baseAngle = (a * Math.PI) / 3;
          const r1 = rad * 0.35;
          const r2 = rad * 0.85;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(baseAngle) * r1, Math.sin(baseAngle) * r1);
          ctx.lineTo(Math.cos(baseAngle + 0.2) * r2, Math.sin(baseAngle + 0.2) * r2);
        }
        ctx.stroke();

        // Glowing border
        ctx.strokeStyle = `rgba(255, 61, 0, ${0.5 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, rad, rad, 0, 0, Math.PI * 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
        }
        ctx.stroke();

      } else if (gz.type === 'slash_mark') {
        const rad = gz.radius || 120;
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 100);

        // Warning pull circle
        ctx.fillStyle = `rgba(213, 0, 0, ${0.18 * pulse})`;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, rad, rad, 0, 0, Math.PI * 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
        }
        ctx.fill();

        // Crimson runic cross / slash
        ctx.strokeStyle = '#d50000';
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(-16, -16);
        ctx.lineTo(16, 16);
        ctx.moveTo(-16, 16);
        ctx.lineTo(16, -16);
        ctx.stroke();

        // Warning border
        ctx.strokeStyle = `rgba(255, 23, 68, ${0.8 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(0, 0, rad, rad, 0, 0, Math.PI * 2);
        } else if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

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

    // Railgun beams
    const beams = this.railgunBeams || [];
    for (let i = 0; i < beams.length; i++) {
      const rb = beams[i];
      const alpha = Math.max(0, (rb.life / rb.maxLife) * 0.85);
      if (alpha <= 0) continue;
      dCtx.save();
      dCtx.globalAlpha = alpha;
      dCtx.strokeStyle = 'rgba(0, 0, 0, 1.0)';
      dCtx.lineWidth = 70;
      dCtx.beginPath();
      dCtx.moveTo(rb.x, rb.y);
      dCtx.lineTo(rb.x + Math.cos(rb.angle) * 1800, rb.y + Math.sin(rb.angle) * 1800);
      dCtx.stroke();
      dCtx.restore();
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
    const safeInnerR = Math.max(0, Math.min(innerR, outerR - 0.001));
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, safeInnerR, x, y, outerR);
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
      this.drawSingleZombieEyes(ctx, z, alivePlayers, eyeColors[z.type] || '#ff1744');
    }
    ctx.restore();
  }

  drawSingleZombieEyes(ctx, z, alivePlayers, eyeColor) {
    let minDistSq = Infinity;
    for (let j = 0; j < alivePlayers.length; j++) {
      const dx = z.x - alivePlayers[j].x;
      const dy = z.y - alivePlayers[j].y;
      const dSq = dx * dx + dy * dy;
      if (dSq < minDistSq) minDistSq = dSq;
    }

    if (minDistSq <= 400 * 400) {
      const minDist = Math.sqrt(minDistSq);
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
}

if (typeof window !== 'undefined') {
  window.Renderer = Renderer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Renderer };
}
