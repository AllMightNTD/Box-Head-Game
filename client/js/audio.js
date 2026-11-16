class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.distortionCurve = null;
    this.muted = false;
    this.initialized = false;

    this.lastShellClinkTime = -Infinity;
    this.lastGrowlTime = -Infinity;
    this.droneActive = false;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneFilter = null;
    this.droneGain = null;
    this.droneLfo = null;
    this.droneLfoGain = null;
    this.heartbeatTimer = 0;
    this.growlTimer = 0;

    const WeaponBankClass = (typeof window !== 'undefined' && window.WeaponAudioBank)
      ? window.WeaponAudioBank
      : (typeof require === 'function' ? (require('./weaponAudio.js').WeaponAudioBank || null) : null);
    this.weaponBank = WeaponBankClass ? new WeaponBankClass() : null;
    this.rocketLoops = new Map();
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupAudioGraph();
      this.initialized = true;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      if (this.weaponBank && this.ctx) {
        this.weaponBank.decodeAll(this.ctx).catch(err => {
          console.warn('[SoundManager] Weapon audio decode error:', err);
        });
      }
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  setupAudioGraph() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime || 0;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, t);
    this.masterGain.connect(this.ctx.destination);

    this.compressor = this.ctx.createDynamicsCompressor();
    if (this.compressor.threshold) this.compressor.threshold.setValueAtTime(-14, t);
    if (this.compressor.knee) this.compressor.knee.setValueAtTime(10, t);
    if (this.compressor.ratio) this.compressor.ratio.setValueAtTime(6, t);
    if (this.compressor.attack) this.compressor.attack.setValueAtTime(0.003, t);
    if (this.compressor.release) this.compressor.release.setValueAtTime(0.15, t);
    this.compressor.connect(this.masterGain);

    this.reverbNode = this.ctx.createConvolver();
    const impulse = this.createReverbImpulse(1.1, 3.2);
    if (impulse && this.reverbNode) {
      this.reverbNode.buffer = impulse;
    }

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.24, t);
    if (this.reverbNode) {
      this.reverbNode.connect(this.reverbGain);
    }
    this.reverbGain.connect(this.compressor);

    this.distortionCurve = this.createDistortionCurve(35);
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime || 0);
    }
    if (this.muted && this.droneActive) {
      this.stopHorrorAmbience();
    }
    if (this.muted) {
      this.stopRocketLoops();
    }
    return this.muted;
  }

  createNoiseBuffer(duration = 0.2) {
    if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;
    const sampleRate = this.ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  createReverbImpulse(duration = 1.1, decay = 3.2) {
    if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;
    const sampleRate = this.ctx.sampleRate || 44100;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    for (let c = 0; c < 2; c++) {
      const channelData = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const n = Math.random() * 2 - 1;
        channelData[i] = n * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  createDistortionCurve(amount = 35) {
    const k = typeof amount === 'number' ? amount : 35;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; i++) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  computeStereoPan(sourceX, listenerX) {
    if (!Number.isFinite(sourceX) || !Number.isFinite(listenerX)) return 0;
    const pan = (sourceX - listenerX) / 550;
    return Math.max(-0.88, Math.min(0.88, pan));
  }

  computeDistanceGain(sourceX, listenerX, maxDist = 1100) {
    if (!Number.isFinite(sourceX) || !Number.isFinite(listenerX)) return 1.0;
    const d = Math.abs(sourceX - listenerX);
    const norm = Math.min(1.0, Math.max(0.0, d / maxDist));
    const gain = 1.0 - norm * (1.0 - 0.18);
    return Math.max(0.18, Math.min(1.0, gain));
  }

  createSpatialBus(sourceX, listenerX, reverbSend = 0.2) {
    if (!this.ctx) return null;
    const t = this.ctx.currentTime || 0;
    const target = this.compressor || this.masterGain || this.ctx.destination;

    const input = this.ctx.createGain();
    const distGain = this.computeDistanceGain(sourceX, listenerX);
    input.gain.setValueAtTime(distGain, t);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      const panVal = this.computeStereoPan(sourceX, listenerX);
      panner.pan.setValueAtTime(panVal, t);
      input.connect(panner);
      panner.connect(target);

      if (reverbSend > 0 && this.reverbNode) {
        const wetGain = this.ctx.createGain();
        wetGain.gain.setValueAtTime(reverbSend, t);
        panner.connect(wetGain);
        wetGain.connect(this.reverbNode);
      }
      return { input, panner };
    }

    input.connect(target);
    if (reverbSend > 0 && this.reverbNode) {
      const wetGain = this.ctx.createGain();
      wetGain.gain.setValueAtTime(reverbSend, t);
      input.connect(wetGain);
      wetGain.connect(this.reverbNode);
    }
    return { input, panner: null };
  }

  playShoot(weaponType = 'PISTOL', sourceX, listenerX) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const norm = String(weaponType).toLowerCase();
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    let playedWav = false;

    if (this.weaponBank && this.weaponBank.hasBuffer(norm, 'fire')) {
      playedWav = this.weaponBank.playSample(this.ctx, targetNode, norm, 'fire', {
        sourceX, listenerX, maxDist: 1100
      });

      // Post-shot event sequencing
      if (playedWav) {
        if (norm === 'shotgun') {
          setTimeout(() => {
            if (!this.muted && this.ctx) {
              this.weaponBank.playSample(this.ctx, targetNode, 'shotgun', 'pump', { sourceX, listenerX, delay: 0 });
              this.weaponBank.playSample(this.ctx, targetNode, 'shotgun', 'casing', { sourceX, listenerX, delay: 0.05 });
            }
          }, 220);
        } else if (norm === 'railgun') {
          setTimeout(() => {
            if (!this.muted && this.ctx) {
              this.weaponBank.playSample(this.ctx, targetNode, 'railgun', 'cooldown', { sourceX, listenerX, delay: 0 });
            }
          }, 180);
        } else if (norm === 'pistol' || norm === 'uzi') {
          setTimeout(() => {
            if (!this.muted && this.ctx) {
              this.weaponBank.playSample(this.ctx, targetNode, norm, 'casing', { sourceX, listenerX, delay: 0 });
            }
          }, 50);
        }
      }
    } else if (norm === 'grenade' && this.weaponBank && this.weaponBank.hasBuffer('grenade', 'throw')) {
      playedWav = this.weaponBank.playSample(this.ctx, targetNode, 'grenade', 'throw', {
        sourceX, listenerX, maxDist: 700
      });
    }

    if (!playedWav) {
      // Procedural synth fallback
      const bus = this.createSpatialBus(sourceX, listenerX, 0.22);
      if (!bus) return;
      this.playWeaponTransientLayer(weaponType, bus.input);
      this.playWeaponBodyLayer(weaponType, bus.input);
      this.playShellCasingClink(weaponType, sourceX, listenerX);
    }
  }

  playWeaponTransientLayer(weaponType, destNode) {
    const t = this.ctx.currentTime || 0;
    const durMap = { UZI: 0.05, SHOTGUN: 0.16, ROCKET: 0.18, RAILGUN: 0.22, PISTOL: 0.07 };
    const dur = durMap[weaponType] || 0.07;

    const noise = this.ctx.createBufferSource();
    const nBuffer = this.createNoiseBuffer(dur);
    if (!nBuffer) return;

    noise.buffer = nBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = weaponType === 'SHOTGUN' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(weaponType === 'SHOTGUN' ? 1200 : 2200, t);
    filter.frequency.exponentialRampToValueAtTime(280, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(weaponType === 'SHOTGUN' ? 0.7 : 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    if (typeof this.ctx.createWaveShaper === 'function' && this.distortionCurve) {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = this.distortionCurve;
      noise.connect(shaper);
      shaper.connect(filter);
    } else {
      noise.connect(filter);
    }
    filter.connect(gain);
    gain.connect(destNode);

    noise.start(t);
    noise.stop(t + dur);
  }

  playWeaponBodyLayer(weaponType, destNode) {
    const t = this.ctx.currentTime || 0;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(destNode);

    switch (weaponType) {
      case 'UZI':
        this.synthUziBody(osc, gain, t);
        break;
      case 'SHOTGUN':
        this.synthShotgunBody(osc, gain, t);
        break;
      case 'ROCKET':
        this.synthRocketBody(osc, gain, t);
        break;
      case 'RAILGUN':
        this.synthRailgunBody(osc, gain, t);
        break;
      default:
        this.synthPistolBody(osc, gain, t);
        break;
    }
  }

  synthUziBody(osc, gain, t) {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.06);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  synthShotgunBody(osc, gain, t) {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  synthRocketBody(osc, gain, t) {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(320, t + 0.12);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  synthRailgunBody(osc, gain, t) {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  synthPistolBody(osc, gain, t) {
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playShellCasingClink(weaponType, sourceX, listenerX) {
    if (weaponType === 'ROCKET' || weaponType === 'RAILGUN') return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastShellClinkTime < 75) return;
    this.lastShellClinkTime = now;

    const t = (this.ctx.currentTime || 0) + 0.03;
    const bus = this.createSpatialBus(sourceX, listenerX, 0.15);
    if (!bus) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = 2600 + Math.random() * 800;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.04);

    osc.connect(gain);
    gain.connect(bus.input);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  playExplosion(scale = 1, sourceX, listenerX, source = 'GENERIC') {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    let playedWav = false;
    const srcUpper = String(source).toUpperCase();

    if (this.weaponBank) {
      if (srcUpper === 'GRENADE' && this.weaponBank.hasBuffer('grenade', 'explode')) {
        playedWav = this.weaponBank.playSample(this.ctx, targetNode, 'grenade', 'explode', {
          sourceX, listenerX, volume: Math.min(1.3, scale), maxDist: 1300
        });
      } else if (srcUpper === 'ROCKET' && this.weaponBank.hasBuffer('rocket', 'explode')) {
        playedWav = this.weaponBank.playSample(this.ctx, targetNode, 'rocket', 'explode', {
          sourceX, listenerX, volume: Math.min(1.4, scale * 1.1), maxDist: 1400
        });
      } else {
        const fallbackWeapon = Math.random() < 0.5 ? 'rocket' : 'grenade';
        if (this.weaponBank.hasBuffer(fallbackWeapon, 'explode')) {
          playedWav = this.weaponBank.playSample(this.ctx, targetNode, fallbackWeapon, 'explode', {
            sourceX, listenerX, volume: Math.min(1.2, scale), maxDist: 1200
          });
        }
      }
    }

    if (!playedWav) {
      // Procedural synth fallback
      const bus = this.createSpatialBus(sourceX, listenerX, 0.35);
      if (!bus) return;

      const t = this.ctx.currentTime || 0;
      const dur = Math.min(0.7, 0.35 * scale);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90 * scale, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + dur);
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
      osc.connect(gain);
      gain.connect(bus.input);
      osc.start(t);
      osc.stop(t + dur);

      const noise = this.ctx.createBufferSource();
      const nBuffer = this.createNoiseBuffer(dur);
      if (nBuffer) {
        noise.buffer = nBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, t);
        filter.frequency.linearRampToValueAtTime(80, t + dur);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.8, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(bus.input);
        noise.start(t);
        noise.stop(t + dur);
      }
    }
  }

  playWeaponEmpty(weaponType = 'PISTOL', sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const norm = String(weaponType).toLowerCase();
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, norm, 'empty', { sourceX, listenerX });
  }

  playWeaponReload(weaponType = 'PISTOL', sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const norm = String(weaponType).toLowerCase();
    const event = (norm === 'shotgun' || norm === 'rocket') ? 'load' : 'reload';
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, norm, event, { sourceX, listenerX });
  }

  playRailgunCharge(sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, 'railgun', 'charge', { sourceX, listenerX });
  }

  playRailgunImpact(sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, 'railgun', 'impact', { sourceX, listenerX });
  }

  updateRocketFlight(rockets = [], listenerX) {
    if (this.muted || !this.weaponBank || !this.ctx) {
      this.stopRocketLoops();
      return;
    }
    const safeRockets = Array.isArray(rockets) ? rockets : [];
    const currentIds = new Set();
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;

    for (const r of safeRockets) {
      if (!r || !r.id) continue;
      currentIds.add(r.id);
      if (!this.rocketLoops.has(r.id)) {
        const loop = this.weaponBank.createRocketLoop(this.ctx, targetNode, {
          sourceX: r.x, listenerX
        });
        if (loop) this.rocketLoops.set(r.id, loop);
      } else {
        const loop = this.rocketLoops.get(r.id);
        loop.update({ sourceX: r.x, listenerX });
      }
    }

    for (const [id, loop] of this.rocketLoops.entries()) {
      if (!currentIds.has(id)) {
        loop.stop();
        this.rocketLoops.delete(id);
      }
    }
  }

  stopRocketLoops() {
    if (!this.rocketLoops) return;
    for (const loop of this.rocketLoops.values()) {
      loop.stop(0.05);
    }
    this.rocketLoops.clear();
  }

  playZombieHit(zType = 'NORMAL', weapon = 'bullet', sourceX, listenerX) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const bus = this.createSpatialBus(sourceX, listenerX, 0.18);
    if (!bus) return;
    const t = this.ctx.currentTime || 0;

    const noise = this.ctx.createBufferSource();
    const nBuffer = this.createNoiseBuffer(0.08);
    if (nBuffer) {
      noise.buffer = nBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.08);
      if (filter.Q) filter.Q.setValueAtTime(2.5, t);
      const isShotgun = Boolean(weapon && String(weapon).toUpperCase() === 'SHOTGUN');
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(isShotgun ? 0.45 : 0.3, t);
      nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(bus.input);
      noise.start(t);
      noise.stop(t + 0.08);
    }

    const crack = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    crack.type = 'triangle';
    crack.frequency.setValueAtTime(800, t);
    crack.frequency.exponentialRampToValueAtTime(110, t + 0.035);
    cGain.gain.setValueAtTime(0.35, t);
    cGain.gain.exponentialRampToValueAtTime(0.01, t + 0.035);
    crack.connect(cGain);
    cGain.connect(bus.input);
    crack.start(t);
    crack.stop(t + 0.035);
  }

  playZombieDie(zType = 'NORMAL', sourceX, listenerX) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const bus = this.createSpatialBus(sourceX, listenerX, 0.28);
    if (!bus) return;
    const t = this.ctx.currentTime || 0;

    const carrier = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    carrier.type = zType === 'TANK' ? 'sawtooth' : 'triangle';
    const startFreq = zType === 'TANK' ? 95 : 160;
    carrier.frequency.setValueAtTime(startFreq, t);
    carrier.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    cGain.gain.setValueAtTime(0.4, t);
    cGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    carrier.connect(cGain);
    cGain.connect(bus.input);
    carrier.start(t);
    carrier.stop(t + 0.25);

    try {
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(35, t);
      modGain.gain.setValueAtTime(30, t);
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      mod.start(t);
      mod.stop(t + 0.25);
    } catch (e) {
      console.debug('Failed to connect FM modulator in playZombieDie:', e);
    }

    const noise = this.ctx.createBufferSource();
    const nBuf = this.createNoiseBuffer(0.2);
    if (nBuf) {
      noise.buffer = nBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t);
      filter.frequency.exponentialRampToValueAtTime(70, t + 0.2);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.35, t);
      nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(bus.input);
      noise.start(t);
      noise.stop(t + 0.2);
    }
  }

  playZombieGrowl(zType = 'NORMAL', sourceX, listenerX) {
    if (this.muted) return false;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastGrowlTime < 1800) return false;
    this.lastGrowlTime = now;

    this.ensureContext();
    if (!this.ctx) return true;

    const bus = this.createSpatialBus(sourceX, listenerX, 0.3);
    if (!bus) return true;
    const t = this.ctx.currentTime || 0;

    switch (zType) {
      case 'RUNNER':
        this.synthRunnerGrowl(bus.input, t);
        break;
      case 'TANK':
        this.synthTankGrowl(bus.input, t);
        break;
      case 'DEVIL':
      case 'VAMPIRE':
        this.synthDemonGrowl(bus.input, t);
        break;
      default:
        this.synthNormalGrowl(bus.input, t);
        break;
    }
    return true;
  }

  synthRunnerGrowl(destNode, t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(850, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.3);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.connect(gain);
    gain.connect(destNode);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  synthTankGrowl(destNode, t) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, t);
    osc.frequency.setValueAtTime(68, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.5);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destNode);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  synthDemonGrowl(destNode, t) {
    [180, 180 * 1.414].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.35);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
      osc.connect(gain);
      gain.connect(destNode);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  synthNormalGrowl(destNode, t) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, t);
    if (filter.Q) filter.Q.setValueAtTime(2.0, t);
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destNode);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playWaveStart(wave = 1) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime || 0;
    const target = this.compressor || this.masterGain || this.ctx.destination;
    const chord = [55, 82.4, 110];

    chord.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, t);
      filter.frequency.linearRampToValueAtTime(550, t + 0.3);
      filter.frequency.exponentialRampToValueAtTime(140, t + 1.6);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 1.6);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(target);

      if (this.reverbNode) {
        const revSend = this.ctx.createGain();
        revSend.gain.setValueAtTime(0.5, t);
        gain.connect(revSend);
        revSend.connect(this.reverbNode);
      }
      osc.start(t);
      osc.stop(t + 1.6);
    });
  }

  playHeartbeatPulse(intensity = 1) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime || 0;
    const target = this.compressor || this.masterGain || this.ctx.destination;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(60, t);
    osc1.frequency.exponentialRampToValueAtTime(32, t + 0.12);
    gain1.gain.setValueAtTime(0.45 * intensity, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    osc1.connect(gain1);
    gain1.connect(target);
    osc1.start(t);
    osc1.stop(t + 0.12);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(50, t + 0.13);
    osc2.frequency.exponentialRampToValueAtTime(28, t + 0.24);
    gain2.gain.setValueAtTime(0.35 * intensity, t + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.24);
    osc2.connect(gain2);
    gain2.connect(target);
    osc2.start(t + 0.13);
    osc2.stop(t + 0.24);
  }

  startHorrorDrone(wave = 1) {
    if (!this.ctx || this.droneActive) return;
    try {
      const t = this.ctx.currentTime || 0;
      const target = this.compressor || this.masterGain || this.ctx.destination;
      const safeWave = Math.max(1, (wave && Number.isFinite(wave)) ? wave : 1);
      const initialGain = Math.min(0.14, 0.04 + (safeWave - 1) * 0.02);

      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(44, t);

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'sine';
      this.droneOsc2.frequency.setValueAtTime(65.9, t);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(140, t);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(initialGain, t);

      this.droneLfo = this.ctx.createOscillator();
      this.droneLfo.type = 'sine';
      this.droneLfo.frequency.setValueAtTime(0.2, t);

      this.droneLfoGain = this.ctx.createGain();
      this.droneLfoGain.gain.setValueAtTime(35, t);
      this.droneLfo.connect(this.droneLfoGain);
      this.droneLfoGain.connect(this.droneFilter.frequency);

      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc2.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(target);

      this.droneOsc1.start();
      this.droneOsc2.start();
      this.droneLfo.start();
      this.droneActive = true;
    } catch (e) {
      console.warn('Failed to start horror drone:', e);
    }
  }

  safeStopAndDisconnect(node) {
    if (!node) return;
    try {
      if (typeof node.stop === 'function') {
        node.stop();
      }
    } catch (e) {
      console.debug('Audio node stop error:', e);
    }
    try {
      if (typeof node.disconnect === 'function') {
        node.disconnect();
      }
    } catch (e) {
      console.debug('Audio node disconnect error:', e);
    }
  }

  stopHorrorAmbience() {
    this.stopRocketLoops();
    if (!this.droneActive) return;
    this.safeStopAndDisconnect(this.droneOsc1);
    this.safeStopAndDisconnect(this.droneOsc2);
    this.safeStopAndDisconnect(this.droneLfo);
    this.safeStopAndDisconnect(this.droneLfoGain);
    this.safeStopAndDisconnect(this.droneFilter);
    this.safeStopAndDisconnect(this.droneGain);

    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneLfo = null;
    this.droneLfoGain = null;
    this.droneFilter = null;
    this.droneGain = null;
    this.droneActive = false;
  }

  updateHorrorAmbience(dt = 0.1, state = {}) {
    if (this.muted) {
      if (this.droneActive) this.stopHorrorAmbience();
      return;
    }
    const isInGame = Boolean(state && state.isInGame);
    if (!isInGame) {
      this.stopHorrorAmbience();
      return;
    }
    this.ensureContext();
    if (!this.ctx) {
      if (this.droneActive) this.stopHorrorAmbience();
      return;
    }
    const wave = Math.max(1, (state && state.wave) || 1);
    if (!this.droneActive) {
      this.startHorrorDrone(wave);
    }
    if (this.droneGain && this.droneGain.gain) {
      const targetGain = Math.min(0.14, 0.04 + (wave - 1) * 0.02);
      const t = (this.ctx && this.ctx.currentTime) || 0;
      this.droneGain.gain.setValueAtTime(targetGain, t);
    }

    this.updateAmbienceHeartbeat(dt, state);
    this.updateAmbienceGrowls(dt, state);
  }

  updateAmbienceHeartbeat(dt, state) {
    if (!state || !state.localPlayer) return;
    const p = state.localPlayer;
    const hpRatio = (p.hp !== undefined && p.maxHp) ? (p.hp / p.maxHp) : 1;
    const isLowHp = hpRatio <= 0.35 || Boolean(p.isDowned);

    let nearbyCount = 0;
    if (Array.isArray(state.zombies)) {
      for (const z of state.zombies) {
        if (z && !z.isDead) {
          const d = Math.hypot((z.x || 0) - (p.x || 0), (z.y || 0) - (p.y || 0));
          if (d < 280) nearbyCount++;
        }
      }
    }
    const isSurrounded = nearbyCount >= 4;

    if (isLowHp || isSurrounded) {
      this.heartbeatTimer = (this.heartbeatTimer || 0) - dt;
      if (this.heartbeatTimer <= 0) {
        const intensity = isLowHp ? (hpRatio < 0.2 ? 1.0 : 0.8) : 0.6;
        this.playHeartbeatPulse(intensity);
        const interval = isLowHp ? (hpRatio < 0.2 ? 0.65 : 0.85) : 1.05;
        this.heartbeatTimer = interval;
      }
    } else {
      this.heartbeatTimer = 0.5;
    }
  }

  updateAmbienceGrowls(dt, state) {
    this.growlTimer = (this.growlTimer || 0) - dt;
    if (this.growlTimer > 0) return;
    this.growlTimer = 2.6;

    if (!state || !state.localPlayer || !Array.isArray(state.zombies)) return;
    const px = state.localPlayer.x || 0;
    const py = state.localPlayer.y || 0;
    let nearest = null;
    let minDist = 700;
    for (const z of state.zombies) {
      if (z && !z.isDead) {
        const d = Math.hypot((z.x || 0) - px, (z.y || 0) - py);
        if (d < minDist) {
          minDist = d;
          nearest = z;
        }
      }
    }
    if (nearest) {
      this.playZombieGrowl(nearest.type || 'NORMAL', nearest.x, px);
    }
  }

  playDevilFireball() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime || 0;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.linearRampToValueAtTime(160, t + 0.22);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  playComboUpgrade() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    const t = this.ctx.currentTime || 0;

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.14);
    });
  }

  playWaveClear() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    const t = this.ctx.currentTime || 0;

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.4, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.25);
    });
  }

  playGameOver() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [330, 311, 293, 261];
    const t = this.ctx.currentTime || 0;

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.2;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.4, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.35);
    });
  }

  playPickup() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime || 0;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.1);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playUltimate(ultId) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime || 0;

    if (ultId === 'SEISMIC_SLAM') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.45);
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.45);

      const noise = this.ctx.createBufferSource();
      const nBuffer = this.createNoiseBuffer(0.35);
      if (nBuffer) {
        noise.buffer = nBuffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.setValueAtTime(320, t);
        nFilter.frequency.exponentialRampToValueAtTime(60, t + 0.35);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.7, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.35);
      }
    } else if (ultId === 'BLINK_FROST_NOVA') {
      const sweep = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      sweep.type = 'sine';
      sweep.frequency.setValueAtTime(220, t);
      sweep.frequency.exponentialRampToValueAtTime(880, t + 0.18);
      sGain.gain.setValueAtTime(0.4, t);
      sGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      sweep.connect(sGain);
      sGain.connect(this.masterGain);
      sweep.start(t);
      sweep.stop(t + 0.18);

      [1174.66, 1760.0, 2349.32].forEach((freq, i) => {
        const chime = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(freq, t + 0.05 + i * 0.04);
        cGain.gain.setValueAtTime(0.3, t + 0.05 + i * 0.04);
        cGain.gain.exponentialRampToValueAtTime(0.005, t + 0.35 + i * 0.04);
        chime.connect(cGain);
        cGain.connect(this.masterGain);
        chime.start(t + 0.05 + i * 0.04);
        chime.stop(t + 0.35 + i * 0.04);
      });
    } else if (ultId === 'TACTICAL_DRONE') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = t + idx * 0.04;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.28, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(noteTime);
        osc.stop(noteTime + 0.1);
      });
    }
  }
}

// Global sound manager instance for browser environments
if (typeof window !== 'undefined') {
  window.soundManager = new SoundManager();
}

// CommonJS module export for testing/Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SoundManager };
}
