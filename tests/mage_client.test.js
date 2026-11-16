/**
 * @file mage_client.test.js
 * @description Unit tests for Mage client input handling, HUD/Mana bar rendering, Canvas VFX, and WebAudio SFX.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

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
    get className() { return Array.from(classes).join(' '); },
    set className(val) {
      classes.clear();
      if (val) val.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
    classList: {
      add: (...t) => t.forEach(x => classes.add(x)),
      remove: (...t) => t.forEach(x => classes.delete(x)),
      contains: (x) => classes.has(x)
    },
    get textContent() { return el._textContent; },
    set textContent(val) { el._textContent = String(val); el.children = []; },
    get innerHTML() {
      if (el.children.length > 0) {
        return el.children.map(c => `<${c.tagName.toLowerCase()} id="${c.id}" class="${c.className}">${c.innerHTML}</${c.tagName.toLowerCase()}>`).join('');
      }
      return el._innerHTML || '';
    },
    set innerHTML(val) {
      el._innerHTML = String(val);
      el.children = [];
      const idRegex = /<([a-zA-Z0-9]+)[^>]*id=["']([^"']+)["'][^>]*>/g;
      let m;
      while ((m = idRegex.exec(val)) !== null) {
        const child = createMockElement(m[2], m[1]);
        child.parentElement = el;
        el.children.push(child);
        if (global.document && global.document._elements) {
          global.document._elements[m[2]] = child;
        }
      }
    },
    appendChild(child) {
      child.parentElement = el;
      el.children.push(child);
      if (child.id && global.document && global.document._elements) {
        global.document._elements[child.id] = child;
      }
      return child;
    },
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return attributes[k] || null; },
    addEventListener(ev, fn) {
      if (!listeners[ev]) listeners[ev] = [];
      listeners[ev].push(fn);
    },
    querySelectorAll(sel) {
      const res = [];
      const walk = (n) => {
        for (const c of n.children) {
          if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) res.push(c);
          walk(c);
        }
      };
      walk(el);
      return res;
    }
  };
  if (tagName.toUpperCase() === 'CANVAS') {
    el.width = 1600;
    el.height = 1200;
    el.getContext = () => createMockCtx(el);
  }
  return el;
}

function createMockCtx(canvas = { width: 1600, height: 1200 }) {
  const calls = [];
  const ctx = {
    calls,
    canvas,
    save: () => calls.push({ op: 'save' }),
    restore: () => calls.push({ op: 'restore' }),
    translate: (x, y) => calls.push({ op: 'translate', x, y }),
    rotate: (a) => calls.push({ op: 'rotate', a }),
    scale: (sx, sy) => calls.push({ op: 'scale', sx, sy }),
    beginPath: () => calls.push({ op: 'beginPath' }),
    closePath: () => calls.push({ op: 'closePath' }),
    arc: (...args) => calls.push({ op: 'arc', args }),
    ellipse: (...args) => calls.push({ op: 'ellipse', args }),
    moveTo: (x, y) => calls.push({ op: 'moveTo', x, y }),
    lineTo: (x, y) => calls.push({ op: 'lineTo', x, y }),
    stroke: () => calls.push({ op: 'stroke' }),
    fill: () => calls.push({ op: 'fill' }),
    fillRect: (x, y, w, h) => calls.push({ op: 'fillRect', x, y, w, h, fillStyle: ctx.fillStyle }),
    strokeRect: (x, y, w, h) => calls.push({ op: 'strokeRect', x, y, w, h }),
    clearRect: (x, y, w, h) => calls.push({ op: 'clearRect', x, y, w, h }),
    fillText: (text, x, y) => calls.push({ op: 'fillText', text, x, y }),
    strokeText: (text, x, y) => calls.push({ op: 'strokeText', text, x, y }),
    drawImage: (...args) => calls.push({ op: 'drawImage', args }),
    setLineDash: (d) => calls.push({ op: 'setLineDash', d }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
  return ctx;
}

function setupMockEnv() {
  const elements = {};
  const winListeners = {};
  const getOrCreate = (id, tag = 'div') => (elements[id] ||= createMockElement(id, tag));

  [
    'screen-lobby', 'screen-room', 'hud', 'modal-gameover', 'modal-pause', 'modal-map-preview',
    'copy-toast', 'lan-ip-display', 'nickname-input', 'room-name-input', 'rooms-list-body',
    'map-selection-grid', 'selected-map-name-label', 'room-map-banner', 'room-map-thumb-canvas',
    'room-map-badge', 'room-map-name', 'room-map-subtitle', 'room-map-desc', 'btn-change-map',
    'btn-preview-current-map', 'preview-modal-canvas', 'preview-modal-badge', 'preview-modal-title',
    'preview-modal-subtitle', 'preview-modal-desc', 'btn-close-map-preview', 'btn-select-this-map',
    'btn-create-room', 'btn-leave-room', 'btn-copy-room', 'btn-ready', 'btn-start-game',
    'btn-sound-toggle', 'btn-restart-game', 'btn-back-lobby', 'btn-resume-game', 'btn-pause-copy',
    'btn-pause-sound', 'btn-pause-leave', 'room-title', 'player-slots-container', 'hud-team-list',
    'hud-wave-title', 'hud-wave-sub', 'hud-combo-text', 'hud-combo-fill', 'hud-weapons-bar',
    'hud-ult-container', 'hud-ult-name', 'hud-ult-status', 'hud-ult-fill', 'hud-ult-hint',
    'go-wave-reached', 'go-total-score', 'go-best-combo'
  ].forEach(id => getOrCreate(id));

  const mockDocument = {
    _elements: elements,
    getElementById: (id) => getOrCreate(id),
    createElement: (tag) => createMockElement('', tag),
    querySelectorAll: () => []
  };

  const mockWindow = {
    innerWidth: 1600,
    innerHeight: 900,
    location: { origin: 'http://localhost:3000' },
    document: mockDocument,
    addEventListener: (ev, fn) => { (winListeners[ev] ||= []).push(fn); },
    dispatchEvent: (ev) => { (winListeners[ev.type] || []).forEach(fn => fn(ev)); }
  };

  global.window = mockWindow;
  global.document = mockDocument;
  global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ lanIp: '127.0.0.1', port: 3000 }) });
  return { elements, mockWindow };
}

test('InputHandler Mage mode casts skills 2-8 instantly with world cursor coordinates and holds [1] to shoot', () => {
  const { mockWindow } = setupMockEnv();
  delete require.cache[require.resolve('../client/js/input.js')];
  const { InputHandler } = require('../client/js/input.js');

  const canvas = createMockElement('gameCanvas', 'canvas');
  const input = new InputHandler(canvas);
  input.isMageMode = true;

  const casts = [];
  input.onSkillCast = (slot, angle, tx, ty) => casts.push({ slot, angle, tx, ty });

  // Move mouse 115px right of screen center -> at 1.15x zoom, worldX = cameraX + 100
  mockWindow.dispatchEvent({ type: 'mousemove', clientX: 800 + 115, clientY: 450 });
  input.updateWorldMouse(500, 600, 1.15);
  assert.strictEqual(Math.round(input.mouse.worldX), 600);
  assert.strictEqual(Math.round(input.mouse.worldY), 600);

  // Key '1' holds shoot
  mockWindow.dispatchEvent({ type: 'keydown', key: '1', code: 'Digit1', repeat: false });
  assert.strictEqual(input.keys.shoot, true);
  mockWindow.dispatchEvent({ type: 'keyup', key: '1', code: 'Digit1' });
  assert.strictEqual(input.keys.shoot, false);

  // Key '5' triggers instant cast with targetX/targetY (ignored on repeat)
  mockWindow.dispatchEvent({ type: 'keydown', key: '5', code: 'Digit5', repeat: false });
  mockWindow.dispatchEvent({ type: 'keydown', key: '5', code: 'Digit5', repeat: true });
  assert.strictEqual(casts.length, 1);
  assert.strictEqual(casts[0].slot, 5);
  assert.strictEqual(Math.round(casts[0].tx), 600);

  // Mouse wheel does not change Mage slot away from 1
  mockWindow.dispatchEvent({ type: 'wheel', deltaY: 100 });
  assert.strictEqual(input.selectedWeaponSlot, 1);
});

test('main.js handleGameEvent routes MAGE_SKILL, MAGE_SHIELD_BREAK, and METEOR_STORM to renderer and soundManager', () => {
  setupMockEnv();
  delete require.cache[require.resolve('../client/js/main.js')];
  const { handleGameEvent } = require('../client/js/main.js');

  const vfxEvents = [];
  const sfxEvents = [];
  const texts = [];
  const mockRnd = {
    camera: { x: 500, y: 500 },
    spawnMageVfx: (ev) => vfxEvents.push(ev),
    addFloatingText: (t) => texts.push(t)
  };
  const mockSnd = {
    playMageSkill: (ev) => sfxEvents.push(ev),
    playUltimate: (id) => sfxEvents.push({ type: 'ULT', id })
  };

  handleGameEvent({ type: 'MAGE_SKILL', skillId: 'CHAIN_LIGHTNING', x: 500, y: 500, links: [] }, {}, { renderer: mockRnd, soundManager: mockSnd });
  handleGameEvent({ type: 'MAGE_SHIELD_BREAK', x: 500, y: 500 }, {}, { renderer: mockRnd, soundManager: mockSnd });
  handleGameEvent({ type: 'ULTIMATE', ultId: 'METEOR_STORM', x: 600, y: 600, radius: 300 }, {}, { renderer: mockRnd, soundManager: mockSnd });

  assert.strictEqual(vfxEvents.length, 3);
  assert.strictEqual(sfxEvents.length, 3);
  assert.ok(texts.some(t => t.includes('METEOR STORM')));
});
