/**
 * client/js/sprites.js
 * Quản lý nạp Sprite Sheet 512x256 (16 cột x 8 hàng, 32x32px)
 * và ánh xạ góc xoay 360 độ sang đúng hàng (Row) của Boxhead Studio.
 */

const SPRITE_CONFIG = {
    FRAME_SIZE: 32,
    TOTAL_COLS: 16,
    TOTAL_ROWS: 8,
    ANIMATIONS: {
        walk:   { startCol: 0,  count: 6, loop: true  },
        attack: { startCol: 6,  count: 3, loop: false },
        hit:    { startCol: 9,  count: 2, loop: false },
        death:  { startCol: 11, count: 5, loop: false }
    },
    ROW_BY_DIRECTION: {
        down:       0,
        down_right: 1,
        right:      2,
        up_right:   3,
        up:         4,
        down_left:  5,
        left:       6,
        up_left:    7
    },
    // Ánh xạ chuẩn từ Octant (0..7) sang Row của Sprite Sheet Boxhead Studio
    OCTANT_TO_ROW: [2, 1, 0, 5, 6, 7, 4, 3]
};

class SpriteSheetManager {
    constructor() {
        this.images = {};
        this.loadedCount = 0;
        this.totalCount = 0;
        this.isReady = false;
    }

    preloadAll(basePath = '/assets/sprites') {
        const manifest = {
            HUMAN:   `${basePath}/characters/hero_human.png`,
            WARRIOR: `${basePath}/characters/hero_warrior.png`,
            MAGE:    `${basePath}/characters/hero_mage.png`,
            NORMAL:  `${basePath}/zombies/zombie_normal.png`,
            RUNNER:  `${basePath}/zombies/zombie_runner.png`,
            TANK:    `${basePath}/zombies/zombie_tank.png`,
            DEVIL:   `${basePath}/zombies/zombie_devil.png`,
            VAMPIRE: `${basePath}/zombies/zombie_vampire.png`,
            MUMMY:   `${basePath}/zombies/zombie_mummy.png`
        };

        const keys = Object.keys(manifest);
        this.totalCount = keys.length;

        const promises = keys.map(key => {
            return new Promise((resolve) => {
                if (typeof Image === 'undefined') {
                    this.loadedCount++;
                    if (this.loadedCount === this.totalCount) this.isReady = true;
                    resolve(null);
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    this.loadedCount++;
                    if (this.loadedCount === this.totalCount) this.isReady = true;
                    resolve(img);
                };
                img.onerror = () => {
                    console.warn(`[SpriteSheetManager] Không thể tải: ${manifest[key]}`);
                    resolve(null);
                };
                img.src = manifest[key];
                this.images[key] = img;
            });
        });

        return Promise.all(promises);
    }

    angleToDirectionRow(angleRad) {
        if (typeof angleRad !== 'number' || Number.isNaN(angleRad)) {
            return SPRITE_CONFIG.ROW_BY_DIRECTION.down;
        }
        const twoPi = Math.PI * 2;
        const normalized = ((angleRad % twoPi) + twoPi) % twoPi;
        const octant = Math.floor(((normalized + Math.PI / 8) % twoPi) / (Math.PI / 4));
        return SPRITE_CONFIG.OCTANT_TO_ROW[octant];
    }

    getSprite(arg1, arg2) {
        const key = arg2 || arg1;
        const img = this.images[key] || null;
        return {
            image: img,
            isLoaded: Boolean(img && img.complete && img.naturalWidth > 0)
        };
    }

    getFrameSource(arg1, arg2, arg3, arg4, arg5) {
        let dirRow, animName, frameTick;
        if (typeof arg1 === 'number') {
            dirRow = arg1;
            animName = arg2 || 'walk';
            frameTick = arg3 || 0;
        } else {
            // Called with (category, key, animName, dirRow, frameTick)
            animName = arg3 || 'walk';
            dirRow = typeof arg4 === 'number' ? arg4 : 0;
            frameTick = arg5 || 0;
        }
        const anim = SPRITE_CONFIG.ANIMATIONS[animName] || SPRITE_CONFIG.ANIMATIONS.walk;
        const safeRow = Math.max(0, Math.min(SPRITE_CONFIG.TOTAL_ROWS - 1, dirRow));

        let localFrame = 0;
        if (anim.loop) {
            localFrame = Math.abs(Math.floor(frameTick)) % anim.count;
        } else {
            localFrame = Math.min(anim.count - 1, Math.max(0, Math.floor(frameTick)));
        }

        const colIndex = anim.startCol + localFrame;
        return {
            sx: colIndex * SPRITE_CONFIG.FRAME_SIZE,
            sy: safeRow * SPRITE_CONFIG.FRAME_SIZE,
            sw: SPRITE_CONFIG.FRAME_SIZE,
            sh: SPRITE_CONFIG.FRAME_SIZE,
            sWidth: SPRITE_CONFIG.FRAME_SIZE,
            sHeight: SPRITE_CONFIG.FRAME_SIZE,
            colIndex,
            rowIndex: safeRow
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpriteSheetManager, SPRITE_CONFIG };
}
if (typeof window !== 'undefined') {
    window.SpriteSheetManager = SpriteSheetManager;
    window.SPRITE_CONFIG = SPRITE_CONFIG;
    window.spriteManager = window.spriteManager || new SpriteSheetManager();
}
