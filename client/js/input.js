const WEAPON_KEYS = ['PISTOL', 'UZI', 'SHOTGUN', 'BARRICADE', 'BARREL', 'GRENADE', 'ROCKET', 'RAILGUN'];
const WARRIOR_STANCES = ['BERSERKER_STANCE', 'JUGGERNAUT_STANCE'];

class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false,
      revive: false
    };

    const hasWin = typeof window !== 'undefined';
    this.mouse = {
      screenX: hasWin ? window.innerWidth / 2 : 800,
      screenY: hasWin ? window.innerHeight / 2 : 450,
      worldX: 800,
      worldY: 600,
      angle: 0,
      isDown: false
    };

    this.selectedWeaponSlot = 1;
    this.selectedWeaponId = 'PISTOL';
    this.isWarriorMode = false;
    this.isMageMode = false;
    this.onWeaponChange = null;
    this.onSkillCast = null;
    this.onTogglePause = null;
    this.onUltimate = null;
    this.onSkillCast = null;
    this.setupListeners();
  }

  resetKeys() {
    this.keys.up = false;
    this.keys.down = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.shoot = false;
    this.keys.revive = false;
    this.mouse.isDown = false;
  }

  updateWorldMouse(cameraX, cameraY, zoom = 1.15) {
    if (typeof window === 'undefined') return;
    if (typeof cameraX !== 'number' || typeof cameraY !== 'number') return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const scale = zoom > 0 ? zoom : 1;
    this.mouse.worldX = cameraX + (this.mouse.screenX - cx) / scale;
    this.mouse.worldY = cameraY + (this.mouse.screenY - cy) / scale;
  }

  setWeaponSlot(slot, silent = false) {
    if (this.isMageMode) {
      this.selectedWeaponSlot = 1;
      this.selectedWeaponId = 'ARCANE_BOLT';
      return;
    }
    if (this.isWarriorMode) {
      const num = slot === 2 ? 2 : 1;
      const wid = WARRIOR_STANCES[num - 1] || 'BERSERKER_STANCE';
      this.selectedWeaponSlot = num;
      this.selectedWeaponId = wid;
      if (!silent && typeof this.onWeaponChange === 'function') {
        this.onWeaponChange(this.selectedWeaponSlot, this.selectedWeaponId);
      }
      return;
    }
    const num = Math.max(1, Math.min(8, slot));
    const wid = WEAPON_KEYS[num - 1] || 'PISTOL';
    this.selectedWeaponSlot = num;
    this.selectedWeaponId = wid;
    if (!silent && typeof this.onWeaponChange === 'function') {
      this.onWeaponChange(this.selectedWeaponSlot, this.selectedWeaponId);
    }
  }

  setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      // Audio resume on first action
      if (window.soundManager) window.soundManager.ensureContext();

      const k = e.key ? e.key.toLowerCase() : '';
      if (k === 'w' || e.key === 'ArrowUp') this.keys.up = true;
      if (k === 's' || e.key === 'ArrowDown') this.keys.down = true;
      if (k === 'a' || e.key === 'ArrowLeft') this.keys.left = true;
      if (k === 'd' || e.key === 'ArrowRight') this.keys.right = true;
      if (k === 'e') this.keys.revive = true;
      if (e.code === 'Space') this.keys.shoot = true;

      // Ultimate key (F)
      if (k === 'f' && !e.repeat) {
        if (typeof this.onUltimate === 'function') {
          this.onUltimate(this.mouse.angle, this.mouse.worldX, this.mouse.worldY);
        }
      }

      // ESC key for pause menu
      if (e.key === 'Escape') {
        if (typeof this.onTogglePause === 'function') {
          this.onTogglePause();
        }
      }

      // Weapon slots 1-8 / Warrior skills 1-8 / Mage skills 1-8
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) {
        if (this.isMageMode) {
          if (num === 1) {
            this.keys.shoot = true;
          } else if (!e.repeat && typeof this.onSkillCast === 'function') {
            this.onSkillCast(num, this.mouse.angle, this.mouse.worldX, this.mouse.worldY);
          }
        } else if (this.isWarriorMode) {
          if (num === 1 || num === 2) {
            const stance = WARRIOR_STANCES[num - 1];
            if (typeof this.onWeaponChange === 'function') {
              this.onWeaponChange(num, stance);
            } else {
              this.setWeaponSlot(num);
            }
          } else if (num >= 3 && num <= 8) {
            if (!e.repeat && typeof this.onSkillCast === 'function') {
              this.onSkillCast(num, this.mouse.angle);
            }
          }
        } else {
          if (typeof this.onWeaponChange === 'function') {
            this.onWeaponChange(num, WEAPON_KEYS[num - 1]);
          } else {
            this.setWeaponSlot(num);
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key ? e.key.toLowerCase() : '';
      if (k === 'w' || e.key === 'ArrowUp') this.keys.up = false;
      if (k === 's' || e.key === 'ArrowDown') this.keys.down = false;
      if (k === 'a' || e.key === 'ArrowLeft') this.keys.left = false;
      if (k === 'd' || e.key === 'ArrowRight') this.keys.right = false;
      if (k === 'e') this.keys.revive = false;
      if (e.code === 'Space') this.keys.shoot = false;
      if (this.isMageMode && e.key === '1') this.keys.shoot = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.screenX = e.clientX;
      this.mouse.screenY = e.clientY;
      this.updateAngle();
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (window.soundManager) window.soundManager.ensureContext();
        this.mouse.isDown = true;
        this.keys.shoot = true;
      } else if (e.button === 2) {
        // Right-Click for Ultimate
        if (window.soundManager) window.soundManager.ensureContext();
        if (typeof this.onUltimate === 'function') {
          this.onUltimate(this.mouse.angle, this.mouse.worldX, this.mouse.worldY);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.isDown = false;
        this.keys.shoot = false;
      }
    });

    window.addEventListener('wheel', (e) => {
      if (this.isMageMode) return;
      if (this.isWarriorMode) {
        const nextSlot = this.selectedWeaponSlot === 1 ? 2 : 1;
        const stance = WARRIOR_STANCES[nextSlot - 1];
        if (typeof this.onWeaponChange === 'function') {
          this.onWeaponChange(nextSlot, stance);
        } else {
          this.setWeaponSlot(nextSlot);
        }
        return;
      }

      let nextSlot = this.selectedWeaponSlot;
      if (e.deltaY > 0) {
        nextSlot = this.selectedWeaponSlot >= 8 ? 1 : this.selectedWeaponSlot + 1;
      } else {
        nextSlot = this.selectedWeaponSlot <= 1 ? 8 : this.selectedWeaponSlot - 1;
      }
      if (typeof this.onWeaponChange === 'function') {
        this.onWeaponChange(nextSlot, WEAPON_KEYS[nextSlot - 1]);
      } else {
        this.setWeaponSlot(nextSlot);
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateAngle() {
    if (typeof window === 'undefined') return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.mouse.angle = Math.atan2(this.mouse.screenY - cy, this.mouse.screenX - cx);
  }

  getInputPayload() {
    return {
      up: this.keys.up,
      down: this.keys.down,
      left: this.keys.left,
      right: this.keys.right,
      angle: Number(this.mouse.angle.toFixed(3)),
      shoot: this.keys.shoot,
      revive: this.keys.revive,
      weaponId: this.isMageMode ? 'ARCANE_BOLT' : this.selectedWeaponId
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InputHandler, WEAPON_KEYS, WARRIOR_STANCES };
}
if (typeof window !== 'undefined') {
  window.InputHandler = InputHandler;
  window.WARRIOR_STANCES = WARRIOR_STANCES;
}
