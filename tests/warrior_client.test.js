/**
 * @file warrior_client.test.js
 * @description Unit tests for Warrior ARPG client input handling and UI HUD / Armor rendering.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// -------------------------------------------------------------
// Minimal DOM & Browser Global Mock Shim
// -------------------------------------------------------------
function createMockElement(id = '', tagName = 'div') {
  const listeners = {};
  const classes = new Set();
  const attributes = {};

  const el = {
    id,
    tagName: tagName.toUpperCase(),
    style: {},
    children: [],
    parentElement: null,
    listeners,
    _textContent: '',
    _innerHTML: '',

    get className() {
      return Array.from(classes).join(' ');
    },
    set className(val) {
      classes.clear();
      if (val) {
        val.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
      }
    },

    classList: {
      add: (...tokens) => tokens.forEach(t => classes.add(t)),
      remove: (...tokens) => tokens.forEach(t => classes.delete(t)),
      contains: (token) => classes.has(token),
      toggle: (token, force) => {
        if (force === undefined) {
          if (classes.has(token)) classes.delete(token);
          else classes.add(token);
        } else if (force) {
          classes.add(token);
        } else {
          classes.delete(token);
        }
      }
    },

    get textContent() {
      return el._textContent;
    },
    set textContent(val) {
      el._textContent = String(val);
      el.children = [];
    },

    get innerHTML() {
      if (el._innerHTML && el.children.length === 0) return el._innerHTML;
      if (el.children.length > 0) {
        return el.children.map(c => `<${c.tagName.toLowerCase()}${c.id ? ` id="${c.id}"` : ''}${c.className ? ` class="${c.className}"` : ''}>${c.innerHTML}</${c.tagName.toLowerCase()}>`).join('');
      }
      return el._innerHTML || '';
    },
    set innerHTML(val) {
      el._innerHTML = String(val);
      el.children = [];
      const idRegex = /<([a-zA-Z0-9]+)[^>]*id=["']([^"']+)["'][^>]*>/g;
      let m;
      while ((m = idRegex.exec(val)) !== null) {
        const tag = m[1];
        const id = m[2];
        const child = createMockElement(id, tag);
        child.parentElement = el;
        el.children.push(child);
        if (global.document && global.document._elements) {
          global.document._elements[id] = child;
        }
      }
    },

    appendChild(child) {
      if (child) {
        child.parentElement = el;
        el.children.push(child);
        if (child.id && global.document && global.document._elements) {
          global.document._elements[child.id] = child;
        }
      }
      return child;
    },

    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return attributes[name] || null;
    },

    addEventListener(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },

    dispatchEvent(event) {
      const fns = listeners[event.type] || [];
      for (const fn of fns) {
        fn(event);
      }
    },

    querySelector(selector) {
      return el.querySelectorAll(selector)[0] || null;
    },

    querySelectorAll(selector) {
      const results = [];
      function recurse(node) {
        for (const child of node.children) {
          if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) {
            results.push(child);
          } else if (selector.startsWith('#') && child.id === selector.slice(1)) {
            results.push(child);
          } else if (child.tagName.toLowerCase() === selector.toLowerCase()) {
            results.push(child);
          }
          recurse(child);
        }
      }
      recurse(el);
      return results;
    }
  };

  if (tagName.toUpperCase() === 'CANVAS') {
    el.width = 1600;
    el.height = 1200;
    const ctx = createMockCtx();
    ctx.canvas = el;
    el.getContext = () => ctx;
  }

  return el;
}

function createMockCtx() {
  const calls = [];
  const ctx = {
    calls,
    canvas: { width: 1600, height: 1200 },
    save: () => calls.push({ op: 'save' }),
    restore: () => calls.push({ op: 'restore' }),
    translate: (x, y) => calls.push({ op: 'translate', x, y }),
    rotate: (angle) => calls.push({ op: 'rotate', angle }),
    scale: (sx, sy) => calls.push({ op: 'scale', sx, sy }),
    beginPath: () => calls.push({ op: 'beginPath' }),
    ellipse: (...args) => calls.push({ op: 'ellipse', args }),
    arc: (...args) => calls.push({ op: 'arc', args }),
    stroke: () => calls.push({ op: 'stroke' }),
    fill: () => calls.push({ op: 'fill' }),
    fillRect: (x, y, w, h) => calls.push({ op: 'fillRect', x, y, w, h, fillStyle: ctx.fillStyle }),
    strokeRect: (x, y, w, h) => calls.push({ op: 'strokeRect', x, y, w, h }),
    clearRect: (x, y, w, h) => calls.push({ op: 'clearRect', x, y, w, h }),
    fillText: (text, x, y) => calls.push({ op: 'fillText', text, x, y, fillStyle: ctx.fillStyle }),
    drawImage: (...args) => calls.push({ op: 'drawImage', args }),
    moveTo: (x, y) => calls.push({ op: 'moveTo', x, y }),
    lineTo: (x, y) => calls.push({ op: 'lineTo', x, y }),
    setLineDash: (dash) => calls.push({ op: 'setLineDash', dash }),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    shadowColor: '#000000',
    shadowBlur: 0,
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1.0,
    font: '10px sans-serif',
    textAlign: 'left'
  };
  return ctx;
}

function setupMockEnvironment() {
  const elements = {};
  const windowListeners = {};

  function getOrCreateElement(id, tagName = 'div') {
    if (!elements[id]) {
      elements[id] = createMockElement(id, tagName);
    }
    return elements[id];
  }

  // Pre-seed known elements required by UIController
  const requiredIds = [
    'screen-lobby', 'screen-room', 'hud', 'modal-gameover', 'modal-pause',
    'modal-map-preview', 'copy-toast', 'lan-ip-display', 'nickname-input',
    'room-name-input', 'rooms-list-body', 'map-selection-grid', 'selected-map-name-label',
    'room-map-banner', 'room-map-thumb-canvas', 'room-map-badge', 'room-map-name',
    'room-map-subtitle', 'room-map-desc', 'btn-change-map', 'btn-preview-current-map',
    'preview-modal-canvas', 'preview-modal-badge', 'preview-modal-title',
    'preview-modal-subtitle', 'preview-modal-desc', 'btn-close-map-preview',
    'btn-select-this-map', 'btn-create-room', 'btn-leave-room', 'btn-copy-room',
    'btn-ready', 'btn-start-game', 'btn-sound-toggle', 'btn-restart-game',
    'btn-back-lobby', 'btn-resume-game', 'btn-pause-copy', 'btn-pause-sound',
    'btn-pause-leave', 'room-title', 'player-slots-container', 'hud-team-list',
    'hud-wave-title', 'hud-wave-sub', 'hud-combo-text', 'hud-combo-fill',
    'hud-weapons-bar', 'hud-ult-container', 'hud-ult-name', 'hud-ult-status',
    'hud-ult-fill', 'hud-ult-hint', 'go-wave-reached', 'go-total-score', 'go-best-combo'
  ];

  for (const id of requiredIds) {
    getOrCreateElement(id);
  }

  const mockDocument = {
    _elements: elements,
    getElementById: (id) => getOrCreateElement(id),
    createElement: (tag) => createMockElement('', tag),
    querySelectorAll: (sel) => {
      if (sel === '.char-btn') return [];
      return [];
    }
  };

  const mockWindow = {
    innerWidth: 1600,
    innerHeight: 900,
    location: { origin: 'http://localhost:3000' },
    document: mockDocument,
    addEventListener: (ev, fn) => {
      if (!windowListeners[ev]) windowListeners[ev] = [];
      windowListeners[ev].push(fn);
    },
    removeEventListener: (ev, fn) => {
      if (!windowListeners[ev]) return;
      windowListeners[ev] = windowListeners[ev].filter(f => f !== fn);
    },
    dispatchEvent: (ev) => {
      const fns = windowListeners[ev.type] || [];
      for (const fn of fns) fn(ev);
    },
    _windowListeners: windowListeners
  };

  class MockAudioNode {
    constructor() {
      this.connectedTo = [];
      this.frequency = {
        value: 440,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      };
      this.gain = {
        value: 1,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      };
    }
    connect(node) {
      this.connectedTo.push(node);
      return node;
    }
    start() {}
    stop() {}
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.state = 'running';
      this.destination = new MockAudioNode();
      this.sampleRate = 44100;
      this.createdNodes = [];
    }
    createGain() {
      const g = new MockAudioNode();
      this.createdNodes.push(g);
      return g;
    }
    createOscillator() {
      const o = new MockAudioNode();
      this.createdNodes.push(o);
      return o;
    }
    createBufferSource() {
      const b = new MockAudioNode();
      this.createdNodes.push(b);
      return b;
    }
    createBiquadFilter() {
      const f = new MockAudioNode();
      this.createdNodes.push(f);
      return f;
    }
    createBuffer(channels, size, rate) {
      return {
        getChannelData: () => new Float32Array(size)
      };
    }
    resume() { return Promise.resolve(); }
  }

  mockWindow.AudioContext = MockAudioContext;

  global.window = mockWindow;
  global.document = mockDocument;
  global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ lanIp: '127.0.0.1', port: 3000 }) });

  return { mockWindow, mockDocument };
}

// -------------------------------------------------------------
// TESTS
// -------------------------------------------------------------

test('InputHandler Warrior Mode vs Standard Mode', () => {
  setupMockEnvironment();

  // Load InputHandler
  const inputModule = require('../client/js/input.js');
  const InputHandler = inputModule.InputHandler || global.window.InputHandler;
  assert.ok(InputHandler, 'InputHandler class should be exported or on window');

  const canvas = createMockElement('canvas', 'canvas');
  const input = new InputHandler(canvas);

  // 1. Initial defaults
  assert.strictEqual(input.isWarriorMode, false, 'Default isWarriorMode should be false');
  assert.strictEqual(input.onSkillCast, null, 'Default onSkillCast should be null');

  // 2. Standard Gun Mode (isWarriorMode = false): 1..8 switches weapons
  let switchedSlot = null;
  let switchedWid = null;
  input.onWeaponChange = (slot, wid) => {
    switchedSlot = slot;
    switchedWid = wid;
    input.setWeaponSlot(slot, true);
  };

  // Press '3' (Shotgun)
  global.window.dispatchEvent({ type: 'keydown', key: '3', repeat: false });
  assert.strictEqual(switchedSlot, 3);
  assert.strictEqual(switchedWid, 'SHOTGUN');

  // Press '8' (Railgun)
  global.window.dispatchEvent({ type: 'keydown', key: '8', repeat: false });
  assert.strictEqual(switchedSlot, 8);
  assert.strictEqual(switchedWid, 'RAILGUN');

  // Mouse wheel in standard mode wraps 1..8
  input.selectedWeaponSlot = 8;
  global.window.dispatchEvent({ type: 'wheel', deltaY: 100 });
  assert.strictEqual(input.selectedWeaponSlot, 1);
  assert.strictEqual(input.selectedWeaponId, 'PISTOL');

  // 3. Warrior Mode (isWarriorMode = true)
  input.isWarriorMode = true;
  let skillCastSlot = null;
  let skillCastAngle = null;
  input.onSkillCast = (slot, angle) => {
    skillCastSlot = slot;
    skillCastAngle = angle;
  };

  // Slot 1: Berserker Stance
  global.window.dispatchEvent({ type: 'keydown', key: '1', repeat: false });
  assert.strictEqual(switchedSlot, 1);
  assert.strictEqual(switchedWid, 'BERSERKER_STANCE');

  // Slot 2: Juggernaut Stance
  global.window.dispatchEvent({ type: 'keydown', key: '2', repeat: false });
  assert.strictEqual(switchedSlot, 2);
  assert.strictEqual(switchedWid, 'JUGGERNAUT_STANCE');

  // Mouse wheel toggles ONLY between 1 and 2
  input.selectedWeaponSlot = 1;
  global.window.dispatchEvent({ type: 'wheel', deltaY: 100 });
  assert.strictEqual(input.selectedWeaponSlot, 2);
  assert.strictEqual(input.selectedWeaponId, 'JUGGERNAUT_STANCE');

  global.window.dispatchEvent({ type: 'wheel', deltaY: -100 });
  assert.strictEqual(input.selectedWeaponSlot, 1);
  assert.strictEqual(input.selectedWeaponId, 'BERSERKER_STANCE');

  // Slots 3..8 invoke onSkillCast(slot, angle) and do NOT call onWeaponChange
  switchedSlot = null;
  switchedWid = null;
  input.mouse.angle = 1.25;

  global.window.dispatchEvent({ type: 'keydown', key: '3', repeat: false });
  assert.strictEqual(skillCastSlot, 3, 'Key 3 invokes onSkillCast(3)');
  assert.strictEqual(skillCastAngle, 1.25);
  assert.strictEqual(switchedSlot, null, 'Key 3 does NOT call onWeaponChange');

  global.window.dispatchEvent({ type: 'keydown', key: '7', repeat: false });
  assert.strictEqual(skillCastSlot, 7, 'Key 7 invokes onSkillCast(7)');

  // Repeat events (e.repeat = true) are ignored for onSkillCast
  skillCastSlot = null;
  global.window.dispatchEvent({ type: 'keydown', key: '5', repeat: true });
  assert.strictEqual(skillCastSlot, null, 'Holding key 5 (repeat = true) does not fire skill cast');

  // Focus on input element ignores keys
  const inputTarget = createMockElement('nickname', 'input');
  global.window.dispatchEvent({ type: 'keydown', key: '1', repeat: false, target: inputTarget });
  assert.strictEqual(switchedSlot, null, 'Typing in input fields does not trigger weapon switch');
});

test('UIController Warrior Skill Definitions, Bar Toggle & Armor HUD', () => {
  setupMockEnvironment();

  // Load UIController
  const uiModule = require('../client/js/ui.js');
  const UIController = uiModule.UIController || global.window.UIController;
  assert.ok(UIController, 'UIController class should be exported or on window');

  const ui = new UIController();

  // 1. Ultimate Meta for WARRIOR
  assert.ok(ui.ultimateMeta.WARRIOR, 'ultimateMeta.WARRIOR must be defined');
  assert.strictEqual(ui.ultimateMeta.WARRIOR.name, 'HÓA THÂN CHIẾN THẦN (AVATAR)');
  assert.strictEqual(ui.ultimateMeta.WARRIOR.color, '#ff3d00');

  // 2. Warrior skill definitions
  assert.ok(Array.isArray(ui.warriorSkillDefinitions), 'warriorSkillDefinitions must be an array');
  assert.strictEqual(ui.warriorSkillDefinitions.length, 8, 'warriorSkillDefinitions must have 8 slots');
  assert.strictEqual(ui.warriorSkillDefinitions[0].id, 'BERSERKER_STANCE');
  assert.strictEqual(ui.warriorSkillDefinitions[1].id, 'JUGGERNAUT_STANCE');
  assert.strictEqual(ui.warriorSkillDefinitions[7].id, 'AVATAR_OF_WAR');

  // 3. Toggling weapon bar mode to Warrior
  ui.setWeaponsBarMode(true);
  assert.strictEqual(ui.isWarriorMode, true);
  const warriorSlot1 = global.document.getElementById('hud-weapon-BERSERKER_STANCE');
  const warriorSlot8 = global.document.getElementById('hud-weapon-AVATAR_OF_WAR');
  assert.ok(warriorSlot1, 'HUD bar must render BERSERKER_STANCE slot');
  assert.ok(warriorSlot8, 'HUD bar must render AVATAR_OF_WAR slot');

  // Clicking warrior slot triggers onSelectWeapon
  let selectedSlot = null;
  let selectedWid = null;
  ui.onSelectWeapon = (slot, wid) => {
    selectedSlot = slot;
    selectedWid = wid;
  };
  warriorSlot1.dispatchEvent({ type: 'click' });
  assert.strictEqual(selectedSlot, 1);
  assert.strictEqual(selectedWid, 'BERSERKER_STANCE');

  // 4. Toggling back to Gun mode
  ui.setWeaponsBarMode(false);
  assert.strictEqual(ui.isWarriorMode, false);
  const pistolSlot = global.document.getElementById('hud-weapon-PISTOL');
  assert.ok(pistolSlot, 'HUD bar must restore PISTOL slot');

  // 5. HUD Update: Team Roster Armor Bar & Warrior Skill states
  const mockGameState = {
    state: 'PLAYING',
    wave: 3,
    zombiesLeft: 10,
    players: [
      {
        id: 'p-warrior',
        name: 'Conan',
        character: 'WARRIOR',
        hp: 120,
        maxHp: 150,
        armor: 50,
        maxArmor: 75,
        ultCharge: 100,
        ultMaxCharge: 100,
        combo: 25,
        maxCombo: 25,
        comboTimer: 3,
        comboMaxTime: 4,
        selectedWeapon: 'BERSERKER_STANCE',
        warriorState: {
          activeStance: 'BERSERKER_STANCE',
          furyStacks: 6,
          furyTimer: 3.5,
          skills: {
            BERSERKER_STANCE: { id: 'BERSERKER_STANCE', slot: 1, unlocked: true, cooldown: 0 },
            JUGGERNAUT_STANCE: { id: 'JUGGERNAUT_STANCE', slot: 2, unlocked: true, cooldown: 0 },
            BLADE_WHIRLWIND: { id: 'BLADE_WHIRLWIND', slot: 3, unlocked: true, cooldown: 2.4 },
            SHADOW_DASH_SLASH: { id: 'SHADOW_DASH_SLASH', slot: 4, unlocked: true, cooldown: 0 },
            SEISMIC_SLAM: { id: 'SEISMIC_SLAM', slot: 5, unlocked: true, cooldown: 0 },
            WAR_CRY: { id: 'WAR_CRY', slot: 6, unlocked: false, cooldown: 0 },
            COUNTER_SHIELD_BASH: { id: 'COUNTER_SHIELD_BASH', slot: 7, unlocked: false, cooldown: 0 },
            AVATAR_OF_WAR: { id: 'AVATAR_OF_WAR', slot: 8, unlocked: false, cooldown: 0 }
          },
          avatarActive: false,
          avatarTimer: 0
        }
      },
      {
        id: 'p-human',
        name: 'John',
        character: 'HUMAN',
        hp: 100,
        maxHp: 100,
        armor: 0,
        maxArmor: 0,
        ultCharge: 40,
        ultMaxCharge: 100,
        combo: 5,
        maxCombo: 5,
        weapons: { PISTOL: { unlocked: true, ammo: Infinity } },
        selectedWeapon: 'PISTOL'
      }
    ]
  };

  ui.updateHUD(mockGameState, 'p-warrior');

  // Verify Team Roster renders armor bar for Warrior (maxArmor > 0)
  const teamList = global.document.getElementById('hud-team-list');
  assert.ok(teamList.innerHTML.includes('teammate-armor-bar'), 'Team list should include Armor bar for Warrior');

  // Verify Warrior Skill Bar state
  const bSlot = global.document.getElementById('hud-weapon-BERSERKER_STANCE');
  assert.ok(bSlot.classList.contains('active'), 'BERSERKER_STANCE must have active class');
  const ammo1 = global.document.getElementById('hud-ammo-BERSERKER_STANCE');
  assert.ok(ammo1.textContent.includes('⚡x6'), 'Slot 1 must display Fury badge ⚡x6');

  // Cooldown overlay on slot 3
  const cdOverlay = global.document.getElementById('hud-cd-BLADE_WHIRLWIND');
  assert.ok(cdOverlay, 'Slot 3 cooldown overlay element must exist');
  assert.ok(cdOverlay.textContent.includes('2.4s'), 'Slot 3 cooldown overlay should show remaining seconds');

  // Lock status on slot 6 (WAR_CRY requires combo x30, player has x25)
  const slot6 = global.document.getElementById('hud-weapon-WAR_CRY');
  assert.ok(slot6.classList.contains('locked'), 'Slot 6 must have locked class');

  // Avatar Active Buff State in Ultimate Meter
  mockGameState.players[0].warriorState.avatarActive = true;
  mockGameState.players[0].warriorState.avatarTimer = 7.8;
  ui.updateHUD(mockGameState, 'p-warrior');

  const ultContainer = global.document.getElementById('hud-ult-container');
  assert.ok(ultContainer.classList.contains('buffed'), 'hudUltContainer must have buffed class during Avatar');
  const ultStatus = global.document.getElementById('hud-ult-status');
  assert.ok(ultStatus.textContent.includes('CHIẾN THẦN') && ultStatus.textContent.includes('7.8s'),
    'hudUltStatus must display Avatar remaining time');
});

test('Renderer: Melee Sword Trails, Visual Decays, and Session Reset', () => {
  setupMockEnvironment();

  const rendererModule = require('../client/js/renderer.js');
  const Renderer = rendererModule.Renderer || global.window.Renderer;
  assert.ok(Renderer, 'Renderer class must be available');

  const canvas = createMockElement('game-canvas', 'canvas');
  const renderer = new Renderer(canvas);

  // 1. Initial swordTrails state
  assert.ok(Array.isArray(renderer.swordTrails), 'renderer.swordTrails must be initialized as an array');
  assert.strictEqual(renderer.swordTrails.length, 0);

  // 2. addSwordTrail stores trail correctly
  renderer.addSwordTrail(150, 250, Math.PI / 4, {
    radius: 70,
    arcRad: Math.PI * 0.8,
    color: '#ff3d00',
    duration: 0.3,
    isFullCircle: false
  });
  assert.strictEqual(renderer.swordTrails.length, 1);
  assert.strictEqual(renderer.swordTrails[0].x, 150);
  assert.strictEqual(renderer.swordTrails[0].y, 250);
  assert.strictEqual(renderer.swordTrails[0].radius, 70);
  assert.strictEqual(renderer.swordTrails[0].life, 0.3);

  // 3. updateVisuals(0.1) decays life
  renderer.updateVisuals(0.1);
  assert.strictEqual(renderer.swordTrails.length, 1);
  assert.ok(Math.abs(renderer.swordTrails[0].life - 0.2) < 0.001);

  // 4. updateVisuals(0.25) expires and prunes trail
  renderer.updateVisuals(0.25);
  assert.strictEqual(renderer.swordTrails.length, 0);

  // 5. resetSession() clears sword trails
  renderer.addSwordTrail(100, 100, 0, { duration: 1.0 });
  assert.strictEqual(renderer.swordTrails.length, 1);
  renderer.resetSession();
  assert.strictEqual(renderer.swordTrails.length, 0);
});

test('Renderer: addWarriorSkillVfx and spawnWarriorVfx Contract Reconciliation', () => {
  setupMockEnvironment();

  const rendererModule = require('../client/js/renderer.js');
  const Renderer = rendererModule.Renderer || global.window.Renderer;
  const canvas = createMockElement('game-canvas', 'canvas');
  const renderer = new Renderer(canvas);

  assert.strictEqual(typeof renderer.addWarriorSkillVfx, 'function', 'addWarriorSkillVfx must be a function');
  assert.strictEqual(typeof renderer.spawnWarriorVfx, 'function', 'spawnWarriorVfx must be a function');

  // spawnWarriorVfx delegates cleanly to addWarriorSkillVfx
  // Event 1: Berserker Stance (slash trail + sparks)
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_SKILL',
    skillId: 'BERSERKER_STANCE',
    x: 100,
    y: 100,
    angle: 0.5
  });
  assert.ok(renderer.swordTrails.length >= 1, 'BERSERKER_STANCE should add a sword trail');

  // Event 2: Juggernaut Stance (heavier trail + shake)
  const prevShake = renderer.camera.shake;
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_SKILL',
    skillId: 'JUGGERNAUT_STANCE',
    x: 120,
    y: 120,
    angle: 1.0
  });
  assert.ok(renderer.camera.shake >= prevShake, 'JUGGERNAUT_STANCE should trigger screen shake');

  // Event 3: Blade Whirlwind (360 whirlwind trail)
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_SKILL',
    skillId: 'BLADE_WHIRLWIND',
    x: 200,
    y: 200,
    radius: 105
  });
  const wwTrail = renderer.swordTrails.find(t => t.isFullCircle);
  assert.ok(wwTrail, 'BLADE_WHIRLWIND should spawn a full-circle sword trail');

  // Event 4: Shadow Dash Slash (blink trail + destination trail)
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_SKILL',
    skillId: 'SHADOW_DASH_SLASH',
    x: 100,
    y: 100,
    toX: 250,
    toY: 100,
    angle: 0
  });
  assert.ok(renderer.blinkTrails.length >= 1, 'SHADOW_DASH_SLASH should add blink trail');

  // Event 5: Seismic Slam (shockwave + debris)
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_SKILL',
    skillId: 'SEISMIC_SLAM',
    x: 300,
    y: 300
  });
  assert.ok(renderer.shockwaves.some(s => s.maxRadius >= 200), 'SEISMIC_SLAM should add shockwave');

  // Event 6: War Cry (massive 900px shockwave)
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_SKILL',
    skillId: 'WAR_CRY',
    x: 400,
    y: 400,
    radius: 900
  });
  assert.ok(renderer.shockwaves.some(s => s.maxRadius >= 800), 'WAR_CRY should add wide aura shockwave');

  // Event 7: Counter Shield Parry
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_COUNTER',
    playerId: 'p-1',
    x: 150,
    y: 150,
    angle: 0
  });
  assert.ok(renderer.shockwaves.some(s => s.color === '#00e5ff'), 'WARRIOR_COUNTER should add cyan shockwave');

  // Event 8: Mark Explode
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_MARK_EXPLODE',
    x: 160,
    y: 160,
    radius: 120
  });
  assert.ok(renderer.shockwaves.some(s => s.color === '#ff1744'), 'WARRIOR_MARK_EXPLODE should add crimson shockwave');

  // Event 9: Avatar End (Final Fire Nova)
  renderer.spawnWarriorVfx({
    type: 'WARRIOR_AVATAR_END',
    playerId: 'p-1',
    x: 200,
    y: 200,
    radius: 240
  });
  assert.ok(renderer.shockwaves.some(s => s.maxRadius >= 240), 'WARRIOR_AVATAR_END should add 240px nova');

  // Event 10: ULTIMATE AVATAR_OF_WAR
  renderer.spawnWarriorVfx({
    type: 'ULTIMATE',
    ultId: 'AVATAR_OF_WAR',
    playerId: 'p-1',
    x: 220,
    y: 220
  });
  assert.ok(renderer.shockwaves.some(s => s.color === '#ff3d00'), 'AVATAR_OF_WAR should add fiery shockwave');
});

test('Renderer: drawPlayerTag Armor Bar when maxArmor > 0 and Regression Safety for HUMAN', () => {
  setupMockEnvironment();

  const rendererModule = require('../client/js/renderer.js');
  const Renderer = rendererModule.Renderer || global.window.Renderer;
  const canvas = createMockElement('game-canvas', 'canvas');
  const renderer = new Renderer(canvas);

  // 1. Warrior with maxArmor = 75, armor = 50
  const warriorCtx = createMockCtx();
  const warriorPlayer = {
    id: 'w-1',
    name: 'Warrior',
    character: 'WARRIOR',
    x: 100,
    y: 100,
    hp: 100,
    maxHp: 150,
    armor: 50,
    maxArmor: 75
  };
  renderer.drawPlayerTag(warriorCtx, warriorPlayer, true);

  // Check that fillRect was called with an Armor bar fill
  const warriorFills = warriorCtx.calls.filter(c => c.op === 'fillRect');
  assert.ok(warriorFills.length >= 4, `Warrior tag should draw Armor bar (found ${warriorFills.length} rects)`);

  // 2. Human with maxArmor = 0, armor = 0
  const humanCtx = createMockCtx();
  const humanPlayer = {
    id: 'h-1',
    name: 'Human',
    character: 'HUMAN',
    x: 200,
    y: 200,
    hp: 80,
    maxHp: 100,
    armor: 0,
    maxArmor: 0
  };
  renderer.drawPlayerTag(humanCtx, humanPlayer, true);

  const humanFills = humanCtx.calls.filter(c => c.op === 'fillRect');
  // Human should ONLY draw HP bar (2 fillRect calls)
  assert.strictEqual(humanFills.length, 2, 'Human tag must only draw standard HP bar rects');
});

test('Renderer: drawGroundZones renders seismic_fissure and slash_mark without errors', () => {
  setupMockEnvironment();

  const rendererModule = require('../client/js/renderer.js');
  const Renderer = rendererModule.Renderer || global.window.Renderer;
  const canvas = createMockElement('game-canvas', 'canvas');
  const renderer = new Renderer(canvas);

  const ctx = createMockCtx();
  const groundZones = [
    { id: 'gz-1', type: 'seismic_fissure', x: 200, y: 300, radius: 160, timer: 3.5 },
    { id: 'gz-2', type: 'slash_mark', x: 400, y: 500, radius: 120, timer: 0.4 }
  ];

  assert.doesNotThrow(() => {
    renderer.drawGroundZones(ctx, groundZones);
  });

  // Verify operations occurred
  assert.ok(ctx.calls.some(c => c.op === 'stroke'), 'drawGroundZones should invoke stroke');
  assert.ok(ctx.calls.some(c => c.op === 'fill'), 'drawGroundZones should invoke fill');
});

test('Renderer: drawBoxyPlayer Avatar 1.35x scale & Overlays vs HUMAN Isolation', () => {
  setupMockEnvironment();

  const rendererModule = require('../client/js/renderer.js');
  const Renderer = rendererModule.Renderer || global.window.Renderer;
  const canvas = createMockElement('game-canvas', 'canvas');
  const renderer = new Renderer(canvas);

  // 1. Warrior with Avatar active -> must invoke scale(1.35, 1.35)
  const avatarCtx = createMockCtx();
  const warriorAvatar = {
    id: 'w-avatar',
    name: 'Titan',
    character: 'WARRIOR',
    x: 100,
    y: 100,
    angle: 0,
    hp: 150,
    maxHp: 150,
    armor: 75,
    maxArmor: 75,
    selectedWeapon: 'BERSERKER_STANCE',
    warriorState: {
      avatarActive: true,
      avatarTimer: 8.5,
      counterShieldActive: false,
      warCryAuraActive: false,
      whirlwindActive: false
    }
  };
  renderer.drawBoxyPlayer(avatarCtx, warriorAvatar, true);
  const scaleCalls = avatarCtx.calls.filter(c => c.op === 'scale' && Math.abs(c.sx - 1.35) < 0.01 && Math.abs(c.sy - 1.35) < 0.01);
  assert.ok(scaleCalls.length >= 1, 'Avatar Warrior must scale ctx by (1.35, 1.35)');

  // 2. Warrior with Counter Shield active -> must draw frontal shield arc
  const counterCtx = createMockCtx();
  const warriorCounter = {
    id: 'w-shield',
    name: 'ShieldGuard',
    character: 'WARRIOR',
    x: 100,
    y: 100,
    angle: Math.PI / 2,
    hp: 150,
    maxHp: 150,
    armor: 75,
    maxArmor: 75,
    selectedWeapon: 'JUGGERNAUT_STANCE',
    warriorState: {
      avatarActive: false,
      counterShieldActive: true,
      warCryAuraActive: false,
      whirlwindActive: false
    }
  };
  renderer.drawBoxyPlayer(counterCtx, warriorCounter, true);
  assert.ok(counterCtx.calls.some(c => c.op === 'stroke'), 'Counter Shield active should stroke frontal shield arc');

  // 3. Human player regression check -> scale(1.35, 1.35) must NEVER be called
  const humanCtx = createMockCtx();
  const humanPlayer = {
    id: 'h-1',
    name: 'HumanPlayer',
    character: 'HUMAN',
    x: 150,
    y: 150,
    angle: 0,
    hp: 100,
    maxHp: 100,
    armor: 0,
    maxArmor: 0,
    selectedWeapon: 'PISTOL'
  };
  renderer.drawBoxyPlayer(humanCtx, humanPlayer, true);
  const humanScaleCalls = humanCtx.calls.filter(c => c.op === 'scale' && Math.abs(c.sx - 1.35) < 0.01);
  assert.strictEqual(humanScaleCalls.length, 0, 'Human player must NEVER trigger Avatar 1.35x scaling');
});

test('Renderer: drawBullets and drawBoxyZombie Warrior Status Indicators', () => {
  setupMockEnvironment();

  const rendererModule = require('../client/js/renderer.js');
  const Renderer = rendererModule.Renderer || global.window.Renderer;
  const canvas = createMockElement('game-canvas', 'canvas');
  const renderer = new Renderer(canvas);

  // 1. drawBullets with wind_blade and fire_slash
  const bulletCtx = createMockCtx();
  const bullets = [
    { x: 100, y: 100, angle: 0.2, type: 'wind_blade' },
    { x: 200, y: 200, angle: 0.5, type: 'fire_slash' }
  ];
  renderer.drawBullets(bulletCtx, bullets);
  assert.ok(bulletCtx.calls.some(c => c.op === 'stroke'), 'wind_blade and fire_slash should render crescent strokes');

  // 2. drawBoxyZombie with isTaunted and isFeared
  const zombieCtx = createMockCtx();
  const zombie = {
    type: 'NORMAL',
    x: 150,
    y: 150,
    angle: 0,
    hp: 40,
    maxHp: 50,
    isTaunted: true,
    isFeared: true
  };
  renderer.drawBoxyZombie(zombieCtx, zombie);
  const textCalls = zombieCtx.calls.filter(c => c.op === 'fillText');
  assert.ok(textCalls.some(c => c.text && c.text.includes('TAUNTED')), 'Zombie with isTaunted should render TAUNTED text');
  assert.ok(textCalls.some(c => c.text && c.text.includes('FEAR')), 'Zombie with isFeared should render FEAR text');
});

test('SoundManager: playWarriorSkill handles event object, (skillId, subType) and muted/null guards', () => {
  setupMockEnvironment();

  const audioModule = require('../client/js/audio.js');
  const SoundManager = audioModule.SoundManager || global.window.SoundManager;
  assert.ok(SoundManager, 'SoundManager class must be available');

  const sm = new SoundManager();

  // 1. Calling when null ctx or uninitialized should not throw
  assert.doesNotThrow(() => {
    sm.playWarriorSkill('BERSERKER_STANCE');
  });

  // 2. Initialized with MockAudioContext
  sm.init();
  assert.ok(sm.ctx, 'SoundManager.ctx should be initialized');

  // 3. Accepts string skillId
  assert.doesNotThrow(() => {
    sm.playWarriorSkill('BERSERKER_STANCE');
    sm.playWarriorSkill('JUGGERNAUT_STANCE');
    sm.playWarriorSkill('BLADE_WHIRLWIND');
    sm.playWarriorSkill('SHADOW_DASH_SLASH');
    sm.playWarriorSkill('SEISMIC_SLAM');
    sm.playWarriorSkill('WAR_CRY');
    sm.playWarriorSkill('COUNTER_SHIELD_BASH');
    sm.playWarriorSkill('AVATAR_OF_WAR');
  });

  // 4. Accepts event objects (contract from main.js)
  assert.doesNotThrow(() => {
    sm.playWarriorSkill({ type: 'WARRIOR_SKILL', skillId: 'BERSERKER_STANCE' });
    sm.playWarriorSkill({ type: 'WARRIOR_COUNTER', playerId: 'p1' });
    sm.playWarriorSkill({ type: 'WARRIOR_MARK_EXPLODE', radius: 120 });
    sm.playWarriorSkill({ type: 'WARRIOR_AVATAR_END', radius: 240 });
    sm.playWarriorSkill({ type: 'ULTIMATE', ultId: 'AVATAR_OF_WAR' });
  });

  // 5. Guard when muted
  sm.muted = true;
  const initialNodesCount = sm.ctx.createdNodes ? sm.ctx.createdNodes.length : 0;
  sm.playWarriorSkill('BERSERKER_STANCE');
  if (sm.ctx.createdNodes) {
    assert.strictEqual(sm.ctx.createdNodes.length, initialNodesCount, 'Muted soundManager should not create new audio nodes');
  }
});
