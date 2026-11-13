const WEAPONS = {
  PISTOL: {
    id: 'PISTOL',
    slot: 1,
    name: 'Pistol',
    unlockCombo: 1,
    type: 'bullet',
    damage: 25,
    fireRate: 3.5, // shots per second
    fireDelay: 1 / 3.5,
    bulletSpeed: 900,
    range: 1200,
    maxAmmo: Infinity,
    startingAmmo: Infinity,
    knockback: 60,
    color: '#ffff00'
  },
  UZI: {
    id: 'UZI',
    slot: 2,
    name: 'Uzi',
    unlockCombo: 5,
    type: 'bullet',
    damage: 18,
    fireRate: 9.0,
    fireDelay: 1 / 9.0,
    bulletSpeed: 950,
    range: 1000,
    maxAmmo: 250,
    startingAmmo: 120,
    spread: 0.12,
    knockback: 40,
    color: '#ffaa00'
  },
  SHOTGUN: {
    id: 'SHOTGUN',
    slot: 3,
    name: 'Shotgun',
    unlockCombo: 10,
    type: 'shotgun',
    damage: 20, // per pellet
    pellets: 6,
    spread: 0.35,
    fireRate: 1.6,
    fireDelay: 1 / 1.6,
    bulletSpeed: 850,
    range: 650,
    maxAmmo: 60,
    startingAmmo: 30,
    knockback: 180,
    color: '#ff8800'
  },
  BARRICADE: {
    id: 'BARRICADE',
    slot: 4,
    name: 'Barricade',
    unlockCombo: 15,
    type: 'placeable_wall',
    hp: 300,
    fireRate: 2.5,
    fireDelay: 1 / 2.5,
    maxAmmo: 15,
    startingAmmo: 6,
    size: 40,
    color: '#8b5a2b'
  },
  BARREL: {
    id: 'BARREL',
    slot: 5,
    name: 'Explosive Barrel',
    unlockCombo: 20,
    type: 'placeable_barrel',
    hp: 40,
    fireRate: 2.0,
    fireDelay: 1 / 2.0,
    maxAmmo: 10,
    startingAmmo: 4,
    radius: 20,
    explosionRadius: 150,
    explosionDamage: 250,
    color: '#cc1111'
  },
  GRENADE: {
    id: 'GRENADE',
    slot: 6,
    name: 'Grenade',
    unlockCombo: 30,
    type: 'grenade',
    damage: 200,
    fireRate: 1.2,
    fireDelay: 1 / 1.2,
    throwSpeed: 550,
    fuseTime: 1.2, // seconds
    maxAmmo: 20,
    startingAmmo: 8,
    explosionRadius: 130,
    color: '#2e7d32'
  },
  ROCKET: {
    id: 'ROCKET',
    slot: 7,
    name: 'Rocket Launcher',
    unlockCombo: 40,
    type: 'rocket',
    damage: 350,
    fireRate: 0.8,
    fireDelay: 1 / 0.8,
    bulletSpeed: 600,
    maxAmmo: 15,
    startingAmmo: 6,
    explosionRadius: 180,
    knockback: 250,
    color: '#e65100'
  },
  RAILGUN: {
    id: 'RAILGUN',
    slot: 8,
    name: 'Railgun',
    unlockCombo: 50,
    type: 'railgun',
    damage: 500,
    fireRate: 0.5,
    fireDelay: 1 / 0.5,
    maxAmmo: 10,
    startingAmmo: 4,
    penetration: true,
    range: 2000,
    color: '#00e5ff'
  }
};

function getUnlockedWeapons(combo) {
  return Object.values(WEAPONS).filter(w => combo >= w.unlockCombo);
}

function getWeaponById(id) {
  return WEAPONS[id] || WEAPONS.PISTOL;
}

module.exports = { WEAPONS, getUnlockedWeapons, getWeaponById };
