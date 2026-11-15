const test = require('node:test');
const assert = require('node:assert');
const {
  WARRIOR_SKILLS,
  WARRIOR_SKILL_KEYS,
  WARRIOR_ARMOR_CONFIG,
  WARRIOR_AMMO_REDUCTION,
  getWarriorSkillBySlot,
  getWarriorSkillById,
  getUnlockedWarriorSkills
} = require('../server/game/WarriorSkillsConfig.js');
const { getUltimateConfigForClass } = require('../server/game/UltimateConfig.js');
const { Player } = require('../server/game/Player.js');
const { GameMap } = require('../server/game/Map.js');
const { Zombie } = require('../server/game/Zombie.js');

test('WarriorSkillsConfig defines 8 skills with exact combo unlock milestones and spec constants', () => {
  assert.strictEqual(WARRIOR_SKILL_KEYS.length, 8);
  assert.strictEqual(WARRIOR_ARMOR_CONFIG.MAX_ARMOR, 75);
  assert.strictEqual(WARRIOR_ARMOR_CONFIG.WAVE_CLEAR_RESTORE_RATIO, 0.5);
  assert.strictEqual(WARRIOR_ARMOR_CONFIG.REVIVE_RESTORE_RATIO, 0.5);
  assert.strictEqual(WARRIOR_AMMO_REDUCTION.COOLDOWN_RATIO, 0.3);
  assert.strictEqual(WARRIOR_AMMO_REDUCTION.MIN_SECONDS, 1.5);
  assert.strictEqual(WARRIOR_AMMO_REDUCTION.ULT_CHARGE_BONUS, 15);

  const expectedUnlocks = [1, 5, 10, 15, 20, 30, 40, 50];
  WARRIOR_SKILL_KEYS.forEach((key, idx) => {
    const skill = WARRIOR_SKILLS[key];
    assert.ok(skill, `Expected skill object for key ${key}`);
    assert.strictEqual(skill.slot, idx + 1);
    assert.strictEqual(skill.unlockCombo, expectedUnlocks[idx]);
  });

  assert.strictEqual(getWarriorSkillBySlot(1).id, 'BERSERKER_STANCE');
  assert.strictEqual(getWarriorSkillBySlot(7).missCooldown, 4.0);
  assert.strictEqual(getWarriorSkillById('SEISMIC_SLAM').fissureDuration, 4.0);
  assert.strictEqual(getUnlockedWarriorSkills(15).length, 4);
  assert.strictEqual(getUltimateConfigForClass('WARRIOR').id, 'AVATAR_OF_WAR');
});

test('WarriorSkillsConfig contains exact spec values for all 8 warrior skills', () => {
  // [1] BERSERKER_STANCE
  const s1 = WARRIOR_SKILLS.BERSERKER_STANCE;
  assert.strictEqual(s1.id, 'BERSERKER_STANCE');
  assert.strictEqual(s1.slot, 1);
  assert.strictEqual(s1.unlockCombo, 1);
  assert.strictEqual(s1.damage, 42);
  assert.strictEqual(s1.fireDelay, 0.26);
  assert.strictEqual(s1.range, 80);
  assert.strictEqual(s1.arcRad, (90 * Math.PI) / 180);
  assert.strictEqual(s1.maxFuryStacks, 10);
  assert.strictEqual(s1.furyDuration, 4.0);
  assert.strictEqual(s1.atkSpeedPerStack, 0.03);
  assert.strictEqual(s1.moveSpeedPerStack, 0.02);

  // [2] JUGGERNAUT_STANCE
  const s2 = WARRIOR_SKILLS.JUGGERNAUT_STANCE;
  assert.strictEqual(s2.id, 'JUGGERNAUT_STANCE');
  assert.strictEqual(s2.slot, 2);
  assert.strictEqual(s2.unlockCombo, 5);
  assert.strictEqual(s2.damage, 58);
  assert.strictEqual(s2.fireDelay, 0.55);
  assert.strictEqual(s2.range, 125);
  assert.strictEqual(s2.arcRad, (130 * Math.PI) / 180);
  assert.strictEqual(s2.knockback, 260);
  assert.strictEqual(s2.frontalReduction, 0.2);
  assert.strictEqual(s2.frontalArcHalfRad, (70 * Math.PI) / 180);
  assert.strictEqual(s2.slowFactor, 0.7);
  assert.strictEqual(s2.slowDuration, 1.5);

  // [3] BLADE_WHIRLWIND
  const s3 = WARRIOR_SKILLS.BLADE_WHIRLWIND;
  assert.strictEqual(s3.id, 'BLADE_WHIRLWIND');
  assert.strictEqual(s3.slot, 3);
  assert.strictEqual(s3.unlockCombo, 10);
  assert.strictEqual(s3.cooldown, 4.5);
  assert.strictEqual(s3.duration, 1.5);
  assert.strictEqual(s3.tickInterval, 0.25);
  assert.strictEqual(s3.totalTicks, 6);
  assert.strictEqual(s3.radius, 105);
  assert.strictEqual(s3.damage, 45);
  assert.strictEqual(s3.moveSpeedMultiplier, 0.7);
  assert.strictEqual(s3.windBladeDamage, 65);
  assert.strictEqual(s3.windBladeSpeed, 560);
  assert.strictEqual(s3.windBladeRange, 260);
  assert.strictEqual(s3.juggernautSlamRadius, 135);
  assert.strictEqual(s3.juggernautSlamDamage, 90);
  assert.strictEqual(s3.juggernautSlamKnockback, 240);
  assert.strictEqual(s3.juggernautStunDuration, 1.2);
  assert.strictEqual(s3.juggernautBossStunDuration, 0.8);

  // [4] SHADOW_DASH_SLASH
  const s4 = WARRIOR_SKILLS.SHADOW_DASH_SLASH;
  assert.strictEqual(s4.id, 'SHADOW_DASH_SLASH');
  assert.strictEqual(s4.slot, 4);
  assert.strictEqual(s4.unlockCombo, 15);
  assert.strictEqual(s4.cooldown, 5.0);
  assert.strictEqual(s4.duration, 0.18);
  assert.strictEqual(s4.distance, 240);
  assert.strictEqual(s4.dashDamage, 55);
  assert.strictEqual(s4.markFuseTime, 0.5);
  assert.strictEqual(s4.markRadius, 115);
  assert.strictEqual(s4.markPullRadius, 160);
  assert.strictEqual(s4.markDamage, 75);

  // [5] SEISMIC_SLAM
  const s5 = WARRIOR_SKILLS.SEISMIC_SLAM;
  assert.strictEqual(s5.id, 'SEISMIC_SLAM');
  assert.strictEqual(s5.slot, 5);
  assert.strictEqual(s5.unlockCombo, 20);
  assert.strictEqual(s5.cooldown, 8.0);
  assert.strictEqual(s5.fireballClearRadius, 230);
  assert.strictEqual(s5.fissureRadius, 210);
  assert.strictEqual(s5.fissureDuration, 4.0);
  assert.strictEqual(s5.fissureSlowFactor, 0.4);
  assert.strictEqual(s5.fissureTickInterval, 0.5);
  assert.strictEqual(s5.fissureTickDamage, 8);
  assert.strictEqual(s5.rings.length, 3);
  assert.deepStrictEqual(s5.rings, [
    { delay: 0, minR: 0, maxR: 95, damage: 165, knockback: 200, stun: 0, bossStun: 0 },
    { delay: 0.12, minR: 95, maxR: 165, damage: 105, knockback: 300, stun: 2.0, bossStun: 1.2 },
    { delay: 0.24, minR: 165, maxR: 230, damage: 70, knockback: 380, stun: 2.5, bossStun: 1.5 }
  ]);

  // [6] WAR_CRY
  const s6 = WARRIOR_SKILLS.WAR_CRY;
  assert.strictEqual(s6.id, 'WAR_CRY');
  assert.strictEqual(s6.slot, 6);
  assert.strictEqual(s6.unlockCombo, 30);
  assert.strictEqual(s6.cooldown, 10.0);
  assert.strictEqual(s6.tauntRadius, 900);
  assert.strictEqual(s6.tauntDuration, 4.0);
  assert.strictEqual(s6.fearRadius, 180);
  assert.strictEqual(s6.fearDuration, 1.5);
  assert.strictEqual(s6.armorRestoreRatio, 0.2);
  assert.strictEqual(s6.auraRadius, 200);
  assert.strictEqual(s6.auraDuration, 5.0);
  assert.strictEqual(s6.allyDamageBonus, 0.15);

  // [7] COUNTER_SHIELD_BASH
  const s7 = WARRIOR_SKILLS.COUNTER_SHIELD_BASH;
  assert.strictEqual(s7.id, 'COUNTER_SHIELD_BASH');
  assert.strictEqual(s7.slot, 7);
  assert.strictEqual(s7.unlockCombo, 40);
  assert.strictEqual(s7.cooldown, 8.0);
  assert.strictEqual(s7.missCooldown, 4.0);
  assert.strictEqual(s7.duration, 1.5);
  assert.strictEqual(s7.frontalArcHalfRad, (70 * Math.PI) / 180);
  assert.strictEqual(s7.moveSpeedMultiplier, 0.75);
  assert.strictEqual(s7.stepDistance, 75);
  assert.strictEqual(s7.bashConeRad, (130 * Math.PI) / 180);
  assert.strictEqual(s7.bashRange, 130);
  assert.strictEqual(s7.bashDamage, 95);
  assert.strictEqual(s7.bashKnockback, 360);
  assert.strictEqual(s7.bashStunDuration, 2.2);
  assert.strictEqual(s7.bashBossStunDuration, 1.4);
  assert.strictEqual(s7.cleaveDamage, 120);
  assert.strictEqual(s7.cleaveRange, 125);
  assert.strictEqual(s7.cleaveConeRad, (130 * Math.PI) / 180);

  // [8] AVATAR_OF_WAR
  const s8 = WARRIOR_SKILLS.AVATAR_OF_WAR;
  assert.strictEqual(s8.id, 'AVATAR_OF_WAR');
  assert.strictEqual(s8.slot, 8);
  assert.strictEqual(s8.unlockCombo, 50);
  assert.strictEqual(s8.cooldown, 60.0);
  assert.strictEqual(s8.duration, 10.0);
  assert.strictEqual(s8.damageMultiplier, 1.5);
  assert.strictEqual(s8.attackSpeedMultiplier, 1.3);
  assert.strictEqual(s8.moveSpeedMultiplier, 1.3);
  assert.strictEqual(s8.fireSlashDamage, 55);
  assert.strictEqual(s8.fireSlashSpeed, 750);
  assert.strictEqual(s8.fireSlashRange, 340);
  assert.strictEqual(s8.endExplosionRadius, 210);
  assert.strictEqual(s8.endExplosionDamage, 180);
  assert.strictEqual(s8.endExplosionKnockback, 350);
});

test('Warrior helper functions handle valid values, boundary conditions, and invalid inputs gracefully', () => {
  // getWarriorSkillBySlot
  for (let slot = 1; slot <= 8; slot++) {
    const skill = getWarriorSkillBySlot(slot);
    assert.ok(skill, `Skill for slot ${slot} should exist`);
    assert.strictEqual(skill.slot, slot);
  }
  assert.strictEqual(getWarriorSkillBySlot(0), null);
  assert.strictEqual(getWarriorSkillBySlot(9), null);
  assert.strictEqual(getWarriorSkillBySlot(-1), null);
  assert.strictEqual(getWarriorSkillBySlot('1'), null);
  assert.strictEqual(getWarriorSkillBySlot(null), null);
  assert.strictEqual(getWarriorSkillBySlot(undefined), null);
  assert.strictEqual(getWarriorSkillBySlot(Number.NaN), null);

  // getWarriorSkillById
  assert.strictEqual(getWarriorSkillById('BERSERKER_STANCE').slot, 1);
  assert.strictEqual(getWarriorSkillById('AVATAR_OF_WAR').slot, 8);
  assert.strictEqual(getWarriorSkillById('INVALID_ID'), null);
  assert.strictEqual(getWarriorSkillById(''), null);
  assert.strictEqual(getWarriorSkillById(null), null);
  assert.strictEqual(getWarriorSkillById(123), null);

  // getUnlockedWarriorSkills
  assert.strictEqual(getUnlockedWarriorSkills(-1).length, 0);
  assert.strictEqual(getUnlockedWarriorSkills(0).length, 0);
  assert.strictEqual(getUnlockedWarriorSkills(1).length, 1);
  assert.strictEqual(getUnlockedWarriorSkills(4).length, 1);
  assert.strictEqual(getUnlockedWarriorSkills(5).length, 2);
  assert.strictEqual(getUnlockedWarriorSkills(9).length, 2);
  assert.strictEqual(getUnlockedWarriorSkills(10).length, 3);
  assert.strictEqual(getUnlockedWarriorSkills(14).length, 3);
  assert.strictEqual(getUnlockedWarriorSkills(15).length, 4);
  assert.strictEqual(getUnlockedWarriorSkills(19).length, 4);
  assert.strictEqual(getUnlockedWarriorSkills(20).length, 5);
  assert.strictEqual(getUnlockedWarriorSkills(29).length, 5);
  assert.strictEqual(getUnlockedWarriorSkills(30).length, 6);
  assert.strictEqual(getUnlockedWarriorSkills(39).length, 6);
  assert.strictEqual(getUnlockedWarriorSkills(40).length, 7);
  assert.strictEqual(getUnlockedWarriorSkills(49).length, 7);
  assert.strictEqual(getUnlockedWarriorSkills(50).length, 8);
  assert.strictEqual(getUnlockedWarriorSkills(100).length, 8);
  assert.strictEqual(getUnlockedWarriorSkills('50').length, 0);
  assert.strictEqual(getUnlockedWarriorSkills(null).length, 0);
});

test('UltimateConfig defines WARRIOR ultimate as AVATAR_OF_WAR with full spec parameters', () => {
  const warriorUlt = getUltimateConfigForClass('WARRIOR');
  assert.strictEqual(warriorUlt.id, 'AVATAR_OF_WAR');
  assert.strictEqual(warriorUlt.name, 'Avatar of War');
  assert.strictEqual(warriorUlt.duration, 10.0);
  assert.strictEqual(warriorUlt.damageMultiplier, 1.5);
  assert.strictEqual(warriorUlt.attackSpeedMultiplier, 1.3);
  assert.strictEqual(warriorUlt.moveSpeedMultiplier, 1.3);
  assert.strictEqual(warriorUlt.fireSlashDamage, 55);
  assert.strictEqual(warriorUlt.fireSlashSpeed, 750);
  assert.strictEqual(warriorUlt.fireSlashRange, 340);
  assert.strictEqual(warriorUlt.endExplosionRadius, 210);
  assert.strictEqual(warriorUlt.endExplosionDamage, 180);
  assert.strictEqual(warriorUlt.endExplosionKnockback, 350);
});

test('Warrior starts with 75 Armor, absorbs damage before HP, and Juggernaut reduces frontal damage by 20%', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.angle = 0; // facing East (+X)
  assert.strictEqual(warrior.maxArmor, 75);
  assert.strictEqual(warrior.armor, 75);

  // Unlock Juggernaut stance at combo 5 and switch
  for (let i = 0; i < 4; i++) warrior.recordKill();
  assert.strictEqual(warrior.warriorState.skills.JUGGERNAUT_STANCE.unlocked, true);
  warrior.applyInput({ weaponId: 'JUGGERNAUT_STANCE' });
  assert.strictEqual(warrior.warriorState.activeStance, 'JUGGERNAUT_STANCE');

  // Frontal attack from East (500, 400): 25% melee + 20% Juggernaut = 45% reduction -> 100 * 0.55 = 55 -> absorbs into 75 armor
  const resFront = warrior.takeDamage(100, 'MELEE', { sourceX: 500, sourceY: 400 });
  assert.strictEqual(resFront.blocked, false);
  assert.strictEqual(resFront.damage, 55);
  assert.strictEqual(warrior.armor, 20);
  assert.strictEqual(warrior.hp, 150);

  // Rear attack from West (300, 400): only 25% melee reduction -> 100 * 0.75 = 75 -> drains remaining 20 armor + 55 HP
  const resBack = warrior.takeDamage(100, 'MELEE', { sourceX: 300, sourceY: 400 });
  assert.strictEqual(resBack.damage, 75);
  assert.strictEqual(warrior.armor, 0);
  assert.strictEqual(warrior.hp, 95);
});

test('Review Focus #1: Switching to Juggernaut clears Berserker furyStacks and ignores locked stance', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.warriorState.furyStacks = 6;
  warrior.warriorState.furyTimer = 3.5;

  // Before combo 5, switching to Juggernaut is rejected and keeps Berserker + stacks
  warrior.applyInput({ weaponId: 'JUGGERNAUT_STANCE' });
  assert.strictEqual(warrior.warriorState.activeStance, 'BERSERKER_STANCE');
  assert.strictEqual(warrior.warriorState.furyStacks, 6);

  // Unlock at combo 5 -> switch clears furyStacks immediately
  for (let i = 0; i < 4; i++) warrior.recordKill();
  warrior.applyInput({ weaponId: 'JUGGERNAUT_STANCE' });
  assert.strictEqual(warrior.warriorState.activeStance, 'JUGGERNAUT_STANCE');
  assert.strictEqual(warrior.warriorState.furyStacks, 0);
  assert.strictEqual(warrior.warriorState.furyTimer, 0);
});

test('Review Focus #4 (Player): Counter Shield blocks frontal hits at 0 dmg once per activation, but rear hits bypass', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.angle = 0;
  warrior.warriorState.counterShieldTimer = 1.5;
  warrior.warriorState.counterShieldActive = true;

  // Attack from behind (West, 180 deg) must NOT trigger parry
  const rearHit = warrior.takeDamage(40, 'MELEE', { sourceX: 300, sourceY: 400 });
  assert.strictEqual(rearHit.parried, false);
  assert.strictEqual(warrior.warriorState.counterShieldTimer, 1.5);
  assert.ok(warrior.armor < 75);

  // Attack from 60 deg front-right triggers parry once with 0 damage
  const armorBefore = warrior.armor;
  const frontHit = warrior.takeDamage(40, 'MELEE', { sourceX: 450, sourceY: 480 });
  assert.strictEqual(frontHit.blocked, true);
  assert.strictEqual(frontHit.parried, true);
  assert.strictEqual(frontHit.damage, 0);
  assert.strictEqual(warrior.armor, armorBefore);
  assert.strictEqual(warrior.warriorState.counterShieldTimer, 0);
  assert.strictEqual(warrior.warriorState.counterShieldActive, false);
  assert.ok(warrior.warriorState.pendingParry);
  assert.strictEqual(warrior.warriorState.pendingParry.sourceX, 450);

  // Second hit in the same tick after parry is NOT blocked
  const secondHit = warrior.takeDamage(40, 'MELEE', { sourceX: 450, sourceY: 400 });
  assert.strictEqual(secondHit.parried, false);
});

test('applyWarriorCooldownBonus() & re-reaching milestone reduces [3]..[7] cooldowns by 30% (min 1.5s) and adds +15 ultCharge without touching [8]', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.ultCharge = 10;
  warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown = 4.0;
  warrior.warriorState.skills.COUNTER_SHIELD_BASH.cooldown = 2.0;
  warrior.warriorState.skills.AVATAR_OF_WAR.cooldown = 50.0;

  // Direct method invocation:
  // slot 3 (cd 4.0): max(1.5, 4.0 * 0.3 = 1.2) = 1.5 -> cd becomes 2.5
  // slot 7 (cd 2.0): max(1.5, 2.0 * 0.3 = 0.6) = 1.5 -> cd becomes 0.5
  // slot 8: unchanged at 50.0
  warrior.applyWarriorCooldownBonus();
  assert.strictEqual(warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown, 2.5);
  assert.strictEqual(warrior.warriorState.skills.COUNTER_SHIELD_BASH.cooldown, 0.5);
  assert.strictEqual(warrior.warriorState.skills.AVATAR_OF_WAR.cooldown, 50.0);
  assert.strictEqual(warrior.ultCharge, 25);

  // Reach combo milestone 10 (BLADE_WHIRLWIND unlock)
  for (let i = 0; i < 9; i++) warrior.recordKill();
  assert.strictEqual(warrior.combo, 10);
  assert.strictEqual(warrior.warriorState.skills.BLADE_WHIRLWIND.unlocked, true);

  // Let combo decay back to 1
  warrior.comboTimer = 0;
  warrior.update(0.1, new GameMap(), []);
  assert.strictEqual(warrior.combo, 1);

  // Set cooldown on slot 3 again
  warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown = 4.5;
  const ultBefore = warrior.ultCharge;

  // Re-reach combo 10
  for (let i = 0; i < 9; i++) warrior.recordKill();
  assert.strictEqual(warrior.combo, 10);
  // Re-reaching milestone 10 triggered applyWarriorCooldownBonus:
  // cd 4.5 -> reduction max(1.5, 4.5 * 0.3 = 1.35) = 1.5 -> 3.0
  assert.strictEqual(warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown, 3.0);
  assert.ok(warrior.ultCharge >= ultBefore + 15);
});

test('Warrior update(dt) handles passive ult regen, fury expiration, cooldown ticking, speed multipliers, and dash displacement suppression', () => {
  const map = new GameMap();
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  assert.strictEqual(warrior.speed, 144);

  // 1. Passive ult regen when avatarTimer <= 0
  warrior.ultCharge = 0;
  warrior.update(1.0, map, []);
  assert.ok(Math.abs(warrior.ultCharge - (100 / 60)) < 0.1, 'Should passively gain ~1.67 ultCharge per sec');

  // No passive ult regen when avatarTimer > 0
  warrior.warriorState.avatarTimer = 5.0;
  warrior.warriorState.avatarActive = true;
  const ultDuringAvatar = warrior.ultCharge;
  warrior.update(1.0, map, []);
  assert.strictEqual(warrior.ultCharge, ultDuringAvatar, 'No passive ult regen during Avatar');
  assert.strictEqual(warrior.warriorState.avatarTimer, 4.0);
  assert.strictEqual(warrior.warriorState.avatarActive, true, 'avatarActive must not be auto-cleared in Player.update');
  warrior.warriorState.avatarTimer = 0;
  warrior.warriorState.avatarActive = false;

  // 2. Fury expiration and speed bonus in Berserker stance
  warrior.warriorState.furyStacks = 5;
  warrior.warriorState.furyTimer = 0.5;
  warrior.update(0.1, map, []);
  // speed: 144 * (1 + 5 * 0.02) = 144 * 1.10 = 158.4
  assert.strictEqual(warrior.speed, 158.4);
  assert.strictEqual(warrior.warriorState.furyStacks, 5);

  // Fury expires after 0.5s total
  warrior.update(0.5, map, []);
  assert.strictEqual(warrior.warriorState.furyStacks, 0);
  assert.strictEqual(warrior.warriorState.furyTimer, 0);
  assert.strictEqual(warrior.speed, 144);

  // 3. Counter Shield speed multiplier (0.75x)
  warrior.warriorState.counterShieldTimer = 1.0;
  warrior.warriorState.counterShieldActive = true;
  warrior.update(0.1, map, []);
  assert.strictEqual(warrior.speed, 144 * 0.75); // 108
  warrior.warriorState.counterShieldTimer = 0;
  warrior.warriorState.counterShieldActive = false;

  // 4. Whirlwind speed multiplier (0.70x)
  warrior.warriorState.whirlwind = { timer: 1.0, ticksRemaining: 4 };
  warrior.update(0.1, map, []);
  assert.strictEqual(warrior.speed, 144 * 0.70); // 100.8
  warrior.warriorState.whirlwind = null;

  // 5. Dash suppresses WASD movement displacement
  warrior.warriorState.dash = { timer: 0.18 };
  warrior.applyInput({ right: true });
  const startX = warrior.x;
  warrior.update(0.1, map, []);
  assert.strictEqual(warrior.x, startX, 'WASD movement must be suppressed while dashing');
  warrior.warriorState.dash = null;

  // 6. Attack speed multiplier
  warrior.warriorState.furyStacks = 4;
  // 1 + 4 * 0.03 = 1.12
  assert.strictEqual(Number(warrior.getWarriorAttackSpeedMultiplier().toFixed(2)), 1.12);
  warrior.warriorState.avatarTimer = 5.0;
  // 1.12 * 1.3 = 1.456
  assert.strictEqual(Number(warrior.getWarriorAttackSpeedMultiplier().toFixed(3)), 1.456);

  // 7. Damage multiplier
  assert.strictEqual(warrior.getWarriorDamageMultiplier(), 1.5);
  warrior.hasWarCryBuff = true;
  assert.strictEqual(Number(warrior.getWarriorDamageMultiplier().toFixed(3)), Number((1.5 * 1.15).toFixed(3)));
});

test('Warrior takeDamage clears active channels on downed or dead, and restoreArmor caps at maxArmor', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  warrior.warriorState.whirlwind = { timer: 1.0 };
  warrior.warriorState.dash = { timer: 0.1 };
  warrior.warriorState.counterShieldTimer = 1.0;
  warrior.warriorState.counterShieldActive = true;
  warrior.warriorState.warCryAuraTimer = 3.0;
  warrior.warriorState.avatarTimer = 5.0;
  warrior.warriorState.avatarActive = true;
  warrior.warriorState.furyStacks = 5;
  warrior.warriorState.furyTimer = 3.0;
  warrior.hasWarCryBuff = true;

  // Armor restoration
  warrior.armor = 50;
  assert.strictEqual(warrior.restoreArmor(15), 65);
  assert.strictEqual(warrior.restoreArmor(50), 75); // capped at maxArmor (75)

  // Lethal blow to trigger downed state
  warrior.takeDamage(500, 'EXPLOSIVE');
  assert.strictEqual(warrior.isDowned, true);
  assert.strictEqual(warrior.armor, 0);
  assert.strictEqual(warrior.hp, 0);
  assert.strictEqual(warrior.warriorState.whirlwind, null);
  assert.strictEqual(warrior.warriorState.dash, null);
  assert.strictEqual(warrior.warriorState.counterShieldTimer, 0);
  assert.strictEqual(warrior.warriorState.counterShieldActive, false);
  assert.strictEqual(warrior.warriorState.warCryAuraTimer, 0);
  assert.strictEqual(warrior.warriorState.avatarTimer, 0);
  assert.strictEqual(warrior.warriorState.avatarActive, false);
  assert.strictEqual(warrior.warriorState.furyStacks, 0);
  assert.strictEqual(warrior.warriorState.furyTimer, 0);
  assert.strictEqual(warrior.hasWarCryBuff, false);
});

test('Player serialization includes Armor, hasWarCryBuff, and warriorState for WARRIOR while keeping other classes clean', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  const human = new Player('h1', 'Ranger', 'HUMAN', 400, 400);

  const wSnap = warrior.serialize();
  assert.strictEqual(wSnap.armor, 75);
  assert.strictEqual(wSnap.maxArmor, 75);
  assert.strictEqual(wSnap.hasWarCryBuff, false);
  assert.ok(wSnap.warriorState);
  assert.strictEqual(wSnap.warriorState.activeStance, 'BERSERKER_STANCE');
  assert.strictEqual(wSnap.warriorState.skills.BERSERKER_STANCE.unlocked, true);
  assert.strictEqual(wSnap.warriorState.skills.JUGGERNAUT_STANCE.unlocked, false);

  const hSnap = human.serialize();
  assert.strictEqual(hSnap.armor, 0);
  assert.strictEqual(hSnap.maxArmor, 0);
  assert.strictEqual(hSnap.hasWarCryBuff, false);
  assert.strictEqual(hSnap.warriorState, null);
});

test('Warrior revive restores 50% maxArmor', () => {
  const warrior = new Player('w1', 'Tank', 'WARRIOR', 400, 400);
  const medic = new Player('m1', 'Medic', 'HUMAN', 410, 400);

  // Knock down warrior
  warrior.takeDamage(500, 'EXPLOSIVE');
  assert.strictEqual(warrior.isDowned, true);
  assert.strictEqual(warrior.armor, 0);

  // Medic revives warrior
  medic.startRevive(warrior);
  const revived = medic.updateRevive(2.1);
  assert.strictEqual(revived, warrior);
  assert.strictEqual(warrior.isDowned, false);
  assert.strictEqual(warrior.hp, 40);
  // 50% of 75 = 37.5 -> rounded to 38
  assert.strictEqual(warrior.armor, 38);
});

test('Review Focus #2: Zombie Taunt overrides nearest target, clears on downed target, and Fear repels non-bosses', () => {
  const map = new GameMap('THE_ROOMS');
  const nearHuman = new Player('h1', 'Near', 'HUMAN', 250, 600);
  const farWarrior = new Player('w1', 'Warrior', 'WARRIOR', 600, 600);
  const z = new Zombie('z1', 'NORMAL', 300, 600);
  const boss = new Zombie('b1', 'TANK', 300, 600);

  // Taunt draws z toward farWarrior instead of nearHuman
  z.applyTaunt('w1', 4.0);
  z.update(0.1, [nearHuman, farWarrior], [], map, []);
  assert.ok(z.x > 300, 'Taunted zombie must move East toward farWarrior');
  assert.strictEqual(z.serialize().isTaunted, true);

  // When farWarrior is downed, taunt clears immediately and zombie targets nearHuman
  farWarrior.isDowned = true;
  z.update(0.1, [nearHuman, farWarrior], [], map, []);
  assert.strictEqual(z.tauntTargetId, null);
  assert.strictEqual(z.tauntTimer, 0);
  assert.strictEqual(z.serialize().isTaunted, false);

  // When farWarrior dies, taunt also clears if re-applied
  farWarrior.isDowned = false;
  farWarrior.isDead = true;
  z.applyTaunt('w1', 4.0);
  z.update(0.1, [nearHuman, farWarrior], [], map, []);
  assert.strictEqual(z.tauntTargetId, null);
  assert.strictEqual(z.tauntTimer, 0);

  // Fear forces normal zombie away from (350, 600) while boss ignores Fear
  const zFear = new Zombie('z2', 'NORMAL', 300, 600);
  zFear.applyFear(350, 600, 1.5);
  boss.applyFear(350, 600, 1.5);
  zFear.update(0.1, [farWarrior], [], map, []);
  assert.ok(zFear.x < 300, 'Feared normal zombie must flee West away from Warrior');
  assert.strictEqual(zFear.serialize().isFeared, true);
  assert.strictEqual(boss.serialize().isFeared, false);

  // Devil also ignores Fear
  const devil = new Zombie('d1', 'DEVIL', 300, 600);
  devil.applyFear(350, 600, 1.5);
  assert.strictEqual(devil.fearTimer, 0);
  assert.strictEqual(devil.serialize().isFeared, false);
});

test('Feared zombies flee without attacking or throwing fireballs, and handle identical coordinates cleanly', () => {
  const map = new GameMap('THE_ROOMS');
  const warrior = new Player('w1', 'Warrior', 'WARRIOR', 300, 600);
  const z = new Zombie('z1', 'NORMAL', 305, 600); // within melee range
  z.attackCooldown = 0;
  z.applyFear(300, 600, 2.0);

  const initialHp = warrior.hp;
  z.update(0.1, [warrior], [], map, []);
  assert.strictEqual(warrior.hp, initialHp, 'Feared zombie in melee range must flee instead of attacking');
  assert.strictEqual(z.isAttacking, false);
  assert.ok(z.x > 305, 'Zombie must flee East away from fear source at (300, 600)');

  // Same coordinates fallback (no NaN)
  const zCenter = new Zombie('zc', 'NORMAL', 300, 600);
  zCenter.applyFear(300, 600, 1.0);
  zCenter.update(0.1, [warrior], [], map, []);
  assert.ok(!Number.isNaN(zCenter.x) && !Number.isNaN(zCenter.y), 'Coordinates must remain finite numbers');
});

test('Zombie applySlow validates inputs, preserves stronger slow, and reduces movement speed', () => {
  const map = new GameMap('THE_ROOMS');
  const player = new Player('p1', 'Target', 'HUMAN', 800, 600);

  // Normal zombie speed baseline
  const zNorm = new Zombie('zn', 'NORMAL', 300, 600);
  zNorm.update(0.1, [player], [], map, []);
  const normalDeltaX = zNorm.x - 300;

  // Slowed zombie (e.g. 50% slow -> slowFactor 0.5)
  const zSlow = new Zombie('zs', 'NORMAL', 300, 600);
  zSlow.applySlow(2.0, 0.5);
  zSlow.update(0.1, [player], [], map, []);
  const slowDeltaX = zSlow.x - 300;

  assert.ok(slowDeltaX > 0 && slowDeltaX < normalDeltaX, 'Slowed zombie moves slower than normal zombie');
  assert.ok(Math.abs(slowDeltaX - normalDeltaX * 0.5) < 0.5, 'Slow factor 0.5 reduces movement displacement proportionally');

  // Weaker slow does not weaken an active stronger slow
  zSlow.applySlow(5.0, 0.8); // 0.8 is weaker than 0.5
  assert.strictEqual(zSlow.slowFactor, 0.5, 'Active stronger slowFactor 0.5 must be preserved');
  assert.strictEqual(zSlow.slowTimer >= 5.0 - 0.1, true, 'Duration extended to max');

  // Dead zombie ignores applySlow
  const zDead = new Zombie('zd', 'NORMAL', 300, 600);
  zDead.isDead = true;
  zDead.applySlow(2.0, 0.5);
  assert.strictEqual(zDead.slowTimer, 0);

  // Invalid inputs ignored
  const zVal = new Zombie('zv', 'NORMAL', 300, 600);
  zVal.applySlow(-1, 0.5);
  zVal.applySlow(2.0, -0.5);
  zVal.applySlow(2.0, 1.5);
  zVal.applySlow(NaN, 0.5);
  zVal.applySlow(2.0, NaN);
  assert.strictEqual(zVal.slowTimer, 0);
  assert.strictEqual(zVal.slowFactor, 1.0);
});

test('Zombie melee attack passes source coordinates allowing Warrior Counter Shield to parry', () => {
  const map = new GameMap('THE_ROOMS');
  const warrior = new Player('w1', 'Warrior', 'WARRIOR', 400, 400);
  warrior.angle = 0; // Facing East (+X)
  warrior.warriorState.counterShieldTimer = 1.0;
  warrior.warriorState.counterShieldActive = true;

  // Zombie is in front of warrior at (430, 400) - melee range, East of Warrior
  const z = new Zombie('z1', 'NORMAL', 430, 400);
  z.attackCooldown = 0;

  const initialHp = warrior.hp;
  const initialArmor = warrior.armor;
  z.update(0.1, [warrior], [], map, []);

  assert.strictEqual(warrior.hp, initialHp, 'Warrior HP must not decrease on parried melee attack');
  assert.strictEqual(warrior.armor, initialArmor, 'Warrior Armor must not decrease on parried melee attack');
  assert.strictEqual(warrior.warriorState.counterShieldTimer, 0, 'Counter Shield consumed on parry');
  assert.ok(warrior.warriorState.pendingParry, 'Pending parry must be set on Warrior');
  assert.strictEqual(warrior.warriorState.pendingParry.sourceType, 'MELEE');
  assert.strictEqual(warrior.warriorState.pendingParry.sourceX, z.x);
  assert.strictEqual(warrior.warriorState.pendingParry.sourceY, z.y);
});

const { Barricade } = require('../server/game/Barricade.js');
const { Bullet } = require('../server/game/Bullet.js');
const { triggerPlayerUltimate } = require('../server/game/UltimateAbilities.js');
const {
  executeWarriorBasicAttack,
  triggerWarriorSkill,
  activateAvatarOfWar,
  triggerWarriorCounterParry,
  updateWarriorRoomSystems,
  applyWarriorAmmoPickup,
  isFrontalShieldBlocking
} = require('../server/game/WarriorAbilities.js');

function createMockRoom() {
  return {
    state: 'PLAYING',
    map: new GameMap('THE_ROOMS'),
    players: new Map(),
    zombies: [],
    bullets: [],
    barricades: [],
    groundZones: [],
    pendingSlams: [],
    eventsBuffer: [],
    pickups: []
  };
}

test('Task 4: [1] Berserker Stance builds fury on hit (not miss) and [2] Juggernaut pierces all zombies with slow & knockback', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.angle = 0; // facing East
  room.players.set(warrior.id, warrior);

  // Berserker stance basic attack
  const zHit = new Zombie('z1', 'NORMAL', 450, 400); // 50px away, within 80px range
  const zBehind = new Zombie('z2', 'NORMAL', 350, 400); // behind warrior
  room.zombies.push(zHit, zBehind);

  const didHit = executeWarriorBasicAttack(warrior, room);
  assert.strictEqual(didHit, true);
  assert.strictEqual(zHit.hp, 80 - 42);
  assert.strictEqual(zBehind.hp, 80);
  assert.strictEqual(warrior.warriorState.furyStacks, 1);
  assert.strictEqual(warrior.warriorState.furyTimer, 4.0);
  assert.strictEqual(warrior.fireCooldown, 0.26);

  // Swing in empty air (miss) must NOT build fury
  warrior.fireCooldown = 0;
  zHit.x = 900; // move far away
  executeWarriorBasicAttack(warrior, room);
  assert.strictEqual(warrior.warriorState.furyStacks, 1, 'Miss must not build furyStacks');

  // Switch to Juggernaut (requires combo milestone 5)
  warrior.maxCombo = 5;
  warrior.recordKill(5);
  warrior.setWarriorStance('JUGGERNAUT_STANCE');
  assert.strictEqual(warrior.warriorState.furyStacks, 0, 'Switching stances resets furyStacks');

  // Place 3 zombies in 130° cone within 125px range
  const zA = new Zombie('zA', 'NORMAL', 480, 400); // 80px East
  const zB = new Zombie('zB', 'NORMAL', 470, 430); // ~76px at ~23°
  const zC = new Zombie('zC', 'NORMAL', 460, 360); // ~72px at ~-33°
  room.zombies = [zA, zB, zC];

  warrior.fireCooldown = 0;
  executeWarriorBasicAttack(warrior, room);

  for (const z of [zA, zB, zC]) {
    assert.strictEqual(z.hp, 80 - 58, 'All zombies in Juggernaut cone must be pierced');
    assert.strictEqual(z.slowFactor, 0.7, 'Juggernaut hit applies 0.7 slow');
    assert.ok(z.slowTimer > 0, 'Juggernaut hit applies slow duration');
    const kb = Math.hypot(z.knockbackX, z.knockbackY);
    assert.ok(Math.abs(kb - 260) < 1, 'Juggernaut hit applies 260 knockback');
  }
  assert.strictEqual(warrior.fireCooldown, 0.55);
});

test('Task 4: [3] Blade Whirlwind executes 6 ticks over 1.5s; Berserker fires 4 wind_blade bullets and Juggernaut slams & stuns on tick 6', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.angle = 0;
  warrior.maxCombo = 10;
  warrior.recordKill(10); // unlocks slot 3
  room.players.set(warrior.id, warrior);

  // Berserker whirl test
  warrior.setWarriorStance('BERSERKER_STANCE');
  const zNear = new Zombie('zn', 'NORMAL', 440, 400); // within 105px radius
  room.zombies = [zNear];

  const res1 = triggerWarriorSkill(warrior, 3, 0, room);
  assert.strictEqual(res1.activated, true);
  assert.strictEqual(warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown, 4.5);

  // Step 75 ticks of 0.02s (1.50s)
  for (let t = 0; t < 75; t++) {
    updateWarriorRoomSystems(0.02, room);
  }

  assert.strictEqual(warrior.warriorState.whirlwind, null, 'Whirlwind must finish after 1.5s');
  assert.strictEqual(room.bullets.length, 4, 'Berserker whirlwind tick 6 must spawn 4 wind_blade bullets');
  for (const b of room.bullets) {
    assert.strictEqual(b.type, 'wind_blade');
    assert.strictEqual(b.penetration, true);
    assert.strictEqual(b.radius, 16);
    assert.strictEqual(b.damage, 65);
    assert.strictEqual(b.speed, 560);
  }

  // Juggernaut whirl test
  warrior.setWarriorStance('JUGGERNAUT_STANCE');
  warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown = 0;
  room.bullets = [];

  const zNorm = new Zombie('zn2', 'NORMAL', 530, 400); // 130px away (< 135+20=155px slam radius, > 105+20=125px tick radius)
  zNorm.maxHp = 150;
  zNorm.hp = 150;
  const zBoss = new Zombie('zb2', 'TANK', 530, 400); // 130px away
  room.zombies = [zNorm, zBoss];

  triggerWarriorSkill(warrior, 3, 0, room);
  for (let t = 0; t < 75; t++) {
    updateWarriorRoomSystems(0.02, room);
  }

  assert.strictEqual(zNorm.hp, 150 - 90, 'Normal zombie must take 90 slam damage');
  assert.strictEqual(zNorm.serialize().isStunned, true);
  assert.strictEqual(zNorm.stunTimer, 1.2, 'Normal zombie stunned 1.2s');
  assert.strictEqual(zBoss.stunTimer, 0.8, 'Boss zombie stunned 0.8s');
  assert.strictEqual(room.bullets.length, 0, 'Juggernaut whirlwind must not spawn wind_blade bullets');
});

test('Task 4: [4] Shadow Dash moves 240px over 0.18s, clamps against obstacles, and drops 2 marks that pull zombies inward at 0.5s', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 300, 300);
  warrior.angle = 0; // Dash East
  warrior.maxCombo = 15;
  warrior.recordKill(15); // unlocks slot 4
  room.players.set(warrior.id, warrior);

  const zPath = new Zombie('zp', 'NORMAL', 400, 300); // on dash path
  const zNearStart = new Zombie('zs', 'NORMAL', 300, 380); // 80px south of origin mark (within 160px pull radius)
  room.zombies = [zPath, zNearStart];

  const res = triggerWarriorSkill(warrior, 4, 0, room);
  assert.strictEqual(res.activated, true);
  assert.strictEqual(room.groundZones.length, 1, 'Origin slash_mark zone dropped immediately');
  assert.strictEqual(room.groundZones[0].type, 'slash_mark');
  assert.strictEqual(room.groundZones[0].x, 300);
  assert.strictEqual(room.groundZones[0].y, 300);

  // Advance 9 ticks of 0.02s (0.18s)
  for (let t = 0; t < 9; t++) {
    updateWarriorRoomSystems(0.02, room);
  }

  assert.strictEqual(warrior.warriorState.dash, null, 'Dash finished after 0.18s');
  assert.ok(Math.abs(warrior.x - 540) <= 2, `Warrior must travel ~240px, got x=${warrior.x}`);
  assert.strictEqual(zPath.hp, 80 - 55, 'Zombie on path takes 55 dash damage');
  assert.strictEqual(room.groundZones.length, 2, 'Destination slash_mark zone dropped at final position');
  assert.strictEqual(room.groundZones[1].x, Math.round(warrior.x));

  // Advance 0.5s for marks to detonate and pull zombies
  const startYBefore = zNearStart.y;
  for (let t = 0; t < 25; t++) {
    updateWarriorRoomSystems(0.02, room);
  }

  assert.strictEqual(room.groundZones.length, 0, 'Both marks exploded and cleared');
  assert.ok(zNearStart.y < startYBefore, 'Zombie near mark must be pulled inward toward (300, 300)');
  assert.strictEqual(zNearStart.hp, 80 - 75, 'Zombie in mark radius takes 75 mark damage');

  // Review Focus #5: Collision clamping against Barricade
  warrior.x = 350;
  warrior.y = 300;
  warrior.warriorState.skills.SHADOW_DASH_SLASH.cooldown = 0;
  const bar = new Barricade('b_test', 430, 300);
  room.barricades = [bar];

  triggerWarriorSkill(warrior, 4, 0, room);
  for (let t = 0; t < 9; t++) {
    updateWarriorRoomSystems(0.02, room);
  }
  assert.ok(warrior.x <= bar.x - bar.half - warrior.radius + 1, 'Dash must clamp against Barricade without clipping');
});

test('Task 4: [5] Seismic Slam fires 3 rings, clears fireballs, spares Barricade, and creates ticking seismic_fissure', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.angle = 0;
  warrior.maxCombo = 20;
  warrior.recordKill(20); // unlocks slot 5
  room.players.set(warrior.id, warrior);

  const bar = new Barricade('bar_friendly', 450, 400);
  const initialBarHp = bar.hp;
  room.barricades = [bar];

  const fireball = new Bullet('fb_dev', 'd1', 460, 400, Math.PI, { type: 'fireball', isFireball: true });
  room.bullets = [fireball];

  const z1 = new Zombie('z_r1', 'NORMAL', 460, 400); // 60px (Ring 1: 0-95px)
  const z2 = new Zombie('z_r2', 'NORMAL', 530, 400); // 130px (Ring 2: 95-165px)
  z2.maxHp = 200;
  z2.hp = 200;
  const z3 = new Zombie('z_r3', 'NORMAL', 600, 400); // 200px (Ring 3: 165-230px)
  room.zombies = [z1, z2, z3];

  const res = triggerWarriorSkill(warrior, 5, 0, room);
  assert.strictEqual(res.activated, true);
  assert.strictEqual(room.bullets.length, 0, 'Devil fireball must be destroyed immediately');
  assert.strictEqual(bar.hp, initialBarHp, 'Friendly Barricade must NOT take damage from Seismic Slam');

  // Ring 1 hits at t=0
  updateWarriorRoomSystems(0.02, room);
  assert.strictEqual(z1.isDead, true, 'Ring 1 (165 dmg) kills 80 HP normal zombie');
  assert.strictEqual(z2.hp, 200, 'Ring 2 has not hit yet at t=0.02');

  // Ring 2 hits at t=0.12
  for (let t = 0; t < 5; t++) updateWarriorRoomSystems(0.02, room); // reaches ~0.12s
  assert.strictEqual(z2.hp, 200 - 105, 'Ring 2 deals 105 damage');
  assert.strictEqual(z2.serialize().isStunned, true);
  assert.strictEqual(z2.stunTimer, 2.0);

  // Ring 3 hits at t=0.24
  for (let t = 0; t < 6; t++) updateWarriorRoomSystems(0.02, room); // reaches ~0.24s
  assert.strictEqual(z3.hp, 80 - 70, 'Ring 3 deals 70 damage');
  assert.strictEqual(z3.stunTimer, 2.5);

  // Seismic fissure zone checks
  assert.strictEqual(room.groundZones.length, 1);
  const fissure = room.groundZones[0];
  assert.strictEqual(fissure.type, 'seismic_fissure');
  assert.strictEqual(fissure.radius, 210);

  // Zombie walking through fissure gets slowed and takes 8 'FIRE' damage every 0.5s
  const zWalk = new Zombie('zw', 'NORMAL', 430, 400);
  room.zombies = [zWalk];
  for (let t = 0; t < 26; t++) { // 0.52s
    updateWarriorRoomSystems(0.02, room);
  }
  assert.strictEqual(zWalk.slowFactor, 0.4, 'Fissure slows zombies to 0.4');
  assert.strictEqual(zWalk.hp, 80 - 8, 'Fissure ticks 8 FIRE damage after 0.5s');

  // After 4.0s total, fissure expires
  for (let t = 0; t < 180; t++) {
    updateWarriorRoomSystems(0.02, room);
  }
  assert.strictEqual(room.groundZones.length, 0, 'Fissure expires after 4.0s');
});

test('Task 4: [6] War Cry taunts within 900px, fears close non-bosses <=180px, restores +15 Armor, and grants +15% dmg aura', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.armor = 30; // damaged armor
  warrior.maxCombo = 30;
  warrior.recordKill(30); // unlocks slot 6
  room.players.set(warrior.id, warrior);

  const allyNear = new Player('h1', 'Ranger', 'HUMAN', 450, 400); // 50px away <= 200px aura
  const allyFar = new Player('h2', 'Sniper', 'HUMAN', 700, 400); // 300px away > 200px aura
  room.players.set(allyNear.id, allyNear);
  room.players.set(allyFar.id, allyFar);

  const zNearNorm = new Zombie('zn', 'NORMAL', 480, 400); // 80px away <= 180px
  const zNearBoss = new Zombie('zb', 'TANK', 490, 400); // 90px away <= 180px
  const zMidNorm = new Zombie('zm', 'NORMAL', 700, 400); // 300px away <= 900px, > 180px
  const zFarNorm = new Zombie('zf', 'NORMAL', 1500, 400); // 1100px away > 900px
  room.zombies = [zNearNorm, zNearBoss, zMidNorm, zFarNorm];

  const res = triggerWarriorSkill(warrior, 6, 0, room);
  assert.strictEqual(res.activated, true);
  assert.strictEqual(warrior.armor, 45, 'Restores +15 Armor (20% of 75)');

  // Taunt checks
  assert.strictEqual(zNearNorm.tauntTargetId, 'w1');
  assert.strictEqual(zNearBoss.tauntTargetId, 'w1');
  assert.strictEqual(zMidNorm.tauntTargetId, 'w1');
  assert.strictEqual(zFarNorm.tauntTargetId, null);

  // Fear checks (only normal zombies within 180px)
  assert.strictEqual(zNearNorm.fearTimer, 1.5, 'Normal zombie <=180px is Feared');
  assert.strictEqual(zNearBoss.fearTimer, 0, 'Boss zombie ignores Fear');
  assert.strictEqual(zMidNorm.fearTimer, 0, 'Zombie >180px is not Feared');

  // Ally damage buff aura
  updateWarriorRoomSystems(0.02, room);
  assert.strictEqual(allyNear.hasWarCryBuff, true, 'Nearby ally gains War Cry +15% dmg buff');
  assert.strictEqual(allyFar.hasWarCryBuff, false, 'Far ally does not gain War Cry buff');

  // Advance 5.0s -> aura expires
  for (let t = 0; t < 260; t++) {
    warrior.update(0.02, room.map, []);
    updateWarriorRoomSystems(0.02, room);
  }
  assert.strictEqual(allyNear.hasWarCryBuff, false, 'War Cry buff clears after 5.0s expiration');
});

test('Task 4: [7] Counter Shield Parry steps forward, stuns & cleaves on pendingParry; miss sets 4.0s CD; frontal blocking guard', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.angle = 0; // facing East
  warrior.maxCombo = 40;
  warrior.recordKill(40); // unlocks slot 7
  room.players.set(warrior.id, warrior);

  // isFrontalShieldBlocking check before activation
  assert.strictEqual(isFrontalShieldBlocking(warrior, 500, 400), false);

  // Activate Counter Shield
  const res = triggerWarriorSkill(warrior, 7, 0, room);
  assert.strictEqual(res.activated, true);
  assert.strictEqual(warrior.warriorState.counterShieldActive, true);
  assert.strictEqual(isFrontalShieldBlocking(warrior, 500, 400), true, 'Frontal hit blocked within +-70 deg');
  assert.strictEqual(isFrontalShieldBlocking(warrior, 300, 400), false, 'Rear hit bypassed');

  // Parry flow: simulate frontal melee attack setting pendingParry
  warrior.takeDamage(40, 'MELEE', { sourceX: 430, sourceY: 400 });
  assert.ok(warrior.warriorState.pendingParry, 'pendingParry set on frontal block');

  const zInCone = new Zombie('zc', 'NORMAL', 460, 400);
  room.zombies = [zInCone];

  updateWarriorRoomSystems(0.02, room);
  assert.strictEqual(warrior.warriorState.pendingParry, null, 'pendingParry cleared after parry');
  assert.strictEqual(warrior.warriorState.skills.COUNTER_SHIELD_BASH.cooldown, 8.0, 'Full 8.0s cooldown on parry');
  assert.ok(warrior.x > 400, `Warrior steps forward ~75px, got x=${warrior.x}`);
  assert.strictEqual(zInCone.isDead, true, 'Cone bash (95) + cleave (120) kills 80 HP normal zombie');

  // Miss flow: activate shield and let 1.5s expire without taking hits
  warrior.warriorState.skills.COUNTER_SHIELD_BASH.cooldown = 0;
  triggerWarriorSkill(warrior, 7, 0, room);
  for (let t = 0; t < 75; t++) {
    warrior.update(0.02, room.map, []);
    updateWarriorRoomSystems(0.02, room);
  }
  assert.strictEqual(warrior.warriorState.counterShieldActive, false);
  assert.strictEqual(warrior.warriorState.skills.COUNTER_SHIELD_BASH.cooldown, 4.0, 'Miss cooldown set to 4.0s');
});

test('Task 4: [8] Avatar of War fires fire_slash bullets, triggers Final Fire Nova on expiry, and downed warrior cancels Nova', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.angle = 0;
  warrior.maxCombo = 50;
  warrior.recordKill(50); // unlocks slot 8
  warrior.ultCharge = 100;
  room.players.set(warrior.id, warrior);

  const res = triggerWarriorSkill(warrior, 8, 0, room);
  assert.strictEqual(res.activated, true);
  assert.strictEqual(warrior.ultCharge, 0);
  assert.strictEqual(warrior.warriorState.avatarActive, true);
  assert.strictEqual(warrior.warriorState.avatarTimer, 10.0);

  // Basic attacks in Avatar spawn piercing fire_slash Bullets
  warrior.fireCooldown = 0;
  executeWarriorBasicAttack(warrior, room);
  assert.strictEqual(room.bullets.length, 1);
  const slash = room.bullets[0];
  assert.strictEqual(slash.type, 'fire_slash');
  assert.strictEqual(slash.penetration, true);
  assert.strictEqual(slash.damage, 55);
  assert.strictEqual(slash.speed, 750);
  assert.strictEqual(slash.range, 340);
  assert.strictEqual(slash.radius, 16);

  // Advance 10.0s -> Final Fire Nova
  const zNear = new Zombie('zn', 'NORMAL', 500, 400); // 100px away <= 210px radius
  room.zombies = [zNear];
  for (let t = 0; t < 501; t++) {
    warrior.update(0.02, room.map, []);
    updateWarriorRoomSystems(0.02, room);
  }
  assert.strictEqual(warrior.warriorState.avatarActive, false);
  assert.strictEqual(zNear.isDead, true, 'Final Fire Nova (180 dmg) kills 80 HP normal zombie');

  // Edge case: Downed warrior does NOT trigger Final Fire Nova
  warrior.ultCharge = 100;
  activateAvatarOfWar(warrior, room);
  assert.strictEqual(warrior.warriorState.avatarActive, true);

  warrior.hp = 10;
  warrior.armor = 0;
  warrior.takeDamage(20, 'MELEE'); // downs warrior
  assert.strictEqual(warrior.isDowned, true);
  assert.strictEqual(warrior.warriorState.avatarActive, false);

  const zSpare = new Zombie('zs', 'NORMAL', 450, 400);
  room.zombies = [zSpare];
  for (let t = 0; t < 501; t++) {
    warrior.update(0.02, room.map, []);
    updateWarriorRoomSystems(0.02, room);
  }
  assert.strictEqual(zSpare.hp, 80, 'Downed warrior must not fire Final Fire Nova');
});

test('Task 4: applyWarriorAmmoPickup(player) delegates to player.applyWarriorCooldownBonus()', () => {
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown = 4.0;
  warrior.warriorState.skills.SHADOW_DASH_SLASH.cooldown = 5.0;

  let delegateCalled = false;
  const originalBonus = warrior.applyWarriorCooldownBonus.bind(warrior);
  warrior.applyWarriorCooldownBonus = function () {
    delegateCalled = true;
    return originalBonus();
  };

  applyWarriorAmmoPickup(warrior);
  assert.strictEqual(delegateCalled, true, 'applyWarriorAmmoPickup must delegate to player.applyWarriorCooldownBonus()');
  assert.ok(warrior.warriorState.skills.BLADE_WHIRLWIND.cooldown < 4.0);
  assert.strictEqual(warrior.ultCharge, 15);
});

test('Task 4 Review Fix: triggerPlayerUltimate integrates cleanly with Avatar of War', () => {
  const room = createMockRoom();
  const warrior = new Player('w1', 'Garen', 'WARRIOR', 400, 400);
  warrior.ultCharge = 100;
  room.players.set(warrior.id, warrior);

  // 1. Successful ultimate trigger
  const res = triggerPlayerUltimate(warrior, 0, room);
  assert.strictEqual(res.activated, true);
  assert.ok(res.event, 'event must be returned and non-null');
  assert.strictEqual(res.event.type, 'ULTIMATE');
  assert.strictEqual(res.event.ultId, 'AVATAR_OF_WAR');
  assert.strictEqual(warrior.ultCharge, 0, 'ultCharge consumed to 0');
  assert.strictEqual(warrior.warriorState.avatarActive, true);
  assert.strictEqual(warrior.warriorState.avatarTimer, 10.0);
  assert.strictEqual(room.eventsBuffer.length, 1);
  assert.strictEqual(room.eventsBuffer[0].ultId, 'AVATAR_OF_WAR');

  // 2. Calling while Avatar of War is already active does NOT consume ultCharge or break active state
  warrior.ultCharge = 100; // artificial re-charge while active
  const resAlreadyActive = triggerPlayerUltimate(warrior, 0, room);
  assert.strictEqual(resAlreadyActive.activated, false);
  assert.strictEqual(resAlreadyActive.reason, 'WARRIOR_ULT_UNAVAILABLE');
  assert.strictEqual(warrior.ultCharge, 100, 'ultCharge must NOT be wiped if ultimate fails to activate');
  assert.strictEqual(warrior.warriorState.avatarActive, true, 'avatarActive state must be preserved');
  assert.strictEqual(warrior.warriorState.avatarTimer, 10.0, 'avatarTimer must remain active');
});


