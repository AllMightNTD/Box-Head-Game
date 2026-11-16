const MAGE_SKILL_DEFINITIONS = [
  { id: 'ARCANE_BOLT', key: 1, name: 'Tia Ma Pháp', unlockCombo: 1, manaCost: 0, icon: '✨' },
  { id: 'FROST_NOVA', key: 2, name: 'Băng Giá', unlockCombo: 5, manaCost: 10, icon: '❄️' },
  { id: 'CHAIN_LIGHTNING', key: 3, name: 'Lôi Điện', unlockCombo: 10, manaCost: 30, icon: '⚡' },
  { id: 'FIREBALL', key: 4, name: 'Hỏa Cầu', unlockCombo: 15, manaCost: 35, icon: '🔥' },
  { id: 'ARCANE_TELEPORT', key: 5, name: 'Dịch Chuyển', unlockCombo: 20, manaCost: 25, icon: '🌀' },
  { id: 'SANCTUARY_HEAL', key: 6, name: 'Thánh Vực', unlockCombo: 30, manaCost: 35, icon: '💠' },
  { id: 'MANA_SHIELD', key: 7, name: 'Khiên Mana', unlockCombo: 40, manaCost: 15, icon: '🛡️' },
  { id: 'METEOR_STORM', key: 8, name: 'Thiên Thạch', unlockCombo: 1, manaCost: 100, icon: '☄️' }
];

const WARRIOR_SKILL_DEFINITIONS = [
  { id: 'BERSERKER_STANCE', key: 1, name: 'Berserker', unlockCombo: 1, icon: '⚔️', badge: 'x1' },
  { id: 'JUGGERNAUT_STANCE', key: 2, name: 'Juggernaut', unlockCombo: 5, icon: '🛡️', badge: 'x5' },
  { id: 'BLADE_WHIRLWIND', key: 3, name: 'Whirlwind', unlockCombo: 10, icon: '🌪️', badge: 'x10' },
  { id: 'SHADOW_DASH_SLASH', key: 4, name: 'Shadow Dash', unlockCombo: 15, icon: '⚡', badge: 'x15' },
  { id: 'SEISMIC_SLAM', key: 5, name: 'Seismic Slam', unlockCombo: 20, icon: '💥', badge: 'x20' },
  { id: 'WAR_CRY', key: 6, name: 'War Cry', unlockCombo: 30, icon: '📢', badge: 'x30' },
  { id: 'COUNTER_SHIELD_BASH', key: 7, name: 'Counter Shield', unlockCombo: 40, icon: '🔰', badge: 'x40' },
  { id: 'AVATAR_OF_WAR', key: 8, name: 'Avatar of War', unlockCombo: 50, icon: '🔥', badge: 'x50' }
];

const DEFAULT_SHOP_ITEMS = {
  BANDOLIER: { id: 'BANDOLIER', name: 'Băng Đạn Chiến Thuật', icon: 'assets/items/bandolier.svg', rarity: 'Rare', price: 40, stackMax: 3, classes: ['HUMAN'], statBonuses: { maxAmmoBonus: 30 }, description: 'Băng đạn chiến thuật — +30% max ammo tất cả súng' },
  HOLLOW_BULLETS: { id: 'HOLLOW_BULLETS', name: 'Đầu Đạn Rỗng', icon: 'assets/items/hollow_bullets.svg', rarity: 'Epic', price: 70, stackMax: 2, classes: ['HUMAN'], statBonuses: { critChance: 15, damageBonus: 8 }, description: 'Đầu đạn rỗng — +15% crit, +8% damage' },
  LASER_SIGHT: { id: 'LASER_SIGHT', name: 'Kính Ngắm Laser', icon: 'assets/items/laser_sight.svg', rarity: 'Rare', price: 35, stackMax: 3, classes: ['HUMAN'], statBonuses: { attackSpeedBonus: 20, rangeBonus: 15 }, description: 'Kính ngắm laser — +20% tốc độ bắn, +15% tầm bắn' },
  DRONE_CHIP: { id: 'DRONE_CHIP', name: 'Chip Điều Khiển Drone', icon: 'assets/items/drone_chip.svg', rarity: 'Legendary', price: 120, stackMax: 1, classes: ['HUMAN'], statBonuses: { pickupRange: 80, damageBonus: 12 }, description: 'Chip điều khiển drone — +80px pickup range, +12% damage', passive: 'drone_assist' },
  SPIKED_GAUNTLET: { id: 'SPIKED_GAUNTLET', name: 'Găng Tay Gai', icon: 'assets/items/spiked_gauntlet.svg', rarity: 'Common', price: 20, stackMax: 5, classes: ['WARRIOR'], statBonuses: { meleeDamageBonus: 15 }, description: 'Găng tay gai — +15% melee damage' },
  TITAN_PLATE: { id: 'TITAN_PLATE', name: 'Giáp Titan', icon: 'assets/items/titan_plate.svg', rarity: 'Rare', price: 45, stackMax: 3, classes: ['WARRIOR'], statBonuses: { armor: 8, maxHpBonus: 20 }, description: 'Giáp Titan — +8 armor, +20 HP tối đa' },
  WAR_HORN: { id: 'WAR_HORN', name: 'Tù Và Chiến Tranh', icon: 'assets/items/war_horn.svg', rarity: 'Epic', price: 75, stackMax: 2, classes: ['WARRIOR'], statBonuses: { warCryDuration: 3, attackSpeedBonus: 10 }, description: 'Tù và chiến tranh — +3s War Cry, +10% tốc độ', passive: 'war_cry' },
  BLOODLUST_AXE: { id: 'BLOODLUST_AXE', name: 'Búa Khát Máu', icon: 'assets/items/bloodlust_axe.svg', rarity: 'Legendary', price: 110, stackMax: 1, classes: ['WARRIOR'], statBonuses: { lifeSteal: 20, meleeDamageBonus: 25 }, description: 'Búa khát máu — +20% life steal, +25% melee damage', passive: 'bloodlust' },
  MANA_CRYSTAL: { id: 'MANA_CRYSTAL', name: 'Tinh Thể Mana', icon: 'assets/items/mana_crystal.svg', rarity: 'Common', price: 18, stackMax: 5, classes: ['MAGE'], statBonuses: { maxManaBonus: 20, manaRegenBonus: 2 }, description: 'Tinh thể mana — +20 max mana, +2/s mana regen' },
  FROST_RING: { id: 'FROST_RING', name: 'Nhẫn Băng Giá', icon: 'assets/items/frost_ring.svg', rarity: 'Rare', price: 40, stackMax: 3, classes: ['MAGE'], statBonuses: { freezeDuration: 1.5, aoeBonus: 10 }, description: 'Nhẫn băng giá — +1.5s freeze, +10% AoE', passive: 'freeze_on_hit' },
  FIRE_ORB: { id: 'FIRE_ORB', name: 'Cầu Lửa', icon: 'assets/items/fire_orb.svg', rarity: 'Epic', price: 68, stackMax: 2, classes: ['MAGE'], statBonuses: { damageBonus: 18, critChance: 10 }, description: 'Cầu lửa — +18% damage, +10% crit', passive: 'fire_trail' },
  ARCANE_SCROLL: { id: 'ARCANE_SCROLL', name: 'Cuộn Phép Cổ Đại', icon: 'assets/items/arcane_scroll.svg', rarity: 'Legendary', price: 115, stackMax: 1, classes: ['MAGE'], statBonuses: { cooldownReduction: 25, damageBonus: 20 }, description: 'Cuộn phép cổ đại — -25% cooldown, +20% damage', passive: 'arcane_mastery' },
  COMBAT_MEDKIT: { id: 'COMBAT_MEDKIT', name: 'Hộp Y Tế', icon: 'assets/items/combat_medkit.svg', rarity: 'Common', price: 15, stackMax: 5, classes: ['ALL'], statBonuses: { hpRegen: 3 }, description: 'Hộp y tế — +3 HP regen mỗi 5 giây' },
  BIO_SERUM: { id: 'BIO_SERUM', name: 'Huyết Thanh Sinh Học', icon: 'assets/items/bio_serum.svg', rarity: 'Rare', price: 38, stackMax: 3, classes: ['ALL'], statBonuses: { lifeSteal: 10, hpRegen: 2 }, description: 'Huyết thanh sinh học — +10% lifesteal, +2 HP regen' },
  REINFORCED_WOOD: { id: 'REINFORCED_WOOD', name: 'Gỗ Gia Cố', icon: 'assets/items/reinforced_wood.svg', rarity: 'Common', price: 12, stackMax: 5, classes: ['ALL'], statBonuses: { maxHpBonus: 15, armor: 2 }, description: 'Gỗ gia cố — +15 max HP, +2 armor' },
  ENERGY_VACUUM: { id: 'ENERGY_VACUUM', name: 'Hút Năng Lượng', icon: 'assets/items/energy_vacuum.svg', rarity: 'Rare', price: 42, stackMax: 3, classes: ['ALL'], statBonuses: { pickupRange: 50, materialBonus: 15 }, description: 'Hút năng lượng — +50px pickup range, +15% materials' },
  DEFIBRILLATOR: { id: 'DEFIBRILLATOR', name: 'Máy Sốc Tim', icon: 'assets/items/defibrillator.svg', rarity: 'Epic', price: 65, stackMax: 2, classes: ['ALL'], statBonuses: { reviveSpeedBonus: 50, maxHpBonus: 10 }, description: 'Máy sốc tim — cứu đồng đội 50% nhanh hơn, +10 HP', passive: 'emergency_revive' },
  NITRO_TANK: { id: 'NITRO_TANK', name: 'Bình Nitro', icon: 'assets/items/nitro_tank.svg', rarity: 'Rare', price: 36, stackMax: 3, classes: ['ALL'], statBonuses: { speedBonus: 15, dodge: 5 }, description: 'Bình nitro — +15% tốc độ di chuyển, +5% dodge' }
};

class UIController {
  constructor(socket = null) {
    this.screenLobby = document.getElementById('screen-lobby');
    this.screenRoom = document.getElementById('screen-room');
    this.hud = document.getElementById('hud');
    this.modalGameOver = document.getElementById('modal-gameover');
    this.modalPause = document.getElementById('modal-pause');
    this.modalMapPreview = document.getElementById('modal-map-preview');
    this.copyToast = document.getElementById('copy-toast');

    // Inter-wave Shop Overlay elements
    this.modalShop = document.getElementById('modal-shop');
    this.shopCardsContainer = document.getElementById('shop-cards-container');
    this.shopMaterialsCount = document.getElementById('shop-materials-count');
    this.hudMaterialsCount = document.getElementById('hud-materials-count');
    this.btnShopReroll = document.getElementById('btn-shop-reroll');
    this.shopRerollCost = document.getElementById('shop-reroll-cost');
    this.btnShopReady = document.getElementById('btn-shop-ready');
    this.shopReadyCount = document.getElementById('shop-ready-count');
    this.shopInventoryGrid = document.getElementById('shop-inventory-grid');
    this.shopInventoryCount = document.getElementById('shop-inventory-count');
    this.shopWaveTag = document.getElementById('shop-wave-tag');

    this.isShopOpen = false;
    this.currentShopData = null;
    this.currentMaterials = 0;
    this.playerIsReady = false;

    // Sockets & callbacks
    this.socket = socket || (typeof window !== 'undefined' && window.socket) || null;
    this.onBuyShopItem = null;
    this.onRerollShop = null;
    this.onRecycleItem = null;
    this.onPlayerReady = null;

    this.lanIpDisplay = document.getElementById('lan-ip-display');
    this.nicknameInput = document.getElementById('nickname-input');
    this.roomNameInput = document.getElementById('room-name-input');
    this.roomsListBody = document.getElementById('rooms-list-body');

    // Map selection elements
    this.mapSelectionGrid = document.getElementById('map-selection-grid');
    this.selectedMapNameLabel = document.getElementById('selected-map-name-label');
    this.selectedMapId = (window.DEFAULT_MAP_ID || 'THE_ROOMS');

    // Room screen map banner elements
    this.roomMapBanner = document.getElementById('room-map-banner');
    this.roomMapThumbCanvas = document.getElementById('room-map-thumb-canvas');
    this.roomMapBadge = document.getElementById('room-map-badge');
    this.roomMapName = document.getElementById('room-map-name');
    this.roomMapSubtitle = document.getElementById('room-map-subtitle');
    this.roomMapDesc = document.getElementById('room-map-desc');
    this.btnChangeMap = document.getElementById('btn-change-map');
    this.btnPreviewCurrentMap = document.getElementById('btn-preview-current-map');

    // Map preview modal elements
    this.previewModalCanvas = document.getElementById('preview-modal-canvas');
    this.previewModalBadge = document.getElementById('preview-modal-badge');
    this.previewModalTitle = document.getElementById('preview-modal-title');
    this.previewModalSubtitle = document.getElementById('preview-modal-subtitle');
    this.previewModalDesc = document.getElementById('preview-modal-desc');
    this.btnCloseMapPreview = document.getElementById('btn-close-map-preview');
    this.btnSelectThisMap = document.getElementById('btn-select-this-map');
    this.previewModalMapId = null;

    // Action buttons
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.btnLeaveRoom = document.getElementById('btn-leave-room');
    this.btnCopyRoom = document.getElementById('btn-copy-room');
    this.btnReady = document.getElementById('btn-ready');
    this.btnStartGame = document.getElementById('btn-start-game');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.btnRestartGame = document.getElementById('btn-restart-game');
    this.btnBackLobby = document.getElementById('btn-back-lobby');

    this.btnResumeGame = document.getElementById('btn-resume-game');
    this.btnPauseCopy = document.getElementById('btn-pause-copy');
    this.btnPauseSound = document.getElementById('btn-pause-sound');
    this.btnPauseLeave = document.getElementById('btn-pause-leave');

    this.roomTitle = document.getElementById('room-title');
    this.playerSlotsContainer = document.getElementById('player-slots-container');
    this.charButtons = document.querySelectorAll('.char-btn');

    this.hudTeamList = document.getElementById('hud-team-list');
    this.hudWaveTitle = document.getElementById('hud-wave-title');
    this.hudWaveSub = document.getElementById('hud-wave-sub');
    this.hudComboText = document.getElementById('hud-combo-text');
    this.hudComboFill = document.getElementById('hud-combo-fill');
    this.hudWeaponsBar = document.getElementById('hud-weapons-bar');

    // Ultimate HUD elements
    this.hudUltContainer = document.getElementById('hud-ult-container');
    this.hudUltName = document.getElementById('hud-ult-name');
    this.hudUltStatus = document.getElementById('hud-ult-status');
    this.hudUltFill = document.getElementById('hud-ult-fill');
    this.hudUltHint = document.getElementById('hud-ult-hint');

    this.ultimateMeta = {
      HUMAN: { name: 'DRONE & HÀO QUANG ĐẠN', color: '#00e676' },
      WARRIOR: { name: 'HÓA THÂN CHIẾN THẦN (AVATAR)', color: '#ff3d00' },
      MAGE: { name: 'THIÊN THẠCH HỦY DIỆT', color: '#ff5722' }
    };

    this.isWarriorMode = false;
    this.isMageMode = false;
    this.warriorSkillDefinitions = WARRIOR_SKILL_DEFINITIONS;

    this.currentRoom = null;
    this.myPlayerId = null;
    this.lanIp = '';
    this.lanPort = 3000;
    this.toastTimeout = null;

    // Callback when host selects a map in room
    this.onSelectMap = null;

    this.hudBarMode = 'GUN';
    this.mageSkillDefinitions = MAGE_SKILL_DEFINITIONS;

    this.weaponDefinitions = [
      { id: 'PISTOL', key: 1, name: 'Pistol', unlockCombo: 1, icon: '🔫' },
      { id: 'UZI', key: 2, name: 'Uzi', unlockCombo: 5, icon: '⚡' },
      { id: 'SHOTGUN', key: 3, name: 'Shotgun', unlockCombo: 10, icon: '💥' },
      { id: 'BARRICADE', key: 4, name: 'Tường Gỗ', unlockCombo: 15, icon: '📦' },
      { id: 'BARREL', key: 5, name: 'Thùng Nổ', unlockCombo: 20, icon: '🛢️' },
      { id: 'GRENADE', key: 6, name: 'Lựu Đạn', unlockCombo: 30, icon: '💣' },
      { id: 'ROCKET', key: 7, name: 'Rocket', unlockCombo: 40, icon: '🚀' },
      { id: 'RAILGUN', key: 8, name: 'Railgun', unlockCombo: 50, icon: '🔮' }
    ];

    this.fetchLanIp();
    this.setWeaponsBarMode('GUN');
    this.initSoundToggle();
    this.initCopyButtons();
    this.initMapSelector();
    this.initMapPreviewModal();
    this.initShopEvents();
    if (this.socket) this.setSocket(this.socket);
  }

  fetchLanIp() {
    fetch('/api/info')
      .then(r => r.json())
      .then(data => {
        this.lanIp = data.lanIp;
        this.lanPort = data.port;
        this.lanIpDisplay.textContent = `http://${data.lanIp}:${data.port}`;
      })
      .catch(() => {
        this.lanIpDisplay.textContent = window.location.origin;
      });
  }

  initSoundToggle() {
    const formatSoundLabel = (diag) => {
      if (!diag) return '🔊 Âm thanh: BẬT';
      if (!diag.supported) return '⚠ Web Audio không hỗ trợ';
      if (diag.muted) return '🔇 Âm thanh: TẮT';
      if (diag.ctxState !== 'running') {
        return `⏳ Bấm để bật tiếng (${diag.decodedCount}/${diag.totalCount})`;
      }
      return `🔊 Âm thanh: BẬT (${diag.decodedCount}/${diag.totalCount})`;
    };

    const syncLabels = (diagOverride) => {
      const sm = typeof window !== 'undefined' ? window.soundManager : null;
      const diag = diagOverride || (sm && typeof sm.getAudioDiagnostics === 'function'
        ? sm.getAudioDiagnostics()
        : { supported: true, muted: Boolean(sm && sm.muted), ctxState: 'running', decodedCount: 0, totalCount: 72 });
      const text = formatSoundLabel(diag);
      if (this.btnSoundToggle) this.btnSoundToggle.textContent = text;
      if (this.btnPauseSound) this.btnPauseSound.textContent = text;
    };

    const handleSoundButtonClick = async () => {
      const sm = typeof window !== 'undefined' ? window.soundManager : null;
      if (!sm) return;
      const diag = typeof sm.getAudioDiagnostics === 'function' ? sm.getAudioDiagnostics() : null;
      if (diag && !diag.muted && diag.ctxState !== 'running' && typeof sm.unlockFromGesture === 'function') {
        const running = await sm.unlockFromGesture();
        if (running && typeof sm.playUnlockTestChime === 'function') {
          sm.playUnlockTestChime();
        }
        syncLabels();
        return;
      }
      const isMuted = sm.toggleMute();
      if (!isMuted && typeof sm.playUnlockTestChime === 'function') {
        setTimeout(() => sm.playUnlockTestChime(), 20);
      }
      syncLabels();
    };

    if (typeof window !== 'undefined' && window.soundManager && typeof window.soundManager.subscribe === 'function') {
      window.soundManager.subscribe((diag) => syncLabels(diag));
    }
    syncLabels();

    if (this.btnSoundToggle) {
      this.btnSoundToggle.addEventListener('click', handleSoundButtonClick);
    }
    if (this.btnPauseSound) {
      this.btnPauseSound.addEventListener('click', handleSoundButtonClick);
    }
  }

  initCopyButtons() {
    if (this.btnCopyRoom) {
      this.btnCopyRoom.addEventListener('click', () => this.copyRoomLink());
    }
    if (this.btnPauseCopy) {
      this.btnPauseCopy.addEventListener('click', () => this.copyRoomLink());
    }
  }

  // Draw scaled miniature of any map on any canvas
  drawMapMiniature(canvas, mapConfig, options = {}) {
    if (!canvas || !mapConfig) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    const mw = mapConfig.width || 1600;
    const mh = mapConfig.height || 1200;

    const sx = cw / mw;
    const sy = ch / mh;

    ctx.clearRect(0, 0, cw, ch);

    const theme = mapConfig.theme || {};
    const floorColor = theme.floorColor || '#22252a';
    const gridColor = theme.gridColor || '#2b2f36';
    const wallTop = theme.wallTop || '#454d59';
    const wallSide = theme.wallSide || '#2e343d';
    const wallBorder = theme.wallBorder || '#181b20';
    const pillarTop = theme.pillarTop || '#5a6372';
    const pillarBorder = theme.pillarBorder || '#181b20';

    // 1. Floor
    ctx.fillStyle = floorColor;
    ctx.fillRect(0, 0, cw, ch);

    // 2. Faint Grid Lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    const gridSize = 100 * sx;
    for (let x = gridSize; x < cw; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = gridSize; y < ch; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 3. Thematic environment details
    if (mapConfig.id === 'DESERT') {
      ctx.fillStyle = 'rgba(244, 162, 97, 0.25)';
      ctx.beginPath();
      ctx.arc(cw * 0.35, ch * 0.4, 45 * sx, 0, Math.PI * 2);
      ctx.arc(cw * 0.7, ch * 0.65, 55 * sx, 0, Math.PI * 2);
      ctx.fill();
    } else if (mapConfig.id === 'SNOW') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(cw * 0.2, ch * 0.25, 40 * sx, 40 * sy);
      ctx.fillRect(cw * 0.75, ch * 0.7, 50 * sx, 50 * sy);
    } else if (mapConfig.id === 'VOLCANO') {
      const grad = ctx.createRadialGradient(cw / 2, ch / 2, 10 * sx, cw / 2, ch / 2, 90 * sx);
      grad.addColorStop(0, 'rgba(255, 61, 0, 0.55)');
      grad.addColorStop(0.6, 'rgba(198, 40, 40, 0.3)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    }

    // 4. Walls & Pillars
    const walls = mapConfig.walls || [];
    walls.forEach(w => {
      const rx = w.x * sx;
      const ry = w.y * sy;
      const rw = w.w * sx;
      const rh = w.h * sy;

      if (w.type === 'boundary') {
        ctx.fillStyle = wallSide;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = wallBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, rw, rh);
      } else {
        ctx.fillStyle = pillarTop;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = pillarBorder;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);
      }
    });

    // 5. Spawns (if enabled in options)
    if (options.showSpawns) {
      // Player spawns (Green circles)
      const playerSpawns = mapConfig.playerSpawns || [
        { x: 740, y: 550 }, { x: 860, y: 550 },
        { x: 740, y: 650 }, { x: 860, y: 650 }
      ];
      playerSpawns.forEach((s, idx) => {
        const px = s.x * sx;
        const py = s.y * sy;
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(3, 8 * sx), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Zombie spawns (Red perimeter markers)
      const zombieSpawns = mapConfig.zombieSpawns || [
        { x: 100, y: 80 }, { x: 800, y: 80 }, { x: 1500, y: 80 },
        { x: 1520, y: 600 }, { x: 1500, y: 1120 }, { x: 800, y: 1120 },
        { x: 100, y: 1120 }, { x: 80, y: 600 }
      ];
      zombieSpawns.forEach(z => {
        const zx = z.x * sx;
        const zy = z.y * sy;
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(zx, zy, Math.max(2.5, 6 * sx), 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  initMapSelector() {
    if (!this.mapSelectionGrid || !window.MAPS_CONFIG) return;

    this.mapSelectionGrid.innerHTML = '';
    const maps = Object.values(window.MAPS_CONFIG);

    maps.forEach(map => {
      const card = document.createElement('div');
      const isSelected = map.id === this.selectedMapId;
      card.className = 'map-card' + (isSelected ? ' selected' : '');
      card.id = `map-card-${map.id}`;
      card.setAttribute('data-map-id', map.id);

      card.innerHTML = `
        <div class="map-card-thumb">
          <canvas width="160" height="120" id="thumb-canvas-${map.id}"></canvas>
        </div>
        <div class="map-card-body">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="map-card-badge" style="color: ${map.badgeColor};">${map.badge}</span>
          </div>
          <div class="map-card-title">${escapeHtml(map.name)}</div>
          <div class="map-card-desc">${escapeHtml(map.desc)}</div>
          <button class="map-card-btn-preview" data-preview-id="${map.id}">🔍 Xem chi tiết</button>
        </div>
      `;

      // Select map on card click
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('map-card-btn-preview')) return;
        this.selectMap(map.id);
      });

      // Preview button click
      const btnPreview = card.querySelector('.map-card-btn-preview');
      btnPreview.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMapPreviewModal(map.id);
      });

      this.mapSelectionGrid.appendChild(card);

      // Render miniature canvas
      const cvs = card.querySelector(`#thumb-canvas-${map.id}`);
      this.drawMapMiniature(cvs, map, { showSpawns: false });
    });

    this.updateSelectedMapLabel();
  }

  selectMap(mapId) {
    if (!window.MAPS_CONFIG || !window.MAPS_CONFIG[mapId]) return;
    this.selectedMapId = mapId;

    // Update UI card highlight
    const cards = document.querySelectorAll('.map-card');
    cards.forEach(c => {
      if (c.getAttribute('data-map-id') === mapId) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });

    this.updateSelectedMapLabel();

    // If currently inside a room waiting lobby as Host, inform server
    if (this.currentRoom && typeof this.onSelectMap === 'function') {
      const myPlayer = this.currentRoom.players.find(p => p.id === this.myPlayerId);
      if (myPlayer && myPlayer.isHost) {
        this.onSelectMap(mapId);
      }
    }
  }

  updateSelectedMapLabel() {
    if (!this.selectedMapNameLabel || !window.MAPS_CONFIG) return;
    const map = window.MAPS_CONFIG[this.selectedMapId];
    if (map) {
      this.selectedMapNameLabel.innerHTML = `<span style="color: ${map.badgeColor};">${map.badge}</span> ${escapeHtml(map.name)}`;
    }
  }

  initMapPreviewModal() {
    if (this.btnCloseMapPreview) {
      this.btnCloseMapPreview.addEventListener('click', () => {
        if (this.modalMapPreview) this.modalMapPreview.classList.add('hidden');
      });
    }

    if (this.btnSelectThisMap) {
      this.btnSelectThisMap.addEventListener('click', () => {
        if (this.previewModalMapId) {
          this.selectMap(this.previewModalMapId);
        }
        if (this.modalMapPreview) this.modalMapPreview.classList.add('hidden');
      });
    }

    // Modal background click to close
    if (this.modalMapPreview) {
      this.modalMapPreview.addEventListener('click', (e) => {
        if (e.target === this.modalMapPreview) {
          this.modalMapPreview.classList.add('hidden');
        }
      });
    }

    // Room screen button to preview current map
    if (this.btnPreviewCurrentMap) {
      this.btnPreviewCurrentMap.addEventListener('click', () => {
        const curId = (this.currentRoom && this.currentRoom.mapId) || this.selectedMapId;
        this.openMapPreviewModal(curId);
      });
    }

    // Room screen button to change map (for Host)
    if (this.btnChangeMap) {
      this.btnChangeMap.addEventListener('click', () => {
        // Cycle to next map or open selection modal
        const mapKeys = Object.keys(window.MAPS_CONFIG);
        const curIdx = mapKeys.indexOf(this.currentRoom ? this.currentRoom.mapId : this.selectedMapId);
        const nextMapId = mapKeys[(curIdx + 1) % mapKeys.length];
        this.selectMap(nextMapId);
      });
    }
  }

  openMapPreviewModal(mapId) {
    if (!window.MAPS_CONFIG || !window.MAPS_CONFIG[mapId]) return;
    const map = window.MAPS_CONFIG[mapId];
    this.previewModalMapId = mapId;

    if (this.previewModalBadge) {
      this.previewModalBadge.textContent = map.badge;
      this.previewModalBadge.style.color = map.badgeColor;
      this.previewModalBadge.style.borderColor = map.badgeColor;
      this.previewModalBadge.style.background = `${map.badgeColor}22`;
    }

    if (this.previewModalTitle) {
      this.previewModalTitle.textContent = map.name;
    }

    if (this.previewModalSubtitle) {
      this.previewModalSubtitle.textContent = map.subtitle || '';
    }

    if (this.previewModalDesc) {
      this.previewModalDesc.textContent = map.desc || '';
    }

    if (this.previewModalCanvas) {
      this.drawMapMiniature(this.previewModalCanvas, map, { showSpawns: true });
    }

    if (this.modalMapPreview) {
      this.modalMapPreview.classList.remove('hidden');
    }
  }

  togglePauseMenu() {
    if (!this.modalPause) return false;
    const isHidden = this.modalPause.classList.contains('hidden');
    if (isHidden) {
      this.modalPause.classList.remove('hidden');
      return true;
    } else {
      this.modalPause.classList.add('hidden');
      return false;
    }
  }

  showToast(msg) {
    if (!this.copyToast) return;
    this.copyToast.textContent = msg;
    this.copyToast.classList.remove('hidden');
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.copyToast.classList.add('hidden');
    }, 2200);
  }

  copyRoomLink() {
    if (!this.currentRoom) {
      this.showToast('⚠ Chưa vào phòng nào để copy link!');
      return;
    }
    let base = window.location.origin;
    if (this.lanIp && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      base = `http://${this.lanIp}:${this.lanPort}`;
    }
    const inviteUrl = `${base}/#room=${encodeURIComponent(this.currentRoom.id)}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.showToast(`✔ Đã sao chép link phòng: ${this.currentRoom.id}`);
      }).catch(() => {
        this.fallbackCopyText(inviteUrl);
      });
    } else {
      this.fallbackCopyText(inviteUrl);
    }
  }

  fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast(`✔ Đã sao chép link phòng!`);
    } catch (e) {
      prompt('Link phòng của bạn:', text);
    }
    document.body.removeChild(ta);
  }

  initWeaponsBar() {
    this.setWeaponsBarMode('GUN');
  }

  setWeaponsBarMode(mode = 'GUN') {
    if (mode === true || mode === 'WARRIOR') {
      this.hudBarMode = 'WARRIOR';
      this.isWarriorMode = true;
      this.isMageMode = false;
    } else if (mode === 'MAGE') {
      this.hudBarMode = 'MAGE';
      this.isWarriorMode = false;
      this.isMageMode = true;
    } else {
      this.hudBarMode = 'GUN';
      this.isWarriorMode = false;
      this.isMageMode = false;
    }

    if (!this.hudWeaponsBar) return;
    this.hudWeaponsBar.innerHTML = '';

    if (this.hudBarMode === 'MAGE') {
      this.mageSkillDefinitions.forEach(s => {
        const slot = document.createElement('div');
        slot.className = 'weapon-slot mage-slot' + (s.key === 1 ? ' active' : ' locked');
        slot.id = 'hud-weapon-' + s.id;
        slot.innerHTML = `
          <div class="weapon-key">[${s.key}] ${s.icon}</div>
          <div class="weapon-name">${s.name}</div>
          <div class="weapon-ammo" id="hud-ammo-${s.id}">${s.key === 1 ? s.manaCost + ' MP' : 'x' + s.unlockCombo + ' 🔒'}</div>
          <div class="skill-cooldown-overlay hidden" id="hud-cd-${s.id}">
            <span class="skill-cd-text" id="hud-cd-text-${s.id}"></span>
          </div>
        `;
        slot.addEventListener('click', () => {
          if (typeof this.onSelectWeapon === 'function') {
            this.onSelectWeapon(s.key, s.id);
          }
        });
        this.hudWeaponsBar.appendChild(slot);
      });
      return;
    }

    if (this.hudBarMode === 'WARRIOR') {
      this.warriorSkillDefinitions.forEach(s => {
        const slot = document.createElement('div');
        slot.className = 'weapon-slot warrior-slot' + (s.id === 'BERSERKER_STANCE' ? ' active' : ' locked');
        slot.id = 'hud-weapon-' + s.id;
        slot.innerHTML = `
          <div class="weapon-key">[${s.key}]</div>
          <div class="weapon-name">${s.name}</div>
          <div class="weapon-ammo" id="hud-ammo-${s.id}">${s.id === 'BERSERKER_STANCE' ? 'STANCE' : 'x' + s.unlockCombo + ' 🔒'}</div>
          <div class="skill-cooldown-overlay hidden" id="hud-cd-${s.id}">
            <span class="skill-cd-text" id="hud-cd-text-${s.id}"></span>
          </div>
        `;
        slot.addEventListener('click', () => {
          if (typeof this.onSelectWeapon === 'function') {
            this.onSelectWeapon(s.key, s.id);
          }
        });
        this.hudWeaponsBar.appendChild(slot);
      });
      return;
    }

    this.weaponDefinitions.forEach(w => {
      const slot = document.createElement('div');
      slot.className = 'weapon-slot' + (w.id === 'PISTOL' ? ' active' : ' locked');
      slot.id = 'hud-weapon-' + w.id;
      slot.innerHTML = `
        <div class="weapon-key">[${w.key}]</div>
        <div class="weapon-name">${w.name}</div>
        <div class="weapon-ammo" id="hud-ammo-${w.id}">${w.id === 'PISTOL' ? '∞' : 'x' + w.unlockCombo + ' 🔒'}</div>
      `;
      slot.addEventListener('click', () => {
        if (typeof this.onSelectWeapon === 'function') {
          this.onSelectWeapon(w.key, w.id);
        }
      });
      this.hudWeaponsBar.appendChild(slot);
    });
  }

  showScreen(screenName) {
    this.screenLobby.classList.add('hidden');
    this.screenRoom.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.modalGameOver.classList.add('hidden');
    if (this.modalPause) this.modalPause.classList.add('hidden');
    if (this.modalMapPreview) this.modalMapPreview.classList.add('hidden');
    if (this.modalShop) this.modalShop.classList.add('hidden');

    if (screenName === 'lobby') this.screenLobby.classList.remove('hidden');
    if (screenName === 'room') this.screenRoom.classList.remove('hidden');
    if (screenName === 'game') this.hud.classList.remove('hidden');
  }

  setSocket(socket) {
    this.socket = socket;
    if (!socket || typeof socket.on !== 'function') return;

    socket.on('SHOP_OPEN', (data) => this.openShop(data));
    socket.on('SHOP_UPDATE', (data) => this.updateShop(data));
    socket.on('SHOP_CLOSE', () => this.closeShop());
    socket.on('ITEM_BOUGHT', (payload) => {
      if (payload && payload.materials !== undefined) {
        this.updateMaterials(payload.materials);
      }
      if (this.currentShopData && this.currentShopData.items && payload && payload.itemId) {
        this.currentShopData.items = this.currentShopData.items.filter(i => (i.id || i.itemId) !== payload.itemId);
        this.renderShopItems(this.currentShopData.items, this.currentMaterials, this.currentShopData.inventory);
      }
    });
    socket.on('SHOP_REROLLED', (payload) => {
      if (payload && payload.materials !== undefined) {
        this.updateMaterials(payload.materials);
      }
      if (payload && payload.items) {
        const cost = (payload.rerolls !== undefined ? payload.rerolls : 1) + 1;
        this.updateShop({ items: payload.items, rerollCost: cost, materials: payload.materials });
      }
    });
    socket.on('ITEM_RECYCLED', (payload) => {
      if (payload && payload.materials !== undefined) {
        this.updateMaterials(payload.materials);
      }
    });
    socket.on('PLAYER_READY', (payload) => {
      if (payload && payload.readyCount !== undefined) {
        this.updateReadyStatus(payload.readyCount, payload.totalPlayers);
      }
    });
  }

  initShopEvents() {
    if (this.btnShopReroll) {
      this.btnShopReroll.addEventListener('click', () => {
        if (this.socket && typeof this.socket.emit === 'function') {
          this.socket.emit('REROLL_SHOP');
        }
        if (typeof this.onRerollShop === 'function') {
          this.onRerollShop();
        }
      });
    }

    if (this.btnShopReady) {
      this.btnShopReady.addEventListener('click', () => {
        this.playerIsReady = !this.playerIsReady;
        if (this.socket && typeof this.socket.emit === 'function') {
          this.socket.emit('PLAYER_READY');
        }
        if (typeof this.onPlayerReady === 'function') {
          this.onPlayerReady();
        }
        if (this.playerIsReady) {
          this.btnShopReady.classList.add('player-is-ready');
        } else {
          this.btnShopReady.classList.remove('player-is-ready');
        }
      });
    }
  }

  openShop(data = {}) {
    this.isShopOpen = true;
    this.currentShopData = data || {};
    this.playerIsReady = false;
    if (this.btnShopReady) {
      this.btnShopReady.classList.remove('player-is-ready');
    }

    if (data.materials !== undefined) {
      this.currentMaterials = data.materials;
    }
    this.updateMaterials(this.currentMaterials);

    const wave = data.wave !== undefined ? data.wave : 1;
    if (this.shopWaveTag) {
      this.shopWaveTag.textContent = `KẾT THÚC WAVE ${wave}`;
    }

    const rerollCost = data.rerollCost !== undefined ? data.rerollCost : 1;
    if (this.shopRerollCost) {
      this.shopRerollCost.textContent = String(rerollCost);
    }
    if (this.btnShopReroll) {
      this.btnShopReroll.disabled = (this.currentMaterials < rerollCost);
    }

    const readyCount = data.readyCount !== undefined ? data.readyCount : 0;
    const totalPlayers = data.totalPlayers !== undefined ? data.totalPlayers : 1;
    this.updateReadyStatus(readyCount, totalPlayers);

    this.renderShopItems(data.items || [], this.currentMaterials, data.inventory || []);
    this.renderInventory(data.inventory || []);

    if (this.modalShop) {
      this.modalShop.classList.remove('hidden');
    }
  }

  updateShop(data = {}) {
    if (!this.currentShopData) this.currentShopData = {};
    Object.assign(this.currentShopData, data);

    if (data.materials !== undefined) {
      this.currentMaterials = data.materials;
      this.updateMaterials(this.currentMaterials);
    }

    if (data.rerollCost !== undefined && this.shopRerollCost) {
      this.shopRerollCost.textContent = String(data.rerollCost);
      if (this.btnShopReroll) {
        this.btnShopReroll.disabled = (this.currentMaterials < data.rerollCost);
      }
    }

    if (data.readyCount !== undefined) {
      this.updateReadyStatus(data.readyCount, data.totalPlayers || 1);
    }

    const items = data.items !== undefined ? data.items : (this.currentShopData.items || []);
    const inv = data.inventory !== undefined ? data.inventory : (this.currentShopData.inventory || []);
    this.renderShopItems(items, this.currentMaterials, inv);
    if (data.inventory !== undefined) {
      this.renderInventory(inv);
    }
  }

  closeShop() {
    this.isShopOpen = false;
    this.currentShopData = null;
    this.playerIsReady = false;
    if (this.modalShop) {
      this.modalShop.classList.add('hidden');
    }
  }

  updateMaterials(amount) {
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      this.currentMaterials = amount;
    }
    const val = String(this.currentMaterials || 0);
    if (this.hudMaterialsCount) {
      this.hudMaterialsCount.textContent = val;
    }
    if (this.shopMaterialsCount) {
      this.shopMaterialsCount.textContent = val;
    }
    if (this.btnShopReroll && this.shopRerollCost) {
      const cost = parseInt(this.shopRerollCost.textContent, 10) || 1;
      this.btnShopReroll.disabled = (this.currentMaterials < cost);
    }
  }

  updateReadyStatus(readyCount = 0, totalPlayers = 1) {
    if (this.shopReadyCount) {
      this.shopReadyCount.textContent = `${readyCount}/${totalPlayers}`;
    }
  }

  renderShopItems(items = [], currentMaterials = 0, playerInventory = []) {
    if (!this.shopCardsContainer) return;
    this.shopCardsContainer.innerHTML = '';

    const inventoryMap = {};
    if (Array.isArray(playerInventory)) {
      for (const item of playerInventory) {
        const iId = item.itemId || item.id;
        inventoryMap[iId] = item.stack || 1;
      }
    }

    items.forEach((item) => {
      const id = item.id || item.itemId;
      const def = (DEFAULT_SHOP_ITEMS && DEFAULT_SHOP_ITEMS[id]) || item;
      const name = item.name || def.name || id;
      const rarity = item.rarity || def.rarity || 'Common';
      const price = item.currentPrice !== undefined ? item.currentPrice : (item.price !== undefined ? item.price : (def.price || 20));
      const stackMax = item.stackMax || def.stackMax || 3;
      const currentStack = inventoryMap[id] || 0;
      const isStackFull = currentStack >= stackMax;
      const canAfford = currentMaterials >= price;
      const iconPath = item.icon || def.icon || `assets/items/${id.toLowerCase()}.svg`;
      const desc = item.description || def.description || '';
      const statBonuses = item.statBonuses || def.statBonuses || {};

      const card = document.createElement('div');
      card.className = `shop-card rarity-${rarity}`;

      let statsHtml = '';
      if (statBonuses && Object.keys(statBonuses).length > 0) {
        statsHtml = '<div class="shop-card-stats">' + Object.entries(statBonuses).map(([k, v]) => {
          const sign = typeof v === 'number' && v >= 0 ? '+' : '';
          return `<div>${sign}${v} ${k}</div>`;
        }).join('') + '</div>';
      }

      card.innerHTML = `
        <div class="shop-card-header">
          <div class="shop-card-icon-wrap">
            <img src="${escapeHtml(iconPath)}" alt="${escapeHtml(name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
            <span class="fallback-emoji" style="display:none;">📦</span>
          </div>
          <div class="shop-card-name">${escapeHtml(name)}</div>
          <div class="shop-card-rarity">${escapeHtml(rarity)}</div>
        </div>
        <div class="shop-card-body">
          ${statsHtml}
          <div class="shop-card-desc">${escapeHtml(desc)}</div>
        </div>
        <div class="shop-card-footer">
          <div class="shop-card-price-tag">
            <span>💎</span>
            <span>${price}</span>
          </div>
          <button class="btn btn-buy-item" data-item-id="${escapeHtml(id)}" ${(!canAfford || isStackFull) ? 'disabled' : ''}>
            ${isStackFull ? 'ĐÃ ĐẦY TỦ' : (canAfford ? `MUA (${price} 💎)` : `THIẾU 💎 (${price})`)}
          </button>
        </div>
      `;

      const buyBtn = card.querySelector('.btn-buy-item');
      if (buyBtn && !buyBtn.disabled) {
        buyBtn.addEventListener('click', () => {
          if (this.socket && typeof this.socket.emit === 'function') {
            this.socket.emit('BUY_SHOP_ITEM', { itemId: id });
          }
          if (typeof this.onBuyShopItem === 'function') {
            this.onBuyShopItem(id);
          }
        });
      }

      this.shopCardsContainer.appendChild(card);
    });
  }

  renderInventory(inventory = []) {
    if (!this.shopInventoryGrid) return;
    this.shopInventoryGrid.innerHTML = '';

    const invList = Array.isArray(inventory) ? inventory : [];
    if (this.shopInventoryCount) {
      this.shopInventoryCount.textContent = invList.length;
    }

    const maxSlots = 18;
    for (let i = 0; i < maxSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'inventory-slot';

      if (i < invList.length) {
        const invItem = invList[i];
        const id = invItem.itemId || invItem.id;
        const stack = invItem.stack || 1;
        const def = (DEFAULT_SHOP_ITEMS && DEFAULT_SHOP_ITEMS[id]) || {};
        const name = def.name || id;
        const rarity = def.rarity || 'Common';
        const iconPath = def.icon || `assets/items/${id.toLowerCase()}.svg`;

        slot.classList.add('occupied', `rarity-${rarity}`);
        slot.title = `${name} (x${stack}) — Nhấp chuột phải hoặc bấm ♻️ để tái chế`;

        slot.innerHTML = `
          <img src="${escapeHtml(iconPath)}" alt="${escapeHtml(name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span class="fallback-emoji" style="display:none;">📦</span>
          <span class="inventory-stack-badge">x${stack}</span>
          <button class="inventory-recycle-btn" title="Tái chế hoàn 50% 💎">♻️</button>
        `;

        const recycleAction = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (this.socket && typeof this.socket.emit === 'function') {
            this.socket.emit('RECYCLE_ITEM', { itemId: id });
          }
          if (typeof this.onRecycleItem === 'function') {
            this.onRecycleItem(id);
          }
        };

        const recBtn = slot.querySelector('.inventory-recycle-btn');
        if (recBtn) recBtn.addEventListener('click', recycleAction);
        slot.addEventListener('contextmenu', recycleAction);
      } else {
        slot.classList.add('empty');
      }

      this.shopInventoryGrid.appendChild(slot);
    }
  }

  renderRoomsList(rooms, onJoin) {
    if (!rooms || rooms.length === 0) {
      this.roomsListBody.innerHTML = `
        <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Chưa có phòng nào. Hãy tạo phòng mới!</td></tr>
      `;
      return;
    }

    this.roomsListBody.innerHTML = '';
    rooms.forEach(r => {
      const tr = document.createElement('tr');
      const isFull = r.playerCount >= 4;
      const isPlaying = r.state === 'PLAYING';
      const statusText = isPlaying ? 'Đang chiến' : (isFull ? 'Đã đầy' : 'Đang chờ');
      const statusColor = isPlaying ? 'var(--primary)' : (isFull ? 'var(--danger)' : 'var(--success)');

      const mapConf = (window.MAPS_CONFIG && window.MAPS_CONFIG[r.mapId]) || null;
      const badge = r.mapBadge || (mapConf ? mapConf.badge : '🏢 KINH ĐIỂN');
      const badgeColor = (mapConf && mapConf.badgeColor) || '#00e5ff';
      const mapName = r.mapName || (mapConf ? mapConf.name : 'The Rooms');

      tr.innerHTML = `
        <td style="font-weight: bold;">${escapeHtml(r.name)}</td>
        <td>
          <span class="map-tag" style="border-color: ${badgeColor}; color: ${badgeColor};">${badge}</span>
          <span style="font-size: 0.88rem; margin-left: 4px;">${escapeHtml(mapName)}</span>
        </td>
        <td>${r.playerCount} / 4</td>
        <td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
        <td>
          <button class="btn btn-secondary btn-join" ${isFull || isPlaying ? 'disabled' : ''} data-room-id="${r.id}" style="padding: 6px 14px; font-size: 0.85rem;">
            Tham Gia
          </button>
        </td>
      `;
      this.roomsListBody.appendChild(tr);
    });

    this.roomsListBody.querySelectorAll('.btn-join').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomId = e.target.getAttribute('data-room-id');
        onJoin(roomId);
      });
    });
  }

  renderRoomLobby(room, myPlayerId) {
    this.currentRoom = room;
    this.myPlayerId = myPlayerId;
    this.roomTitle.textContent = room.name.toUpperCase();

    const myPlayer = room.players.find(p => p.id === myPlayerId);
    const isHost = myPlayer ? myPlayer.isHost : false;

    // Show/hide host start button & map change button
    this.btnStartGame.style.display = isHost ? 'block' : 'none';
    this.btnReady.style.display = isHost ? 'none' : 'block';
    if (this.btnChangeMap) {
      this.btnChangeMap.style.display = isHost ? 'block' : 'none';
    }

    if (myPlayer) {
      this.btnReady.textContent = myPlayer.ready ? '✔ ĐÃ SẴN SÀNG' : '⚡ SẴN SÀNG';
      this.btnReady.className = myPlayer.ready ? 'btn btn-success' : 'btn btn-secondary';
    }

    // Sync Map Banner in Room
    const mapId = room.mapId || window.DEFAULT_MAP_ID || 'THE_ROOMS';
    const mapConf = (window.MAPS_CONFIG && window.MAPS_CONFIG[mapId]) || null;
    if (mapConf) {
      if (this.roomMapBadge) {
        this.roomMapBadge.textContent = mapConf.badge;
        this.roomMapBadge.style.color = mapConf.badgeColor;
        this.roomMapBadge.style.borderColor = mapConf.badgeColor;
        this.roomMapBadge.style.background = `${mapConf.badgeColor}22`;
      }
      if (this.roomMapName) {
        this.roomMapName.textContent = mapConf.name;
      }
      if (this.roomMapSubtitle) {
        this.roomMapSubtitle.textContent = `(${mapConf.subtitle})`;
      }
      if (this.roomMapDesc) {
        this.roomMapDesc.textContent = mapConf.desc;
      }
      if (this.roomMapThumbCanvas) {
        this.drawMapMiniature(this.roomMapThumbCanvas, mapConf, { showSpawns: false });
      }
    }

    // Render 4 slots
    this.playerSlotsContainer.innerHTML = '';
    const PLAYER_RING_COLORS = ['#00e676', '#ff3d00', '#2979ff', '#ffc400'];

    for (let i = 0; i < 4; i++) {
      const player = room.players[i] || null;
      const slot = document.createElement('div');
      const ringColor = PLAYER_RING_COLORS[i % 4];

      if (player) {
        const isMe = player.id === myPlayerId;
        slot.className = 'slot-card occupied' + (isMe ? ' is-me' : '');
        slot.innerHTML = `
          <div class="slot-avatar char-${player.character}" style="box-shadow: 0 0 10px ${ringColor}; border-color: ${ringColor};">${player.name.substring(0, 1)}</div>
          <div style="font-weight: bold; font-size: 1.1rem;">${escapeHtml(player.name)} ${isMe ? '(Bạn)' : ''}</div>
          <div style="font-size: 0.85rem; color: ${ringColor}; font-weight: bold;">P${i + 1} • ${player.character}</div>
          <div style="margin-top: 6px;">
            ${player.isHost ? '<span style="color: var(--accent); font-weight: bold;">👑 CHỦ PHÒNG</span>' : (player.ready ? '<span style="color: var(--success); font-weight: bold;">✔ SẴN SÀNG</span>' : '<span style="color: var(--text-muted);">Đang chờ...</span>')}
          </div>
        `;
      } else {
        slot.className = 'slot-card';
        slot.innerHTML = `
          <div class="slot-avatar" style="background: #2a2f38; color: #555;">+</div>
          <div style="color: var(--text-muted); font-size: 0.9rem;">Slot ${i + 1}</div>
          <div style="font-size: 0.8rem; color: #555;">Đang chờ người...</div>
        `;
      }
      this.playerSlotsContainer.appendChild(slot);
    }

    // Update character selection buttons (All classes selectable, duplicate classes permitted)
    this.charButtons.forEach(btn => {
      const char = btn.getAttribute('data-char');
      const isSelected = myPlayer && myPlayer.character === char;

      btn.disabled = false;
      if (isSelected) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  updateHUD(gameState, localPlayerId) {
    if (!gameState) return;

    // Find local player safely (fallback to first player or by id)
    const localPlayer = (gameState.players && gameState.players.find(p => p.id === localPlayerId)) ||
                        (gameState.players && gameState.players[0]) || null;

    // 1. Team Roster
    this.hudTeamList.innerHTML = '';
    if (gameState.players) {
      gameState.players.forEach(p => {
        const isMe = p.id === localPlayerId;
        const row = document.createElement('div');
        row.className = 'teammate-row';
        const hpPercent = Math.max(0, (p.hp / p.maxHp) * 100);
        const ultPct = Math.floor(Math.min(100, p.ultCharge || 0));
        const ultReady = ultPct >= 100;
        const ultBadge = `<span class="teammate-ult-badge ${ultReady ? 'ready' : ''}">${ultReady ? '⚡ READY' : ultPct + '%'}</span>`;
        const maxArmor = p.maxArmor || 0;
        const armor = Math.max(0, p.armor || 0);
        const armorPercent = maxArmor > 0 ? Math.max(0, Math.min(100, (armor / maxArmor) * 100)) : 0;
        const armorBarHtml = maxArmor > 0 ? `
          <div class="teammate-armor-bar" title="Giáp: ${armor}/${maxArmor}">
            <div class="teammate-armor-fill" style="width: ${armorPercent}%;"></div>
          </div>
        ` : '';

        const statText = p.isDowned
          ? '🚨 GỤC'
          : (maxArmor > 0 ? `${p.hp} HP • ${armor} AP` : `${p.hp} HP`);

        const maxMana = p.maxMana || 0;
        const manaVal = Math.max(0, Math.floor(p.mana || 0));
        const manaPct = maxMana > 0 ? Math.max(0, Math.min(100, (manaVal / maxMana) * 100)) : 0;
        const manaBarHtml = maxMana > 0 ? `
          <div class="teammate-mana-bar" title="Mana: ${manaVal}/${maxMana}">
            <div class="teammate-mana-fill" style="width: ${manaPct}%;"></div>
          </div>
        ` : '';
        const badgeHtml = maxMana > 0
          ? `<span class="teammate-ult-badge">${manaVal} MP</span>`
          : ultBadge;

        row.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: bold; font-size: 0.85rem;">${escapeHtml(p.name)} ${isMe ? '(Bạn)' : ''}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">${escapeHtml(p.character || 'HUMAN')}</span>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 3px;">
            <div class="teammate-hp-bar">
              <div class="teammate-hp-fill" style="width: ${hpPercent}%; background: ${p.isDowned ? 'var(--danger)' : 'var(--success)'};"></div>
            </div>
            ${armorBarHtml}
            ${manaBarHtml}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-family: monospace; font-size: 0.8rem;">${statText}</span>
            ${badgeHtml}
          </div>
        `;
        this.hudTeamList.appendChild(row);
      });
    }

    // 2. Wave Announcement
    if (gameState.state === 'INTERMISSION') {
      this.hudWaveTitle.textContent = 'CHUẨN BỊ ĐỢT TIẾP';
      this.hudWaveTitle.style.color = 'var(--accent)';
      this.hudWaveSub.textContent = `Bắt đầu sau: ${gameState.intermissionTimer} giây (Hãy đặt thêm Barricade!)`;
    } else {
      this.hudWaveTitle.textContent = `WAVE ${gameState.wave}`;
      this.hudWaveTitle.style.color = 'var(--primary)';
      this.hudWaveSub.textContent = `ZOMBIES CÒN LẠI: ${gameState.zombiesLeft}`;
    }

    // 2.5 Materials Count on HUD (Brotato Green Gems)
    if (localPlayer && localPlayer.materials !== undefined) {
      this.updateMaterials(localPlayer.materials);
    } else {
      this.updateMaterials(this.currentMaterials || 0);
    }

    // Auto-open shop if items are loaded, or close when returning to PLAYING
    if (gameState.state === 'SHOP') {
      if (!this.isShopOpen && this.currentShopData && this.currentShopData.items && this.currentShopData.items.length > 0) {
        this.openShop(this.currentShopData);
      }
    } else if (this.isShopOpen && gameState.state === 'PLAYING') {
      this.closeShop();
    }

    // 3. Combo Meter
    if (localPlayer) {
      this.hudComboText.textContent = `x${localPlayer.combo}`;
      const comboRatio = localPlayer.comboMaxTime > 0 ? (localPlayer.comboTimer / localPlayer.comboMaxTime) * 100 : 0;
      this.hudComboFill.style.width = `${Math.max(0, Math.min(100, comboRatio))}%`;

      // 4. Weapons Ammo & Active Slot / Skills Bar
      const playerMaxCombo = Math.max(localPlayer.maxCombo || 1, localPlayer.combo || 1);

      if (localPlayer.character === 'MAGE') {
        if (this.hudBarMode !== 'MAGE') this.setWeaponsBarMode('MAGE');
        const ms = localPlayer.mageState;
        const currentMana = localPlayer.mana || 0;

        this.mageSkillDefinitions.forEach(s => {
          const slotEl = document.getElementById('hud-weapon-' + s.id);
          const ammoEl = document.getElementById('hud-ammo-' + s.id);
          const cdEl = document.getElementById('hud-cd-' + s.id);
          const cdText = document.getElementById('hud-cd-text-' + s.id);
          const sk = ms && ms.skills ? ms.skills[s.id] : null;
          const isUnlocked = Boolean((sk && sk.unlocked) || (playerMaxCombo >= s.unlockCombo) || s.key === 1);
          if (!slotEl) return;

          const isShieldActive = s.key === 7 && Boolean(ms && ms.manaShieldActive);
          slotEl.classList.toggle('active', s.key === 1 || isShieldActive);
          slotEl.classList.toggle('locked', !isUnlocked);
          slotEl.classList.toggle('no-mana', isUnlocked && currentMana < s.manaCost);

          if (!isUnlocked) {
            if (ammoEl) ammoEl.textContent = `x${s.unlockCombo} 🔒`;
            if (cdEl) { cdEl.classList.add('hidden'); cdEl.textContent = ''; }
            if (cdText) cdText.textContent = '';
            return;
          }

          if (s.key === 1) {
            if (ammoEl) ammoEl.textContent = '∞';
          } else if (s.key === 8) {
            const cd = sk && sk.cooldown > 0 ? sk.cooldown : 0;
            if (cd > 0) {
              const cdStr = `${cd.toFixed(1)}s`;
              if (ammoEl) ammoEl.textContent = cdStr;
            } else {
              if (ammoEl) ammoEl.textContent = currentMana >= 100 ? 'READY' : `${s.manaCost} MP`;
            }
          } else {
            if (ammoEl) ammoEl.textContent = `${s.manaCost} MP`;
          }
          const cd = sk && sk.cooldown > 0 ? sk.cooldown : 0;
          if (cd > 0) {
            const cdStr = `${cd.toFixed(1)}s`;
            if (cdEl) { cdEl.classList.remove('hidden'); cdEl.textContent = cdStr; }
            if (cdText) cdText.textContent = cdStr;
          } else {
            if (cdEl) { cdEl.classList.add('hidden'); cdEl.textContent = ''; }
            if (cdText) cdText.textContent = '';
          }
        });
      } else if (localPlayer.character === 'WARRIOR') {
        if (this.hudBarMode !== 'WARRIOR') {
          this.setWeaponsBarMode('WARRIOR');
        }

        const ws = localPlayer.warriorState;
        const activeStance = ws ? ws.activeStance : 'BERSERKER_STANCE';
        const furyStacks = ws ? (ws.furyStacks || 0) : 0;

        this.warriorSkillDefinitions.forEach(s => {
          const slotEl = document.getElementById('hud-weapon-' + s.id);
          const ammoEl = document.getElementById('hud-ammo-' + s.id);
          const cdEl = document.getElementById('hud-cd-' + s.id);
          const cdText = document.getElementById('hud-cd-text-' + s.id);
          const sk = ws && ws.skills ? ws.skills[s.id] : null;

          const isUnlocked = Boolean(
            (sk && sk.unlocked) ||
            (playerMaxCombo >= s.unlockCombo) ||
            (s.id === 'BERSERKER_STANCE')
          );

          if (!slotEl) return;

          // Highlight active stance for slots 1 and 2
          if (s.key === 1 || s.key === 2) {
            if (activeStance === s.id) {
              slotEl.classList.add('active');
            } else {
              slotEl.classList.remove('active');
            }
          } else {
            slotEl.classList.remove('active');
          }

          if (isUnlocked) {
            slotEl.classList.remove('locked');

            if (s.key === 1) {
              if (ammoEl) {
                ammoEl.textContent = furyStacks > 0 ? `⚡x${furyStacks}` : 'STANCE';
                ammoEl.style.color = furyStacks > 0 ? '#ff3d00' : 'var(--accent)';
              }
            } else if (s.key === 2) {
              if (ammoEl) {
                ammoEl.textContent = 'STANCE';
                ammoEl.style.color = 'var(--accent)';
              }
            } else if (s.key >= 3 && s.key <= 7) {
              const cd = sk && sk.cooldown > 0 ? sk.cooldown : 0;
              if (cd > 0) {
                const cdStr = `${cd.toFixed(1)}s`;
                if (cdEl) {
                  cdEl.classList.remove('hidden');
                  cdEl.textContent = cdStr;
                }
                if (cdText) cdText.textContent = cdStr;
                if (ammoEl) ammoEl.textContent = cdStr;
              } else {
                if (cdEl) {
                  cdEl.classList.add('hidden');
                  cdEl.textContent = '';
                }
                if (cdText) cdText.textContent = '';
                if (ammoEl) ammoEl.textContent = 'READY';
              }
            } else if (s.key === 8) {
              // Avatar of War
              if (ws && ws.avatarActive) {
                const rem = ws.avatarTimer !== undefined ? ws.avatarTimer : 0;
                const remStr = `${rem.toFixed(1)}s`;
                if (cdEl) {
                  cdEl.classList.remove('hidden');
                  cdEl.textContent = remStr;
                }
                if (cdText) cdText.textContent = remStr;
                if (ammoEl) ammoEl.textContent = 'ACTIVE';
              } else {
                if (cdEl) {
                  cdEl.classList.add('hidden');
                  cdEl.textContent = '';
                }
                if (cdText) cdText.textContent = '';
                const pct = Math.floor(Math.min(100, ((localPlayer.ultCharge || 0) / (localPlayer.ultMaxCharge || 100)) * 100));
                if (ammoEl) ammoEl.textContent = pct >= 100 ? 'READY' : `${pct}%`;
              }
            }
          } else {
            slotEl.classList.add('locked');
            if (ammoEl) ammoEl.textContent = `x${s.unlockCombo} 🔒`;
            if (cdEl) {
              cdEl.classList.add('hidden');
              cdEl.textContent = '';
            }
          }
        });

      } else {
        if (this.hudBarMode !== 'GUN') {
          this.setWeaponsBarMode('GUN');
        }

        this.weaponDefinitions.forEach(w => {
          const slotEl = document.getElementById('hud-weapon-' + w.id);
          const ammoEl = document.getElementById('hud-ammo-' + w.id);
          const pw = localPlayer.weapons ? localPlayer.weapons[w.id] : null;

          const isUnlocked = Boolean(
            (pw && pw.unlocked) ||
            (playerMaxCombo >= w.unlockCombo) ||
            (w.id === 'PISTOL')
          );

          if (slotEl && ammoEl) {
            if (localPlayer.selectedWeapon === w.id) {
              slotEl.classList.add('active');
            } else {
              slotEl.classList.remove('active');
            }

            if (isUnlocked) {
              slotEl.classList.remove('locked');
              if (localPlayer.hasInfiniteAmmo && w.id !== 'BARRICADE' && w.id !== 'BARREL') {
                ammoEl.textContent = '∞';
              } else if (pw && pw.ammo !== undefined) {
                ammoEl.textContent = pw.ammo === Infinity ? '∞' : pw.ammo;
              } else {
                ammoEl.textContent = w.id === 'PISTOL' ? '∞' : '0';
              }
            } else {
              slotEl.classList.add('locked');
              ammoEl.textContent = `x${w.unlockCombo} 🔒`;
            }
          }
        });
      }

      // 4.5 Ultimate Meter HUD
      if (this.hudUltContainer && this.hudUltFill && this.hudUltStatus) {
        const char = localPlayer.character || 'HUMAN';
        const meta = this.ultimateMeta[char] || this.ultimateMeta.HUMAN;
        if (this.hudUltName) this.hudUltName.textContent = meta.name;

        if (char === 'MAGE') {
          this.hudUltContainer.classList.add('mana-mode');
          this.hudUltContainer.classList.remove('buffed');
          const curM = Math.floor(localPlayer.mana || 0);
          const maxM = localPlayer.maxMana || 100;
          const mPct = Math.max(0, Math.min(100, Math.floor((curM / maxM) * 100)));
          this.hudUltFill.style.width = mPct + '%';
          this.hudUltStatus.textContent = `${curM} / ${maxM} MP`;
          this.hudUltContainer.classList.toggle('ready', curM >= 100);
          if (this.hudUltHint) this.hudUltHint.textContent = 'Hồi +5 Mana/giây • [F] / [Chuột Phải] / [8]: Thiên Thạch (100 MP, CD 50s)';
        } else {
          this.hudUltContainer.classList.remove('mana-mode');
          const maxC = localPlayer.ultMaxCharge || 100;
          const pct = Math.floor(Math.min(100, ((localPlayer.ultCharge || 0) / maxC) * 100));
          this.hudUltFill.style.width = pct + '%';

          if (localPlayer.character === 'WARRIOR' && localPlayer.warriorState && localPlayer.warriorState.avatarActive) {
            this.hudUltContainer.classList.add('buffed');
            this.hudUltContainer.classList.remove('ready');
            const rem = localPlayer.warriorState.avatarTimer !== undefined ? localPlayer.warriorState.avatarTimer : 0;
            this.hudUltStatus.textContent = `🔥 CHIẾN THẦN: ${rem.toFixed(1)}s`;
            if (this.hudUltHint) this.hudUltHint.textContent = 'CHIẾN THẦN ĐANG HOẠT ĐỘNG (TĂNG SÁT THƯƠNG & TỐC ĐỘ)';
          } else if (localPlayer.hasInfiniteAmmo) {
            this.hudUltContainer.classList.add('buffed');
            this.hudUltContainer.classList.remove('ready');
            this.hudUltStatus.textContent = '⚡ ĐẠN VÔ HẠN!';
            if (this.hudUltHint) this.hudUltHint.textContent = 'HÀO QUANG ĐẠN VÔ HẠN ĐANG HOẠT ĐỘNG';
          } else {
            this.hudUltContainer.classList.remove('buffed');
            if (pct >= 100) {
              this.hudUltContainer.classList.add('ready');
              this.hudUltStatus.textContent = 'SẴN SÀNG!';
              if (this.hudUltHint) {
                if (localPlayer.character === 'WARRIOR') {
                  this.hudUltHint.textContent = 'NHẤN [F], [CHUỘT PHẢI] HOẶC PHÍM [8] KÍCH HOẠT!';
                } else {
                  this.hudUltHint.textContent = 'NHẤN [F] HOẶC [CHUỘT PHẢI] KÍCH HOẠT!';
                }
              }
            } else {
              this.hudUltContainer.classList.remove('ready');
              this.hudUltStatus.textContent = pct + '%';
              if (this.hudUltHint) this.hudUltHint.textContent = '[F] hoặc [Chuột Phải] (Cần 100%)';
            }
          }
        }
      }
    }

    // 5. Game Over Modal
    if (gameState.state === 'GAMEOVER') {
      this.modalGameOver.classList.remove('hidden');
      document.getElementById('go-wave-reached').textContent = `Wave ${gameState.wave}`;
      let totalKills = 0;
      let bestCombo = 1;
      gameState.players.forEach(p => {
        totalKills += p.kills;
        if (p.combo > bestCombo) bestCombo = p.combo;
      });
      document.getElementById('go-total-score').textContent = totalKills + ' Kills';
      document.getElementById('go-best-combo').textContent = `x${bestCombo}`;
    } else {
      this.modalGameOver.classList.add('hidden');
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIController, MAGE_SKILL_DEFINITIONS, WARRIOR_SKILL_DEFINITIONS, DEFAULT_SHOP_ITEMS };
}
if (typeof window !== 'undefined') {
  window.UIController = UIController;
  window.MAGE_SKILL_DEFINITIONS = MAGE_SKILL_DEFINITIONS;
  window.WARRIOR_SKILL_DEFINITIONS = WARRIOR_SKILL_DEFINITIONS;
  window.DEFAULT_SHOP_ITEMS = DEFAULT_SHOP_ITEMS;
}
