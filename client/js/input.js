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

    this.mouse = {
      screenX: window.innerWidth / 2,
      screenY: window.innerHeight / 2,
      worldX: 800,
      worldY: 600,
      angle: 0,
      isDown: false
    };

    this.selectedWeaponSlot = 1;
    this.selectedWeaponId = 'PISTOL';
    this.onWeaponChange = null;
    this.onTogglePause = null;
    this.onUltimate = null;
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

  setWeaponSlot(slot, silent = false) {
    const num = Math.max(1, Math.min(8, slot));
    const WEAPON_KEYS = ['PISTOL', 'UZI', 'SHOTGUN', 'BARRICADE', 'BARREL', 'GRENADE', 'ROCKET', 'RAILGUN'];
    const wid = WEAPON_KEYS[num - 1] || 'PISTOL';
    this.selectedWeaponSlot = num;
    this.selectedWeaponId = wid;
    if (!silent && typeof this.onWeaponChange === 'function') {
      this.onWeaponChange(this.selectedWeaponSlot, this.selectedWeaponId);
    }
  }

  unlockAudioFromInput() {
    if (typeof window === 'undefined' || !window.soundManager) return;
    if (typeof window.soundManager.unlockFromGesture === 'function') {
      window.soundManager.unlockFromGesture();
    } else if (typeof window.soundManager.ensureContext === 'function') {
      window.soundManager.ensureContext();
    }
  }

  setupListeners() {
    const WEAPON_KEYS = ['PISTOL', 'UZI', 'SHOTGUN', 'BARRICADE', 'BARREL', 'GRENADE', 'ROCKET', 'RAILGUN'];

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      // Audio resume on first action
      this.unlockAudioFromInput();

      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') this.keys.up = true;
      if (k === 's' || e.key === 'ArrowDown') this.keys.down = true;
      if (k === 'a' || e.key === 'ArrowLeft') this.keys.left = true;
      if (k === 'd' || e.key === 'ArrowRight') this.keys.right = true;
      if (k === 'e') this.keys.revive = true;
      if (e.code === 'Space') this.keys.shoot = true;

      // Ultimate key (F)
      if (k === 'f' && !e.repeat) {
        if (typeof this.onUltimate === 'function') {
          this.onUltimate(this.mouse.angle);
        }
      }

      // ESC key for pause menu
      if (e.key === 'Escape') {
        if (typeof this.onTogglePause === 'function') {
          this.onTogglePause();
        }
      }

      // Weapon slots 1-8
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) {
        if (typeof this.onWeaponChange === 'function') {
          this.onWeaponChange(num, WEAPON_KEYS[num - 1]);
        } else {
          this.setWeaponSlot(num);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') this.keys.up = false;
      if (k === 's' || e.key === 'ArrowDown') this.keys.down = false;
      if (k === 'a' || e.key === 'ArrowLeft') this.keys.left = false;
      if (k === 'd' || e.key === 'ArrowRight') this.keys.right = false;
      if (k === 'e') this.keys.revive = false;
      if (e.code === 'Space') this.keys.shoot = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.screenX = e.clientX;
      this.mouse.screenY = e.clientY;
      this.updateAngle();
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.unlockAudioFromInput();
        this.mouse.isDown = true;
        this.keys.shoot = true;
      } else if (e.button === 2) {
        // Right-Click for Ultimate
        this.unlockAudioFromInput();
        if (typeof this.onUltimate === 'function') {
          this.onUltimate(this.mouse.angle);
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
      weaponId: this.selectedWeaponId
    };
  }
}

window.InputHandler = InputHandler;
