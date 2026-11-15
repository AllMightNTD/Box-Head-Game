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

  return el;
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
