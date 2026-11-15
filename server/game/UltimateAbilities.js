const { TacticalDrone } = require('./TacticalDrone.js');
const { getUltimateConfigForClass } = require('./UltimateConfig.js');
const { activateAvatarOfWar } = require('./WarriorAbilities.js');

function isPositionBlocked(x, y, radius, map, barricades) {
  if (map && map.isWall(x, y, radius)) {
    return true;
  }
  for (let i = 0; i < barricades.length; i++) {
    const b = barricades[i];
    if (!b || b.isDead) continue;
    if (b.type === 'barrel') {
      if (Math.hypot(x - b.x, y - b.y) < radius + b.radius) return true;
    } else {
      const closestX = Math.max(b.x - b.half, Math.min(x, b.x + b.half));
      const closestY = Math.max(b.y - b.half, Math.min(y, b.y + b.half));
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

function polishResolution(x, y, radius, map, barricades) {
  let rx = x;
  let ry = y;
  if (map) {
    const resolved = map.resolveCircleCollision(rx, ry, radius);
    rx = resolved.x;
    ry = resolved.y;
  }
  for (let i = 0; i < barricades.length; i++) {
    const b = barricades[i];
    if (!b || b.isDead) continue;
    const bCol = b.resolveCircleCollision(rx, ry, radius);
    rx = bCol.x;
    ry = bCol.y;
  }
  return { x: rx, y: ry };
}

function resolveBlinkDestination(startX, startY, angle, distance, radius, map, barricades = []) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const clampPoint = (px, py) => (map ? map.clampToBounds(px, py, radius) : { x: px, y: py });
  const target = clampPoint(startX + cos * distance, startY + sin * distance);

  if (!isPositionBlocked(target.x, target.y, radius, map, barricades)) {
    return polishResolution(target.x, target.y, radius, map, barricades);
  }

  // Try extending slightly forward (up to +48px) to clear thick pillars cleanly
  for (let extra = 8; extra <= 48; extra += 8) {
    const fwd = clampPoint(startX + cos * (distance + extra), startY + sin * (distance + extra));
    if (!isPositionBlocked(fwd.x, fwd.y, radius, map, barricades)) {
      return polishResolution(fwd.x, fwd.y, radius, map, barricades);
    }
  }

  // Otherwise step backward along the blink ray until clear
  for (let d = distance - 8; d >= 0; d -= 8) {
    const back = clampPoint(startX + cos * d, startY + sin * d);
    if (!isPositionBlocked(back.x, back.y, radius, map, barricades)) {
      return polishResolution(back.x, back.y, radius, map, barricades);
    }
  }

  return polishResolution(startX, startY, radius, map, barricades);
}

function applyFrostNovaAt(cx, cy, conf, player, room) {
  for (let i = 0; i < room.zombies.length; i++) {
    const z = room.zombies[i];
    if (!z || z.isDead) continue;
    const dist = Math.hypot(z.x - cx, z.y - cy);
    if (dist <= conf.novaRadius + z.radius) {
      z.takeDamage(conf.damage, 'MAGIC');
      if (z.isDead) {
        player.recordKill(z.score, { awardUltCharge: false });
        room.eventsBuffer.push({ type: 'ZOMBIE_DIE', x: z.x, y: z.y, zType: z.type, angle: z.angle });
      } else if (z.type === 'TANK' || z.type === 'DEVIL') {
        z.applyFreeze(conf.bossFreezeDuration, conf.bossSlowDuration, conf.bossSlowFactor);
      } else {
        z.applyFreeze(conf.freezeDuration);
      }
    }
  }
}

function executeSeismicSlam(player, conf, room) {
  // Stun, knockback, and damage zombies in 360-degree radius (never damage barricades/barrels)
  for (let i = 0; i < room.zombies.length; i++) {
    const z = room.zombies[i];
    if (!z || z.isDead) continue;
    const dist = Math.hypot(z.x - player.x, z.y - player.y);
    if (dist <= conf.radius + z.radius) {
      z.takeDamage(conf.damage, 'EXPLOSION');
      const knockAngle = dist > 0.001 ? Math.atan2(z.y - player.y, z.x - player.x) : player.angle;
      z.applyKnockback(knockAngle, conf.knockback);
      if (z.isDead) {
        player.recordKill(z.score, { awardUltCharge: false });
        room.eventsBuffer.push({ type: 'ZOMBIE_DIE', x: z.x, y: z.y, zType: z.type, angle: z.angle });
      } else {
        const stunDur = (z.type === 'TANK' || z.type === 'DEVIL') ? conf.bossStunDuration : conf.stunDuration;
        z.applyStun(stunDur);
      }
    }
  }

  // Destroy nearby Devil fireballs in slam radius
  for (let i = room.bullets.length - 1; i >= 0; i--) {
    const b = room.bullets[i];
    if (!b || !b.isFireball) continue;
    if (Math.hypot(b.x - player.x, b.y - player.y) <= conf.radius) {
      b.isDead = true;
      room.bullets.splice(i, 1);
    }
  }

  return {
    type: 'ULTIMATE',
    ultId: conf.id,
    playerId: player.id,
    character: player.character,
    x: Math.round(player.x),
    y: Math.round(player.y),
    radius: conf.radius
  };
}

function executeBlinkFrostNova(player, angle, conf, room) {
  const fromX = player.x;
  const fromY = player.y;
  const blinkAngle = (typeof angle === 'number' && Number.isFinite(angle)) ? angle : player.angle;
  const dest = resolveBlinkDestination(
    fromX,
    fromY,
    blinkAngle,
    conf.blinkDistance,
    player.radius,
    room.map,
    room.barricades
  );

  // Trigger Frost Nova at BOTH origin and destination
  applyFrostNovaAt(fromX, fromY, conf, player, room);
  player.x = dest.x;
  player.y = dest.y;
  player.angle = blinkAngle;
  applyFrostNovaAt(dest.x, dest.y, conf, player, room);

  return {
    type: 'ULTIMATE',
    ultId: conf.id,
    playerId: player.id,
    character: player.character,
    fromX: Math.round(fromX),
    fromY: Math.round(fromY),
    toX: Math.round(dest.x),
    toY: Math.round(dest.y),
    radius: conf.novaRadius
  };
}

function executeTacticalDrone(player, conf, room) {
  const droneId = 'dr_' + Math.random().toString(36).substring(2, 8);
  const drone = new TacticalDrone(droneId, player.id, player.x, player.y, conf);
  room.drones.push(drone);

  return {
    type: 'ULTIMATE',
    ultId: conf.id,
    playerId: player.id,
    character: player.character,
    droneId,
    x: Math.round(player.x),
    y: Math.round(player.y),
    auraRadius: conf.auraRadius
  };
}

function triggerPlayerUltimate(player, angle, room) {
  if (!player || player.isDead || player.isDowned) return { activated: false };
  if (room.state !== 'PLAYING' && room.state !== 'INTERMISSION') return { activated: false };
  if (player.ultCharge < player.ultMaxCharge) return { activated: false };

  const conf = getUltimateConfigForClass(player.character);
  player.ultCharge = 0;

  let event = null;
  if (conf.id === 'AVATAR_OF_WAR') {
    event = activateAvatarOfWar(player, room);
  } else if (conf.id === 'SEISMIC_SLAM') {
    event = executeSeismicSlam(player, conf, room);
  } else if (conf.id === 'BLINK_FROST_NOVA') {
    event = executeBlinkFrostNova(player, angle, conf, room);
  } else {
    event = executeTacticalDrone(player, conf, room);
  }

  if (event) {
    room.eventsBuffer.push(event);
  }
  return { activated: true, event };
}

module.exports = {
  resolveBlinkDestination,
  triggerPlayerUltimate
};

