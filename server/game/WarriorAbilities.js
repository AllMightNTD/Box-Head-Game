/**
 * @file WarriorAbilities.js
 * @description Authoritative combat simulation engine for Warrior Stance and ARPG skills (1-8),
 * managing hitbox collisions, crowd control, parry counters, ground zones, and team buffs.
 */

'use strict';

const {
  WARRIOR_SKILLS,
  getWarriorSkillBySlot
} = require('./WarriorSkillsConfig.js');
const { Bullet } = require('./Bullet.js');
const { ULT_CHARGE_CONFIG } = require('./UltimateConfig.js');

/**
 * Steps an entity forward incrementally along angle, clamping against map
 * bounds, walls, interior pillars, and intact barricades.
 * @param {{ x: number, y: number, radius: number }} entity
 * @param {number} angle
 * @param {number} totalDistance
 * @param {object|null} map
 * @param {Array<object>} [barricades=[]]
 * @returns {{ x: number, y: number }} Clamped final coordinates
 */
function stepClamped(entity, angle, totalDistance, map, barricades = []) {
  if (totalDistance <= 0 || !Number.isFinite(totalDistance)) {
    return { x: entity.x, y: entity.y };
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const maxSubStep = 8;
  const steps = Math.max(1, Math.ceil(totalDistance / maxSubStep));
  const stepDist = totalDistance / steps;

  let curX = entity.x;
  let curY = entity.y;

  for (let s = 0; s < steps; s++) {
    let nextX = curX + cos * stepDist;
    let nextY = curY + sin * stepDist;

    if (map) {
      const resolved = map.resolveCircleCollision(nextX, nextY, entity.radius);
      nextX = resolved.x;
      nextY = resolved.y;
    }

    for (let i = 0; i < barricades.length; i++) {
      const b = barricades[i];
      if (!b || b.isDead || b.isDestroyed) continue;
      const bCol = b.resolveCircleCollision(nextX, nextY, entity.radius);
      nextX = bCol.x;
      nextY = bCol.y;
    }

    curX = nextX;
    curY = nextY;
  }

  entity.x = curX;
  entity.y = curY;
  return { x: curX, y: curY };
}

/**
 * Deals damage to zombie, applying warrior multipliers, knockback, stun, slow,
 * awarding ult charge, and recording kills with unlocked events and pickup drops.
 * @param {object} warrior
 * @param {object} zombie
 * @param {number} baseDmg
 * @param {string} sourceType
 * @param {object} room
 * @param {object} [options={}]
 */
function damageAndCreditZombie(warrior, zombie, baseDmg, sourceType, room, options = {}) {
  if (!zombie || zombie.isDead) return;

  const mult = warrior && typeof warrior.getWarriorDamageMultiplier === 'function'
    ? warrior.getWarriorDamageMultiplier()
    : ((warrior?.warriorState?.avatarTimer > 0 ? 1.5 : 1.0) * (warrior?.hasWarCryBuff ? 1.15 : 1.0));
  const finalDamage = Math.max(1, Math.round(baseDmg * mult));

  zombie.takeDamage(finalDamage, sourceType);

  if (options.knockback && options.knockAngle !== undefined) {
    zombie.applyKnockback(options.knockAngle, options.knockback);
  }

  if (options.stun) {
    const isBoss = zombie.type === 'TANK' || zombie.type === 'DEVIL';
    const stunDur = isBoss
      ? (options.bossStun !== undefined ? options.bossStun : options.stun)
      : options.stun;
    if (stunDur > 0) {
      zombie.applyStun(stunDur);
    }
  }

  if (options.slowFactor && options.slowDuration) {
    zombie.applySlow(options.slowDuration, options.slowFactor);
  }

  // Ult charge on hit when not in Avatar of War
  const isAvatarActive = Boolean(warrior?.warriorState?.avatarActive || warrior?.warriorState?.avatarTimer > 0);
  if (warrior && !isAvatarActive && options.awardHitCharge !== false) {
    warrior.addUltCharge(ULT_CHARGE_CONFIG.HIT_BASE);
  }

  // Zombie death
  if (zombie.isDead && warrior) {
    const awardKillUlt = options.awardKillCharge !== undefined
      ? Boolean(options.awardKillCharge)
      : !isAvatarActive;
    const scoreVal = zombie.scoreValue || zombie.score || 10;
    const newlyUnlocked = warrior.recordKill(scoreVal, { awardUltCharge: awardKillUlt });

    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'ZOMBIE_DIE',
        x: Math.round(zombie.x),
        y: Math.round(zombie.y),
        zType: zombie.type,
        angle: Number(zombie.angle.toFixed(2))
      });
      if (Array.isArray(newlyUnlocked) && newlyUnlocked.length > 0) {
        for (let i = 0; i < newlyUnlocked.length; i++) {
          const u = newlyUnlocked[i];
          room.eventsBuffer.push({
            type: 'UNLOCKED',
            weapon: u.name || u.id,
            playerId: warrior.id,
            slot: u.slot
          });
        }
      }
    }

    // 15% pickup drop chance
    if (room && Array.isArray(room.pickups) && options.dropPickup !== false && Math.random() < 0.15) {
      room.pickups.push({
        id: 'pk_' + Math.random().toString(36).substring(2, 7),
        type: Math.random() < 0.4 ? 'MEDKIT' : 'AMMO',
        x: Math.round(zombie.x),
        y: Math.round(zombie.y),
        life: 25
      });
    }
  }
}

/**
 * Executes Warrior basic melee attack in current stance ([1] Berserker or [2] Juggernaut).
 * @param {object} player
 * @param {object} room
 * @returns {boolean} True if swing was executed
 */
function executeWarriorBasicAttack(player, room) {
  if (!player || player.character !== 'WARRIOR' || !player.warriorState) return false;
  if (player.isDead || player.isDowned) return false;
  if (player.fireCooldown > 0) return false;

  const stanceId = player.warriorState.activeStance || 'BERSERKER_STANCE';
  const skill = WARRIOR_SKILLS[stanceId];
  if (!skill) return false;

  player.fireCooldown = skill.fireDelay;
  const angle = player.angle;
  const isBerserker = stanceId === 'BERSERKER_STANCE';
  let hitCount = 0;

  if (room && Array.isArray(room.zombies)) {
    for (let i = 0; i < room.zombies.length; i++) {
      const z = room.zombies[i];
      if (!z || z.isDead) continue;
      const dist = Math.hypot(z.x - player.x, z.y - player.y);
      if (dist > skill.range + z.radius) continue;

      const angleToZ = Math.atan2(z.y - player.y, z.x - player.x);
      let diff = angleToZ - angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) > skill.arcRad / 2) continue;

      hitCount++;
      if (isBerserker) {
        damageAndCreditZombie(player, z, skill.damage, 'MELEE', room, {
          knockback: 50,
          knockAngle: angleToZ
        });
      } else {
        damageAndCreditZombie(player, z, skill.damage, 'MELEE', room, {
          knockback: skill.knockback,
          knockAngle: angleToZ,
          slowFactor: skill.slowFactor,
          slowDuration: skill.slowDuration
        });
      }
    }
  }

  // Berserker stacks: increment only if hit at least one zombie
  if (isBerserker && hitCount > 0) {
    player.warriorState.furyStacks = Math.min(skill.maxFuryStacks, player.warriorState.furyStacks + 1);
    player.warriorState.furyTimer = skill.furyDuration;
  }

  // Fire slash projectile when in Avatar of War
  const isAvatarActive = Boolean(player.warriorState.avatarActive || player.warriorState.avatarTimer > 0);
  if (isAvatarActive && room && Array.isArray(room.bullets)) {
    const ultCfg = WARRIOR_SKILLS.AVATAR_OF_WAR;
    const bId = 'b_fs_' + Math.random().toString(36).substring(2, 8);
    const slash = new Bullet(bId, player.id, player.x, player.y, angle, {
      type: 'fire_slash',
      speed: ultCfg.fireSlashSpeed,
      damage: ultCfg.fireSlashDamage,
      range: ultCfg.fireSlashRange,
      penetration: true,
      radius: 16,
      fromUlt: true
    });
    room.bullets.push(slash);
  }

  if (room && Array.isArray(room.eventsBuffer)) {
    room.eventsBuffer.push({
      type: 'WARRIOR_SKILL',
      skillId: stanceId,
      slot: skill.slot,
      playerId: player.id,
      x: Math.round(player.x),
      y: Math.round(player.y),
      angle: Number(angle.toFixed(2))
    });
  }

  return true;
}

/**
 * Activates Avatar of War ultimate ability on Warrior.
 * @param {object} player
 * @param {object} room
 * @returns {object|null} Event object for eventsBuffer
 */
function activateAvatarOfWar(player, room) {
  if (!player || player.character !== 'WARRIOR' || !player.warriorState) return null;
  if (player.isDead || player.isDowned) return null;
  if (player.warriorState.avatarActive || player.warriorState.avatarTimer > 0) return null;
  if (player.ultCharge < player.ultMaxCharge) return null;

  const skill = WARRIOR_SKILLS.AVATAR_OF_WAR;
  player.ultCharge = 0;
  player.warriorState.avatarTimer = skill.duration;
  player.warriorState.avatarActive = true;

  const event = {
    type: 'ULTIMATE',
    ultId: 'AVATAR_OF_WAR',
    playerId: player.id,
    character: player.character,
    x: Math.round(player.x),
    y: Math.round(player.y),
    duration: skill.duration
  };

  return event;
}

/**
 * Triggers a Warrior skill (slots 3..8) by slot number and aim angle.
 * @param {object} player
 * @param {number} slot
 * @param {number} angle
 * @param {object} room
 * @returns {{ activated: boolean, skillId?: string }}
 */
function triggerWarriorSkill(player, slot, angle, room) {
  if (!player || player.character !== 'WARRIOR' || !player.warriorState) {
    return { activated: false };
  }
  if (player.isDead || player.isDowned) return { activated: false };
  if (!room || (room.state !== 'PLAYING' && room.state !== 'INTERMISSION')) {
    return { activated: false };
  }
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 3 || slot > 8) {
    return { activated: false };
  }
  if (typeof angle !== 'number' || !Number.isFinite(angle)) {
    return { activated: false };
  }

  const skill = getWarriorSkillBySlot(slot);
  if (!skill) return { activated: false };

  const skillState = player.warriorState.skills[skill.id];
  if (!skillState || !skillState.unlocked) {
    return { activated: false };
  }

  // Slot 8: Avatar of War
  if (slot === 8) {
    if (player.warriorState.avatarActive || player.warriorState.avatarTimer > 0) {
      return { activated: false };
    }
    if (player.ultCharge < player.ultMaxCharge) {
      return { activated: false };
    }
    const event = activateAvatarOfWar(player, room);
    if (event && room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push(event);
    }
    return { activated: true, skillId: 'AVATAR_OF_WAR' };
  }

  // Slots 3..7 require cooldown <= 0
  if (skillState.cooldown > 0) {
    return { activated: false };
  }

  if (slot === 3) {
    // BLADE_WHIRLWIND
    skillState.cooldown = skill.cooldown;
    player.warriorState.whirlwind = {
      timer: skill.duration,
      duration: skill.duration,
      elapsed: 0,
      ticksDone: 0,
      totalTicks: skill.totalTicks,
      tickInterval: skill.tickInterval,
      stanceAtTrigger: player.warriorState.activeStance,
      triggerAngle: angle
    };
    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'WARRIOR_SKILL',
        skillId: 'BLADE_WHIRLWIND',
        slot: 3,
        playerId: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        duration: skill.duration
      });
    }
    return { activated: true, skillId: 'BLADE_WHIRLWIND' };
  }

  if (slot === 4) {
    // SHADOW_DASH_SLASH
    skillState.cooldown = skill.cooldown;
    room.groundZones = room.groundZones || [];
    room.groundZones.push({
      id: 'gz_sm_' + Math.random().toString(36).substring(2, 8),
      type: 'slash_mark',
      ownerId: player.id,
      x: Math.round(player.x),
      y: Math.round(player.y),
      radius: skill.markRadius,
      pullRadius: skill.markPullRadius,
      damage: skill.markDamage,
      timer: skill.markFuseTime
    });

    player.warriorState.dash = {
      timer: skill.duration,
      duration: skill.duration,
      distance: skill.distance,
      speed: skill.distance / skill.duration,
      angle,
      damage: skill.dashDamage,
      hitIds: new Set(),
      destMarkDropped: false
    };

    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'WARRIOR_SKILL',
        skillId: 'SHADOW_DASH_SLASH',
        slot: 4,
        playerId: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        angle: Number(angle.toFixed(2)),
        distance: skill.distance,
        duration: skill.duration
      });
    }
    return { activated: true, skillId: 'SHADOW_DASH_SLASH' };
  }

  if (slot === 5) {
    // SEISMIC_SLAM
    skillState.cooldown = skill.cooldown;
    room.pendingSlams = room.pendingSlams || [];
    room.pendingSlams.push({
      id: 'slam_' + Math.random().toString(36).substring(2, 8),
      playerId: player.id,
      x: player.x,
      y: player.y,
      timer: 0,
      ringsDone: 0,
      hitIds: new Set(),
      rings: skill.rings.map(r => ({ ...r, fired: false })),
      fireballClearRadius: skill.fireballClearRadius
    });

    // Destroy Devil fireballs immediately within fireballClearRadius
    if (room && Array.isArray(room.bullets)) {
      for (let i = room.bullets.length - 1; i >= 0; i--) {
        const b = room.bullets[i];
        if (b && b.isFireball && Math.hypot(b.x - player.x, b.y - player.y) <= skill.fireballClearRadius) {
          b.isDead = true;
          room.bullets.splice(i, 1);
        }
      }
    }

    // Spawn seismic_fissure zone
    room.groundZones = room.groundZones || [];
    room.groundZones.push({
      id: 'gz_sf_' + Math.random().toString(36).substring(2, 8),
      type: 'seismic_fissure',
      ownerId: player.id,
      x: Math.round(player.x),
      y: Math.round(player.y),
      radius: skill.fissureRadius,
      slowFactor: skill.fissureSlowFactor,
      damagePerTick: skill.fissureTickDamage,
      tickInterval: skill.fissureTickInterval,
      timer: skill.fissureDuration,
      tickTimer: 0
    });

    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'WARRIOR_SKILL',
        skillId: 'SEISMIC_SLAM',
        slot: 5,
        playerId: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        radius: skill.fissureRadius
      });
    }
    return { activated: true, skillId: 'SEISMIC_SLAM' };
  }

  if (slot === 6) {
    // WAR_CRY
    skillState.cooldown = skill.cooldown;
    player.restoreArmor(player.maxArmor * skill.armorRestoreRatio);
    player.warriorState.warCryAuraTimer = skill.auraDuration;

    if (room && Array.isArray(room.zombies)) {
      for (let i = 0; i < room.zombies.length; i++) {
        const z = room.zombies[i];
        if (!z || z.isDead) continue;
        const dist = Math.hypot(z.x - player.x, z.y - player.y);
        if (dist <= skill.tauntRadius) {
          z.applyTaunt(player.id, skill.tauntDuration);
        }
        if (dist <= skill.fearRadius) {
          z.applyFear(player.x, player.y, skill.fearDuration);
        }
      }
    }

    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'WARRIOR_SKILL',
        skillId: 'WAR_CRY',
        slot: 6,
        playerId: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        radius: skill.tauntRadius,
        fearRadius: skill.fearRadius,
        auraRadius: skill.auraRadius,
        duration: skill.auraDuration
      });
    }
    return { activated: true, skillId: 'WAR_CRY' };
  }

  if (slot === 7) {
    // COUNTER_SHIELD_BASH
    player.warriorState.counterShieldTimer = skill.duration;
    player.warriorState.counterShieldActive = true;
    player.warriorState.pendingParry = null;
    player.warriorState.skills.COUNTER_SHIELD_BASH.cooldown = skill.cooldown;

    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push({
        type: 'WARRIOR_SKILL',
        skillId: 'COUNTER_SHIELD_BASH',
        slot: 7,
        playerId: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        angle: Number(angle.toFixed(2)),
        duration: skill.duration
      });
    }
    return { activated: true, skillId: 'COUNTER_SHIELD_BASH' };
  }

  return { activated: false };
}

/**
 * Triggers Perfect Counter Parry sequence: clamped step forward, shield bash stun, and free cleave.
 * @param {object} player
 * @param {object} room
 */
function triggerWarriorCounterParry(player, room) {
  if (!player || player.character !== 'WARRIOR' || !player.warriorState) return;
  const parryData = player.warriorState.pendingParry;
  player.warriorState.pendingParry = null;
  player.warriorState.counterShieldActive = false;
  player.warriorState.counterShieldTimer = 0;

  const skill = WARRIOR_SKILLS.COUNTER_SHIELD_BASH;
  player.warriorState.skills.COUNTER_SHIELD_BASH.cooldown = skill.cooldown;

  // Clamped 75px step forward
  const barricades = (room && Array.isArray(room.barricades)) ? room.barricades : [];
  stepClamped(player, player.angle, skill.stepDistance, room?.map || null, barricades);

  const bashAngle = player.angle;

  // Bash (95 dmg, 360 kb, 2.2s stun, 1.4s boss stun) & Cleave (120 dmg)
  if (room && Array.isArray(room.zombies)) {
    for (let i = 0; i < room.zombies.length; i++) {
      const z = room.zombies[i];
      if (!z || z.isDead) continue;
      const dist = Math.hypot(z.x - player.x, z.y - player.y);
      const angleToZ = Math.atan2(z.y - player.y, z.x - player.x);
      let diff = angleToZ - bashAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      if (Math.abs(diff) <= skill.bashConeRad / 2) {
        if (dist <= skill.bashRange + z.radius) {
          damageAndCreditZombie(player, z, skill.bashDamage, 'MELEE', room, {
            knockback: skill.bashKnockback,
            knockAngle: angleToZ,
            stun: skill.bashStunDuration,
            bossStun: skill.bashBossStunDuration
          });
        }
        if (!z.isDead && dist <= skill.cleaveRange + z.radius) {
          damageAndCreditZombie(player, z, skill.cleaveDamage, 'MELEE', room, {
            knockback: 100,
            knockAngle: angleToZ
          });
        }
      }
    }
  }

  if (room && Array.isArray(room.eventsBuffer)) {
    room.eventsBuffer.push({
      type: 'WARRIOR_COUNTER',
      playerId: player.id,
      x: Math.round(player.x),
      y: Math.round(player.y),
      angle: Number(player.angle.toFixed(2)),
      sourceX: parryData?.sourceX,
      sourceY: parryData?.sourceY
    });
  }
}

/**
 * Checks whether an incoming attack is blocked by Warrior's active frontal counter shield.
 * @param {object} player
 * @param {number} sourceX
 * @param {number} sourceY
 * @returns {boolean}
 */
function isFrontalShieldBlocking(player, sourceX, sourceY) {
  if (!player || player.character !== 'WARRIOR' || !player.warriorState) return false;
  if (player.isDead || player.isDowned) return false;
  if (!player.warriorState.counterShieldActive && player.warriorState.counterShieldTimer <= 0) {
    return false;
  }
  return player.isAttackInFrontCone(
    sourceX,
    sourceY,
    WARRIOR_SKILLS.COUNTER_SHIELD_BASH.frontalArcHalfRad
  );
}

/**
 * Applies AMMO pickup bonus to Warrior by delegating to Player.applyWarriorCooldownBonus().
 * @param {object} player
 */
function applyWarriorAmmoPickup(player) {
  if (!player || typeof player.applyWarriorCooldownBonus !== 'function') return;
  player.applyWarriorCooldownBonus();
}

/**
 * Updates ground zones (slash marks and seismic fissures) in room.
 * @param {number} dt
 * @param {object} room
 */
function updateGroundZones(dt, room) {
  if (!room || !Array.isArray(room.groundZones)) return;
  const ownerLookup = (id) => (room.players instanceof Map ? room.players.get(id) : room.players?.find?.(p => p.id === id));

  for (let i = room.groundZones.length - 1; i >= 0; i--) {
    const zone = room.groundZones[i];
    zone.timer -= dt;

    if (zone.type === 'slash_mark') {
      if (zone.timer <= 0) {
        const owner = ownerLookup(zone.ownerId);
        if (Array.isArray(room.zombies)) {
          for (let zIdx = 0; zIdx < room.zombies.length; zIdx++) {
            const z = room.zombies[zIdx];
            if (!z || z.isDead) continue;
            const dist = Math.hypot(z.x - zone.x, z.y - zone.y);

            if (dist <= zone.pullRadius + z.radius) {
              const pullAngle = Math.atan2(zone.y - z.y, zone.x - z.x);
              const pullStep = Math.min(dist, 90);
              let nx = z.x + Math.cos(pullAngle) * pullStep;
              let ny = z.y + Math.sin(pullAngle) * pullStep;
              if (room.map) {
                const res = room.map.resolveCircleCollision(nx, ny, z.radius);
                nx = res.x;
                ny = res.y;
              }
              z.x = nx;
              z.y = ny;
              z.applyKnockback(pullAngle, 180);
            }

            if (dist <= zone.radius + z.radius) {
              damageAndCreditZombie(owner, z, zone.damage, 'EXPLOSION', room);
            }
          }
        }

        if (Array.isArray(room.eventsBuffer)) {
          room.eventsBuffer.push({
            type: 'WARRIOR_MARK_EXPLODE',
            x: zone.x,
            y: zone.y,
            radius: zone.radius,
            pullRadius: zone.pullRadius
          });
        }
        room.groundZones.splice(i, 1);
      }
    } else if (zone.type === 'seismic_fissure') {
      const owner = ownerLookup(zone.ownerId);
      if (Array.isArray(room.zombies)) {
        for (let zIdx = 0; zIdx < room.zombies.length; zIdx++) {
          const z = room.zombies[zIdx];
          if (!z || z.isDead) continue;
          if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
            z.applySlow(0.4, zone.slowFactor);
          }
        }
      }

      zone.tickTimer = (zone.tickTimer || 0) + dt;
      if (zone.tickTimer >= zone.tickInterval - 1e-6) {
        zone.tickTimer = 0;
        if (Array.isArray(room.zombies)) {
          for (let zIdx = 0; zIdx < room.zombies.length; zIdx++) {
            const z = room.zombies[zIdx];
            if (!z || z.isDead) continue;
            if (Math.hypot(z.x - zone.x, z.y - zone.y) <= zone.radius + z.radius) {
              damageAndCreditZombie(owner, z, zone.damagePerTick, 'FIRE', room, { awardHitCharge: false });
            }
          }
        }
      }

      if (zone.timer <= 0) {
        room.groundZones.splice(i, 1);
      }
    }
  }
}

/**
 * Updates pending 3-ring Seismic Slam shockwaves.
 * @param {number} dt
 * @param {object} room
 */
function updatePendingSlams(dt, room) {
  if (!room || !Array.isArray(room.pendingSlams)) return;
  const ownerLookup = (id) => (room.players instanceof Map ? room.players.get(id) : room.players?.find?.(p => p.id === id));

  for (let i = room.pendingSlams.length - 1; i >= 0; i--) {
    const slam = room.pendingSlams[i];
    slam.timer += dt;
    const owner = ownerLookup(slam.playerId);

    for (let rIdx = 0; rIdx < slam.rings.length; rIdx++) {
      const ring = slam.rings[rIdx];
      if (ring.fired || slam.timer < ring.delay - 1e-6) continue;
      ring.fired = true;
      slam.ringsDone++;

      // Clear fireballs within ring radius
      if (Array.isArray(room.bullets)) {
        for (let bIdx = room.bullets.length - 1; bIdx >= 0; bIdx--) {
          const b = room.bullets[bIdx];
          if (b && b.isFireball && Math.hypot(b.x - slam.x, b.y - slam.y) <= ring.maxR) {
            b.isDead = true;
            room.bullets.splice(bIdx, 1);
          }
        }
      }

      // Damage zombies in [minR, maxR]
      if (Array.isArray(room.zombies)) {
        for (let zIdx = 0; zIdx < room.zombies.length; zIdx++) {
          const z = room.zombies[zIdx];
          if (!z || z.isDead || slam.hitIds.has(z.id)) continue;
          const dist = Math.hypot(z.x - slam.x, z.y - slam.y);
          if (dist >= ring.minR && dist <= ring.maxR + z.radius) {
            slam.hitIds.add(z.id);
            const knockAngle = dist > 0.001 ? Math.atan2(z.y - slam.y, z.x - slam.x) : 0;
            damageAndCreditZombie(owner, z, ring.damage, 'EXPLOSION', room, {
              knockback: ring.knockback,
              knockAngle,
              stun: ring.stun,
              bossStun: ring.bossStun
            });
          }
        }
      }
    }

    if (slam.ringsDone >= slam.rings.length) {
      room.pendingSlams.splice(i, 1);
    }
  }
}

/**
 * Updates active Blade Whirlwind channeling state.
 * @param {number} dt
 * @param {object} player
 * @param {object} room
 */
function updateWarriorWhirlwind(dt, player, room) {
  const ws = player.warriorState;
  if (!ws.whirlwind) return;

  const ww = ws.whirlwind;
  ww.timer -= dt;
  ww.elapsed += dt;

  while (ww.ticksDone < ww.totalTicks && ww.elapsed >= (ww.ticksDone + 1) * ww.tickInterval - 1e-6) {
    ww.ticksDone++;
    const isTick6 = ww.ticksDone === ww.totalTicks;
    const skill = WARRIOR_SKILLS.BLADE_WHIRLWIND;

    // Normal tick damage (105px radius, 45 dmg)
    if (Array.isArray(room.zombies)) {
      for (let i = 0; i < room.zombies.length; i++) {
        const z = room.zombies[i];
        if (!z || z.isDead) continue;
        const dist = Math.hypot(z.x - player.x, z.y - player.y);
        if (dist <= skill.radius + z.radius) {
          damageAndCreditZombie(player, z, skill.damage, 'MELEE', room, {
            knockback: 40,
            knockAngle: Math.atan2(z.y - player.y, z.x - player.x)
          });
        }
      }
    }

    // Tick 6 stance synergy
    if (isTick6) {
      if (ww.stanceAtTrigger === 'BERSERKER_STANCE') {
        const angles = [
          player.angle,
          player.angle + Math.PI / 2,
          player.angle + Math.PI,
          player.angle - Math.PI / 2
        ];
        for (let a = 0; a < angles.length; a++) {
          const bId = 'b_wb_' + Math.random().toString(36).substring(2, 8);
          const bullet = new Bullet(bId, player.id, player.x, player.y, angles[a], {
            type: 'wind_blade',
            speed: skill.windBladeSpeed,
            damage: skill.windBladeDamage,
            range: skill.windBladeRange,
            penetration: true,
            radius: 16
          });
          if (Array.isArray(room.bullets)) room.bullets.push(bullet);
        }
      } else if (ww.stanceAtTrigger === 'JUGGERNAUT_STANCE') {
        if (Array.isArray(room.zombies)) {
          for (let i = 0; i < room.zombies.length; i++) {
            const z = room.zombies[i];
            if (!z || z.isDead) continue;
            const dist = Math.hypot(z.x - player.x, z.y - player.y);
            if (dist <= skill.juggernautSlamRadius + z.radius) {
              damageAndCreditZombie(player, z, skill.juggernautSlamDamage, 'EXPLOSION', room, {
                knockback: skill.juggernautSlamKnockback,
                knockAngle: Math.atan2(z.y - player.y, z.x - player.x),
                stun: skill.juggernautStunDuration,
                bossStun: skill.juggernautBossStunDuration
              });
            }
          }
        }
      }
    }
  }

  if (ww.timer <= 0) {
    ws.whirlwind = null;
  }
}

/**
 * Updates active Shadow Dash state.
 * @param {number} dt
 * @param {object} player
 * @param {object} room
 */
function updateWarriorDash(dt, player, room) {
  const ws = player.warriorState;
  if (!ws.dash) return;

  const dash = ws.dash;
  dash.timer -= dt;

  const moveDist = dash.speed * dt;
  const barricades = Array.isArray(room.barricades) ? room.barricades : [];
  stepClamped(player, dash.angle, moveDist, room.map || null, barricades);

  // Check hits along dash
  if (Array.isArray(room.zombies)) {
    for (let i = 0; i < room.zombies.length; i++) {
      const z = room.zombies[i];
      if (!z || z.isDead || dash.hitIds.has(z.id)) continue;
      const dist = Math.hypot(z.x - player.x, z.y - player.y);
      if (dist <= player.radius + z.radius + 12) {
        dash.hitIds.add(z.id);
        damageAndCreditZombie(player, z, dash.damage, 'MELEE', room, {
          knockback: 120,
          knockAngle: dash.angle
        });
      }
    }
  }

  if (dash.timer <= 0) {
    if (!dash.destMarkDropped) {
      dash.destMarkDropped = true;
      room.groundZones = room.groundZones || [];
      const skill = WARRIOR_SKILLS.SHADOW_DASH_SLASH;
      room.groundZones.push({
        id: 'gz_sm_' + Math.random().toString(36).substring(2, 8),
        type: 'slash_mark',
        ownerId: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        radius: skill.markRadius,
        pullRadius: skill.markPullRadius,
        damage: skill.markDamage,
        timer: skill.markFuseTime
      });
    }
    ws.dash = null;
  }
}

/**
 * Updates Counter Shield expiry and Avatar of War expiry (Final Fire Nova).
 * @param {number} dt
 * @param {object} player
 * @param {object} room
 */
function updateCounterAndAvatar(dt, player, room) {
  const ws = player.warriorState;

  // Counter shield
  if (ws.pendingParry) {
    triggerWarriorCounterParry(player, room);
  } else if (ws.counterShieldActive && ws.counterShieldTimer <= 0) {
    ws.counterShieldActive = false;
    ws.skills.COUNTER_SHIELD_BASH.cooldown = WARRIOR_SKILLS.COUNTER_SHIELD_BASH.missCooldown;
  }

  // Avatar of War expiry
  if (ws.avatarActive && ws.avatarTimer <= 0) {
    ws.avatarActive = false;
    if (!player.isDead && !player.isDowned) {
      const skill = WARRIOR_SKILLS.AVATAR_OF_WAR;
      if (Array.isArray(room.zombies)) {
        for (let i = 0; i < room.zombies.length; i++) {
          const z = room.zombies[i];
          if (!z || z.isDead) continue;
          const dist = Math.hypot(z.x - player.x, z.y - player.y);
          if (dist <= skill.endExplosionRadius + z.radius) {
            damageAndCreditZombie(player, z, skill.endExplosionDamage, 'FIRE', room, {
              knockback: skill.endExplosionKnockback,
              knockAngle: Math.atan2(z.y - player.y, z.x - player.x),
              awardKillCharge: false
            });
          }
        }
      }

      if (Array.isArray(room.eventsBuffer)) {
        room.eventsBuffer.push({
          type: 'WARRIOR_AVATAR_END',
          playerId: player.id,
          x: Math.round(player.x),
          y: Math.round(player.y),
          radius: skill.endExplosionRadius,
          damage: skill.endExplosionDamage
        });
      }
    }
  }
}

/**
 * Updates hasWarCryBuff for all alive teammates within aura radius of active War Cry Warriors.
 * @param {object} room
 */
function updateWarCryTeamBuff(room) {
  if (!room) return;
  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);

  const activeAuraWarriors = [];
  for (let i = 0; i < playersList.length; i++) {
    const p = playersList[i];
    if (p && p.character === 'WARRIOR' && p.warriorState && !p.isDead && !p.isDowned) {
      if (p.warriorState.warCryAuraTimer > 0) {
        activeAuraWarriors.push(p);
      }
    }
  }

  const auraRadius = WARRIOR_SKILLS.WAR_CRY.auraRadius;

  for (let i = 0; i < playersList.length; i++) {
    const p = playersList[i];
    if (!p || p.isDead || p.isDowned) {
      if (p) p.hasWarCryBuff = false;
      continue;
    }

    let inAura = false;
    for (let w = 0; w < activeAuraWarriors.length; w++) {
      const warrior = activeAuraWarriors[w];
      if (Math.hypot(p.x - warrior.x, p.y - warrior.y) <= auraRadius) {
        inAura = true;
        break;
      }
    }
    p.hasWarCryBuff = inAura;
  }
}

/**
 * Authoritative 50Hz server update for all Warrior combat systems in room:
 * ground zones, pending slams, whirlwinds, dashes, counter shields, avatar expiry, and War Cry aura.
 * @param {number} dt
 * @param {object} room
 */
function updateWarriorRoomSystems(dt, room) {
  if (!room) return;

  updateGroundZones(dt, room);
  updatePendingSlams(dt, room);

  const playersList = room.players instanceof Map
    ? Array.from(room.players.values())
    : (room.players || []);

  for (let i = 0; i < playersList.length; i++) {
    const p = playersList[i];
    if (!p || p.character !== 'WARRIOR' || !p.warriorState) continue;
    if (p.isDead || p.isDowned) continue;

    updateWarriorWhirlwind(dt, p, room);
    updateWarriorDash(dt, p, room);
    updateCounterAndAvatar(dt, p, room);
  }

  updateWarCryTeamBuff(room);
}

module.exports = {
  executeWarriorBasicAttack,
  triggerWarriorSkill,
  activateAvatarOfWar,
  triggerWarriorCounterParry,
  updateWarriorRoomSystems,
  applyWarriorAmmoPickup,
  isFrontalShieldBlocking,
  damageAndCreditZombie,
  stepClamped
};
