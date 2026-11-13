from PIL import Image, ImageDraw, ImageFont
import math, os, json, types

OUT_DIR = "/mnt/user-data/outputs"
os.makedirs(OUT_DIR, exist_ok=True)

OUT = (30, 30, 30, 255)
WHITE = (235, 235, 222, 255)
BLOOD = (150, 24, 24, 255)
SHADOW = (0, 0, 0, 70)
FAR_SH = (24, 26, 40, 255)


def rgba(t):
    return (*t, 255)


# ---------------------------------------------------------------- biến thể
VARIANTS = {
    # zombie thường: xanh lá
    "normal": dict(k=1.0, skin=(122, 154, 107), skin_d=(79, 107, 71),
                   shirt=(110, 88, 66), shirt_d=(78, 62, 46),
                   pants=(58, 63, 92), pants_d=(40, 44, 66), shoe=(52, 42, 36),
                   hair=(48, 36, 30), hair_l=(74, 58, 48), eye=(236, 204, 64),
                   bw=10, lw=4, aw=4),
    # zombie nhanh: gầy, da đỏ nhạt
    "fast": dict(k=1.0, skin=(222, 150, 140), skin_d=(172, 106, 100),
                 shirt=(96, 88, 92), shirt_d=(66, 60, 64),
                 pants=(78, 58, 62), pants_d=(54, 40, 44), shoe=(44, 34, 34),
                 hair=(84, 30, 34), hair_l=(120, 50, 54), eye=(255, 255, 255),
                 bw=6, lw=2, aw=3),
    # zombie to: scale 1.5x, áo đậm
    "big": dict(k=1.5, skin=(96, 136, 92), skin_d=(62, 94, 62),
                shirt=(54, 48, 66), shirt_d=(36, 32, 46),
                pants=(44, 44, 54), pants_d=(30, 30, 38), shoe=(36, 30, 30),
                hair=(28, 22, 22), hair_l=(50, 40, 40), eye=(230, 70, 50),
                bw=10, lw=4, aw=4),
}
for _v in VARIANTS.values():
    for _k in ("skin", "skin_d", "shirt", "shirt_d", "pants", "pants_d",
               "shoe", "hair", "hair_l", "eye"):
        _v[_k] = rgba(_v[_k])


# ---------------------------------------------------------------- cọ vẽ (có scale)
class Pen:
    def __init__(self, size, k):
        self.img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)
        self.k = k

    def sc(self, v):
        return math.floor(v * self.k + 0.5)

    def m(self, a, b):
        return self.sc(a), self.sc(b + 1) - 1

    def R(self, x0, y0, x1, y1, c):
        a, b = self.m(x0, x1)
        c0, d0 = self.m(y0, y1)
        if a <= b and c0 <= d0:
            self.d.rectangle([a, c0, b, d0], fill=c)

    def P(self, pts, c):
        for x, y in pts:
            self.R(x, y, x, y, c)

    def box(self, x0, y0, x1, y1, fill, shade):
        a, b = self.m(x0, x1)
        c0, d0 = self.m(y0, y1)
        if a > b or c0 > d0:
            return
        self.d.rectangle([a - 1, c0 - 1, b + 1, d0 + 1], fill=OUT)  # viền 1px
        self.d.rectangle([a, c0, b, d0], fill=fill)
        self.d.rectangle([b, c0, b, d0], fill=shade)
        self.d.rectangle([a, d0, b, d0], fill=shade)


def darker(col, f=0.7):
    return (int(col[0] * f), int(col[1] * f), int(col[2] * f), 255)


# ---------------------------------------------------------------- tay
def arm_pose(view, atk, s):
    back = view in ("N", "NE")
    if atk is None:
        return dict(tl=s, bl=s, tr=-s, br=-s, ht=False)
    if not back:
        tl, bl, ht = [(-6, -3, True), (0, 3, False), (-2, -1, False)][atk]
    else:
        tl, bl, ht = [(1, 2, False), (-6, -4, True), (-3, -2, True)][atk]
    return dict(tl=tl, bl=bl, tr=tl, br=bl, ht=ht)


# ---------------------------------------------------------------- vẽ hướng S, SE, N, NE
def draw_front(c):
    R, P, box, T, view = c.R, c.P, c.box, c.T, c.view
    back = view in ("N", "NE")
    turn = view in ("SE", "NE")
    bx0o = 16 - c.bw // 2
    bx1 = bx0o + c.bw - 1
    bx0 = bx0o + (1 if turn else 0)
    lw, aw = c.lw, c.aw

    # chân
    for x0, x1, lift in ((bx0, bx0 + lw - 1, c.lift_l), (bx1 - lw + 1, bx1, c.lift_r)):
        y1 = 28 - lift
        y0 = min(24 + T, y1)
        box(x0, y0, x1, y1, c.PA, c.PAD)
        R(x0, y1, x1, y1, c.SHO)

    # tay
    ap = arm_pose(view, c.atk, c.s)

    def arm(x0, x1, top, bot, ht, dy=0):
        y0 = 16 + T + top + dy
        y1 = 22 + T + bot + dy
        box(x0, y0, x1, y1, c.SH, c.SHD)
        if ht:
            R(x0, y0, x1, y0 + 2, c.SK)
            R(x0, y0, x1, y0, c.SKD)
        else:
            R(x0, y1 - 2, x1, y1, c.SK)
            R(x0, y1, x1, y1, c.SKD)

    far = ((bx0 - (aw - 1)) if turn else (bx0 - aw), bx0 - 1)
    near = (bx1 + 1, bx1 + aw + (1 if turn else 0))
    arm(far[0], far[1], ap["tl"], ap["bl"], ap["ht"])
    if not turn:
        arm(near[0], near[1], ap["tr"], ap["br"], ap["ht"])

    # thân
    box(bx0, 15 + T, bx1, 22 + T, c.SH, c.SHD)

    def bR(x0, y0, x1, y1, col):
        x0, x1 = max(x0, bx0), min(x1, bx1)
        if x0 <= x1:
            R(x0, y0, x1, y1, col)

    def bP(pts, col):
        for x, y in pts:
            if bx0 <= x <= bx1:
                P([(x, y)], col)

    if not back:
        bR(13, 19 + T, 15, 21 + T, c.SK)                 # áo rách lộ bụng
        bP([(14, 20 + T)], c.SKD)
        bP([(17, 17 + T), (18, 17 + T), (18, 18 + T)], BLOOD)
    else:
        bP([(15, 16 + T), (15, 17 + T), (16, 18 + T), (16, 19 + T)], c.SHD)  # vết rách sau lưng
        bP([(18, 18 + T), (18, 19 + T), (19, 19 + T)], BLOOD)
    bP([(x, 22 + T) for x in (bx0 + 1, bx0 + 6, bx0 + 8)], c.PAD)           # gấu áo tả tơi

    if turn:  # tay gần camera vẽ đè lên thân
        arm(near[0], near[1], ap["tr"], ap["br"], ap["ht"], 1)

    # đầu vuông
    t = lambda y: y + T
    box(10, t(2), 21, t(13), c.SK, c.SKD)
    if not back:
        R(10, t(2), 21, t(2), c.HA)
        P([(x, t(3)) for x in (10, 11, 14, 16, 19, 21)], c.HA)
        ex = [(12, 14), (17, 19)] if not turn else [(14, 15), (19, 20)]
        pu = [13, 18] if not turn else [15, 20]
        nose = (15, 16) if not turn else (17, 18)
        mx0, mx1 = (12, 19) if not turn else (14, 20)
        for (a, z) in ex:
            R(a, t(5), z, t(5), OUT)                       # lông mày
            if c.dead:
                R(a, t(6), z, t(7), c.SK)
                R(a, t(7), z, t(7), OUT)                   # mắt nhắm
            else:
                R(a, t(6), z, t(7), c.EY)
        if not c.dead:
            P([(x, t(7)) for x in pu], OUT)                # con ngươi
        R(nose[0], t(8), nose[1], t(8), c.SKD)
        wide = (c.atk == 1) or c.open
        my0, my1 = (9, 12) if wide else (10, 11)
        R(mx0, t(my0), mx1, t(my1), OUT)                   # miệng
        if wide:
            R(mx0 + 2, t(my0 + 1), mx1 - 2, t(my1 - 1), BLOOD)
        P([(x, t(my0)) for x in range(mx0 + 1, mx1 + 1, 2)], WHITE)
        P([(x, t(my1)) for x in range(mx0 + 2, mx1 + 1, 2)], WHITE)
        if not wide:
            P([(mx1 - 1, t(12)), (mx1 - 1, t(13))], BLOOD)
        P([(11, t(8)), (12, t(8)), (11, t(9))], BLOOD)
    else:
        R(10, t(2), 21, t(10), c.HA)                       # sau gáy toàn tóc
        P([(x, t(11)) for x in (10, 11, 12, 15, 18, 20, 21)], c.HA)
        P([(13, t(5)), (14, t(5)), (17, t(7)), (12, t(8)), (18, t(4)),
           (19, t(9)), (15, t(9))], c.HAL)
        if turn:  # lộ một mảng mặt bên phải
            R(20, t(5), 21, t(10), c.SK)
            R(20, t(5), 21, t(5), OUT)
            if c.dead:
                R(20, t(7), 21, t(7), OUT)
            else:
                R(20, t(6), 21, t(7), c.EY)
                P([(21, t(7))], OUT)
            R(20, t(10), 21, t(10), OUT)


# ---------------------------------------------------------------- vẽ hướng E (nhìn ngang)
def draw_side(c):
    R, P, box, T = c.R, c.P, c.box, c.T
    sbw = max(4, c.bw - 4)
    bx0 = 16 - sbw // 2
    bx1 = bx0 + sbw - 1
    lws = max(c.lw, 3)
    base = 16 - lws // 2
    th = c.aw - 1
    atk = c.atk
    if atk is None:
        near_ext, far_ext = -c.s, c.s
    else:
        e = [-2, 2, 1][atk]
        near_ext, far_ext = e, e - 1

    def leg(off, lift, fill, shade):
        x0 = base + off
        x1 = x0 + lws - 1
        y1 = 28 - lift
        y0 = min(24 + T, y1)
        box(x0, y0, x1, y1, fill, shade)
        R(x0, y1, x1 + 1, y1, c.SHO)
        P([(x1 + 2, y1)], OUT)

    def sarm(y0, xend, ext, sleeve, shade, hand, hand_d):
        xe = xend + ext
        y1 = y0 + th - 1
        box(16, y0, xe, y1, sleeve, shade)
        R(xe - 2, y0, xe, y1, hand)
        R(xe - 2, y1, xe, y1, hand_d)

    # chân xa, tay xa (tối hơn, nằm sau thân)
    leg(-c.off, c.lift_r, c.PAD, FAR_SH)
    sarm(15 + T, 24, far_ext, darker(c.SH), darker(c.SHD), c.SKD, darker(c.SKD))

    # thân
    box(bx0, 15 + T, bx1, 22 + T, c.SH, c.SHD)
    P([(16, 17 + T), (16, 18 + T), (17, 18 + T)], BLOOD)
    P([(bx0 + 1, 22 + T), (bx1 - 1, 22 + T)], c.PAD)

    # chân gần
    leg(c.off, c.lift_l, c.PA, c.PAD)

    # đầu: mặt quay sang phải
    t = lambda y: y + T
    box(10, t(2), 21, t(13), c.SK, c.SKD)
    R(10, t(2), 21, t(2), c.HA)
    R(10, t(3), 12, t(9), c.HA)                            # tóc sau gáy
    P([(14, t(3)), (16, t(3)), (19, t(3))], c.HA)
    P([(11, t(5)), (11, t(7)), (12, t(4))], c.HAL)
    R(13, t(7), 14, t(9), c.SKD)                           # tai
    R(16, t(5), 18, t(5), OUT)                             # lông mày
    if c.dead:
        R(16, t(6), 18, t(7), c.SK)
        R(16, t(7), 18, t(7), OUT)
    else:
        R(16, t(6), 18, t(7), c.EY)
        P([(18, t(7))], OUT)
    P([(22, t(8)), (22, t(9))], c.SK)                      # mũi nhô ra
    P([(23, t(8)), (23, t(9)), (22, t(7)), (22, t(10))], OUT)
    wide = (atk == 1) or c.open
    my0, my1 = (9, 12) if wide else (10, 11)
    R(16, t(my0), 21, t(my1), OUT)
    if wide:
        R(18, t(my0 + 1), 20, t(my1 - 1), BLOOD)
    P([(x, t(my0)) for x in (17, 19, 21)], WHITE)
    P([(x, t(my1)) for x in (18, 20)], WHITE)
    if not wide:
        P([(20, t(12)), (20, t(13))], BLOOD)
    P([(14, t(5)), (14, t(6))], BLOOD)                     # vết thương thái dương

    # tay gần
    sarm(18 + T, 25, near_ext, c.SH, c.SHD, c.SK, c.SKD)


# ---------------------------------------------------------------- render 1 frame
def render(view, V, pose=None):
    pose = pose or {}
    k = V["k"]
    pen = Pen(int(round(32 * k)), k)
    c = types.SimpleNamespace(
        R=pen.R, P=pen.P, box=pen.box, view=view,
        SK=V["skin"], SKD=V["skin_d"], SH=V["shirt"], SHD=V["shirt_d"],
        PA=V["pants"], PAD=V["pants_d"], SHO=V["shoe"],
        HA=V["hair"], HAL=V["hair_l"], EY=V["eye"],
        bw=V["bw"], lw=V["lw"], aw=V["aw"],
        lift_l=pose.get("lift_l", 0), lift_r=pose.get("lift_r", 0),
        s=pose.get("s", 0), off=pose.get("off", 1),
        T=-pose.get("b", 0) + pose.get("drop", 0),
        atk=pose.get("atk"), dead=pose.get("dead", False),
        open=pose.get("open", False))
    if pose.get("shadow", True):
        pen.d.ellipse([int(8 * k), int(28 * k), int(24 * k) - 1, int(31 * k) - 1], fill=SHADOW)
    (draw_side if view == "E" else draw_front)(c)
    return pen.img


# ---------------------------------------------------------------- pose
def idle_pose(view):
    return {"off": 1} if view == "E" else {}


def walk_pose(view, i, n=6):
    t = 2 * math.pi * (i + 0.5) / n
    if view == "E":
        off = round(3 * math.sin(t))
        ln = round(max(0, math.cos(t)) * 2)
        lf = round(max(0, -math.cos(t)) * 2)
        return dict(off=off, lift_l=ln, lift_r=lf,
                    s=(off > 0) - (off < 0), b=1 if max(ln, lf) == 2 else 0)
    ll = round(max(0, math.sin(t)) * 2)
    lr = round(max(0, -math.sin(t)) * 2)
    return dict(lift_l=ll, lift_r=lr, s=(ll > lr) - (ll < lr),
                b=1 if max(ll, lr) == 2 else 0)


def attack_pose(view, i):
    p = dict(atk=i, open=(i == 1))
    if view == "E":
        p["off"] = [0, 2, 1][i]
    return p


# ---------------------------------------------------------------- hiệu ứng ảnh
def shift(img, dx, dy):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (dx, dy))
    return out


def tint(img, color, amt):
    out = img.copy()
    px, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 255 or (r, g, b) == OUT[:3]:
                continue
            po[x, y] = (int(r + (color[0] - r) * amt), int(g + (color[1] - g) * amt),
                        int(b + (color[2] - b) * amt), 255)
    return out


def shear(img, frac, k):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gy = 28 * k
    for y in range(img.height):
        out.paste(img.crop((0, y, img.width, y + 1)), (round(frac * (gy - y)), y))
    return out


def lying(view, V, big_pool, dy=0):
    k = V["k"]
    body = render(view, V, dict(dead=True, open=True, shadow=False)).transpose(Image.ROTATE_90)
    body = shift(body, 0, round(dy * k))
    pool = Image.new("RGBA", body.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(pool)
    rx, ry = (15, 12) if big_pool else (13, 10)
    cx, cy = 16 * k, 17 * k
    d.ellipse([cx - rx * k, cy - ry * k, cx + rx * k, cy + ry * k], fill=(84, 12, 14, 255))
    d.ellipse([cx - (rx - 3) * k, cy - (ry - 2) * k, cx + (rx - 3) * k, cy + (ry - 2) * k],
              fill=(118, 20, 22, 255))
    return Image.alpha_composite(pool, body)


# ---------------------------------------------------------------- tạo frame cho 1 (biến thể, anim, hướng)
FACING = {"S": (0, 1), "SE": (1, 1), "E": (1, 0), "NE": (1, -1), "N": (0, -1)}
DIRS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]
MIRROR = {"NW": "NE", "W": "E", "SW": "SE"}
ANIMS = [("idle", 1), ("walk", 6), ("attack", 3), ("hit", 2), ("die", 5)]


def frames_for(vname, anim, d):
    base = MIRROR.get(d, d)
    flip = d in MIRROR
    V = VARIANTS[vname]
    k = V["k"]
    fx, fy = FACING[base]
    mv = lambda img, a: shift(img, round(a * fx * k), round(a * fy * k))
    out = []
    if anim == "idle":
        out = [render(base, V, idle_pose(base))]
    elif anim == "walk":
        out = [render(base, V, walk_pose(base, i)) for i in range(6)]
    elif anim == "attack":
        for i in range(3):
            out.append(mv(render(base, V, attack_pose(base, i)), [-1, 2, 1][i]))
    elif anim == "hit":
        p = dict(idle_pose(base), open=True)
        out.append(mv(tint(render(base, V, p), (255, 255, 255), 0.68), -1))
        out.append(mv(tint(render(base, V, dict(p, drop=1)), (255, 60, 60), 0.35), -2))
    elif anim == "die":
        p = dict(idle_pose(base), open=True)
        out.append(mv(tint(render(base, V, p), (255, 60, 60), 0.45), -2))
        out.append(mv(render(base, V, dict(p, dead=True, drop=3)), -2))
        out.append(shear(mv(render(base, V, dict(p, dead=True, drop=5)), -1), -0.3, k))
        out.append(lying(base, V, False))
        out.append(lying(base, V, True, dy=1))
    if flip:
        out = [o.transpose(Image.FLIP_LEFT_RIGHT) for o in out]
    return out


# ---------------------------------------------------------------- sprite sheet + preview
BG = (170, 165, 150, 255)
INK = (30, 30, 30, 255)
FONT = ImageFont.load_default()


def grid(rows, cell, scale, labels=None, header=None, lab_w=44, head_h=0):
    h, w = len(rows), max(len(r) for r in rows)
    img = Image.new("RGBA", (lab_w + w * cell * scale, head_h + h * cell * scale), BG)
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        if labels:
            d.text((4, head_h + r * cell * scale + cell * scale // 2 - 5), labels[r], fill=INK, font=FONT)
        for ci, fr in enumerate(row):
            big = fr.resize((fr.width * scale, fr.height * scale), Image.NEAREST)
            img.alpha_composite(big, (lab_w + ci * cell * scale, head_h + r * cell * scale))
    for x, text in (header or []):
        d.text((lab_w + x * cell * scale + 4, 3), text, fill=INK, font=FONT)
    return img


def to48(img):
    if img.width == 48:
        return img
    c = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    c.paste(img, (8, 16))
    return c


def save_gif(frames, durations, path):
    rgb = [f.convert("RGB") for f in frames]
    rgb[0].save(path, save_all=True, append_images=rgb[1:], duration=durations, loop=0)


def over_bg(img):
    return Image.alpha_composite(Image.new("RGBA", img.size, BG), img)


def strip(imgs, scale):
    """ghép ngang nhiều ảnh cùng cỡ, phóng to, nền xám"""
    cw = imgs[0].width
    out = Image.new("RGBA", (cw * len(imgs) * scale, imgs[0].height * scale), BG)
    for i, im in enumerate(imgs):
        out.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST),
                            (i * cw * scale, 0))
    return out


if __name__ == "__main__":
    # tạo toàn bộ frame
    ALL = {v: {a: {d: frames_for(v, a, d) for d in DIRS} for a, _ in ANIMS} for v in VARIANTS}

    # --- sprite sheet từng biến thể: hàng = anim*8 + hướng, cột = frame
    for v in VARIANTS:
        cell = int(round(32 * VARIANTS[v]["k"]))
        sheet = Image.new("RGBA", (cell * 6, cell * 8 * len(ANIMS)), (0, 0, 0, 0))
        for ai, (a, n) in enumerate(ANIMS):
            for di, d in enumerate(DIRS):
                for fi, fr in enumerate(ALL[v][a][d]):
                    sheet.paste(fr, (fi * cell, (ai * 8 + di) * cell))
        sheet.save(f"{OUT_DIR}/zombie_{v}_spritesheet.png")

    info = {
        "cell_size": {v: int(round(32 * VARIANTS[v]["k"])) for v in VARIANTS},
        "columns": 6,
        "directions_in_row_order": DIRS,
        "animations_in_block_order": [{"name": a, "frames": n} for a, n in ANIMS],
        "row_formula": "row = animation_index * 8 + direction_index",
        "note": "Dir NW/W/SW = lật ngang của NE/E/SE. Die: 5 frame, frame cuối nằm im.",
    }
    json.dump(info, open(f"{OUT_DIR}/zombie_spritesheet_info.json", "w"), ensure_ascii=False, indent=2)

    # --- BƯỚC 1: 8 hướng
    rows = [ALL["normal"]["walk"][d] for d in DIRS]
    grid(rows, 32, 4, labels=DIRS).save(f"{OUT_DIR}/step1_8directions.png")
    gif = []
    for i in range(6):
        gif.append(strip([ALL["normal"]["walk"][d][i] for d in DIRS], 4))
    save_gif(gif, 110, f"{OUT_DIR}/step1_walk_8dir.gif")

    # --- BƯỚC 2: tấn công / trúng đạn / chết
    rows = [ALL["normal"]["attack"][d] + ALL["normal"]["hit"][d] + ALL["normal"]["die"][d] for d in DIRS]
    grid(rows, 32, 4, labels=DIRS, head_h=16,
         header=[(0, "ATTACK"), (3, "HIT"), (5, "DIE")]).save(f"{OUT_DIR}/step2_actions.png")
    seq = [("attack", 0), ("attack", 1), ("attack", 2)] * 2 + [("hit", 0), ("hit", 1)] + \
          [("die", i) for i in range(5)]
    dur = [150] * 6 + [110, 160] + [140, 140, 140, 220, 900]
    save_gif([strip([ALL["normal"][a][d][i] for d in DIRS], 4) for a, i in seq], dur,
             f"{OUT_DIR}/step2_actions.gif")

    # --- BƯỚC 3: biến thể
    cols = [("idle", "S", 0), ("idle", "E", 0), ("idle", "N", 0), ("walk", "SE", 1),
            ("attack", "S", 1), ("attack", "E", 1), ("hit", "S", 0), ("die", "S", 4)]
    rows = [[to48(ALL[v][a][d][i]) for a, d, i in cols] for v in VARIANTS]
    grid(rows, 48, 3, labels=list(VARIANTS), head_h=16,
         header=[(j, f"{a}/{d}") for j, (a, d, _) in enumerate(cols)]).save(f"{OUT_DIR}/step3_variants.png")
    show = ["S", "SE", "E", "NE", "N"]
    gif = []
    for i in range(6):
        r = [strip([to48(ALL[v]["walk"][d][i]) for d in show], 3) for v in VARIANTS]
        canvas = Image.new("RGBA", (r[0].width, r[0].height * 3), BG)
        for j, im in enumerate(r):
            canvas.paste(im, (0, j * im.height))
        gif.append(canvas)
    save_gif(gif, 110, f"{OUT_DIR}/step3_variants_walk.gif")
    print("done")
