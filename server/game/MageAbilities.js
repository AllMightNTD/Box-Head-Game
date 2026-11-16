/**
 * @file MageAbilities.js
 * @description Authoritative 50Hz simulation engine for Mage 8-skill kit,
 * cursor-targeted casting, Chain Lightning bounces, Fireball/Meteor pools,
 * Sanctuary healing/buffs, Mana Shield, and 18% AMMO pickup drops.
 */

'use strict';

const {
  MAGE_SKILLS,
  getMageSkillBySlot
} = require('./MageSkillsConfig.js');
const { Bullet } = require('./Bullet.js');
const { resolveBlinkDestination } = require('./UltimateAbilities.js');
const {
  normalizeAngleDiff,
  maybeDropPickup,
  damageAndCreditZombie: sharedDamageAndCreditZombie
} = require('./CombatUtils.js');

/**
 * Clamps cursor target within maxRange from origin, falling back to angle direction.
 * @param {object} player
 * @param {number} angle
 * @param {number} maxRange
 * @param {object|null} targetPos
 * @returns {{ x: number, y: number, dist: number }}
 */
function clampCastTarget(player, angle, maxRange, targetPos) {
  const hasCursor = targetPos &&
    typeof targetPos.x === 'number' && Number.isFinite(targetPos.x) &&
    typeof targetPos.y === 'number' && Number.isFinite(targetPos.y);

  if (hasCursor) {
    const dx = targetPos.x - player.x;
    const dy = targetPos.y - player.y;
    const rawDist = Math.hypot(dx, dy);
    if (rawDist <= maxRange) {
      return { x: targetPos.x, y: targetPos.y, dist: rawDist };
    }
    const dirAngle = Math.atan2(dy, dx);
    return {
      x: player.x + Math.cos(dirAngle) * maxRange,
      y: player.y + Math.sin(dirAngle) * maxRange,
      dist: maxRange
    };
  }

  return {
    x: player.x + Math.cos(angle) * maxRange,
    y: player.y + Math.sin(angle) * maxRange,
    dist: maxRange
  };
}

/**
 * Applies damage and optional CC to a zombie, credits kills, emits ZOMBIE_DIE/UNLOCKED, and rolls pickups.
 * @param {object|null} attacker
 * @param {object} zombie
 * @param {number} damage
 * @param {string} sourceType
 * @param {object} room
 * @param {object} [options={}]
 */
function damageAndCreditZombie(attacker, zombie, damage, sourceType, room, options = {}) {
  return sharedDamageAndCreditZombie(attacker, zombie, damage, sourceType, room, {
    ...options,
    awardUltCharge: false
  });
}

/**
 * Triggers explosive barrel chain reactions within blast radius without harming Barricades or teammates.
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {number} damage
 * @param {string|null} ownerId
 * @param {object} room
 */
function detonateBarrelsInRadius(x, y, radius, damage, ownerId, room) {
  if (!room || !Array.isArray(room.barricades)) return;
  const barrels = room.barricades.filter(b => b && b.type === 'barrel' && !b.isDead);
  for (let i = 0; i < barrels.length; i++) {
    const b = barrels[i];
    if (b.isDead) continue;
    if (Math.hypot(b.x - x, b.y - y) <= radius + (b.radius || 20)) {
      b.takeDamage(damage, barrels, (bx, by, br, bd) => {
        if (typeof room.triggerExplosion === 'function') {
          room.triggerExplosion(bx, by, br, bd, ownerId);
        }
      });
    }
  }
}

/**
 * Resolves primary living zombie target for Chain Lightning.
 * @param {object} player
 * @param {number} angle
 * @param {object|null} targetPos
 * @param {object} skill
 * @param {Array<object>} zombies
 * @returns {object|null}
 */
function findChainPrimaryTarget(player, angle, targetPos, skill, zombies) {
  if (!Array.isArray(zombies) || zombies.length === 0) return null;

  const hasCursor = targetPos &&
    typeof targetPos.x === 'number' && Number.isFinite(targetPos.x) &&
    typeof targetPos.y === 'number' && Number.isFinite(targetPos.y);

  let bestCursorTarget = null;
  let bestCursorDist = skill.cursorSnapRadius;
  let bestConeTarget = null;
  let bestConeDist = skill.castRange;

  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    const distToPlayer = Math.hypot(z.x - player.x, z.y - player.y);
    if (distToPlayer > skill.castRange + z.radius) continue;

    if (hasCursor) {
      const distToCursor = Math.hypot(z.x - targetPos.x, z.y - targetPos.y);
      if (distToCursor <= bestCursorDist + z.radius) {
        bestCursorDist = distToCursor;
        bestCursorTarget = z;
      }
    }

    const angleToZ = Math.atan2(z.y - player.y, z.x - player.x);
    if (Math.abs(normalizeAngleDiff(angleToZ - angle)) <= skill.coneHalfRad) {
      if (distToPlayer < bestConeDist) {
        bestConeDist = distToPlayer;
        bestConeTarget = z;
      }
    }
  }

  return bestCursorTarget || bestConeTarget;
}

/**
 * Fires Mage slot [1] ARCANE_BOLT toward player's aim angle.
 * @param {object} player
 * @param {object} room
 * @returns {boolean}
 */
function executeMageArcaneBolt(player, room) {
  if (!player || player.character !== 'MAGE' || !player.mageState) return false;
  if (player.isDead || player.isDowned || player.fireCooldown > 0) return false;

  const skill = MAGE_SKILLS.ARCANE_BOLT;
  if (!player.consumeMana(skill.manaCost)) return false;

  player.fireCooldown = skill.fireDelay;
  const muzzleDist = player.radius + 18;
  const mx = player.x + Math.cos(player.angle) * muzzleDist;
  const my = player.y + Math.sin(player.angle) * muzzleDist;

  const bolt = new Bullet(
    'b_ab_' + Math.random().toString(36).substring(2, 8),
    player.id,
    mx,
    my,
    player.angle,
    {
      type: 'arcane_bolt',
      speed: skill.speed,
      damage: skill.damage,
      range: skill.range,
      radius: skill.radius,
      knockback: skill.knockback,
      damageType: skill.damageType
    }
  );
  if (room && Array.isArray(room.bullets)) {
    room.bullets.push(bolt);
  }
  if (room && Array.isArray(room.eventsBuffer)) {
    room.eventsBuffer.push({
      type: 'MAGE_SKILL',
      skillId: 'ARCANE_BOLT',
      slot: 1,
      playerId: player.id,
      x: Math.round(mx),
      y: Math.round(my),
      angle: Number(player.angle.toFixed(2))
    });
  }
  return true;
}

function castFrostNova(player, room, skill) {
  const zombies = room.zombies || [];
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    if (Math.hypot(z.x - player.x, z.y - player.y) <= skill.radius + z.radius) {
      damageAndCreditZombie(player, z, skill.damage, skill.damageType, room, {
        freezeDuration: skill.freezeDuration,
        bossFreezeDuration: skill.bossFreezeDuration
      });
    }
  }
  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'FROST_NOVA',
    slot: 2,
    playerId: player.id,
    x: Math.round(player.x),
    y: Math.round(player.y),
    radius: skill.radius
  });
}

function castChainLightning(player, angle, room, targetPos, skill) {
  const zombies = room.zombies || [];
  const primary = findChainPrimaryTarget(player, angle, targetPos, skill, zombies);
  if (!primary) return false;

  const links = [];
  const hitIds = new Set();
  let currentTarget = primary;
  let currentFromX = player.x;
  let currentFromY = player.y;

  for (let jump = 0; jump <= skill.maxBounces && currentTarget; jump++) {
    hitIds.add(currentTarget.id);
    const dmg = Math.max(1, Math.round(skill.damage * Math.pow(1 - skill.bounceDamageDecay, jump)));
    const tx = currentTarget.x;
    const ty = currentTarget.y;

    links.push({
      fromX: Math.round(currentFromX),
      fromY: Math.round(currentFromY),
      toX: Math.round(tx),
      toY: Math.round(ty)
    });

    damageAndCreditZombie(player, currentTarget, dmg, skill.damageType, room, {
      stunDuration: skill.stunDuration
    });

    // Pick closest unhit living zombie within bounceRadius
    let nextTarget = null;
    let minDist = skill.bounceRadius;
    for (let i = 0; i < zombies.length; i++) {
      const cand = zombies[i];
      if (!cand || cand.isDead || hitIds.has(cand.id)) continue;
      const d = Math.hypot(cand.x - tx, cand.y - ty);
      if (d <= minDist + cand.radius && d < minDist) {
        minDist = d;
        nextTarget = cand;
      }
    }
    currentFromX = tx;
    currentFromY = ty;
    currentTarget = nextTarget;
  }

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'CHAIN_LIGHTNING',
    slot: 3,
    playerId: player.id,
    x: Math.round(player.x),
    y: Math.round(player.y),
    links
  });
  return true;
}

function castFireball(player, angle, room, skill) {
  const muzzleDist = player.radius + 18;
  const mx = player.x + Math.cos(angle) * muzzleDist;
  const my = player.y + Math.sin(angle) * muzzleDist;

  const fb = new Bullet(
    'b_mfb_' + Math.random().toString(36).substring(2, 8),
    player.id,
    mx,
    my,
    angle,
    {
      type: 'mage_fireball',
      isMageFireball: true,
      speed: skill.speed,
      damage: skill.damage,
      range: skill.range,
      radius: skill.radius,
      explosionRadius: skill.explosionRadius,
      explosionDamage: skill.damage,
      knockback: skill.knockback,
      damageType: skill.damageType
    }
  );
  room.bullets.push(fb);

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'FIREBALL',
    slot: 4,
    playerId: player.id,
    x: Math.round(mx),
    y: Math.round(my),
    angle: Number(angle.toFixed(2))
  });
}

function castArcaneTeleport(player, angle, room, targetPos, skill) {
  const fromX = player.x;
  const fromY = player.y;
  const clamped = clampCastTarget(player, angle, skill.maxDistance, targetPos);
  const blinkAngle = clamped.dist > 0.001 ? Math.atan2(clamped.y - fromY, clamped.x - fromX) : angle;

  const dest = resolveBlinkDestination(
    fromX,
    fromY,
    blinkAngle,
    clamped.dist,
    player.radius,
    room.map,
    room.barricades || []
  );

  // Origin arcane blast (zombies + barrels only; Barricade & ally safe)
  const zombies = room.zombies || [];
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    const dist = Math.hypot(z.x - fromX, z.y - fromY);
    if (dist <= skill.blastRadius + z.radius) {
      const knockAngle = dist > 0.001 ? Math.atan2(z.y - fromY, z.x - fromX) : blinkAngle;
      damageAndCreditZombie(player, z, skill.blastDamage, skill.damageType, room, {
        knockback: skill.knockback,
        knockAngle
      });
    }
  }
  detonateBarrelsInRadius(fromX, fromY, skill.blastRadius, skill.blastDamage, player.id, room);

  player.x = dest.x;
  player.y = dest.y;
  player.angle = blinkAngle;

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'ARCANE_TELEPORT',
    slot: 5,
    playerId: player.id,
    fromX: Math.round(fromX),
    fromY: Math.round(fromY),
    toX: Math.round(dest.x),
    toY: Math.round(dest.y),
    radius: skill.blastRadius
  });
}

function castSanctuaryHeal(player, angle, room, targetPos, skill) {
  const target = clampCastTarget(player, angle, skill.maxCastRange, targetPos);
  const bounded = room.map ? room.map.clampToBounds(target.x, target.y, 16) : target;

  room.groundZones = room.groundZones || [];
  room.groundZones.push({
    id: 'gz_sanc_' + Math.random().toString(36).substring(2, 8),
    type: 'sanctuary',
    ownerId: player.id,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    radius: skill.radius,
    healPerTick: skill.healPerSec * skill.healTickInterval,
    tickInterval: skill.healTickInterval,
    slowFactor: skill.zombieSlowFactor,
    slowRefresh: skill.zombieSlowRefresh,
    timer: skill.duration,
    tickTimer: 0
  });

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'SANCTUARY_HEAL',
    slot: 6,
    playerId: player.id,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    radius: skill.radius,
    duration: skill.duration
  });
}

function castManaShield(player, room, skill) {
  player.mageState.manaShieldTimer = skill.duration;
  player.mageState.manaShieldActive = true;

  room.eventsBuffer.push({
    type: 'MAGE_SKILL',
    skillId: 'MANA_SHIELD',
    slot: 7,
    playerId: player.id,
    x: Math.round(player.x),
    y: Math.round(player.y),
    duration: skill.duration
  });
}

function castMeteorStorm(player, angle, room, targetPos, skill) {
  const target = clampCastTarget(player, angle, skill.maxCastRange, targetPos);
  const bounded = room.map ? room.map.clampToBounds(target.x, target.y, 24) : target;

  // Fixed deterministic spread + center hit over 3.0s
  const offsets = [
    { dx: 0, dy: 0 },
    { dx: 130, dy: -90 },
    { dx: -140, dy: 80 },
    { dx: 95, dy: 135 },
    { dx: -110, dy: -120 }
  ];
  const stepDelay = skill.duration / Math.max(1, skill.meteorCount - 1);
  const meteors = offsets.map((off, idx) => {
    const mx = bounded.x + off.dx;
    const my = bounded.y + off.dy;
    const clamped = room.map ? room.map.clampToBounds(mx, my, 16) : { x: mx, y: my };
    return {
      delay: Number((idx * stepDelay).toFixed(2)),
      x: Math.round(clamped.x),
      y: Math.round(clamped.y),
      fired: false
    };
  });

  room.pendingMeteors = room.pendingMeteors || [];
  room.pendingMeteors.push({
    id: 'ms_' + Math.random().toString(36).substring(2, 8),
    playerId: player.id,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    stormRadius: skill.stormRadius,
    impactRadius: skill.meteorImpactRadius,
    damage: skill.meteorDamage,
    knockback: skill.meteorKnockback,
    timer: 0,
    meteorsDone: 0,
    meteors
  });

  room.eventsBuffer.push({
    type: 'ULTIMATE',
    ultId: 'METEOR_STORM',
    playerId: player.id,
    character: player.character,
    x: Math.round(bounded.x),
    y: Math.round(bounded.y),
    radius: skill.stormRadius,
    duration: skill.duration
  });
}

/**
 * Triggers a Mage skill by slot (1..8).
 * @param {object} player
 * @param {number} slot
 * @param {number} angle
 * @param {object} room
 * @param {object|null} [targetPos=null]
 * @returns {{ activated: boolean, skillId?: string, reason?: string }}
 */
function triggerMageSkill(player, slot, angle, room, targetPos = null) {
  if (!player || player.character !== 'MAGE' || !player.mageState) {
    return { activated: false, reason: 'NOT_MAGE' };
  }
  if (player.isDead || player.isDowned) return { activated: false, reason: 'UNAVAILABLE' };
  if (!room || (room.state !== 'PLAYING' && room.state !== 'INTERMISSION')) {
    return { activated: false, reason: 'INVALID_STATE' };
  }
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > 8) {
    return { activated: false, reason: 'INVALID_SLOT' };
  }
  if (slot === 1) {
    const ok = executeMageArcaneBolt(player, room);
    return ok ? { activated: true, skillId: 'ARCANE_BOLT' } : { activated: false, reason: 'COOLDOWN_OR_MANA' };
  }

  const safeAngle = (typeof angle === 'number' && Number.isFinite(angle)) ? angle : player.angle;
  const skill = getMageSkillBySlot(slot);
  const skillState = skill ? player.mageState.skills[skill.id] : null;
  if (!skill || !skillState || !skillState.unlocked) {
    return { activated: false, reason: 'LOCKED' };
  }
  if (skillState.cooldown > 0) {
    return { activated: false, reason: 'ON_COOLDOWN' };
  }
  if (player.mana + 1e-6 < skill.manaCost) {
    return { activated: false, reason: 'NO_MANA' };
  }

  room.eventsBuffer = room.eventsBuffer || [];
  room.zombies = room.zombies || [];
  room.bullets = room.bullets || [];

  // Chain Lightning validates target availability before consuming Mana/CD
  if (slot === 3) {
    const hit = castChainLightning(player, safeAngle, room, targetPos, skill);
    if (!hit) return { activated: false, reason: 'NO_TARGET' };
    player.consumeMana(skill.manaCost);
    skillState.cooldown = skill.cooldown;
    return { activated: true, skillId: skill.id };
  }

  player.consumeMana(skill.manaCost);
  skillState.cooldown = skill.cooldown;

  if (slot === 2) castFrostNova(player, room, skill);
  else if (slot === 4) castFireball(player, safeAngle, room, skill);
  else if (slot === 5) castArcaneTeleport(player, safeAngle, room, targetPos, skill);
  else if (slot === 6) castSanctuaryHeal(player, safeAngle, room, targetPos, skill);
  else if (slot === 7) castManaShield(player, room, skill);
  else if (slot === 8) castMeteorStorm(player, safeAngle, room, targetPos, skill);

  return { activated: true, skillId: skill.id };
}

/**
 * Detonates Mage Fireball (zombies + barrels only) and creates a 3.0s burn_pool ground zone.
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {number} damage
 * @param {string|null} ownerId
 * @param {object} room
 */
function explodeMageFireball(x, y, radius, damage, ownerId, room) {
  if (!room) return;
  const skill = MAGE_SKILLS.FIREBALL;
  const owner = room.players instanceof Map ? room.players.get(ownerId) : null;

  room.eventsBuffer = room.eventsBuffer || [];
  room.eventsBuffer.push({
    type: 'EXPLOSION',
    x: Math.round(x),
    y: Math.round(y),
    radius: Math.round(radius),
    source: 'MAGE_FIREBALL'
  });

  const zombies = room.zombies || [];
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;
    const d = Math.hypot(z.x - x, z.y - y);
    if (d <= radius + z.radius) {
      const knockAngle = d > 0.001 ? Math.atan2(z.y - y, z.x - x) : 0;
      damageAndCreditZombie(owner, z, damage, 'FIRE', room, {
        knockback: skill.knockback,
        knockAngle
      });
    }
  }

  detonateBarrelsInRadius(x, y, radius, damage, ownerId, room);

  room.groundZones = room.groundZones || [];
  room.groundZones.push({
    id: 'gz_burn_' + Math.random().toString(36).substring(2, 8),
    type: 'burn_pool',
    ownerId,
    x: Math.round(x),
    y: Math.round(y),
    radius: skill.burnRadius,
    damagePerTick: skill.burnDamagePerSec * skill.burnTickInterval,
    tickInterval: skill.burnTickInterval,
    timer: skill.burnDuration,
    tickTimer: 0
  });
}

function spawnOrRefreshLavaPool(x, y, ownerId, room) {
  const skill = MAGE_SKILLS.METEOR_STORM;
  room.groundZones = room.groundZones || [];
  const existing = room.groundZones.find(gz => gz.type === 'lava_pool' && gz.ownerId === ownerId);
  if (existing) {
    existing.timer = Math.max(existing.timer, skill.lavaDuration);
    return;
  }
  room.groundZones.push({
    id: 'gz_lava_' + Math.random().toString(36).substring(2, 8),
    type: 'lava_pool',
    ownerId,
    x: Math.round(x),
    y: Math.round(y),
    radius: skill.lavaRadius,
    damagePerTick: skill.lavaDamagePerSec * skill.lavaTickInterval,
    tickInterval: skill.lavaTickInterval,
    slowFactor: skill.lavaSlowFactor,
    timer: skill.lavaDuration,
    tickTimer: 0
  });
}

function updateMageGroundZones(dt, room) {
  if (!Array.isArray(room.groundZones)) return;
  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);
  const ownerLookup = (id) => (room.players instanceof Map ? room.players.get(id) : playersList.find(p => p.id === id));

  for (let i = 0; i < playersList.length; i++) {
    if (playersList[i]) playersList[i].hasSanctuaryBuff = false;
  }

  for (let i = room.groundZones.length - 1; i >= 0; i--) {
    const zone = room.groundZones[i];
    zone.timer -= dt;
    const zombies = room.zombies || [];

    if (zone.type === 'sanctuary') {
      for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
        const z = zombies[zIdx];
        if (!z || z.isDead) continue;
        if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
          z.applySlow(zone.slowRefresh || 0.4, zone.slowFactor);
        }
      }
      for (let pIdx = 0; pIdx < playersList.length; pIdx++) {
        const p = playersList[pIdx];
        if (!p || p.isDead || p.isDowned) continue;
        if (Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius) {
          p.hasSanctuaryBuff = true;
        }
      }
      zone.tickTimer = (zone.tickTimer || 0) + dt;
      if (zone.tickTimer >= zone.tickInterval - 1e-6) {
        zone.tickTimer = 0;
        for (let pIdx = 0; pIdx < playersList.length; pIdx++) {
          const p = playersList[pIdx];
          if (!p || p.isDead || p.isDowned) continue;
          if (Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius) {
            p.heal(zone.healPerTick);
          }
        }
      }
    } else if (zone.type === 'burn_pool' || zone.type === 'lava_pool') {
      if (zone.slowFactor) {
        for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
          const z = zombies[zIdx];
          if (!z || z.isDead) continue;
          if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
            z.applySlow(0.4, zone.slowFactor);
          }
        }
      }
      zone.tickTimer = (zone.tickTimer || 0) + dt;
      if (zone.tickTimer >= zone.tickInterval - 1e-6) {
        zone.tickTimer = 0;
        const owner = ownerLookup(zone.ownerId);
        for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
          const z = zombies[zIdx];
          if (!z || z.isDead) continue;
          if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
            damageAndCreditZombie(owner, z, zone.damagePerTick, 'FIRE', room);
          }
        }
      }
    }

    if (zone.timer <= 1e-6) {
      room.groundZones.splice(i, 1);
    }
  }
}

function updatePendingMeteors(dt, room) {
  if (!Array.isArray(room.pendingMeteors)) return;
  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);
  const ownerLookup = (id) => (room.players instanceof Map ? room.players.get(id) : playersList.find(p => p.id === id));

  for (let i = room.pendingMeteors.length - 1; i >= 0; i--) {
    const storm = room.pendingMeteors[i];
    storm.timer += dt;
    const owner = ownerLookup(storm.playerId);

    for (let mIdx = 0; mIdx < storm.meteors.length; mIdx++) {
      const m = storm.meteors[mIdx];
      if (m.fired || storm.timer < m.delay - 1e-6) continue;
      m.fired = true;
      storm.meteorsDone++;

      const zombies = room.zombies || [];
      for (let zIdx = 0; zIdx < zombies.length; zIdx++) {
        const z = zombies[zIdx];
        if (!z || z.isDead) continue;
        const dist = Math.hypot(z.x - m.x, z.y - m.y);
        if (dist <= storm.impactRadius + z.radius) {
          const knockAngle = dist > 0.001 ? Math.atan2(z.y - m.y, z.x - m.x) : 0;
          damageAndCreditZombie(owner, z, storm.damage, 'FIRE', room, {
            knockback: storm.knockback,
            knockAngle
          });
        }
      }

      detonateBarrelsInRadius(m.x, m.y, storm.impactRadius, storm.damage, storm.playerId, room);
      spawnOrRefreshLavaPool(storm.x, storm.y, storm.playerId, room);

      if (Array.isArray(room.eventsBuffer)) {
        room.eventsBuffer.push({
          type: 'MAGE_SKILL',
          skillId: 'METEOR_IMPACT',
          slot: 8,
          playerId: storm.playerId,
          x: m.x,
          y: m.y,
          radius: storm.impactRadius
        });
      }
    }

    if (storm.meteorsDone >= storm.meteors.length) {
      room.pendingMeteors.splice(i, 1);
    }
  }
}

/**
 * Authoritative tick update for Mage groundZones and pending meteor impacts.
 * @param {number} dt
 * @param {object} room
 */
function updateMageRoomSystems(dt, room) {
  if (!room) return;
  updateMageGroundZones(dt, room);
  updatePendingMeteors(dt, room);

  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);
  for (let i = 0; i < playersList.length; i++) {
    const p = playersList[i];
    if (p && p.character === 'MAGE' && p.mageState && p.mageState.shieldJustBroken) {
      p.mageState.shieldJustBroken = false;
      if (Array.isArray(room.eventsBuffer)) {
        room.eventsBuffer.push({
          type: 'MAGE_SHIELD_BREAK',
          playerId: p.id,
          x: Math.round(p.x),
          y: Math.round(p.y)
        });
      }
    }
  }
}

module.exports = {
  maybeDropPickup,
  damageAndCreditZombie,
  executeMageArcaneBolt,
  triggerMageSkill,
  explodeMageFireball,
  updateMageRoomSystems,
  clampCastTarget,
  findChainPrimaryTarget
};
