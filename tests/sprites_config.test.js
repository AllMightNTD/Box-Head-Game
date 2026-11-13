const test = require('node:test');
const assert = require('node:assert/strict');
const { SpriteSheetManager, SPRITE_CONFIG } = require('../client/js/sprites.js');

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
