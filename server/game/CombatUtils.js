'use strict';

const PICKUP_DROP_CONFIG = Object.freeze({
  AMMO_DROP_CHANCE: 0.18,
  MEDKIT_DROP_CHANCE: 0.07,
  TOTAL_DROP_CHANCE: 0.25,
  LIFETIME: 25
});

/**
 * Normalizes an angle difference into [-Math.PI, Math.PI].
 * @param {number} diff
 * @returns {number}
 */
function normalizeAngleDiff(diff) {
  let d = diff;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Rolls zombie pickup drop using 18% AMMO and 7% MEDKIT probabilities (25% total).
 * Supports { forceDrop, forceType } overrides for deterministic tests.
 * @param {object} room
 * @param {object} zombie
 * @param {object} [options={}]
 * @returns {object|null}
 */
function maybeDropPickup(room, zombie, options = {}) {
  if (!room || !Array.isArray(room.pickups) || !zombie) return null;

  let type = null;
  if (options.forceDrop) {
    type = options.forceType === 'MEDKIT' ? 'MEDKIT' : 'AMMO';
  } else {
    const roll = Math.random();
    if (roll < PICKUP_DROP_CONFIG.AMMO_DROP_CHANCE) {
      type = 'AMMO';
    } else if (roll < PICKUP_DROP_CONFIG.TOTAL_DROP_CHANCE) {
      type = 'MEDKIT';
    }
  }

  if (!type) return null;

  const pickup = {
    id: 'pk_' + Math.random().toString(36).substring(2, 7),
    type,
    x: Math.round(zombie.x),
    y: Math.round(zombie.y),
    life: PICKUP_DROP_CONFIG.LIFETIME
  };
  room.pickups.push(pickup);
  return pickup;
}

/**
 * Credits kill score, unlock notifications, ZOMBIE_DIE event, and pickup drops
 * for an already-killed zombie.
 * @param {object|null} killer
 * @param {object} zombie
 * @param {object|null} room
 * @param {object} [options={}]
 */
function creditZombieKill(killer, zombie, room, options = {}) {
  if (!zombie) return;

  if (killer) {
    const awardUltCharge = options.awardUltCharge !== undefined ? Boolean(options.awardUltCharge) : true;
    const scoreVal = zombie.scoreValue || zombie.score || 10;
    const unlocks = killer.recordKill(scoreVal, { awardUltCharge });
    if (room && Array.isArray(room.eventsBuffer) && Array.isArray(unlocks)) {
      for (let i = 0; i < unlocks.length; i++) {
        const u = unlocks[i];
        room.eventsBuffer.push({
          type: 'UNLOCKED',
          weapon: u.name || u.id,
          playerId: killer.id,
          ...(u.slot !== undefined ? { slot: u.slot } : {})
        });
      }
    }
  }

  if (room && Array.isArray(room.eventsBuffer)) {
    const baseAngle = Number.isFinite(zombie.angle) ? zombie.angle : 0;
    const killAngle = options.killAngle !== undefined && Number.isFinite(options.killAngle)
      ? options.killAngle
      : baseAngle;
    room.eventsBuffer.push({
      type: 'ZOMBIE_DIE',
      x: Math.round(zombie.x),
      y: Math.round(zombie.y),
      zType: zombie.type,
      angle: Number(baseAngle.toFixed(2)),
      killAngle: Number(killAngle.toFixed(2))
    });
  }

  if (options.dropPickup !== false) {
    maybeDropPickup(room, zombie, options);
  }
}

/**
 * Applies damage and optional crowd control (knockback, freeze, stun, slow) to a zombie,
 * crediting kills and rolling pickups on lethal blows.
 * @param {object|null} attacker
 * @param {object} zombie
 * @param {number} damage
 * @param {string} sourceType
 * @param {object|null} room
 * @param {object} [options={}]
 * @returns {boolean} True if zombie died from this damage
 */
function damageAndCreditZombie(attacker, zombie, damage, sourceType, room, options = {}) {
  if (!zombie || zombie.isDead) return false;

  zombie.takeDamage(damage, sourceType || 'GENERIC');

  if (options.knockback && options.knockAngle !== undefined) {
    zombie.applyKnockback(options.knockAngle, options.knockback);
  }

  const isBoss = zombie.type === 'TANK' || zombie.type === 'DEVIL';

  if (options.freezeDuration) {
    const freezeDur = isBoss && options.bossFreezeDuration !== undefined
      ? options.bossFreezeDuration
      : options.freezeDuration;
    if (freezeDur > 0) {
      zombie.applyFreeze(freezeDur);
    }
  }

  const rawStun = options.stunDuration !== undefined ? options.stunDuration : options.stun;
  if (rawStun) {
    const bossOverride = options.bossStunDuration !== undefined ? options.bossStunDuration : options.bossStun;
    const stunDur = isBoss && bossOverride !== undefined ? bossOverride : rawStun;
    if (stunDur > 0) {
      zombie.applyStun(stunDur);
    }
  }

  if (options.slowFactor && options.slowDuration) {
    zombie.applySlow(options.slowDuration, options.slowFactor);
  }

  if (zombie.isDead) {
    creditZombieKill(attacker, zombie, room, options);
    return true;
  }

  return false;
}

module.exports = {
  PICKUP_DROP_CONFIG,
  normalizeAngleDiff,
  maybeDropPickup,
  creditZombieKill,
  damageAndCreditZombie
};

