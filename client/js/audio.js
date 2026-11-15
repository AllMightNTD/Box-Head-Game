class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;

      // Resume context if suspended
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
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
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.muted;
  }

  createNoiseBuffer(duration = 0.2) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playShoot(weaponType = 'PISTOL') {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    if (weaponType === 'UZI') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
      osc.start(t);
      osc.stop(t + 0.06);
    } else if (weaponType === 'SHOTGUN') {
      // Bass pop + noise burst
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.18);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);

      const noise = this.ctx.createBufferSource();
      const nBuffer = this.createNoiseBuffer(0.15);
      if (nBuffer) {
        noise.buffer = nBuffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.setValueAtTime(800, t);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.6, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(t);
      }
    } else if (weaponType === 'ROCKET') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.linearRampToValueAtTime(320, t + 0.12);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    } else if (weaponType === 'RAILGUN') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    } else {
      // Default Pistol
      osc.type = 'square';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  playExplosion(scale = 1) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dur = Math.min(0.7, 0.35 * scale);

    // Deep sub bass oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90 * scale, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + dur);
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + dur);

    // Filtered noise explosion
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
      nGain.connect(this.masterGain);
      noise.start(t);
    }
  }

  playZombieHit() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playZombieDie() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playDevilFireball() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
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

    // Ascending arcade chime notes: C5 (523), E5 (659), G5 (784), C6 (1046)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const t = this.ctx.currentTime;

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
    const t = this.ctx.currentTime;

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
    const t = this.ctx.currentTime;

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

    const t = this.ctx.currentTime;
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

    const t = this.ctx.currentTime;

    if (ultId === 'SEISMIC_SLAM') {
      // Heavy seismic ground pound: sub-bass boom + rumble
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
      }
    } else if (ultId === 'BLINK_FROST_NOVA') {
      // Teleport whoosh + crystalline freeze chime
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

      // Frost chimes
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
      // High-tech drone deployment arpeggio chirp
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
    } else if (ultId === 'AVATAR_OF_WAR') {
      this.playWarriorSkill('AVATAR_OF_WAR');
    }
  }

  get isMuted() {
    return Boolean(this.muted);
  }

  playWarriorSkill(skillIdOrEvent, subType) {
    if (this.muted || this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    let skillId = null;
    let type = null;
    let sub = subType;

    if (typeof skillIdOrEvent === 'object' && skillIdOrEvent !== null) {
      type = skillIdOrEvent.type;
      skillId = skillIdOrEvent.skillId || (type === 'ULTIMATE' && skillIdOrEvent.ultId === 'AVATAR_OF_WAR' ? 'AVATAR_OF_WAR' : null);
      if (!sub) sub = skillIdOrEvent.subType || type;
    } else if (typeof skillIdOrEvent === 'string') {
      skillId = skillIdOrEvent;
      type = 'WARRIOR_SKILL';
    }

    const t = this.ctx.currentTime;

    if (type === 'WARRIOR_COUNTER' || skillId === 'WARRIOR_COUNTER') {
      // Clashing metallic parry clang
      [1100, 2400].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.005, t + 0.28);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.28);
      });
      return;
    }

    if (type === 'WARRIOR_MARK_EXPLODE' || skillId === 'WARRIOR_MARK_EXPLODE') {
      // Detonation implosion pop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
      return;
    }

    if (type === 'WARRIOR_AVATAR_END' || skillId === 'WARRIOR_AVATAR_END') {
      // Final Fire Nova roar and explosion
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.5);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.5);
      return;
    }

    if (skillId === 'BERSERKER_STANCE') {
      // Crisp blade slash whoosh
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);

    } else if (skillId === 'JUGGERNAUT_STANCE') {
      // Heavy greatsword cleave
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);

    } else if (skillId === 'BLADE_WHIRLWIND') {
      // Spinning whirlwind blade slice
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.linearRampToValueAtTime(600, t + 0.15);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.3);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);

    } else if (skillId === 'SHADOW_DASH_SLASH') {
      // High-speed shadow slice
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.16);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);

    } else if (skillId === 'SEISMIC_SLAM') {
      // Deep ground pound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);

    } else if (skillId === 'WAR_CRY') {
      // War Cry brass horn / bellowing roar
      [220, 330].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq * 1.25, t + 0.35);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.35);
      });

    } else if (skillId === 'COUNTER_SHIELD_BASH') {
      // Frontal shield guard whoosh
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);

    } else if (skillId === 'AVATAR_OF_WAR') {
      // Avatar of War roar
      [110, 165, 220].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq * 1.4, t + 0.4);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    }
  }
}

// Global sound manager instance
if (typeof window !== 'undefined') {
  window.SoundManager = SoundManager;
  window.soundManager = new SoundManager();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SoundManager };
}
