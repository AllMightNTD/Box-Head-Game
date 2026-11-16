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

function triggerPlayerUltimate(player, angle, room, targetPos = null) {
  if (!player || player.isDead || player.isDowned) return { activated: false };
  if (!room || (room.state !== 'PLAYING' && room.state !== 'INTERMISSION')) return { activated: false };

  if (player.character === 'MAGE') {
    const { triggerMageSkill } = require('./MageAbilities.js');
    return triggerMageSkill(player, 8, angle, room, targetPos);
  }
  if (player.ultCharge < player.ultMaxCharge) return { activated: false };

  const conf = getUltimateConfigForClass(player.character);

  if (conf.id === 'AVATAR_OF_WAR') {
    const event = activateAvatarOfWar(player, room);
    if (!event) {
      return { activated: false, reason: 'WARRIOR_ULT_UNAVAILABLE' };
    }
    if (room && Array.isArray(room.eventsBuffer)) {
      room.eventsBuffer.push(event);
    }
    return { activated: true, event };
  }

  player.ultCharge = 0;

  const event = executeTacticalDrone(player, conf, room);

  if (event && room && Array.isArray(room.eventsBuffer)) {
    room.eventsBuffer.push(event);
  }
  return { activated: true, event };
}

module.exports = {
  resolveBlinkDestination,
  triggerPlayerUltimate
};
