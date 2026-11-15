// zombie_audio.js - phát âm thanh zombie trong game HTML5 (Web Audio API, không cần thư viện)
// Cấu trúc thư mục:  audio/<loại>/<sự kiện>_<n>.wav   (giải nén zombie_audio.zip)
// LƯU Ý: trình duyệt chặn fetch trên file://, hãy chạy qua server cục bộ, ví dụ:  python3 -m http.server
//        và chỉ tạo ZombieAudio sau cú click/phím đầu tiên của người chơi (chính sách autoplay).
//
// Ví dụ:
//   const sfx = new ZombieAudio();
//   await sfx.load(["rotten", "ghoul", "butcher"]);                 // chỉ tải loại cần dùng
//   const pos = { x: z.x, y: z.y, listenerX: player.x, listenerY: player.y, maxDist: 700 };
//   sfx.play("rotten", "aggro", pos);                              // phát hiện người chơi
//   sfx.play("ghoul", "attack", pos);  sfx.play("burned", "hit", pos);  sfx.play("mutant", "die", pos);
//   // mỗi frame:  sfx.idleTick(z.snd, "rotten", dt, pos);          // tự rên ngẫu nhiên 3-8 giây/lần
//   //             sfx.stepOnFrame(z.snd, "rotten", walkFrame, pos); // bước chân khớp animation đi bộ

const ZOMBIE_SFX_COUNT = { idle: 3, aggro: 1, attack: 2, hit: 2, die: 1, step: 3 };
const ZOMBIE_SFX_VOL   = { idle: .55, aggro: 1, attack: .9, hit: .8, die: 1, step: .45 };

class ZombieAudio {
  constructor(maxVoices = 24) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.buf = {};
    this.voices = 0;
    this.maxVoices = maxVoices;
  }

  async load(types, folder = "audio/") {
    for (const t of types) {
      for (const [ev, n] of Object.entries(ZOMBIE_SFX_COUNT)) {
        for (let i = 1; i <= n; i++) {
          const res = await fetch(`${folder}${t}/${ev}_${i}.wav`);
          if (!res.ok) throw new Error(`Không tải được ${t}/${ev}_${i}.wav`);
          const audio = await this.ctx.decodeAudioData(await res.arrayBuffer());
          (this.buf[`${t}/${ev}`] ||= []).push(audio);
        }
      }
    }
  }

  // o: { x, y, listenerX, listenerY, maxDist, volume, pitch }
  play(type, ev, o = {}) {
    const list = this.buf[`${type}/${ev}`];
    if (!list || this.voices >= this.maxVoices) return;
    if (this.ctx.state === "suspended") this.ctx.resume();

    let vol = (ZOMBIE_SFX_VOL[ev] ?? 1) * (o.volume ?? 1);
    let pan = 0;
    if (o.x !== undefined) {                       // âm lượng giảm theo khoảng cách, pan trái/phải
      const dx = o.x - (o.listenerX ?? 0), dy = (o.y ?? 0) - (o.listenerY ?? 0);
      const md = o.maxDist ?? 700;
      vol *= Math.max(0, 1 - Math.hypot(dx, dy) / md);
      pan = Math.max(-1, Math.min(1, dx / md));
    }
    if (vol < 0.01) return;

    const src = this.ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = (o.pitch ?? 1) * (0.94 + Math.random() * 0.12);   // mỗi con một giọng
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    src.connect(gain).connect(panner).connect(this.master);
    this.voices++;
    src.onended = () => this.voices--;
    src.start();
  }

  idleTick(state, type, dt, o = {}) {              // state: object riêng của từng zombie
    state.idleT = (state.idleT ?? 2 + Math.random() * 6) - dt;
    if (state.idleT <= 0) { this.play(type, "idle", o); state.idleT = 3 + Math.random() * 5; }
  }

  stepOnFrame(state, type, frame, o = {}) {        // gọi mỗi frame với chỉ số frame đi bộ (0..5)
    if (frame !== state.lastFrame && (frame === 0 || frame === 3)) this.play(type, "step", o);
    state.lastFrame = frame;
  }
}
