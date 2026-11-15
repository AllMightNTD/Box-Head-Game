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
