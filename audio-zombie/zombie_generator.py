from PIL import Image, ImageDraw, ImageFont
import math, os, json, types

OUT_DIR = os.environ.get("ZOMBIE_OUT", ".")
os.makedirs(OUT_DIR, exist_ok=True)

OUT = (30, 30, 30, 255)
WHITE = (235, 235, 222, 255)
BLOOD = (150, 24, 24, 255)
SHADOW = (0, 0, 0, 70)
FAR_SH = (24, 26, 40, 255)
BONE = (222, 212, 186, 255)
BONE_D = (168, 156, 128, 255)
GUT = (70, 12, 18, 255)
GORE_D = (100, 14, 18, 255)
BRAIN = (198, 110, 124, 255)
PUS = (232, 226, 110, 255)
PUS_R = (190, 70, 60, 255)
SACK = (160, 126, 84, 255)
SACK_D = (112, 84, 52, 255)
ROPE = (82, 58, 38, 255)
STITCH = (38, 26, 20, 255)
HEAD_VEINS = [(11, 10), (11, 11), (11, 12), (12, 12), (20, 12), (19, 12), (13, 3), (12, 4)]
TORSO_VEINS = [(13, 17), (13, 18), (14, 18), (17, 20), (17, 21), (18, 20), (12, 20)]
SIDE_HEAD_VEINS = [(15, 11), (14, 12), (15, 12), (20, 12)]
SIDE_TORSO_VEINS = [(14, 17), (14, 18), (15, 19), (17, 20)]
PUST = [(10, 16), (14, 17), (19, 17), (11, 20), (17, 20), (14, 21)]
SIDE_PUST = [(12, 17), (17, 16), (14, 20), (18, 19)]


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

    # ===== zombie đáng sợ =====
    # xác thối: hở xương sọ, lộ xương sườn, mất một mắt, gân tím
    "rotten": dict(k=1.0, skin=(140, 150, 120), skin_d=(94, 104, 80),
                   shirt=(86, 96, 108), shirt_d=(58, 66, 76),
                   pants=(70, 60, 48), pants_d=(48, 40, 32), shoe=(40, 32, 28),
                   hair=(66, 64, 52), hair_l=(92, 90, 74), eye=(214, 236, 90),
                   bw=10, lw=4, aw=4, eyes="oneless", skull=True, ribs=True,
                   veins=(110, 74, 126), angry=True,
                   desc="Xác thối: hở sọ, lộ xương sườn, mất một mắt"),
    # quỷ đói: da trắng bệch, hốc mắt đen đỏ rực, móng dài, miệng há
    "ghoul": dict(k=1.0, skin=(214, 208, 192), skin_d=(150, 144, 130),
                  shirt=(46, 42, 50), shirt_d=(28, 26, 32),
                  pants=(38, 36, 42), pants_d=(24, 22, 28), shoe=(30, 28, 32),
                  hair=(196, 192, 182), hair_l=(222, 218, 208), eye=(255, 50, 50),
                  bw=6, lw=2, aw=3, eyes="hollow", claws=True, bare=True, alen=2,
                  wide=True, veins=(112, 100, 146), angry=True,
                  desc="Quỷ đói: gầy trắng bệch, mắt đỏ, tay dài móng vuốt"),
    # đồ tể: trùm bao tải khâu, một lỗ mắt đỏ, tạp dề đẫm máu, to 1.5x
    "butcher": dict(k=1.5, skin=(176, 140, 122), skin_d=(128, 96, 86),
                    shirt=(196, 188, 176), shirt_d=(150, 140, 130),
                    pants=(52, 46, 42), pants_d=(34, 30, 28), shoe=(30, 26, 24),
                    hair=(60, 40, 30), hair_l=(90, 64, 48), eye=(255, 40, 40),
                    bw=10, lw=4, aw=4, sack=True, bare=True, gore=True,
                    desc="Đồ tể: trùm bao tải khâu, tạp dề đẫm máu"),
    # zombie mủ: bụng phình to, đầy mụn mủ, đầu nhỏ
    "boomer": dict(k=1.0, skin=(176, 184, 92), skin_d=(122, 132, 58),
                   shirt=(150, 128, 92), shirt_d=(108, 90, 62),
                   pants=(96, 84, 62), pants_d=(66, 58, 42), shoe=(54, 44, 32),
                   hair=(106, 96, 44), hair_l=(130, 120, 60), eye=(255, 120, 40),
                   bw=14, lw=5, aw=3, lin=2, pustules=True, angry=True,
                   desc="Zombie mủ: bụng phình, mụn mủ chi chít"),
    # xác cháy: than đen, nứt lửa, hốc mắt cam rực
    "burned": dict(k=1.0, skin=(62, 54, 52), skin_d=(36, 30, 30),
                   shirt=(50, 42, 40), shirt_d=(30, 26, 24),
                   pants=(42, 36, 36), pants_d=(26, 22, 22), shoe=(24, 20, 20),
                   hair=(28, 22, 22), hair_l=(70, 40, 24), eye=(255, 170, 40),
                   bw=10, lw=4, aw=4, eyes="hollow", bare=True,
                   veins=(255, 120, 24),
                   desc="Xác cháy: than đen, nứt lửa, mắt cam rực"),
    # dị biến: cơ bắp tím, gân xanh phát sáng, móng vuốt, to 1.25x
    "mutant": dict(k=1.25, skin=(128, 92, 150), skin_d=(88, 60, 108),
                   shirt=(44, 36, 48), shirt_d=(28, 22, 32),
                   pants=(52, 46, 62), pants_d=(34, 30, 42), shoe=(30, 26, 36),
                   hair=(58, 40, 82), hair_l=(88, 64, 120), eye=(120, 255, 120),
                   bw=12, lw=5, aw=5, eyes="hollow", claws=True, bare=True,
                   veins=(110, 255, 110), angry=True,
                   desc="Dị biến: cơ bắp tím, gân xanh phát sáng, móng vuốt"),
}
for _v in VARIANTS.values():
    for _k, _val in list(_v.items()):
        if isinstance(_val, tuple) and len(_val) == 3:
            _v[_k] = rgba(_val)


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


# ---------------------------------------------------------------- tay, thân, đầu
def arm_pose(view, atk, s):
    back = view in ("N", "NE")
    if atk is None:
        return dict(tl=s, bl=s, tr=-s, br=-s, ht=False)
    if not back:
        tl, bl, ht = [(-6, -3, True), (0, 3, False), (-2, -1, False)][atk]
    else:
        tl, bl, ht = [(1, 2, False), (-6, -4, True), (-3, -2, True)][atk]
    return dict(tl=tl, bl=bl, tr=tl, br=bl, ht=ht)


# ---------------------------------------------------------------- chi tiết dùng chung
def skull_patch(c, t, x0, x1):
    """mảng sọ lộ ra trên đầu, có não và vết nứt"""
    R, P = c.R, c.P
    R(x0, t(2), x1, t(4), BONE)
    R(x0, t(4), x1, t(4), BONE_D)
    R(x1, t(2), x1, t(4), BONE_D)
    P([(x0 + 2, t(2)), (x0 + 3, t(2)), (x0 + 3, t(3))], BRAIN)
    P([(x0 + 1, t(3)), (x0 + 1, t(4))], OUT)
    P([(21, t(5)), (21, t(6)), (21, t(7)), (21, t(8))], BLOOD)


def mouth_open(c, t, mx0, mx1):
    R, P = c.R, c.P
    R(mx0, t(9), mx1, t(12), OUT)
    R(mx0 + 2, t(10), mx1 - 2, t(11), BLOOD)
    P([(x, t(9)) for x in range(mx0 + 1, mx1 + 1, 2)], WHITE)
    P([(x, t(12)) for x in range(mx0 + 2, mx1 + 1, 2)], WHITE)


def sack_front(c, t, back, turn, wide):
    """đầu trùm bao tải khâu, một lỗ mắt đỏ"""
    R, P = c.R, c.P
    R(10, t(12), 21, t(12), ROPE)                       # dây buộc cổ
    P([(11, t(2)), (14, t(2)), (18, t(2)), (20, t(2))], SACK_D)
    if back:
        P([(15, t(y)) for y in range(2, 12, 2)], STITCH)
        P([(16, t(y)) for y in range(3, 12, 2)], STITCH)
        if turn:
            R(20, t(5), 21, t(8), OUT)
            if not c.dead:
                P([(21, t(6)), (21, t(7))], c.EY)
        return
    hx0, hx1 = (17, 19) if not turn else (18, 20)
    xa = 12 if not turn else 13
    mx0, mx1 = (12, 19) if not turn else (14, 20)
    R(hx0, t(5), hx1, t(8), OUT)                        # lỗ mắt
    if not c.dead:
        P([((hx0 + hx1) // 2, t(6)), ((hx0 + hx1) // 2, t(7))], c.EY)
    R(xa, t(5), xa + 2, t(7), SACK_D)                   # miếng vá chữ X
    P([(xa, t(5)), (xa + 2, t(5)), (xa + 1, t(6)), (xa, t(7)), (xa + 2, t(7))], STITCH)
    P([(15, t(2)), (15, t(3)), (15, t(4))], STITCH)
    if wide:
        mouth_open(c, t, mx0, mx1)
    else:                                               # miệng khâu chỉ
        P([(x, t(10)) for x in range(mx0, mx1 + 1)], STITCH)
        for x in range(mx0 + 1, mx1, 2):
            P([(x, t(9)), (x, t(11))], STITCH)
        P([((hx0 + hx1) // 2, t(9))], BLOOD)


def sack_side(c, t, wide):
    R, P = c.R, c.P
    R(10, t(12), 21, t(12), ROPE)
    P([(11, t(2)), (14, t(2)), (18, t(2)), (20, t(2))], SACK_D)
    R(16, t(5), 18, t(8), OUT)
    if not c.dead:
        P([(17, t(6)), (17, t(7))], c.EY)
    R(12, t(5), 14, t(7), SACK_D)
    P([(12, t(5)), (14, t(5)), (13, t(6)), (12, t(7)), (14, t(7))], STITCH)
    if wide:
        mouth_open(c, t, 16, 21)
    else:
        P([(x, t(10)) for x in range(16, 22)], STITCH)
        for x in (17, 19, 21):
            P([(x, t(9)), (x, t(11))], STITCH)


# ---------------------------------------------------------------- vẽ hướng S, SE, N, NE
def draw_front(c):
    R, P, box, T, view, V = c.R, c.P, c.box, c.T, c.view, c.V
    back = view in ("N", "NE")
    turn = view in ("SE", "NE")
    bx0o = 16 - c.bw // 2
    bx1 = bx0o + c.bw - 1
    bx0 = bx0o + (1 if turn else 0)
    lw, aw, lin = c.lw, c.aw, V.get("lin", 0)
    bare, claws, alen, vein = V.get("bare"), V.get("claws"), V.get("alen", 0), V.get("veins")
    t = lambda y: y + T
    wide = (c.atk == 1) or c.open or V.get("wide")

    # chân
    for x0, x1, lift in ((bx0 + lin, bx0 + lin + lw - 1, c.lift_l),
                         (bx1 - lin - lw + 1, bx1 - lin, c.lift_r)):
        y1 = 28 - lift
        y0 = min(24 + T, y1)
        box(x0, y0, x1, y1, c.PA, c.PAD)
        R(x0, y1, x1, y1, c.SHO)

    # tay
    ap = arm_pose(view, c.atk, c.s)

    def arm(x0, x1, top, bot, ht, dy=0):
        y0 = 16 + T + top + dy
        y1 = 22 + T + bot + dy + alen
        fill, shade = (c.SK, c.SKD) if bare else (c.SH, c.SHD)
        box(x0, y0, x1, y1, fill, shade)
        if ht:
            R(x0, y0, x1, y0 + 2, c.SK)
            R(x0, y0, x1, y0, c.SKD)
            if bare:
                R(x0, y0 + 3, x1, y0 + 3, c.SKD)
            if vein:
                P([(x0 + 1, y1 - 2), (x0 + 1, y1 - 1)], vein)
            if claws:
                P([(x, y0 - 2) for x in range(x0, x1 + 1, 2)], BONE)
                P([(x, y0 - 3) for x in range(x0, x1 + 1, 2)], OUT)
        else:
            R(x0, y1 - 2, x1, y1, c.SK)
            R(x0, y1, x1, y1, c.SKD)
            if bare:
                R(x0, y1 - 3, x1, y1 - 3, c.SKD)
            if vein:
                P([(x0 + 1, y0 + 1), (x0 + 1, y0 + 2)], vein)
            if claws:
                P([(x, y1 + 2) for x in range(x0, x1 + 1, 2)], BONE)
                P([(x, y1 + 3) for x in range(x0, x1 + 1, 2)], OUT)

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

    ribs = V.get("ribs")
    if ribs and not back:                                # lộ xương sườn
        bR(13, t(17), 18, t(21), GUT)
        bR(13, t(18), 18, t(18), BONE)
        bR(13, t(20), 18, t(20), BONE)
        bR(15, t(17), 15, t(21), BONE)
        bR(16, t(17), 16, t(21), BONE_D)
    elif ribs and back:                                  # xương sống
        bP([(15, t(16)), (16, t(17)), (15, t(18)), (16, t(19)), (15, t(20))], BONE)
    elif not back:
        bR(13, t(19), 15, t(21), c.SK)                   # áo rách lộ bụng
        bP([(14, t(20))], c.SKD)
        bP([(17, t(17)), (18, t(17)), (18, t(18))], BLOOD)
    else:
        bP([(15, t(16)), (15, t(17)), (16, t(18)), (16, t(19))], c.SHD)
        bP([(18, t(18)), (18, t(19)), (19, t(19))], BLOOD)
    if vein and not ribs:
        bP([(x, t(y)) for x, y in TORSO_VEINS], vein)
    if V.get("gore"):                                    # tạp dề đẫm máu
        bR(12, t(16), 15, t(18), BLOOD)
        bR(17, t(19), 19, t(21), BLOOD)
        bP([(13, t(19)), (13, t(20)), (18, t(16)), (19, t(17))], BLOOD)
        bP([(13, t(17)), (18, t(20))], GORE_D)
    if V.get("pustules"):                                # mụn mủ
        for px, py in PUST:
            bR(px, t(py), px + 1, t(py + 1), PUS)
            bP([(px + 1, t(py + 1))], PUS_R)
    bP([(x, 22 + T) for x in (bx0 + 1, bx0 + 6, bx0 + 8)], c.PAD)   # gấu áo tả tơi

    if turn:  # tay gần camera vẽ đè lên thân
        arm(near[0], near[1], ap["tr"], ap["br"], ap["ht"], 1)

    # đầu vuông
    sack = V.get("sack")
    if sack:
        box(10, t(2), 21, t(13), SACK, SACK_D)
        sack_front(c, t, back, turn, wide)
    else:
        box(10, t(2), 21, t(13), c.SK, c.SKD)
    if not sack and not back:
        R(10, t(2), 21, t(2), c.HA)
        P([(x, t(3)) for x in (10, 11, 14, 16, 19, 21)], c.HA)
        ex = [(12, 14), (17, 19)] if not turn else [(14, 15), (19, 20)]
        pu = [13, 18] if not turn else [15, 20]
        nose = (15, 16) if not turn else (17, 18)
        mx0, mx1 = (12, 19) if not turn else (14, 20)
        style, angry = V.get("eyes", "std"), V.get("angry", False)
        for idx, (a, z) in enumerate(ex):
            R(a, t(5), z, t(5), OUT)                    # lông mày
            if c.dead:
                R(a, t(6), z, t(7), c.SK)
                R(a, t(7), z, t(7), OUT)                # mắt nhắm
            elif style == "hollow":                     # hốc mắt đen, khe sáng
                R(a, t(6), z, t(7), OUT)
                P([((a + z) // 2, t(6)), ((a + z) // 2, t(7))], c.EY)
            elif style == "oneless" and idx == 0:       # mất một mắt
                R(a, t(5), z, t(8), OUT)
                P([(a, t(9)), (a, t(10))], BLOOD)
            else:
                R(a, t(6), z, t(7), c.EY)
                P([(pu[idx], t(7))], OUT)
                if angry:                               # lông mày cau có
                    P([(z if idx == 0 else a, t(6))], OUT)
        R(nose[0], t(8), nose[1], t(8), c.SKD)
        my0, my1 = (9, 12) if wide else (10, 11)
        R(mx0, t(my0), mx1, t(my1), OUT)                # miệng
        if wide:
            R(mx0 + 2, t(my0 + 1), mx1 - 2, t(my1 - 1), BLOOD)
        P([(x, t(my0)) for x in range(mx0 + 1, mx1 + 1, 2)], WHITE)
        P([(x, t(my1)) for x in range(mx0 + 2, mx1 + 1, 2)], WHITE)
        if not wide:
            P([(mx1 - 1, t(12)), (mx1 - 1, t(13))], BLOOD)
        P([(11, t(8)), (12, t(8)), (11, t(9))], BLOOD)
    elif not sack:
        R(10, t(2), 21, t(10), c.HA)                    # sau gáy toàn tóc
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
    if V.get("skull") and not sack:
        skull_patch(c, t, 15, 20)
    if vein and not back and not sack:
        P([(x, t(y)) for x, y in HEAD_VEINS], vein)
    if V.get("pustules") and not back:
        R(18, t(3), 19, t(4), PUS)
        P([(19, t(4))], PUS_R)


# ---------------------------------------------------------------- vẽ hướng E (nhìn ngang)
def draw_side(c):
    R, P, box, T, V = c.R, c.P, c.box, c.T, c.V
    bare, claws, vein = V.get("bare"), V.get("claws"), V.get("veins")
    sbw = max(4, c.bw - 4)
    bx0 = 16 - sbw // 2
    bx1 = bx0 + sbw - 1
    lws = max(c.lw, 3)
    base = 16 - lws // 2
    th = c.aw - 1
    atk = c.atk
    wide = (atk == 1) or c.open or V.get("wide")
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

    def sarm(y0, xend, ext, sleeve, shade, hand, hand_d, claw):
        xe = xend + ext
        y1 = y0 + th - 1
        box(16, y0, xe, y1, sleeve, shade)
        R(xe - 2, y0, xe, y1, hand)
        R(xe - 2, y1, xe, y1, hand_d)
        if bare:
            R(xe - 3, y0, xe - 3, y1, hand_d)
        if vein:
            P([(xe - 5, y0), (xe - 6, y0 + 1)], vein)
        if claws:
            P([(xe + 2, y) for y in range(y0, y1 + 1, 2)], claw)
            P([(xe + 3, y) for y in range(y0, y1 + 1, 2)], OUT)

    # chân xa, tay xa (tối hơn, nằm sau thân)
    leg(-c.off, c.lift_r, c.PAD, FAR_SH)
    sarm(15 + T, 24, far_ext,
         darker(c.SK if bare else c.SH), darker(c.SKD if bare else c.SHD),
         c.SKD, darker(c.SKD), BONE_D)

    # thân
    box(bx0, 15 + T, bx1, 22 + T, c.SH, c.SHD)
    P([(16, 17 + T), (16, 18 + T), (17, 18 + T)], BLOOD)
    P([(bx0 + 1, 22 + T), (bx1 - 1, 22 + T)], c.PAD)
    if vein:
        P([(x, T + y) for x, y in SIDE_TORSO_VEINS], vein)
    if V.get("gore"):
        R(bx0, 16 + T, bx0 + 2, 18 + T, BLOOD)
        P([(bx1 - 1, 20 + T), (bx1, 19 + T), (bx0 + 1, 19 + T)], BLOOD)
        P([(bx0 + 1, 17 + T)], GORE_D)
    if V.get("pustules"):
        for px, py in SIDE_PUST:
            R(px, T + py, px + 1, T + py + 1, PUS)
            P([(px + 1, T + py + 1)], PUS_R)

    # chân gần
    leg(c.off, c.lift_l, c.PA, c.PAD)

    # đầu: mặt quay sang phải
    t = lambda y: y + T
    if V.get("sack"):
        box(10, t(2), 21, t(13), SACK, SACK_D)
        sack_side(c, t, wide)
    else:
        box(10, t(2), 21, t(13), c.SK, c.SKD)
        R(10, t(2), 21, t(2), c.HA)
        R(10, t(3), 12, t(9), c.HA)                        # tóc sau gáy
        P([(14, t(3)), (16, t(3)), (19, t(3))], c.HA)
        P([(11, t(5)), (11, t(7)), (12, t(4))], c.HAL)
        R(13, t(7), 14, t(9), c.SKD)                       # tai
        R(16, t(5), 18, t(5), OUT)                         # lông mày
        style = V.get("eyes", "std")
        if c.dead:
            R(16, t(6), 18, t(7), c.SK)
            R(16, t(7), 18, t(7), OUT)
        elif style == "hollow":
            R(16, t(6), 18, t(7), OUT)
            P([(17, t(6)), (17, t(7))], c.EY)
        elif style == "oneless":
            R(16, t(5), 18, t(8), OUT)
            P([(16, t(9)), (16, t(10))], BLOOD)
        else:
            R(16, t(6), 18, t(7), c.EY)
            P([(18, t(7))], OUT)
            if V.get("angry"):
                P([(18, t(6))], OUT)
        P([(22, t(8)), (22, t(9))], c.SK)                  # mũi nhô ra
        P([(23, t(8)), (23, t(9)), (22, t(7)), (22, t(10))], OUT)
        my0, my1 = (9, 12) if wide else (10, 11)
        R(16, t(my0), 21, t(my1), OUT)
        if wide:
            R(18, t(my0 + 1), 20, t(my1 - 1), BLOOD)
        P([(x, t(my0)) for x in (17, 19, 21)], WHITE)
        P([(x, t(my1)) for x in (18, 20)], WHITE)
        if not wide:
            P([(20, t(12)), (20, t(13))], BLOOD)
        P([(14, t(5)), (14, t(6))], BLOOD)                 # vết thương thái dương
        if V.get("skull"):
            skull_patch(c, t, 14, 19)
        if vein:
            P([(x, t(y)) for x, y in SIDE_HEAD_VEINS], vein)
        if V.get("pustules"):
            R(15, t(3), 16, t(4), PUS)
            P([(16, t(4))], PUS_R)

    # tay gần
    sarm(18 + T, 25, near_ext,
         c.SK if bare else c.SH, c.SKD if bare else c.SHD, c.SK, c.SKD, BONE)


# ---------------------------------------------------------------- render 1 frame
def render(view, V, pose=None):
    pose = pose or {}
    k = V["k"]
    pen = Pen(int(round(32 * k)), k)
    c = types.SimpleNamespace(
        R=pen.R, P=pen.P, box=pen.box, view=view, V=V,
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
    rx, ry = (14, 11) if big_pool else (11, 8)
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
    c.paste(img, ((48 - img.width) // 2, 48 - img.height))
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
    NEW = [v for v in VARIANTS if v not in ("normal", "fast", "big")]
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

    descs = {"normal": "Zombie thường", "fast": "Zombie nhanh: gầy, da đỏ nhạt",
             "big": "Zombie to 1.5x, áo đậm"}
    info = {
        "cell_size": {v: int(round(32 * VARIANTS[v]["k"])) for v in VARIANTS},
        "variants": {v: VARIANTS[v].get("desc", descs.get(v, "")) for v in VARIANTS},
        "columns": 6,
        "directions_in_row_order": DIRS,
        "animations_in_block_order": [{"name": a, "frames": n} for a, n in ANIMS],
        "row_formula": "row = animation_index * 8 + direction_index",
        "pivot_hint": "chân nằm ở khoảng 7/8 chiều cao ô",
        "note": "Dir NW/W/SW = lật ngang của NE/E/SE. Die: 5 frame, frame cuối nằm im.",
    }
    json.dump(info, open(f"{OUT_DIR}/zombie_spritesheet_info.json", "w"), ensure_ascii=False, indent=2)

    # --- ảnh xem trước các zombie mới
    cols = [("idle", "S", 0), ("idle", "SE", 0), ("idle", "E", 0), ("idle", "N", 0),
            ("attack", "S", 1), ("attack", "E", 1), ("hit", "S", 0), ("die", "S", 4)]
    rows = [[to48(ALL[v][a][d][i]) for a, d, i in cols] for v in NEW]
    grid(rows, 48, 3, labels=NEW, head_h=16, lab_w=60,
         header=[(j, f"{a}/{d}") for j, (a, d, _) in enumerate(cols)]).save(f"{OUT_DIR}/scary_variants.png")

    scale, cw = 6, 48 * 6
    img = Image.new("RGBA", (3 * cw, 2 * (cw + 16)), BG)
    dr = ImageDraw.Draw(img)
    for i, v in enumerate(NEW):
        fr = to48(ALL[v]["idle"]["S"][0]).resize((cw, cw), Image.NEAREST)
        x, y = (i % 3) * cw, (i // 3) * (cw + 16)
        img.alpha_composite(fr, (x, y))
        dr.text((x + 8, y + cw), v.upper(), fill=INK, font=FONT)
    img.save(f"{OUT_DIR}/scary_closeup.png")

    names = list(VARIANTS)
    cw = 48 * 4
    img = Image.new("RGBA", (5 * cw, 2 * (cw + 16)), BG)
    dr = ImageDraw.Draw(img)
    for i, v in enumerate(names):
        fr = to48(ALL[v]["idle"]["S"][0]).resize((cw, cw), Image.NEAREST)
        x, y = (i % 5) * cw, (i // 5) * (cw + 16)
        img.alpha_composite(fr, (x, y))
        dr.text((x + 8, y + cw), v.upper(), fill=INK, font=FONT)
    img.save(f"{OUT_DIR}/all_zombies_roster.png")

    show = ["S", "E", "N"]
    gif = []
    for i in range(6):
        r = [strip([to48(ALL[v]["walk"][d][i]) for d in show], 3) for v in NEW]
        canvas = Image.new("RGBA", (r[0].width, r[0].height * len(NEW)), BG)
        for j, im in enumerate(r):
            canvas.paste(im, (0, j * im.height))
        gif.append(canvas)
    save_gif(gif, 110, f"{OUT_DIR}/scary_variants_walk.gif")
    print("done")
