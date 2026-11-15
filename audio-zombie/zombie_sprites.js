// zombie_sprites.js - dùng sprite sheet zombie với HTML5 canvas (không cần thư viện)
// Đặt cùng thư mục với các file zombie_<tên>_spritesheet.png. Chạy được cả khi mở file:// trực tiếp.
//
// Ví dụ:
//   const sheets = await loadZombieSheets(["normal", "rotten", "butcher"]);
//   const z = new Zombie(sheets.rotten, 200, 200);        // (x, y) = vị trí chân
//   // mỗi frame:  z.face(player.x - z.x, player.y - z.y); z.update(dt); z.draw(ctx);
//   // khi bị bắn: z.play("hit");   khi chết: z.play("die");   khi cắn: z.play("attack");

const ZOMBIE_CELL = { normal: 32, fast: 32, big: 48, rotten: 32, ghoul: 32,
                      butcher: 48, boomer: 32, burned: 32, mutant: 40 };
const ZOMBIE_DIRS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"];
// [khối animation, số frame, fps, lặp?]
const ZOMBIE_ANIMS = {
  idle:   [0, 1, 1,  true],
  walk:   [1, 6, 10, true],
  attack: [2, 3, 9,  false],
  hit:    [3, 2, 12, false],
  die:    [4, 5, 8,  false],
};

function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("Không tải được " + src));
    img.src = src;
  });
}

async function loadZombieSheets(names, folder = "") {
  const sheets = {};
  for (const n of names) {
    sheets[n] = { img: await loadImage(`${folder}zombie_${n}_spritesheet.png`), cell: ZOMBIE_CELL[n] };
  }
  return sheets;
}

// hướng từ vector di chuyển (trục y hướng xuống)
function dirFromVector(dx, dy) {
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return { "2": "S", "1": "SE", "0": "E", "-1": "NE", "-2": "N",
           "-3": "NW", "-4": "W", "4": "W", "3": "SW" }[a];
}

class Zombie {
  constructor(sheet, x, y, scale = 2) {
    Object.assign(this, { sheet, x, y, scale, dir: "S", anim: "walk", t: 0, done: false });
  }
  play(anim) {                       // đổi animation, chỉ reset khi khác animation hiện tại
    if (this.anim !== anim) { this.anim = anim; this.t = 0; this.done = false; }
  }
  face(dx, dy) { if (dx || dy) this.dir = dirFromVector(dx, dy); }
  update(dt) {                       // dt tính bằng giây
    const [, n, fps, loop] = ZOMBIE_ANIMS[this.anim];
    this.t += dt * fps;
    if (!loop && this.t >= n) { this.t = n - 1; this.done = true; }   // die giữ frame cuối
  }
  draw(ctx) {
    const { img, cell } = this.sheet;
    const [block, n, , loop] = ZOMBIE_ANIMS[this.anim];
    const f = loop ? Math.floor(this.t) % n : Math.min(Math.floor(this.t), n - 1);
    const row = block * 8 + ZOMBIE_DIRS.indexOf(this.dir);
    const size = cell * this.scale;  // nên dùng scale số nguyên để pixel không bị méo
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, f * cell, row * cell, cell, cell,
                  Math.round(this.x - size / 2), Math.round(this.y - size * 0.875), size, size);
  }
}
