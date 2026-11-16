'use strict';

// ─── SHOP ITEMS ───────────────────────────────────────────────────────────────
// 18 items across HUMAN, WARRIOR, MAGE and ALL classes.
// stackMax: Common→5, Rare→3, Epic→2, Legendary→1
const SHOP_ITEMS = {
  // ── HUMAN CLASS (4 items) ──────────────────────────────────────────────────
  BANDOLIER: {
    id: 'BANDOLIER',
    name: 'Băng Đạn Chiến Thuật',
    icon: 'assets/items/bandolier.svg',
    rarity: 'Rare',
    price: 40,
    stackMax: 3,
    classes: ['HUMAN'],
    statBonuses: { maxAmmoBonus: 30 },
    description: 'Băng đạn chiến thuật — +30% max ammo tất cả súng',
  },
  HOLLOW_BULLETS: {
    id: 'HOLLOW_BULLETS',
    name: 'Đầu Đạn Rỗng',
    icon: 'assets/items/hollow_bullets.svg',
    rarity: 'Epic',
    price: 70,
    stackMax: 2,
    classes: ['HUMAN'],
    statBonuses: { critChance: 15, damageBonus: 8 },
    description: 'Đầu đạn rỗng — +15% crit, +8% damage',
  },
  LASER_SIGHT: {
    id: 'LASER_SIGHT',
    name: 'Kính Ngắm Laser',
    icon: 'assets/items/laser_sight.svg',
    rarity: 'Rare',
    price: 35,
    stackMax: 3,
    classes: ['HUMAN'],
    statBonuses: { attackSpeedBonus: 20, rangeBonus: 15 },
    description: 'Kính ngắm laser — +20% tốc độ bắn, +15% tầm bắn',
  },
  DRONE_CHIP: {
    id: 'DRONE_CHIP',
    name: 'Chip Điều Khiển Drone',
    icon: 'assets/items/drone_chip.svg',
    rarity: 'Legendary',
    price: 120,
    stackMax: 1,
    classes: ['HUMAN'],
    statBonuses: { pickupRange: 80, damageBonus: 12 },
    description: 'Chip điều khiển drone — +80px pickup range, +12% damage',
    passive: 'drone_assist',
  },

  // ── WARRIOR CLASS (4 items) ────────────────────────────────────────────────
  SPIKED_GAUNTLET: {
    id: 'SPIKED_GAUNTLET',
    name: 'Găng Tay Gai',
    icon: 'assets/items/spiked_gauntlet.svg',
    rarity: 'Common',
    price: 20,
    stackMax: 5,
    classes: ['WARRIOR'],
    statBonuses: { meleeDamageBonus: 15 },
    description: 'Găng tay gai — +15% melee damage',
  },
  TITAN_PLATE: {
    id: 'TITAN_PLATE',
    name: 'Giáp Titan',
    icon: 'assets/items/titan_plate.svg',
    rarity: 'Rare',
    price: 45,
    stackMax: 3,
    classes: ['WARRIOR'],
    statBonuses: { armor: 8, maxHpBonus: 20 },
    description: 'Giáp Titan — +8 armor, +20 HP tối đa',
  },
  WAR_HORN: {
    id: 'WAR_HORN',
    name: 'Tù Và Chiến Tranh',
    icon: 'assets/items/war_horn.svg',
    rarity: 'Epic',
    price: 75,
    stackMax: 2,
    classes: ['WARRIOR'],
    statBonuses: { warCryDuration: 3, attackSpeedBonus: 10 },
    description: 'Tù và chiến tranh — +3s War Cry, +10% tốc độ',
    passive: 'war_cry',
  },
  BLOODLUST_AXE: {
    id: 'BLOODLUST_AXE',
    name: 'Búa Khát Máu',
    icon: 'assets/items/bloodlust_axe.svg',
    rarity: 'Legendary',
    price: 110,
    stackMax: 1,
    classes: ['WARRIOR'],
    statBonuses: { lifeSteal: 20, meleeDamageBonus: 25 },
    description: 'Búa khát máu — +20% life steal, +25% melee damage',
    passive: 'bloodlust',
  },

  // ── MAGE CLASS (4 items) ───────────────────────────────────────────────────
  MANA_CRYSTAL: {
    id: 'MANA_CRYSTAL',
    name: 'Tinh Thể Mana',
    icon: 'assets/items/mana_crystal.svg',
    rarity: 'Common',
    price: 18,
    stackMax: 5,
    classes: ['MAGE'],
    statBonuses: { maxManaBonus: 20, manaRegenBonus: 2 },
    description: 'Tinh thể mana — +20 max mana, +2/s mana regen',
  },
  FROST_RING: {
    id: 'FROST_RING',
    name: 'Nhẫn Băng Giá',
    icon: 'assets/items/frost_ring.svg',
    rarity: 'Rare',
    price: 40,
    stackMax: 3,
    classes: ['MAGE'],
    statBonuses: { freezeDuration: 1.5, aoeBonus: 10 },
    description: 'Nhẫn băng giá — +1.5s freeze, +10% AoE',
    passive: 'freeze_on_hit',
  },
  FIRE_ORB: {
    id: 'FIRE_ORB',
    name: 'Cầu Lửa',
    icon: 'assets/items/fire_orb.svg',
    rarity: 'Epic',
    price: 68,
    stackMax: 2,
    classes: ['MAGE'],
    statBonuses: { damageBonus: 18, critChance: 10 },
    description: 'Cầu lửa — +18% damage, +10% crit',
    passive: 'fire_trail',
  },
  ARCANE_SCROLL: {
    id: 'ARCANE_SCROLL',
    name: 'Cuộn Phép Cổ Đại',
    icon: 'assets/items/arcane_scroll.svg',
    rarity: 'Legendary',
    price: 115,
    stackMax: 1,
    classes: ['MAGE'],
    statBonuses: { cooldownReduction: 25, damageBonus: 20 },
    description: 'Cuộn phép cổ đại — -25% cooldown, +20% damage',
    passive: 'arcane_mastery',
  },

  // ── TACTICAL / CO-OP — ALL CLASSES (6 items) ──────────────────────────────
  COMBAT_MEDKIT: {
    id: 'COMBAT_MEDKIT',
    name: 'Hộp Y Tế',
    icon: 'assets/items/combat_medkit.svg',
    rarity: 'Common',
    price: 15,
    stackMax: 5,
    classes: ['ALL'],
    statBonuses: { hpRegen: 3 },
    description: 'Hộp y tế — +3 HP regen mỗi 5 giây',
  },
  BIO_SERUM: {
    id: 'BIO_SERUM',
    name: 'Huyết Thanh Sinh Học',
    icon: 'assets/items/bio_serum.svg',
    rarity: 'Rare',
    price: 38,
    stackMax: 3,
    classes: ['ALL'],
    statBonuses: { lifeSteal: 10, hpRegen: 2 },
    description: 'Huyết thanh sinh học — +10% lifesteal, +2 HP regen',
  },
  REINFORCED_WOOD: {
    id: 'REINFORCED_WOOD',
    name: 'Gỗ Gia Cố',
    icon: 'assets/items/reinforced_wood.svg',
    rarity: 'Common',
    price: 12,
    stackMax: 5,
    classes: ['ALL'],
    statBonuses: { maxHpBonus: 15, armor: 2 },
    description: 'Gỗ gia cố — +15 max HP, +2 armor',
  },
  ENERGY_VACUUM: {
    id: 'ENERGY_VACUUM',
    name: 'Hút Năng Lượng',
    icon: 'assets/items/energy_vacuum.svg',
    rarity: 'Rare',
    price: 42,
    stackMax: 3,
    classes: ['ALL'],
    statBonuses: { pickupRange: 50, materialBonus: 15 },
    description: 'Hút năng lượng — +50px pickup range, +15% materials',
  },
  DEFIBRILLATOR: {
    id: 'DEFIBRILLATOR',
    name: 'Máy Sốc Tim',
    icon: 'assets/items/defibrillator.svg',
    rarity: 'Epic',
    price: 65,
    stackMax: 2,
    classes: ['ALL'],
    statBonuses: { reviveSpeedBonus: 50, maxHpBonus: 10 },
    description: 'Máy sốc tim — cứu đồng đội 50% nhanh hơn, +10 HP',
    passive: 'emergency_revive',
  },
  NITRO_TANK: {
    id: 'NITRO_TANK',
    name: 'Bình Nitro',
    icon: 'assets/items/nitro_tank.svg',
    rarity: 'Rare',
    price: 36,
    stackMax: 3,
    classes: ['ALL'],
    statBonuses: { speedBonus: 15, dodge: 5 },
    description: 'Bình nitro — +15% tốc độ di chuyển, +5% dodge',
  },
};

// ─── WAVE RARITY TABLE ────────────────────────────────────────────────────────
// 20 entries, index = wave - 1. Each entry must sum to 1.0.
//
// Wave  1– 3: Common 60%, Rare 35%, Epic  5%, Legendary  0%
// Wave  4– 6: Common 45%, Rare 35%, Epic 15%, Legendary  5%
// Wave  7–10: Common 25%, Rare 35%, Epic 25%, Legendary 15%
// Wave 11–15: Common 10%, Rare 30%, Epic 35%, Legendary 25%
// Wave 16–20: Common  5%, Rare 20%, Epic 35%, Legendary 40%
const WAVE_RARITY_TABLE = [
  // Wave 1
  { Common: 0.60, Rare: 0.35, Epic: 0.05, Legendary: 0.00 },
  // Wave 2
  { Common: 0.60, Rare: 0.35, Epic: 0.05, Legendary: 0.00 },
  // Wave 3
  { Common: 0.60, Rare: 0.35, Epic: 0.05, Legendary: 0.00 },
  // Wave 4
  { Common: 0.45, Rare: 0.35, Epic: 0.15, Legendary: 0.05 },
  // Wave 5
  { Common: 0.45, Rare: 0.35, Epic: 0.15, Legendary: 0.05 },
  // Wave 6
  { Common: 0.45, Rare: 0.35, Epic: 0.15, Legendary: 0.05 },
  // Wave 7
  { Common: 0.25, Rare: 0.35, Epic: 0.25, Legendary: 0.15 },
  // Wave 8
  { Common: 0.25, Rare: 0.35, Epic: 0.25, Legendary: 0.15 },
  // Wave 9
  { Common: 0.25, Rare: 0.35, Epic: 0.25, Legendary: 0.15 },
  // Wave 10
  { Common: 0.25, Rare: 0.35, Epic: 0.25, Legendary: 0.15 },
  // Wave 11
  { Common: 0.10, Rare: 0.30, Epic: 0.35, Legendary: 0.25 },
  // Wave 12
  { Common: 0.10, Rare: 0.30, Epic: 0.35, Legendary: 0.25 },
  // Wave 13
  { Common: 0.10, Rare: 0.30, Epic: 0.35, Legendary: 0.25 },
  // Wave 14
  { Common: 0.10, Rare: 0.30, Epic: 0.35, Legendary: 0.25 },
  // Wave 15
  { Common: 0.10, Rare: 0.30, Epic: 0.35, Legendary: 0.25 },
  // Wave 16
  { Common: 0.05, Rare: 0.20, Epic: 0.35, Legendary: 0.40 },
  // Wave 17
  { Common: 0.05, Rare: 0.20, Epic: 0.35, Legendary: 0.40 },
  // Wave 18
  { Common: 0.05, Rare: 0.20, Epic: 0.35, Legendary: 0.40 },
  // Wave 19
  { Common: 0.05, Rare: 0.20, Epic: 0.35, Legendary: 0.40 },
  // Wave 20
  { Common: 0.05, Rare: 0.20, Epic: 0.35, Legendary: 0.40 },
];

// ─── SHOP CONSTANTS ───────────────────────────────────────────────────────────
const SHOP_CONFIG = {
  /** Number of item cards shown per shop open / reroll */
  SLOTS_PER_ROLL: 4,
  /** Base material cost to reroll the shop */
  REROLL_BASE_COST: 1,
  /** Additional cost added per reroll within the same wave */
  REROLL_COST_INCREMENT: 1,
  /** Fraction of base price returned when recycling an item */
  RECYCLE_REFUND_RATIO: 0.5,
  /** Maximum item slots in a player's inventory */
  MAX_INVENTORY_SLOTS: 18,
  /** Price multiplier increase per wave (8 % per wave) */
  PRICE_INFLATION_PER_WAVE: 0.08,
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Pick a rarity string for the given wave using the probability table.
 *
 * @param {number} wave  1-based wave number (clamped to 1–20)
 * @returns {'Common'|'Rare'|'Epic'|'Legendary'}
 */
function getRarityForWave(wave) {
  const idx = Math.max(0, Math.min(19, wave - 1));
  const weights = WAVE_RARITY_TABLE[idx];
  const roll = Math.random();

  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) return rarity;
  }
  // Floating-point safety: return last non-zero rarity
  return 'Legendary';
}

/**
 * Roll 4 shop items for a player.
 *
 * @param {number} wave         Current wave number (1-based)
 * @param {string} playerClass  'HUMAN' | 'WARRIOR' | 'MAGE'
 * @param {Object} ownedItems   Map of { [itemId]: stackCount } the player already owns
 * @returns {Object[]}          Array of up to 4 item objects, each with `currentPrice` added
 */
function rollShopItems(wave, playerClass, ownedItems = {}) {
  const slots = [];
  const allItems = Object.values(SHOP_ITEMS);

  for (let i = 0; i < SHOP_CONFIG.SLOTS_PER_ROLL; i++) {
    const rarity = getRarityForWave(wave);

    // Filter: correct rarity + accessible class + not at stack cap
    let pool = allItems.filter((item) => {
      const classOk =
        item.classes.includes(playerClass) || item.classes.includes('ALL');
      const ownedCount = ownedItems[item.id] || 0;
      const notCapped = ownedCount < item.stackMax;
      return item.rarity === rarity && classOk && notCapped;
    });

    // Fallback: ignore rarity restriction but keep class + stack filters
    if (pool.length === 0) {
      pool = allItems.filter((item) => {
        const classOk =
          item.classes.includes(playerClass) || item.classes.includes('ALL');
        const ownedCount = ownedItems[item.id] || 0;
        return classOk && ownedCount < item.stackMax;
      });
    }

    if (pool.length === 0) {
      // Edge case: player owns everything at max stack — skip slot
      continue;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];
    const inflationMultiplier =
      1 + SHOP_CONFIG.PRICE_INFLATION_PER_WAVE * (wave - 1);
    const currentPrice = Math.round(picked.price * inflationMultiplier);

    slots.push({ ...picked, currentPrice });
  }

  return slots;
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  SHOP_ITEMS,
  WAVE_RARITY_TABLE,
  SHOP_CONFIG,
  getRarityForWave,
  rollShopItems,
};
