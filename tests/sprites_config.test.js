const test = require('node:test');
const assert = require('node:assert/strict');
const { SpriteSheetManager, SPRITE_CONFIG } = require('../client/js/sprites.js');
const { Renderer } = require('../client/js/renderer.js');

test('SpriteSheetManager - Ánh xạ chuẩn 8 góc Octant sang đúng Row của Boxhead Studio', () => {
    const manager = new SpriteSheetManager();

    // 0 rad (Right) -> Row 2
    assert.equal(manager.angleToDirectionRow(0), 2);
    // PI/4 (Down-Right) -> Row 1
    assert.equal(manager.angleToDirectionRow(Math.PI / 4), 1);
    // PI/2 (Down) -> Row 0
    assert.equal(manager.angleToDirectionRow(Math.PI / 2), 0);
    // 3*PI/4 (Down-Left) -> Row 5
    assert.equal(manager.angleToDirectionRow((3 * Math.PI) / 4), 5);
    // PI (Left) -> Row 6
    assert.equal(manager.angleToDirectionRow(Math.PI), 6);
    // -3*PI/4 (Up-Left) -> Row 7
    assert.equal(manager.angleToDirectionRow((-3 * Math.PI) / 4), 7);
    // -PI/2 (Up) -> Row 4
    assert.equal(manager.angleToDirectionRow(-Math.PI / 2), 4);
    // -PI/4 (Up-Right) -> Row 3
    assert.equal(manager.angleToDirectionRow(-Math.PI / 4), 3);
});

test('SpriteSheetManager - Cắt tọa độ sx, sy chuẩn 32x32 cho walk, attack, hit, death', () => {
    const manager = new SpriteSheetManager();

    // Walk lặp vòng 6 cột (0..5)
    const walkFrame = manager.getFrameSource(1, 'walk', 7); // 7 % 6 = cột 1
    assert.equal(walkFrame.colIndex, 1);
    assert.equal(walkFrame.sx, 32);
    assert.equal(walkFrame.sy, 32);

    // Attack bắt đầu từ cột 6 (6..8)
    const atkFrame = manager.getFrameSource(2, 'attack', 1); // cột 7
    assert.equal(atkFrame.colIndex, 7);
    assert.equal(atkFrame.sx, 7 * 32);
    assert.equal(atkFrame.sy, 2 * 32);

    // Death không lặp, giữ nguyên ở frame cuối (cột 15) khi tick vượt quá 4
    const deathEnd = manager.getFrameSource(0, 'death', 99);
    assert.equal(deathEnd.colIndex, 15);
    assert.equal(deathEnd.sx, 15 * 32);
    assert.equal(deathEnd.sy, 0);
});

test('SpriteSheetManager - preloadAll resolves cleanly in Node environment', async () => {
    const manager = new SpriteSheetManager();
    await manager.preloadAll();
    assert.equal(manager.isReady, true);
    assert.equal(manager.loadedCount, 9);
});

test('Renderer.drawBoxyPlayer - Happy Path: Không vẽ khối súng đen 360° khi đã có Sprite Sheet và thu gọn bóng chân khớp vòng sáng', () => {
    // Arrange
    const ellipses = [];
    const mockCtx = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        beginPath: () => {},
        ellipse: (x, y, rx, ry) => ellipses.push({ x, y, rx, ry }),
        stroke: () => {},
        fill: () => {},
        fillRect: () => {},
        fillText: () => {},
        drawImage: () => {}
    };
    const mockCanvas = { getContext: () => mockCtx, width: 800, height: 600 };
    const renderer = new Renderer(mockCanvas);

    let weapon360Called = false;
    renderer.drawWeapon360 = () => { weapon360Called = true; };

    const prevWindow = global.window;
    global.window = {
        spriteManager: {
            angleToDirectionRow: () => 4,
            getSprite: () => ({
                image: { complete: true, naturalWidth: 512 }
            }),
            getFrameSource: () => ({ sx: 0, sy: 128, sWidth: 32, sHeight: 32 })
        }
    };

    const player = {
        id: 'p1',
        name: 'Hero_1',
        character: 'HUMAN',
        x: 500,
        y: 400,
        angle: -Math.PI / 2,
        hp: 100,
        maxHp: 100,
        isMoving: false,
        isDowned: false
    };

    try {
        // Act
        renderer.drawBoxyPlayer(mockCtx, player, true);

        // Assert
        assert.equal(weapon360Called, false, 'Không được gọi drawWeapon360 đè lên sprite nhân vật');
        const footShadow = ellipses.find(e => e.rx === 14 && e.ry === 6);
        assert.ok(footShadow, 'Bóng chân phải được thu gọn về bán kính 14x6 nằm trong vòng sáng 18x9');
        assert.equal(footShadow.y, 424, 'Tâm Y của bóng chân phải trùng với tâm vòng sáng (player.y + 24)');
    } finally {
        global.window = prevWindow;
    }
});

test('Renderer.drawBoxyPlayer - Unhappy Path: Vẫn gọi fallback và drawWeapon360 khi Sprite chưa tải được', () => {
    // Arrange
    const mockCtx = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        beginPath: () => {},
        ellipse: () => {},
        stroke: () => {},
        fill: () => {},
        fillRect: () => {},
        fillText: () => {},
        drawImage: () => {}
    };
    const mockCanvas = { getContext: () => mockCtx, width: 800, height: 600 };
    const renderer = new Renderer(mockCanvas);

    let fallbackCalled = false;
    let weapon360Called = false;
    renderer.drawBoxyPlayerFallback = () => { fallbackCalled = true; };
    renderer.drawWeapon360 = () => { weapon360Called = true; };

    const prevWindow = global.window;
    global.window = {
        spriteManager: {
            angleToDirectionRow: () => 0,
            getSprite: () => ({ image: null })
        }
    };

    const player = {
        id: 'p1',
        name: 'Hero_1',
        character: 'HUMAN',
        x: 500,
        y: 400,
        angle: 0,
        hp: 100,
        maxHp: 100,
        isMoving: false,
        isDowned: false
    };

    try {
        // Act
        renderer.drawBoxyPlayer(mockCtx, player, true);

        // Assert
        assert.equal(fallbackCalled, true, 'Phải gọi drawBoxyPlayerFallback khi thiếu sprite');
        assert.equal(weapon360Called, true, 'Phải gọi drawWeapon360 trong chế độ fallback');
    } finally {
        global.window = prevWindow;
    }
});
