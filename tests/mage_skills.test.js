/**
 * @file mage_skills.test.js
 * @description Unit and integration tests for Mage Mana system, 8-skill kit, ground zones, and socket sync.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAGE_MANA_CONFIG,
  MAGE_AMMO_PICKUP,
  MAGE_SKILLS,
  MAGE_SKILL_KEYS,
  getMageSkillBySlot,
  getMageSkillById,
  getUnlockedMageSkills
} = require('../server/game/MageSkillsConfig.js');

test('MageSkillsConfig defines exact 8-skill progression, mana costs, cooldowns, and AMMO drop constants', () => {
  // Arrange & Act
  const expectedOrder = [
    ['ARCANE_BOLT', 1, 1, 5, 0],
    ['FROST_NOVA', 2, 5, 20, 5.0],
    ['CHAIN_LIGHTNING', 3, 10, 30, 4.5],
    ['FIREBALL', 4, 15, 35, 6.0],
    ['ARCANE_TELEPORT', 5, 20, 25, 7.0],
    ['SANCTUARY_HEAL', 6, 30, 35, 12.0],
    ['MANA_SHIELD', 7, 40, 15, 10.0],
    ['METEOR_STORM', 8, 50, 100, 50.0]
  ];

  // Assert
  assert.strictEqual(MAGE_MANA_CONFIG.MAX_MANA, 100);
  assert.strictEqual(MAGE_MANA_CONFIG.REGEN_PER_SEC, 5);
  assert.strictEqual(MAGE_AMMO_PICKUP.AMMO_DROP_CHANCE, 0.18);
  assert.strictEqual(MAGE_AMMO_PICKUP.MANA_RESTORE, 30);
  assert.strictEqual(MAGE_AMMO_PICKUP.COOLDOWN_REDUCTION_SEC, 1.5);
  assert.strictEqual(MAGE_SKILL_KEYS.length, 8);

  for (const [id, slot, unlockCombo, manaCost, cooldown] of expectedOrder) {
    const skill = getMageSkillById(id);
    assert.ok(skill, `Expected skill ${id}`);
    assert.strictEqual(getMageSkillBySlot(slot), skill);
    assert.strictEqual(skill.slot, slot);
    assert.strictEqual(skill.unlockCombo, unlockCombo);
    assert.strictEqual(skill.manaCost, manaCost);
    assert.strictEqual(skill.cooldown, cooldown);
  }

  // Invalid lookups & unlock filtering
  assert.strictEqual(getMageSkillBySlot(0), null);
  assert.strictEqual(getMageSkillBySlot(9), null);
  assert.strictEqual(getMageSkillBySlot(1.5), null);
  assert.strictEqual(getMageSkillById('UNKNOWN'), null);
  assert.deepStrictEqual(getUnlockedMageSkills(10).map(s => s.id), [
    'ARCANE_BOLT',
    'FROST_NOVA',
    'CHAIN_LIGHTNING'
  ]);
  assert.deepStrictEqual(getUnlockedMageSkills(NaN), []);
});

const { Zombie } = require('../server/game/Zombie.js');
const { Bullet } = require('../server/game/Bullet.js');
const { GameMap } = require('../server/game/Map.js');
const { getUltimateConfigForClass } = require('../server/game/UltimateConfig.js');

test('Zombie.applySlow reduces speed without diluting stronger slows and ignores invalid inputs', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS');
  const z = new Zombie('z1', 'NORMAL', 400, 400);
  const target = { x: 800, y: 400, radius: 16, isDead: false };

  // Act: apply 40% slow (0.6x) then weaker 10% slow (0.9x)
  z.applySlow(1.0, 0.6);
  z.applySlow(0.5, 0.9);
  z.applySlow(-1, 0.5);
  z.applySlow(1.0, 0);

  // Assert
  assert.strictEqual(z.slowFactor, 0.6);
  assert.strictEqual(z.slowTimer, 1.0);
  assert.strictEqual(z.serialize().isChilled, true);

  z.update(0.5, [target], [], map, []);
  const moved = z.x - 400;
  // Normal speed 110 * 0.6 * 0.5s = 33px
  assert.ok(Math.abs(moved - 33) < 0.5, `Expected ~33px movement, got ${moved}`);
});

test('Bullet supports arcane_bolt and mage_fireball properties cleanly', () => {
  // Arrange & Act
  const bolt = new Bullet('b1', 'm1', 100, 100, 0, {
    type: 'arcane_bolt',
    speed: 900,
    damage: 35,
    range: 400,
    radius: 7,
    damageType: 'MAGIC'
  });
  const fb = new Bullet('b2', 'm1', 100, 100, 0, {
    type: 'mage_fireball',
    isMageFireball: true,
    speed: 550,
    range: 500,
    radius: 14,
    explosionRadius: 140,
    explosionDamage: 130,
    damageType: 'FIRE'
  });

  // Assert
  assert.strictEqual(bolt.radius, 7);
  assert.strictEqual(bolt.damageType, 'MAGIC');
  assert.strictEqual(bolt.isExplosive, false);
  assert.strictEqual(fb.radius, 14);
  assert.strictEqual(fb.isMageFireball, true);
  assert.strictEqual(fb.isExplosive, true);
  assert.strictEqual(fb.damageType, 'FIRE');
  assert.strictEqual(fb.serialize().type, 'mage_fireball');
});

test('UltimateConfig maps MAGE to METEOR_STORM', () => {
  const mageUlt = getUltimateConfigForClass('MAGE');
  assert.strictEqual(mageUlt.id, 'METEOR_STORM');
});

const { Player } = require('../server/game/Player.js');

test('Player initializes Mage Mana state, regenerates +5/s, and respects Sanctuary cooldown multiplier', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS');
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);

  // Assert initial state
  assert.strictEqual(mage.maxHp, 85);
  assert.strictEqual(mage.speed, 188);
  assert.strictEqual(mage.maxMana, 100);
  assert.strictEqual(mage.mana, 100);
  assert.strictEqual(mage.selectedWeapon, 'ARCANE_BOLT');
  assert.ok(mage.mageState);
  assert.strictEqual(mage.mageState.skills.ARCANE_BOLT.unlocked, true);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.unlocked, false);
  assert.strictEqual(mage.mageState.skills.METEOR_STORM.unlocked, false);

  // Act: spend mana and put skill on CD
  assert.strictEqual(mage.consumeMana(40), true);
  assert.strictEqual(mage.mana, 60);
  assert.strictEqual(mage.consumeMana(70), false);
  assert.strictEqual(mage.mana, 60);

  mage.mageState.skills.FROST_NOVA.cooldown = 5.0;
  mage.update(2.0, map, []);
  assert.strictEqual(mage.mana, 70); // 60 + 5 * 2
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 3.0);

  // Sanctuary buff speeds up cooldown recovery by 1.35x
  mage.hasSanctuaryBuff = true;
  mage.update(1.0, map, []);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 1.65);
});

test('Mage recordKill skips gun unlocks & ultCharge, unlocks Mage skills by combo, and AMMO pickup restores +30 Mana & -1.5s CD', () => {
  // Arrange
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  mage.mana = 50;
  mage.mageState.skills.FROST_NOVA.cooldown = 4.0;
  mage.mageState.skills.CHAIN_LIGHTNING.cooldown = 1.0;

  // Act: 4 kills -> combo reaches 5 -> unlocks FROST_NOVA
  let unlocked = [];
  for (let i = 0; i < 4; i++) {
    unlocked = mage.recordKill(10);
  }

  // Assert
  assert.strictEqual(mage.combo, 5);
  assert.strictEqual(mage.ultCharge, 0, 'Mage must not accumulate ultCharge');
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.unlocked, true);
  assert.ok(unlocked.some(u => u.id === 'FROST_NOVA'));

  // Act: AMMO pickup
  mage.applyMageAmmoPickup();
  assert.strictEqual(mage.mana, 80);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 2.5);
  assert.strictEqual(mage.mageState.skills.CHAIN_LIGHTNING.cooldown, 0);
});

test('Mage Mana Shield absorbs 1:1 into Mana, overflows remainder to HP, and breaks early at 0 Mana', () => {
  // Arrange
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  mage.mana = 50;
  mage.mageState.manaShieldActive = true;
  mage.mageState.manaShieldTimer = 5.0;

  // Act 1: 30 damage fully absorbed
  const res1 = mage.takeDamage(30, 'MELEE');
  assert.strictEqual(res1.absorbedMana, 30);
  assert.strictEqual(res1.damage, 0);
  assert.strictEqual(res1.shieldBroken, false);
  assert.strictEqual(mage.mana, 20);
  assert.strictEqual(mage.hp, 85);
  assert.strictEqual(mage.mageState.manaShieldActive, true);

  // Act 2: 35 damage (> 20 remaining mana) -> absorbs 20, overflows 15 to HP, breaks shield
  const res2 = mage.takeDamage(35, 'MELEE');
  assert.strictEqual(res2.absorbedMana, 20);
  assert.strictEqual(res2.damage, 15);
  assert.strictEqual(res2.shieldBroken, true);
  assert.strictEqual(mage.mana, 0);
  assert.strictEqual(mage.hp, 70);
  assert.strictEqual(mage.mageState.manaShieldActive, false);
  assert.strictEqual(mage.mageState.manaShieldTimer, 0);

  // Serialization includes mana & mageState
  const snap = mage.serialize();
  assert.strictEqual(snap.mana, 0);
  assert.strictEqual(snap.maxMana, 100);
  assert.ok(snap.mageState);
  assert.strictEqual(snap.mageState.manaShieldActive, false);

  // Revive restores 50% Mana
  mage.isDowned = true;
  mage.hp = 0;
  mage.mana = 0;
  mage.revive();
  assert.strictEqual(mage.isDowned, false);
  assert.strictEqual(mage.hp, 40);
  assert.strictEqual(mage.mana, 50);
});

test('Non-Mage characters preserve legacy gun, weapon switch, and ult charge behavior', () => {
  const human = new Player('h1', 'Hero', 'HUMAN', 300, 300);
  assert.strictEqual(human.mana, 0);
  assert.strictEqual(human.maxMana, 0);
  assert.strictEqual(human.mageState, null);
  assert.strictEqual(human.selectedWeapon, 'PISTOL');
  assert.strictEqual(human.consumeMana(10), false);
  assert.strictEqual(human.restoreMana(10), 0);

  // Weapon switch works for Human
  human.weapons.SHOTGUN.unlocked = true;
  human.applyInput({ weaponId: 'SHOTGUN' });
  assert.strictEqual(human.selectedWeapon, 'SHOTGUN');

  // Kill unlocks guns and adds ult charge
  human.recordKill(10);
  assert.ok(human.ultCharge > 0);

  // Serialization for Human
  const snap = human.serialize();
  assert.strictEqual(snap.mana, 0);
  assert.strictEqual(snap.maxMana, 0);
  assert.strictEqual(snap.hasSanctuaryBuff, false);
  assert.strictEqual(snap.mageState, null);
});


const { Barricade, Barrel } = require('../server/game/Barricade.js');
const {
  maybeDropPickup,
  executeMageArcaneBolt,
  triggerMageSkill,
  explodeMageFireball,
  updateMageRoomSystems
} = require('../server/game/MageAbilities.js');

function createMockRoom() {
  return {
    map: new GameMap('THE_ROOMS'),
    players: new Map(),
    zombies: [],
    bullets: [],
    barricades: [],
    pickups: [],
    drones: [],
    groundZones: [],
    pendingMeteors: [],
    state: 'PLAYING',
    eventsBuffer: []
  };
}

test('Mage [1] ARCANE_BOLT and [2] FROST_NOVA execute with exact mana, range, damage, and freeze durations', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 500, 500);
  mage.angle = 0;
  mage.mageState.skills.FROST_NOVA.unlocked = true;
  room.players.set('m1', mage);

  // Act [1]: Arcane Bolt
  const fired = executeMageArcaneBolt(mage, room);
  assert.strictEqual(fired, true);
  assert.strictEqual(mage.mana, 95);
  assert.strictEqual(room.bullets.length, 1);
  assert.strictEqual(room.bullets[0].type, 'arcane_bolt');
  assert.strictEqual(room.bullets[0].speed, 900);
  assert.strictEqual(room.bullets[0].range, 400);
  assert.strictEqual(room.bullets[0].damage, 35);

  // Act [2]: Frost Nova
  const zNormal = new Zombie('zn', 'NORMAL', 590, 500);
  const zTank = new Zombie('zt', 'TANK', 580, 500);
  const zFar = new Zombie('zf', 'NORMAL', 700, 500);
  room.zombies.push(zNormal, zTank, zFar);

  const res = triggerMageSkill(mage, 2, 0, room);
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 75);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 5.0);
  assert.strictEqual(zNormal.hp, 35);
  assert.strictEqual(zNormal.freezeTimer, 2.0);
  assert.strictEqual(zTank.hp, 355);
  assert.strictEqual(zTank.freezeTimer, 1.0);
  assert.strictEqual(zFar.hp, 80);
});

test('Mage [3] CHAIN_LIGHTNING chains up to 4 bounces with -15% damage decay and 0.5s stun, aborting cleanly if no target', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 500);
  mage.mageState.skills.CHAIN_LIGHTNING.unlocked = true;
  room.players.set('m1', mage);

  // Unhappy path: no zombies -> no mana spent, no cooldown
  const emptyRes = triggerMageSkill(mage, 3, 0, room, { x: 450, y: 500 });
  assert.strictEqual(emptyRes.activated, false);
  assert.strictEqual(emptyRes.reason, 'NO_TARGET');
  assert.strictEqual(mage.mana, 100);
  assert.strictEqual(mage.mageState.skills.CHAIN_LIGHTNING.cooldown, 0);

  // Happy path: 6 zombies along chain (1 primary + 4 bounces = 5 hit, 6th untouched)
  const zombies = [];
  for (let i = 0; i < 6; i++) {
    const z = new Zombie(`z${i}`, 'TANK', 450 + i * 100, 500); // TANK has 400 HP
    zombies.push(z);
    room.zombies.push(z);
  }

  const res = triggerMageSkill(mage, 3, 0, room, { x: 450, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 70);
  assert.strictEqual(mage.mageState.skills.CHAIN_LIGHTNING.cooldown, 4.5);

  const expectedDmgs = [70, 60, 51, 43, 37];
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(zombies[i].hp, 400 - expectedDmgs[i], `Bounce ${i} dmg mismatch`);
    assert.strictEqual(zombies[i].stunTimer, 0.5);
  }
  assert.strictEqual(zombies[5].hp, 400, 'Max 4 bounces -> 6th zombie must not be hit');
});

test('Mage [4] FIREBALL spawns explosive fireball that spares Barricades/allies and leaves 3s burn_pool', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 400, 500);
  const ally = new Player('h1', 'Ally', 'HUMAN', 620, 500);
  const barricade = new Barricade('bar1', 610, 500, 'h1');
  const zTank = new Zombie('zt', 'TANK', 630, 500);
  const zMummy = new Zombie('zm', 'MUMMY', 640, 500);
  mage.mageState.skills.FIREBALL.unlocked = true;
  room.players.set('m1', mage);
  room.players.set('h1', ally);
  room.barricades.push(barricade);
  room.zombies.push(zTank, zMummy);

  // Act: cast Fireball and detonate at (620, 500)
  const castRes = triggerMageSkill(mage, 4, 0, room);
  assert.strictEqual(castRes.activated, true);
  assert.strictEqual(mage.mana, 65);
  assert.strictEqual(mage.mageState.skills.FIREBALL.cooldown, 6.0);
  const fb = room.bullets.find(b => b.type === 'mage_fireball');
  assert.ok(fb);
  assert.strictEqual(fb.speed, 550);
  assert.strictEqual(fb.range, 500);

  explodeMageFireball(620, 500, 140, 130, 'm1', room);

  // Assert impact safety & burn pool creation
  assert.strictEqual(ally.hp, ally.maxHp, 'Fireball must not harm teammates');
  assert.strictEqual(barricade.hp, 300, 'Fireball must spare friendly Barricade');
  assert.strictEqual(zTank.hp, 270); // 400 - 130
  assert.strictEqual(zMummy.isDead, true); // 130 * 1.5 FIRE = 195 > 140 HP
  assert.strictEqual(room.groundZones.length, 1);
  assert.strictEqual(room.groundZones[0].type, 'burn_pool');

  // Tick burn_pool for 3.0s (6 ticks * 7.5 = 45 FIRE dmg)
  for (let i = 0; i < 60; i++) {
    updateMageRoomSystems(0.05, room);
  }
  assert.strictEqual(zTank.hp, 225); // 270 - 45
  assert.strictEqual(room.groundZones.length, 0);
});

test('Mage [5] ARCANE_TELEPORT blinks safely to cursor (<=250px) and blasts origin without hitting Barricades', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 500);
  mage.mageState.skills.ARCANE_TELEPORT.unlocked = true;
  const zOrigin = new Zombie('zo', 'NORMAL', 360, 500);
  const bar = new Barricade('bar1', 340, 500, 'm1');
  room.players.set('m1', mage);
  room.zombies.push(zOrigin);
  room.barricades.push(bar);

  // Act: request target 400px east -> clamped to 250px
  const res = triggerMageSkill(mage, 5, 0, room, { x: 700, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 75);
  assert.strictEqual(mage.mageState.skills.ARCANE_TELEPORT.cooldown, 7.0);
  assert.strictEqual(mage.x, 550);
  assert.strictEqual(zOrigin.hp, 30); // 80 - 50
  assert.ok(zOrigin.knockbackX > 0);
  assert.strictEqual(bar.hp, 300);
});

test('Mage [6] SANCTUARY_HEAL heals allies 25 HP/s, buffs CD speed, and slows zombies 40%', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 400, 500);
  const ally = new Player('h1', 'Soldier', 'HUMAN', 600, 500);
  ally.hp = 50;
  const downedAlly = new Player('h2', 'Down', 'HUMAN', 600, 510);
  downedAlly.isDowned = true;
  downedAlly.hp = 0;
  const zIn = new Zombie('zi', 'NORMAL', 620, 500);

  mage.mageState.skills.SANCTUARY_HEAL.unlocked = true;
  room.players.set('m1', mage);
  room.players.set('h1', ally);
  room.players.set('h2', downedAlly);
  room.zombies.push(zIn);

  // Act: cast Sanctuary at (600, 500)
  const res = triggerMageSkill(mage, 6, 0, room, { x: 600, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 65);
  assert.strictEqual(room.groundZones.length, 1);
  assert.strictEqual(room.groundZones[0].type, 'sanctuary');

  // Tick 1.0s (20 steps of 0.05s)
  for (let i = 0; i < 20; i++) {
    updateMageRoomSystems(0.05, room);
  }

  assert.strictEqual(ally.hp, 75); // +25 HP in 1.0s
  assert.strictEqual(ally.hasSanctuaryBuff, true);
  assert.strictEqual(downedAlly.hp, 0, 'Downed ally must not be healed');
  assert.strictEqual(zIn.slowFactor, 0.6, 'Zombie inside sanctuary slowed by 40%');
});

test('Mage [8] METEOR_STORM drops 5 meteors over 3.0s and maintains 240px lava_pool', () => {
  // Arrange
  const room = createMockRoom();
  const mage = new Player('m1', 'Merlin', 'MAGE', 400, 500);
  mage.mageState.skills.METEOR_STORM.unlocked = true;
  const zBoss = new Zombie('zb', 'TANK', 700, 500); // at cursor
  zBoss.hp = 2000;
  room.players.set('m1', mage);
  room.zombies.push(zBoss);

  // Act: cast at (700, 500)
  const res = triggerMageSkill(mage, 8, 0, room, { x: 700, y: 500 });
  assert.strictEqual(res.activated, true);
  assert.strictEqual(mage.mana, 0);
  assert.strictEqual(mage.mageState.skills.METEOR_STORM.cooldown, 50.0);
  assert.strictEqual(room.pendingMeteors.length, 1);

  // Advance 1 tick -> meteor #1 impacts immediately near (700, 500) and spawns lava_pool
  updateMageRoomSystems(0.05, room);
  assert.ok(zBoss.hp <= 1850, 'First meteor must deal 150 FIRE damage');
  assert.ok(room.groundZones.some(gz => gz.type === 'lava_pool' && gz.radius === 240));

  // Advance full 3.05s -> all 5 meteors complete
  for (let i = 0; i < 61; i++) {
    updateMageRoomSystems(0.05, room);
  }
  assert.strictEqual(room.pendingMeteors.length, 0);
});

test('maybeDropPickup respects 18% AMMO and 7% MEDKIT distribution', () => {
  const room = createMockRoom();
  const z = new Zombie('z1', 'NORMAL', 200, 200);
  const origRandom = Math.random;
  try {
    Math.random = () => 0.10; // < 0.18 -> AMMO
    maybeDropPickup(room, z);
    Math.random = () => 0.20; // [0.18, 0.25) -> MEDKIT
    maybeDropPickup(room, z);
    Math.random = () => 0.30; // >= 0.25 -> none
    maybeDropPickup(room, z);
  } finally {
    Math.random = origRandom;
  }

  assert.strictEqual(room.pickups.length, 2);
  assert.strictEqual(room.pickups[0].type, 'AMMO');
  assert.strictEqual(room.pickups[1].type, 'MEDKIT');
});
