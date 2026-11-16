class Interpolator {
  constructor(bufferTimeMs) {
    this.snapshots = [];
    const configuredBuffer = (typeof window !== 'undefined'
      && window.BOXHEAD_DEPLOY_CONFIG
      && Number.isFinite(window.BOXHEAD_DEPLOY_CONFIG.interpolationBufferMs))
      ? window.BOXHEAD_DEPLOY_CONFIG.interpolationBufferMs
      : 40;
    this.bufferTime = Number.isFinite(bufferTimeMs) && bufferTimeMs > 0 ? bufferTimeMs : configuredBuffer;
  }

  setBufferTime(ms) {
    if (Number.isFinite(ms) && ms > 0) {
      this.bufferTime = ms;
    }
  }

  addSnapshot(snapshot) {
    snapshot.receivedAt = performance.now();
    this.snapshots.push(snapshot);
    // Keep last 6 snapshots
    if (this.snapshots.length > 6) {
      this.snapshots.shift();
    }
  }

  getInterpolatedState() {
    if (this.snapshots.length === 0) return null;
    if (this.snapshots.length === 1) return this.snapshots[0];

    const now = performance.now();
    const renderTime = now - this.bufferTime;

    // Find two bounding snapshots
    let prev = null;
    let next = null;

    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].receivedAt <= renderTime) {
        prev = this.snapshots[i];
        next = this.snapshots[i + 1] || null;
        break;
      }
    }

    if (!prev) {
      prev = this.snapshots[0];
      next = this.snapshots[1] || null;
    }

    if (!next) {
      return prev;
    }

    const timeDiff = next.receivedAt - prev.receivedAt;
    const alpha = timeDiff > 0 ? Math.min(1, Math.max(0, (renderTime - prev.receivedAt) / timeDiff)) : 1;

    // Deep clone state structure
    const interpolated = {
      ...next,
      players: this.interpolatePlayers(prev.players, next.players, alpha),
      zombies: this.interpolateZombies(prev.zombies, next.zombies, alpha)
    };

    return interpolated;
  }

  interpolatePlayers(prevPlayers = [], nextPlayers = [], alpha) {
    const prevMap = new Map(prevPlayers.map(p => [p.id, p]));
    return nextPlayers.map(np => {
      const pp = prevMap.get(np.id);
      if (!pp) return np;
      const jumpDist = Math.hypot(np.x - pp.x, np.y - pp.y);
      if (jumpDist > 150) {
        return {
          ...np,
          angle: this.lerpAngle(pp.angle, np.angle, alpha)
        };
      }
      return {
        ...np,
        x: pp.x + (np.x - pp.x) * alpha,
        y: pp.y + (np.y - pp.y) * alpha,
        angle: this.lerpAngle(pp.angle, np.angle, alpha)
      };
    });
  }

  interpolateZombies(prevZombies = [], nextZombies = [], alpha) {
    const prevMap = new Map(prevZombies.map(z => [z.id, z]));
    return nextZombies.map(nz => {
      const pz = prevMap.get(nz.id);
      if (!pz) return nz;
      return {
        ...nz,
        x: pz.x + (nz.x - pz.x) * alpha,
        y: pz.y + (nz.y - pz.y) * alpha,
        angle: this.lerpAngle(pz.angle, nz.angle, alpha)
      };
    });
  }

  lerpAngle(a, b, t) {
    let diff = (b - a) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }
}

if (typeof window !== 'undefined') {
  window.Interpolator = Interpolator;
}
if (typeof module === 'object' && module.exports) {
  module.exports = { Interpolator };
}
