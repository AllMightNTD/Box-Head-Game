/**
 * WeaponAudioBank - Web Audio asset loader, polyphony manager, and spatial audio processor.
 * Supports all 6 weapons: pistol, uzi, shotgun, grenade, rocket, railgun.
 */

const WEAPON_SFX = {
  pistol:  { fire: 3, reload: 1, empty: 1, casing: 2 },
  uzi:     { fire: 4, reload: 1, empty: 1, casing: 2 },
  shotgun: { fire: 3, pump: 2, load: 2, empty: 1, casing: 2 },
  grenade: { pin: 1, throw: 1, bounce: 3, explode: 2 },
  rocket:  { load: 1, fire: 2, flight: 1, explode: 2 },
  railgun: { charge: 1, fire: 3, cooldown: 1, empty: 1, impact: 2 },
};

const WEAPON_SFX_VOLUMES = {
  fire: 1.0,
  explode: 1.0,
  reload: 0.6,
  empty: 0.5,
  casing: 0.35,
  pump: 0.75,
  load: 0.6,
  pin: 0.6,
  throw: 0.7,
  bounce: 0.7,
  flight: 0.55,
  charge: 0.8,
  cooldown: 0.6,
  impact: 0.8
};

const WEAPON_MAX_DIST = {
  fire: 1100,
  explode: 1300,
  reload: 500,
  empty: 400,
  casing: 350,
  pump: 600,
  load: 500,
  pin: 400,
  throw: 550,
  bounce: 600,
  flight: 1000,
  charge: 700,
  cooldown: 600,
  impact: 900
};

class WeaponAudioBank {
  constructor(options = {}) {
    this.basePath = options.basePath || '/assets/audio/weapons';
    this.maxVoices = options.maxVoices || 32;
    this.fetchFn = options.fetchFn || (
      typeof window !== 'undefined' && typeof window.fetch === 'function'
        ? window.fetch.bind(window)
        : (typeof fetch === 'function' ? fetch : null)
    );
    this.buffers = new Map();
    this.rawBuffers = new Map();
    this.lastVariation = new Map();
    this.activeVoices = 0;
    this.preloadPromise = null;
    this.decodePromise = null;
  }

  normalizeWeaponKey(weapon) {
    if (!weapon || typeof weapon !== 'string') return 'pistol';
    const key = weapon.toLowerCase();
    return WEAPON_SFX[key] ? key : 'pistol';
  }

  getAllAssetEntries() {
    const entries = [];
    for (const [weapon, events] of Object.entries(WEAPON_SFX)) {
      for (const [event, count] of Object.entries(events)) {
        for (let i = 1; i <= count; i++) {
          const key = `${weapon}/${event}_${i}`;
          const url = `${this.basePath}/${weapon}/${event}_${i}.wav`;
          entries.push({ weapon, event, index: i, key, url });
        }
      }
    }
    return entries;
  }

  async preloadRaw(concurrency = 6) {
    if (this.preloadPromise) return this.preloadPromise;
    if (!this.fetchFn) return 0;

    const entries = this.getAllAssetEntries();
    let loaded = 0;
    let cursor = 0;

    const worker = async () => {
      while (cursor < entries.length) {
        const item = entries[cursor++];
        if (this.rawBuffers.has(item.key) || this.buffers.has(item.key)) {
          loaded++;
          continue;
        }
        try {
          const res = await this.fetchFn(item.url);
          if (res && res.ok) {
            const buf = await res.arrayBuffer();
            this.rawBuffers.set(item.key, buf);
            loaded++;
          }
        } catch (err) {
          console.warn(`[WeaponAudioBank] Failed to fetch ${item.url}:`, err);
        }
      }
    };

    const workerCount = Math.max(1, Math.min(concurrency, entries.length));
    this.preloadPromise = Promise.all(
      Array.from({ length: workerCount }, () => worker())
    ).then(() => loaded);

    return this.preloadPromise;
  }

  async decodeAll(ctx) {
    if (!ctx || typeof ctx.decodeAudioData !== 'function') return 0;
    if (this.decodePromise) return this.decodePromise;

    await this.preloadRaw();
    let decoded = 0;

    const promises = Array.from(this.rawBuffers.entries()).map(async ([key, raw]) => {
      try {
        const audioBuffer = await ctx.decodeAudioData(raw.slice(0));
        this.buffers.set(key, audioBuffer);
        decoded++;
      } catch (err) {
        console.warn(`[WeaponAudioBank] Failed to decode ${key}:`, err);
      } finally {
        this.rawBuffers.delete(key);
      }
    });

    this.decodePromise = Promise.all(promises).then(() => decoded);
    return this.decodePromise;
  }

  hasBuffer(weapon, event) {
    const norm = this.normalizeWeaponKey(weapon);
    const count = (WEAPON_SFX[norm] && WEAPON_SFX[norm][event]) || 0;
    for (let i = 1; i <= count; i++) {
      if (this.buffers.has(`${norm}/${event}_${i}`)) return true;
    }
    return false;
  }

  hasAnyBuffers() {
    return this.buffers.size > 0;
  }

  pickBuffer(weapon, event) {
    const norm = this.normalizeWeaponKey(weapon);
    const count = (WEAPON_SFX[norm] && WEAPON_SFX[norm][event]) || 0;
    if (count === 0) return null;

    const validIndices = [];
    for (let i = 1; i <= count; i++) {
      if (this.buffers.has(`${norm}/${event}_${i}`)) {
        validIndices.push(i);
      }
    }
    if (validIndices.length === 0) return null;
    if (validIndices.length === 1) {
      return this.buffers.get(`${norm}/${event}_${validIndices[0]}`);
    }

    const last = this.lastVariation.get(`${norm}/${event}`);
    let chosen = validIndices[Math.floor(Math.random() * validIndices.length)];
    if (chosen === last && validIndices.length > 1) {
      const filtered = validIndices.filter(x => x !== last);
      chosen = filtered[Math.floor(Math.random() * filtered.length)];
    }
    this.lastVariation.set(`${norm}/${event}`, chosen);
    return this.buffers.get(`${norm}/${event}_${chosen}`);
  }

  computeSpatialParams(sourceX, listenerX, maxDist = 1000) {
    if (!Number.isFinite(sourceX) || !Number.isFinite(listenerX)) {
      return { gain: 1.0, pan: 0, cutoff: 20000 };
    }
    const safeMaxDist = Math.max(1, Number.isFinite(maxDist) ? maxDist : 1000);
    const dx = sourceX - listenerX;
    const dist = Math.abs(dx);
    const norm = Math.max(0, Math.min(1, dist / safeMaxDist));
    const gain = Math.max(0, 1 - norm);
    const pan = Math.max(-0.9, Math.min(0.9, dx / 550));
    const cutoff = Math.round(800 + 19200 * (gain * gain));
    return { gain, pan, cutoff };
  }

  playSample(ctx, destNode, weapon, event, options = {}) {
    if (!ctx || !destNode || this.activeVoices >= this.maxVoices) return false;
    const buffer = this.pickBuffer(weapon, event);
    if (!buffer) return false;

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const maxDist = options.maxDist || WEAPON_MAX_DIST[event] || 1000;
    const spatial = this.computeSpatialParams(options.sourceX, options.listenerX, maxDist);
    const baseVol = (WEAPON_SFX_VOLUMES[event] !== undefined ? WEAPON_SFX_VOLUMES[event] : 1.0);
    const effectiveGain = baseVol * (options.volume !== undefined ? options.volume : 1.0) * spatial.gain;
    if (effectiveGain < 0.01) return false;

    const t = (ctx.currentTime || 0) + (options.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const pitchMod = options.pitch || (0.97 + Math.random() * 0.06);
    if (src.playbackRate && typeof src.playbackRate.setValueAtTime === 'function') {
      src.playbackRate.setValueAtTime(pitchMod, t);
    }

    const gainNode = ctx.createGain();
    if (gainNode.gain && typeof gainNode.gain.setValueAtTime === 'function') {
      gainNode.gain.setValueAtTime(effectiveGain, t);
    }

    let endNode = gainNode;
    if (typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      if (filter.frequency && typeof filter.frequency.setValueAtTime === 'function') {
        filter.frequency.setValueAtTime(spatial.cutoff, t);
      }
      src.connect(filter);
      filter.connect(gainNode);
    } else {
      src.connect(gainNode);
    }

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      if (panner.pan && typeof panner.pan.setValueAtTime === 'function') {
        panner.pan.setValueAtTime(spatial.pan, t);
      }
      gainNode.connect(panner);
      endNode = panner;
    }

    endNode.connect(destNode);

    this.activeVoices++;
    src.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };

    src.start(t);
    return true;
  }

  createRocketLoop(ctx, destNode, options = {}) {
    if (!ctx || !destNode) return null;
    const buffer = this.buffers.get('rocket/flight_1');
    if (!buffer) return null;

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime || 0;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gainNode = ctx.createGain();
    const baseVol = WEAPON_SFX_VOLUMES.flight || 0.55;
    const spatial = this.computeSpatialParams(options.sourceX, options.listenerX, 1000);
    if (gainNode.gain && typeof gainNode.gain.setValueAtTime === 'function') {
      gainNode.gain.setValueAtTime(baseVol * spatial.gain, t);
    }

    let panner = null;
    let endNode = gainNode;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      if (panner.pan && typeof panner.pan.setValueAtTime === 'function') {
        panner.pan.setValueAtTime(spatial.pan, t);
      }
      gainNode.connect(panner);
      endNode = panner;
    }

    src.connect(gainNode);
    endNode.connect(destNode);
    src.start(t);

    return {
      update: (coords = {}) => {
        const curT = ctx.currentTime || 0;
        const s = this.computeSpatialParams(coords.sourceX, coords.listenerX, 1000);
        if (gainNode.gain) {
          if (typeof gainNode.gain.setTargetAtTime === 'function') {
            gainNode.gain.setTargetAtTime(baseVol * s.gain, curT, 0.05);
          } else if (typeof gainNode.gain.setValueAtTime === 'function') {
            gainNode.gain.setValueAtTime(baseVol * s.gain, curT);
          }
        }
        if (panner && panner.pan && typeof panner.pan.setValueAtTime === 'function') {
          panner.pan.setValueAtTime(s.pan, curT);
        }
      },
      stop: (fade = 0.08) => {
        const stopT = ctx.currentTime || 0;
        if (gainNode.gain) {
          if (typeof gainNode.gain.setTargetAtTime === 'function') {
            gainNode.gain.setTargetAtTime(0, stopT, fade / 3);
          } else if (typeof gainNode.gain.setValueAtTime === 'function') {
            gainNode.gain.setValueAtTime(0, stopT);
          }
        }
        try {
          src.stop(stopT + fade);
        } catch (_) {}
      }
    };
  }

  reset() {
    this.buffers.clear();
    this.rawBuffers.clear();
    this.lastVariation.clear();
    this.activeVoices = 0;
    this.preloadPromise = null;
    this.decodePromise = null;
  }
}

if (typeof window !== 'undefined') {
  window.WeaponAudioBank = WeaponAudioBank;
  window.WEAPON_SFX = WEAPON_SFX;
  window.WEAPON_SFX_VOLUMES = WEAPON_SFX_VOLUMES;
  window.WEAPON_MAX_DIST = WEAPON_MAX_DIST;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeaponAudioBank, WEAPON_SFX, WEAPON_SFX_VOLUMES, WEAPON_MAX_DIST };
}
