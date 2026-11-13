const MAPS = {
  THE_ROOMS: {
    id: 'THE_ROOMS',
    name: 'Phòng Thí Nghiệm',
    subtitle: 'The Rooms - Classic Boxhead',
    desc: 'Đấu trường công nghiệp kinh điển với 4 cột đá đối xứng và hành lang chẹt quái vật.',
    badge: '🏢 KINH ĐIỂN',
    badgeColor: '#00e5ff',
    width: 1600,
    height: 1200,
    boundaryThickness: 40,
    theme: {
      floorColor: '#22252a',
      gridColor: '#2b2f36',
      wallSide: '#2e343d',
      wallTop: '#454d59',
      wallBorder: '#181b20',
      pillarSide: '#3d444f',
      pillarTop: '#5a6372',
      pillarBorder: '#181b20',
      ambient: 'normal'
    },
    walls: [
      { x: 0, y: 0, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 1160, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 0, w: 40, h: 1200, type: 'boundary' },
      { x: 1560, y: 0, w: 40, h: 1200, type: 'boundary' },
      { x: 420, y: 320, w: 140, h: 140, type: 'pillar' },
      { x: 1040, y: 320, w: 140, h: 140, type: 'pillar' },
      { x: 420, y: 740, w: 140, h: 140, type: 'pillar' },
      { x: 1040, y: 740, w: 140, h: 140, type: 'pillar' },
      { x: 730, y: 220, w: 140, h: 50, type: 'pillar' },
      { x: 730, y: 930, w: 140, h: 50, type: 'pillar' }
    ],
    playerSpawns: [
      { x: 740, y: 550 },
      { x: 860, y: 550 },
      { x: 740, y: 650 },
      { x: 860, y: 650 }
    ],
    zombieSpawns: [
      { x: 100, y: 80 },
      { x: 800, y: 80 },
      { x: 1500, y: 80 },
      { x: 1520, y: 600 },
      { x: 1500, y: 1120 },
      { x: 800, y: 1120 },
      { x: 100, y: 1120 },
      { x: 80, y: 600 }
    ]
  },

  DESERT: {
    id: 'DESERT',
    name: 'Sa Mạc Bão Cát',
    subtitle: 'The Dunes - Sa Mạc Cát Cháy',
    desc: 'Môi trường cát vàng với tàn tích đền thờ cổ, đồi cát lộng gió và các khối sa thạch kiên cố.',
    badge: '🏜️ SA MẠC',
    badgeColor: '#f4a261',
    width: 1600,
    height: 1200,
    boundaryThickness: 40,
    theme: {
      floorColor: '#d4a373',
      gridColor: '#c6925c',
      wallSide: '#8c5836',
      wallTop: '#e0a96d',
      wallBorder: '#5c3820',
      pillarSide: '#a06d48',
      pillarTop: '#f4a261',
      pillarBorder: '#5c3820',
      ambient: 'sand'
    },
    walls: [
      { x: 0, y: 0, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 1160, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 0, w: 40, h: 1200, type: 'boundary' },
      { x: 1560, y: 0, w: 40, h: 1200, type: 'boundary' },
      // Central Temple Corner Monoliths
      { x: 670, y: 460, w: 70, h: 70, type: 'pillar' },
      { x: 860, y: 460, w: 70, h: 70, type: 'pillar' },
      { x: 670, y: 670, w: 70, h: 70, type: 'pillar' },
      { x: 860, y: 670, w: 70, h: 70, type: 'pillar' },
      // West Outpost Ruins
      { x: 260, y: 280, w: 50, h: 220, type: 'pillar' },
      { x: 260, y: 280, w: 180, h: 50, type: 'pillar' },
      // East Outpost Ruins
      { x: 1160, y: 650, w: 180, h: 50, type: 'pillar' },
      { x: 1290, y: 650, w: 50, h: 220, type: 'pillar' },
      // Natural Rock Formations
      { x: 340, y: 780, w: 130, h: 130, type: 'pillar' },
      { x: 1130, y: 280, w: 130, h: 130, type: 'pillar' },
      // North & South Gates
      { x: 740, y: 140, w: 120, h: 70, type: 'pillar' },
      { x: 740, y: 990, w: 120, h: 70, type: 'pillar' }
    ],
    playerSpawns: [
      { x: 770, y: 570 },
      { x: 830, y: 570 },
      { x: 770, y: 630 },
      { x: 830, y: 630 }
    ],
    zombieSpawns: [
      { x: 120, y: 100 },
      { x: 800, y: 80 },
      { x: 1480, y: 100 },
      { x: 1510, y: 600 },
      { x: 1480, y: 1100 },
      { x: 800, y: 1120 },
      { x: 120, y: 1100 },
      { x: 90, y: 600 }
    ]
  },

  SNOW: {
    id: 'SNOW',
    name: 'Băng Đảo Bắc Cực',
    subtitle: 'Frostbite - Băng Giá Vĩnh Cửu',
    desc: 'Mặt đất phủ đầy tuyết trắng, các khối tinh thể băng xanh buốt và hẻm núi trơn trượt đầy thử thách.',
    badge: '❄️ BĂNG TUYẾT',
    badgeColor: '#29b6f6',
    width: 1600,
    height: 1200,
    boundaryThickness: 40,
    theme: {
      floorColor: '#e3eff5',
      gridColor: '#cbe0ea',
      wallSide: '#455a64',
      wallTop: '#b0bec5',
      wallBorder: '#263238',
      pillarSide: '#0288d1',
      pillarTop: '#81d4fa',
      pillarBorder: '#01579b',
      ambient: 'snow'
    },
    walls: [
      { x: 0, y: 0, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 1160, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 0, w: 40, h: 1200, type: 'boundary' },
      { x: 1560, y: 0, w: 40, h: 1200, type: 'boundary' },
      // 4 Giant Ice Peaks
      { x: 360, y: 300, w: 130, h: 130, type: 'pillar' },
      { x: 1110, y: 300, w: 130, h: 130, type: 'pillar' },
      { x: 360, y: 770, w: 130, h: 130, type: 'pillar' },
      { x: 1110, y: 770, w: 130, h: 130, type: 'pillar' },
      // Glacier Ridges & Funnels
      { x: 720, y: 360, w: 160, h: 60, type: 'pillar' },
      { x: 720, y: 780, w: 160, h: 60, type: 'pillar' },
      { x: 500, y: 570, w: 70, h: 70, type: 'pillar' },
      { x: 1030, y: 570, w: 70, h: 70, type: 'pillar' },
      { x: 160, y: 530, w: 80, h: 140, type: 'pillar' },
      { x: 1360, y: 530, w: 80, h: 140, type: 'pillar' }
    ],
    playerSpawns: [
      { x: 760, y: 560 },
      { x: 840, y: 560 },
      { x: 760, y: 640 },
      { x: 840, y: 640 }
    ],
    zombieSpawns: [
      { x: 100, y: 80 },
      { x: 800, y: 80 },
      { x: 1500, y: 80 },
      { x: 1520, y: 600 },
      { x: 1500, y: 1120 },
      { x: 800, y: 1120 },
      { x: 100, y: 1120 },
      { x: 80, y: 600 }
    ]
  },

  VOLCANO: {
    id: 'VOLCANO',
    name: 'Hỏa Ngục Núi Lửa',
    subtitle: 'Inferno Pit - Miệng Núi Lửa',
    desc: 'Đá bazan hắc diện thạch, hồ dung nham rực lửa và tàn tro bay lượn trên chiến trường sinh tử.',
    badge: '🌋 NÚI LỬA',
    badgeColor: '#ff3d00',
    width: 1600,
    height: 1200,
    boundaryThickness: 40,
    theme: {
      floorColor: '#191518',
      gridColor: '#2c1c20',
      wallSide: '#261517',
      wallTop: '#4e2729',
      wallBorder: '#100507',
      pillarSide: '#c62828',
      pillarTop: '#ff3d00',
      pillarBorder: '#ffd600',
      ambient: 'embers'
    },
    walls: [
      { x: 0, y: 0, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 1160, w: 1600, h: 40, type: 'boundary' },
      { x: 0, y: 0, w: 40, h: 1200, type: 'boundary' },
      { x: 1560, y: 0, w: 40, h: 1200, type: 'boundary' },
      // Central Giant Obsidian Caldera
      { x: 710, y: 490, w: 180, h: 220, type: 'pillar' },
      // 4 Basalt Fortress Bastions
      { x: 380, y: 270, w: 130, h: 130, type: 'pillar' },
      { x: 1090, y: 270, w: 130, h: 130, type: 'pillar' },
      { x: 380, y: 800, w: 130, h: 130, type: 'pillar' },
      { x: 1090, y: 800, w: 130, h: 130, type: 'pillar' },
      // Magma Spire Chokepoints
      { x: 500, y: 570, w: 90, h: 60, type: 'pillar' },
      { x: 1010, y: 570, w: 90, h: 60, type: 'pillar' },
      { x: 740, y: 160, w: 120, h: 80, type: 'pillar' },
      { x: 740, y: 960, w: 120, h: 80, type: 'pillar' }
    ],
    playerSpawns: [
      { x: 620, y: 600 },
      { x: 980, y: 600 },
      { x: 800, y: 410 },
      { x: 800, y: 790 }
    ],
    zombieSpawns: [
      { x: 100, y: 80 },
      { x: 800, y: 80 },
      { x: 1500, y: 80 },
      { x: 1520, y: 600 },
      { x: 1500, y: 1120 },
      { x: 800, y: 1120 },
      { x: 100, y: 1120 },
      { x: 80, y: 600 }
    ]
  }
};

const DEFAULT_MAP_ID = 'THE_ROOMS';

function getMapConfig(mapId) {
  return MAPS[mapId] || MAPS[DEFAULT_MAP_ID];
}

function getMapList() {
  return Object.values(MAPS).map(m => ({
    id: m.id,
    name: m.name,
    subtitle: m.subtitle,
    desc: m.desc,
    badge: m.badge,
    badgeColor: m.badgeColor,
    theme: m.theme
  }));
}

module.exports = {
  MAPS,
  DEFAULT_MAP_ID,
  getMapConfig,
  getMapList
};
