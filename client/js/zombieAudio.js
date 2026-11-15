// client/js/zombieAudio.js
// Zombie Audio Bank: WAV asset registry, preloading, Web Audio decoding,
// polyphony voice budgeting, 2D distance attenuation, and movement/aggro tracking.

const ZOMBIE_AUDIO_MAP = Object.freeze({
  NORMAL: 'rotten',
  RUNNER: 'ghoul',
  TANK: 'mutant',
  DEVIL: 'burned',
  MUMMY: 'butcher',
  VAMPIRE: 'boomer'
});

const ZOMBIE_PROFILE_ORDER = Object.freeze([
  'rotten',
  'ghoul',
  'mutant',
  'burned',
  'butcher',
  'boomer'
]);

const ZOMBIE_SFX_COUNTS = Object.freeze({
  idle: 3,
  aggro: 1,
  attack: 2,
  hit: 2,
  die: 1,
  step: 3
});

const ZOMBIE_SFX_VOLUMES = Object.freeze({
  idle: 0.55,
  aggro: 1.0,
  attack: 0.9,
  hit: 0.8,
  die: 1.0,
  step: 0.45
});

const ZOMBIE_STEP_STRIDE = Object.freeze({
  NORMAL: 58,
  RUNNER: 48,
  TANK: 68,
  DEVIL: 60,
  MUMMY: 68,
  VAMPIRE: 52
});

const ZOMBIE_EVENT_MAX_DIST = Object.freeze({
  idle: 650,
  aggro: 680,
  attack: 900,
  hit: 1000,
  die: 1050,
  step: 460
});

const EVENT_COOLDOWNS_MS = Object.freeze({
  hit: 55,
  die: 50,
  attack: 70,
  aggro: 1200,
  idle: 1800,
  step: 140
});

class ZombieAudioBank {
  constructor(options = {}) {
    const rawBasePath = typeof options.basePath === 'string' ? options.basePath : 'assets/audio/zombies';
    this.basePath = rawBasePath.replace(/\/+$/, '');
    this.maxVoices = typeof options.maxVoices === 'number' && Number.isFinite(options.maxVoices) ? options.maxVoices : 24;

    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
      return Date.now();
    };

    this.fetchFn = options.fetchFn !== undefined ? options.fetchFn : (typeof fetch === 'function' ? fetch : null);

    this.buffers = new Map();
    this.rawBuffers = new Map();
    this.activeVoices = 0;
    this.lastEventTimes = new Map();
    this.zombieStates = new Map();

    this.preloadPromise = null;
    this.decodePromise = null;
    this.decodeCtx = null;
  }

  resolveProfile(zType) {
    if (!zType || typeof zType !== 'string') {
      return 'rotten';
    }
    const upper = zType.toUpperCase();
    if (ZOMBIE_AUDIO_MAP[upper]) {
      return ZOMBIE_AUDIO_MAP[upper];
    }
    const lower = zType.toLowerCase();
    if (ZOMBIE_PROFILE_ORDER.includes(lower)) {
      return lower;
    }
    return 'rotten';
  }

  getAllAssetEntries() {
    const entries = [];
    for (const profile of ZOMBIE_PROFILE_ORDER) {
      for (const [event, count] of Object.entries(ZOMBIE_SFX_COUNTS)) {
        for (let i = 1; i <= count; i++) {
          const key = `${profile}/${event}_${i}`;
          const url = `${this.basePath}/${profile}/${event}_${i}.wav`;
          entries.push({ profile, event, index: i, key, url });
        }
      }
    }
    return entries;
  }

  hasBuffer(zType, event) {
    if (!zType || !event) {
      return false;
    }
    const profile = this.resolveProfile(zType);
    const list = this.buffers.get(`${profile}/${event}`);
    return Array.isArray(list) && list.length > 0;
  }

  hasAnyBuffers() {
    for (const list of this.buffers.values()) {
      if (Array.isArray(list) && list.length > 0) {
        return true;
      }
    }
    return false;
  }

  compute2DDistanceGain(sourceX, sourceY, listenerX, listenerY, maxDist = 800) {
    if (sourceX === undefined || sourceY === undefined || listenerX === undefined || listenerY === undefined) {
      return 1;
    }
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY) || !Number.isFinite(listenerX) || !Number.isFinite(listenerY)) {
      return 1;
    }
    if (!Number.isFinite(maxDist) || maxDist <= 0) {
      return 1;
    }
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const dist = Math.hypot(dx, dy);
    const gain = 1 - dist / maxDist;
    return Math.max(0, Math.min(1, gain));
  }

  canPlayEvent(event, zombieId) {
    if (!event || typeof event !== 'string') {
      return false;
    }
    if (this.activeVoices >= this.maxVoices) {
      return false;
    }
    const isAmbient = event === 'step' || event === 'idle';
    const ambientCap = Math.floor(this.maxVoices * 0.75);
    if (isAmbient && this.activeVoices >= ambientCap) {
      return false;
    }
    const cooldown = EVENT_COOLDOWNS_MS[event] || 0;
    if (cooldown > 0) {
      const now = this.nowFn();
      const lastTime = this.lastEventTimes.get(event) || 0;
      if (now - lastTime < cooldown) {
        return false;
      }
    }
    return true;
  }

  async preloadRaw(concurrency = 6) {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    if (!this.fetchFn) {
      return 0;
    }

    this.preloadPromise = (async () => {
      const entries = this.getAllAssetEntries();
      let loadedCount = 0;
      let idx = 0;
      const poolSize = typeof concurrency === 'number' && concurrency > 0 ? concurrency : 6;
      const workers = [];

      const worker = async () => {
        while (idx < entries.length) {
          const entry = entries[idx++];
          if (this.rawBuffers.has(entry.key) || this.hasBuffer(entry.profile, entry.event)) {
            continue;
          }
          try {
            const res = await this.fetchFn(entry.url);
            if (!res || !res.ok) {
              console.warn(`[ZombieAudioBank] Preload failed (${res ? res.status : 'no response'}): ${entry.url}`);
              continue;
            }
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              this.rawBuffers.set(entry.key, buf);
              loadedCount++;
            }
          } catch (err) {
            console.warn(`[ZombieAudioBank] Preload error for ${entry.url}:`, err);
          }
        }
      };

      const count = Math.min(poolSize, entries.length);
      for (let i = 0; i < count; i++) {
        workers.push(worker());
      }
      await Promise.all(workers);
      this.preloadPromise = null;
      return loadedCount;
    })();

    return this.preloadPromise;
  }

  async decodeAll(ctx) {
    if (!ctx || typeof ctx.decodeAudioData !== 'function') {
      return 0;
    }
    if (this.decodePromise && this.decodeCtx === ctx) {
      return this.decodePromise;
    }
    this.decodeCtx = ctx;

    this.decodePromise = (async () => {
      const entries = this.getAllAssetEntries();
      let decodedCount = 0;
      let idx = 0;
      const poolSize = 6;
      const workers = [];

      const worker = async () => {
        while (idx < entries.length) {
          const entry = entries[idx++];
          let raw = this.rawBuffers.get(entry.key);
          if (!raw) {
            if (!this.fetchFn) {
              continue;
            }
            try {
              const res = await this.fetchFn(entry.url);
              if (!res || !res.ok) {
                console.warn(`[ZombieAudioBank] Fetch failed (${res ? res.status : 'no response'}): ${entry.url}`);
                continue;
              }
              raw = await res.arrayBuffer();
            } catch (err) {
              console.warn(`[ZombieAudioBank] Fetch error for ${entry.url}:`, err);
              continue;
            }
          }

          this.rawBuffers.delete(entry.key);
          if (!raw || raw.byteLength === 0) {
            continue;
          }

          try {
            const bufToDecode = raw.slice ? raw.slice(0) : raw;
            const decoded = await ctx.decodeAudioData(bufToDecode);
            if (decoded) {
              const bufKey = `${entry.profile}/${entry.event}`;
              let list = this.buffers.get(bufKey);
              if (!list) {
                list = [];
                this.buffers.set(bufKey, list);
              }
              list.push(decoded);
              decodedCount++;
            }
          } catch (err) {
            console.warn(`[ZombieAudioBank] Decode error for ${entry.url}:`, err);
          }
        }
      };

      const count = Math.min(poolSize, entries.length);
      for (let i = 0; i < count; i++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      return decodedCount;
    })();

    return this.decodePromise;
  }

  playSample(ctx, destNode, zType, event, options = {}) {
    if (!ctx || typeof ctx.createBufferSource !== 'function' || !destNode) {
      return false;
    }
    if (!this.hasBuffer(zType, event)) {
      return false;
    }
    if (!this.canPlayEvent(event, options.zombieId)) {
      return false;
    }

    const maxDist = typeof options.maxDist === 'number' && options.maxDist > 0 ? options.maxDist : (ZOMBIE_EVENT_MAX_DIST[event] || 800);
    const distGain = this.compute2DDistanceGain(options.x, options.y, options.listenerX, options.listenerY, maxDist);
    const baseVolume = ZOMBIE_SFX_VOLUMES[event] !== undefined ? ZOMBIE_SFX_VOLUMES[event] : 1.0;
    const optVolume = typeof options.volume === 'number' && Number.isFinite(options.volume) ? options.volume : 1.0;
    const totalGain = distGain * baseVolume * optVolume;

    if (totalGain < 0.01) {
      return false;
    }

    const profile = this.resolveProfile(zType);
    const bufferList = this.buffers.get(`${profile}/${event}`);
    if (!bufferList || bufferList.length === 0) {
      return false;
    }

    const bufferIndex = Math.floor(Math.random() * bufferList.length);
    const audioBuffer = bufferList[bufferIndex];

    let pitch = typeof options.pitch === 'number' && Number.isFinite(options.pitch) ? options.pitch : null;
    if (pitch === null) {
      pitch = 0.94 + Math.random() * (1.06 - 0.94);
    }

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    if (src.playbackRate) {
      src.playbackRate.value = pitch;
    }

    const gainNode = ctx.createGain();
    if (gainNode.gain) {
      if (typeof gainNode.gain.setValueAtTime === 'function' && typeof ctx.currentTime === 'number') {
        gainNode.gain.setValueAtTime(totalGain, ctx.currentTime);
      } else {
        gainNode.gain.value = totalGain;
      }
    }

    src.connect(gainNode);
    gainNode.connect(destNode);

    this.activeVoices++;
    let ended = false;
    src.onended = () => {
      if (!ended) {
        ended = true;
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      }
    };

    this.lastEventTimes.set(event, this.nowFn());

    try {
      if (typeof src.start === 'function') {
        src.start(0);
      }
    } catch (err) {
      if (!ended) {
        ended = true;
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      }
      console.warn('[ZombieAudioBank] Failed to start audio source:', err);
      return false;
    }

    return true;
  }

  updateZombies(dt, state, onTrigger) {
    if (!state || !state.localPlayer || typeof onTrigger !== 'function') {
      return;
    }
    const zombies = Array.isArray(state.zombies) ? state.zombies : [];
    const playerX = state.localPlayer.x;
    const playerY = state.localPlayer.y;
    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
      return;
    }

    const currentIds = new Set();
    for (const z of zombies) {
      if (z && z.id != null) {
        currentIds.add(z.id);
      }
    }

    for (const id of this.zombieStates.keys()) {
      if (!currentIds.has(id)) {
        this.zombieStates.delete(id);
      }
    }

    const delta = typeof dt === 'number' && Number.isFinite(dt) && dt > 0 ? dt : 0;

    for (const z of zombies) {
      if (!z || z.id == null) {
        continue;
      }
      if (z.isDead || z.dead || (z.hp !== undefined && z.hp <= 0)) {
        this.zombieStates.delete(z.id);
        continue;
      }

      this._updateSingleZombie(z, playerX, playerY, delta, onTrigger);
    }
  }

  _updateSingleZombie(z, playerX, playerY, dt, onTrigger) {
    let zs = this.zombieStates.get(z.id);
    const isNew = !zs;

    if (!zs) {
      zs = {
        lastX: z.x,
        lastY: z.y,
        stepDist: 0,
        idleTimer: 3.5 + Math.random() * 5.0,
        hasAggroed: false,
        lastAttackAt: 0
      };
      this.zombieStates.set(z.id, zs);
    }

    const distToPlayer = Math.hypot(z.x - playerX, z.y - playerY);

    if (!zs.hasAggroed && !z.isFrozen && !z.isStunned && distToPlayer <= ZOMBIE_EVENT_MAX_DIST.aggro) {
      zs.hasAggroed = true;
      onTrigger(z, 'aggro');
    }

    if (!isNew) {
      const dx = z.x - zs.lastX;
      const dy = z.y - zs.lastY;
      const moved = Math.hypot(dx, dy);

      if (!z.isFrozen && !z.isStunned && moved > 0 && moved <= 150) {
        zs.stepDist += moved;
        const stride = ZOMBIE_STEP_STRIDE[z.type] || ZOMBIE_STEP_STRIDE.NORMAL || 58;
        if (zs.stepDist >= stride) {
          zs.stepDist -= stride;
          if (distToPlayer <= ZOMBIE_EVENT_MAX_DIST.step) {
            onTrigger(z, 'step');
          }
        }
      } else if (moved > 150) {
        zs.stepDist = 0;
      }
    }
    zs.lastX = z.x;
    zs.lastY = z.y;

    if (!z.isFrozen && !z.isStunned && distToPlayer <= ZOMBIE_EVENT_MAX_DIST.idle) {
      zs.idleTimer -= dt;
      if (zs.idleTimer <= 0) {
        zs.idleTimer = 3.5 + Math.random() * 5.0;
        onTrigger(z, 'idle');
      }
    }
  }

  reset() {
    this.zombieStates.clear();
    this.lastEventTimes.clear();
    this.activeVoices = 0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ZombieAudioBank,
    ZOMBIE_AUDIO_MAP,
    ZOMBIE_SFX_COUNTS,
    ZOMBIE_SFX_VOLUMES,
    ZOMBIE_STEP_STRIDE,
    ZOMBIE_EVENT_MAX_DIST,
    ZOMBIE_PROFILE_ORDER,
    EVENT_COOLDOWNS_MS
  };
}

if (typeof window !== 'undefined') {
  window.ZombieAudioBank = ZombieAudioBank;
  window.ZOMBIE_AUDIO_MAP = ZOMBIE_AUDIO_MAP;
  window.ZOMBIE_SFX_COUNTS = ZOMBIE_SFX_COUNTS;
  window.ZOMBIE_SFX_VOLUMES = ZOMBIE_SFX_VOLUMES;
  window.ZOMBIE_STEP_STRIDE = ZOMBIE_STEP_STRIDE;
  window.ZOMBIE_EVENT_MAX_DIST = ZOMBIE_EVENT_MAX_DIST;
  window.ZOMBIE_PROFILE_ORDER = ZOMBIE_PROFILE_ORDER;
  window.EVENT_COOLDOWNS_MS = EVENT_COOLDOWNS_MS;
}
