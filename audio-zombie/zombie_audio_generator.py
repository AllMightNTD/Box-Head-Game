"""Tổng hợp âm thanh 6 loại zombie bằng DSP thuần (không dùng mẫu có sẵn).
Chạy:  python3 zombie_audio_generator.py   ->  audio/<loại>/<sự kiện>_<n>.wav
Cần: numpy, scipy (matplotlib nếu muốn ảnh phổ)."""
import numpy as np, os, json, wave, zlib, zipfile
from scipy import signal

SR = 44100
OUT_DIR = os.environ.get("ZOMBIE_OUT", ".")
AUDIO_DIR = f"{OUT_DIR}/audio"


# ------------------------------------------------------------ tiện ích cơ bản
def n_of(d): return int(SR * d)
def tt(d): return np.arange(n_of(d)) / SR


def curve(d, pts):
    xs, ys = zip(*pts)
    return np.interp(tt(d), xs, ys)


def smooth_noise(d, rate, rng):
    n = n_of(d)
    k = max(2, int(SR / rate))
    pts = rng.standard_normal(n // k + 3)
    return np.interp(np.arange(n) / k, np.arange(len(pts)), pts)


def noise(d, rng): return rng.standard_normal(n_of(d))
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, "low", fs=SR, output="sos"), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)
def newbuf(d): return np.zeros(n_of(d))


def place(out, sig, t0, g=1.0):
    i = int(t0 * SR)
    if i >= len(out):
        return
    j = min(len(out), i + len(sig))
    out[i:j] += g * sig[:j - i]


# ------------------------------------------------------------ giọng (nguồn thanh quản + formant)
VOW = {"uh": (500, 1200, 2500), "ah": (700, 1150, 2600), "oo": (320, 850, 2300),
       "ee": (280, 2250, 3000), "oh": (460, 850, 2500), "aw": (620, 960, 2500),
       "eh": (540, 1850, 2500)}


def formants(x, vow, scale=1.0):
    out = np.zeros_like(x)
    for f, g in zip(VOW[vow], (1.0, 0.55, 0.25)):
        f *= scale
        b, a = signal.iirpeak(f / (SR / 2), f / max(70, f * 0.1))
        out += g * signal.lfilter(b, a, x)
    return out


def voice(d, f0, vow, vow2=None, rough=0.0, rate=28, jit=0.02, breath=0.15, drive=1.5,
          amp=None, vib=None, lpf=None, rng=None, fscale=1.0):
    t = tt(d)
    F = curve(d, f0) * (1 + jit * smooth_noise(d, 40, rng))
    if vib:
        F = F * (1 + vib[1] * np.sin(2 * np.pi * vib[0] * t))
    ph = np.cumsum(F) / SR
    src = (2 * (ph % 1) - 1) + 0.8 * ((ph % 1) < 0.15)
    if rough > 0:                                   # gầm gừ = điều biên chậm
        rr = rate * (1 + 0.2 * smooth_noise(d, 8, rng))
        gate = 1 - rough + rough * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(rr) / SR))
        src = src * gate
    src = src + breath * rng.standard_normal(len(t))
    y = formants(src, vow, fscale)
    if vow2:                                        # trượt nguyên âm
        m = curve(d, [(0, 0), (d, 1)])
        y = y * (1 - m) + formants(src, vow2, fscale) * m
    y = y / (np.max(np.abs(y)) + 1e-9)
    y = np.tanh(y * drive * 1.2)
    y = y * curve(d, amp if amp else [(0, 0), (min(.08, d / 4), 1), (d * .7, .85), (d, 0)])
    return lp(y, lpf) if lpf else y


# ------------------------------------------------------------ hiệu ứng
def thud(d, f0, f1, decay, click=0.3, rng=None):
    rng = rng or np.random.default_rng(0)
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 30)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)
    return y + click * lp(noise(d, rng), 1500) * np.exp(-t * 120)


def burst(d, lo, hi, rng, decay=20, attack=0.002):
    t = tt(d)
    return bp(noise(d, rng), lo, hi) * np.minimum(t / attack, 1) * np.exp(-t * decay)


def whoosh(d, lo, hi, rng):
    return bp(noise(d, rng), lo, hi) * np.sin(np.pi * tt(d) / d) ** 2


def bubbles(d, n, fmin, fmax, rng, level=1.0):
    y = newbuf(d)
    for _ in range(n):
        i = int(rng.uniform(0, d * .9) * SR)
        L = rng.uniform(.03, .09)
        t = np.arange(int(SR * L)) / SR
        fr = rng.uniform(fmin, fmax) * (1 + 1.5 * t / L)
        s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 50) * rng.uniform(.3, 1)
        y[i:i + len(s)] += s[:len(y) - i]
    return y * level


def squelch(d, r0, r1, lo, hi, rng, decay=6):
    r = np.linspace(r0, r1, n_of(d))
    am = np.abs(np.sin(np.pi * np.cumsum(r) / SR)) ** 1.5
    return bp(noise(d, rng), lo, hi) * am * np.exp(-tt(d) * decay)


def crackles(d, density, lo, hi, rng, decay=0.0, amp=1.0):
    n = n_of(d)
    y = np.zeros(n)
    k = rng.poisson(density * d)
    if k:
        y[rng.integers(0, n - 200, size=k)] = rng.uniform(.3, 1, size=k) * rng.choice([-1, 1], size=k)
    y = bp(y, lo, hi)
    b, a = signal.iirpeak(rng.uniform(lo, hi) / (SR / 2), 3)
    return signal.lfilter(b, a, y) * np.exp(-tt(d) * decay) * amp


def clink(base, d=.8, rng=None):
    t = tt(d)
    y = sum(g * np.sin(2 * np.pi * base * m * t) * np.exp(-t * dec)
            for m, g, dec in ((1, 1, 6), (2.76, .6, 9), (5.4, .4, 14), (8.93, .25, 20)))
    return y * np.minimum(t / .001, 1)


# ============================================================ 1. XÁC THỐI: rên ướt, sũng nước
def rotten_idle(r, p, i):
    d = r.uniform(1.3, 1.8)
    v = voice(d, [(0, 95 * p), (d * .4, 108 * p), (d, 66 * p)], ("uh", "oo", "aw")[i % 3], "oo",
              rough=.55, breath=.3, drive=2, rng=r)
    return v + .35 * bubbles(d, r.integers(5, 10), 180, 520, r) + .25 * squelch(d, 14, 6, 250, 1400, r, 3)

def rotten_aggro(r, p, i):
    d = 1.3
    v = voice(d, [(0, 85 * p), (.5, 150 * p), (1.0, 115 * p), (d, 90 * p)], "aw", "ah",
              rough=.6, breath=.3, drive=2.5, rng=r)
    return v + .4 * bubbles(d, 8, 200, 600, r) + .15 * burst(d, 1500, 6000, r, decay=4)

def rotten_attack(r, p, i):
    d = .55
    out = newbuf(d)
    place(out, voice(d, [(0, 125 * p), (d, 85 * p)], "ah", "uh", rough=.5, breath=.4, drive=2.5,
                     amp=[(0, 0), (.04, 1), (.3, .8), (.55, 0)], rng=r), 0)
    place(out, squelch(.25, 40, 10, 300, 2000, r, 10), .2, .8)
    for k in range(3):                              # răng nghiến lách cách
        place(out, burst(.02, 2000, 6000, r, decay=200), .18 + .04 * k, .3)
    return out

def rotten_hit(r, p, i):
    d = .32
    v = voice(d, [(0, 140 * p), (d, 95 * p)], "eh", "uh", rough=.4, breath=.3, drive=2,
              amp=[(0, 0), (.02, 1), (.15, .7), (.32, 0)], rng=r)
    return v + .6 * squelch(d, 30, 8, 300, 2500, r, 12)

def rotten_die(r, p, i):
    out = newbuf(2.4)
    place(out, voice(1.7, [(0, 115 * p), (.5, 95 * p), (1.7, 48 * p)], "uh", "oo",
                     rough=.6, breath=.35, drive=2, rng=r), 0)
    place(out, bubbles(1.7, 12, 150, 500, r), 0, .4)
    place(out, thud(.5, 70, 35, 9, rng=r), 1.5)
    place(out, squelch(.5, 25, 6, 250, 2000, r, 6), 1.52, .7)
    return out

def rotten_step(r, p, i):                           # kéo lê chân ướt
    out = newbuf(.4)
    place(out, lp(burst(.25, 300, 3000, r, decay=10, attack=.06), 1800), 0, .5)
    place(out, squelch(.12, 40, 15, 250, 1800, r, 22), .12, .8)
    place(out, thud(.2, 90, 45, 24, rng=r), .14, .6)
    return out


# ============================================================ 2. QUỶ ĐÓI: thét rít the thé
def ghoul_idle(r, p, i):
    d = r.uniform(1.2, 1.6)
    v = voice(d, [(0, 380 * p), (d * .5, 420 * p), (d, 300 * p)], ("ee", "eh")[i % 2], "ah",
              rough=.25, breath=.55, drive=2, vib=(5, .03), rng=r)
    return v + .25 * bp(noise(d, r), 3000, 8000) * curve(d, [(0, 0), (.3, 1), (d, 0)])

def ghoul_aggro(r, p, i):
    d = 1.0
    v = voice(d, [(0, 520 * p), (.3, 950 * p), (.7, 1150 * p), (d, 700 * p)], "ah", "ee",
              rough=.3, rate=40, breath=.4, drive=3, vib=(7, .02), rng=r)
    return v + .3 * burst(d, 2500, 9000, r, decay=3)

def ghoul_attack(r, p, i):
    d = .45
    v = voice(d, [(0, 900 * p), (.2, 1250 * p), (d, 800 * p)], "ee", "ah", rough=.4, drive=3, breath=.4,
              amp=[(0, 0), (.02, 1), (.25, .9), (.45, 0)], rng=r)
    g = voice(d, [(0, 130 * p), (d, 100 * p)], "uh", rough=.8, drive=3, breath=.3, rng=r)
    return v + .6 * g

def ghoul_hit(r, p, i):
    d = .3
    v = voice(d, [(0, 820 * p), (d, 480 * p)], "eh", "uh", breath=.5, rough=.3, drive=2,
              amp=[(0, 0), (.02, 1), (.3, 0)], rng=r)
    return v + .25 * burst(d, 3000, 8000, r, decay=12)

def ghoul_die(r, p, i):
    out = newbuf(2.0)
    place(out, voice(1.7, [(0, 700 * p), (.4, 520 * p), (1.7, 190 * p)], "ee", "oo", rough=.45, breath=.6,
                     drive=2, vib=(6, .04), amp=[(0, 0), (.05, 1), (1.2, .7), (1.7, 0)], rng=r), 0)
    place(out, crackles(1.2, 25, 800, 3500, r, 2), .7, .4)         # xương lạo xạo
    return out

def ghoul_step(r, p, i):                            # móng vuốt gõ lạch cạch
    out = newbuf(.35)
    for k in range(3):
        place(out, burst(.03, 2500, 7000, r, decay=90), .02 + .09 * k + r.uniform(0, .02), .7)
    place(out, burst(.2, 800, 3000, r, decay=18, attack=.03), 0, .2)
    return out


# ============================================================ 3. ĐỒ TỂ: thở nặng qua bao tải, dao chặt
def butcher_idle(r, p, i):
    d = 1.6
    out = newbuf(d)
    place(out, lp(noise(d, r), 700) * curve(d, [(0, 0), (.35, .8), (.6, .3), (.8, 0), (.95, .9), (1.4, .5), (d, 0)]), 0, .9)
    place(out, voice(.6, [(0, 72 * p), (.6, 58 * p)], "uh", "oo", rough=.5, breath=.2, drive=2, lpf=900, rng=r), .8)
    if i == 1:                                      # dao treo lủng lẳng
        place(out, clink(520 * p, .7), .2, .25)
        place(out, clink(690 * p, .7), .34, .2)
    return out

def butcher_aggro(r, p, i):
    d = 1.4
    v = voice(d, [(0, 70 * p), (.5, 118 * p), (d, 75 * p)], "oh", "aw", rough=.5, rate=22, breath=.3,
              drive=2.5, lpf=1600, rng=r)
    return v + .25 * lp(noise(d, r), 1200) * curve(d, [(0, 0), (.4, 1), (d, 0)])

def butcher_attack(r, p, i):                        # vung dao + chặt
    out = newbuf(.8)
    place(out, whoosh(.28, 600, 5000, r), 0, .9)
    place(out, thud(.35, 120, 48, 14, .5, r), .27)
    place(out, clink(880 * p, .6), .27, .4)
    place(out, voice(.3, [(0, 95 * p), (.3, 70 * p)], "uh", rough=.5, breath=.3, drive=2, lpf=1200,
                     amp=[(0, 0), (.03, 1), (.3, 0)], rng=r), 0, .7)
    return out

def butcher_hit(r, p, i):
    out = newbuf(.4)
    place(out, voice(.4, [(0, 105 * p), (.4, 70 * p)], "uh", "oh", rough=.4, drive=2, lpf=1200,
                     amp=[(0, 0), (.03, 1), (.4, 0)], rng=r), 0)
    place(out, thud(.2, 140, 60, 25, .6, r), 0, .6)
    return out

def butcher_die(r, p, i):
    out = newbuf(2.3)
    place(out, voice(1.5, [(0, 85 * p), (1.5, 38 * p)], "uh", "oo", rough=.55, drive=2, lpf=1000, rng=r), 0)
    place(out, thud(.8, 70, 26, 5, .5, r), 1.35, 1.2)
    for k, b in enumerate((620, 880, 470)):         # dao rơi loảng xoảng
        place(out, clink(b * p, .6), 1.45 + .12 * k, .35)
    return out

def butcher_step(r, p, i):                          # bước nặng + xích
    out = newbuf(.45)
    place(out, thud(.4, 75 * p, 30, 10, .7, r), 0)
    place(out, burst(.15, 400, 2500, r, decay=25), .01, .4)
    place(out, clink(700 * p, .3), .1, .12)
    return out


# ============================================================ 4. ZOMBIE MỦ: sùng sục, ọc ạch
def boomer_idle(r, p, i):
    d = r.uniform(1.3, 1.7)
    v = voice(d, [(0, 62 * p), (d * .5, 78 * p), (d, 58 * p)], "uh", "oo", rough=.65, rate=18,
              breath=.25, drive=2, lpf=1400, rng=r)
    return v + .6 * bubbles(d, r.integers(10, 16), 140, 700, r) + .35 * squelch(d, 10, 5, 200, 1200, r, 1.5)

def boomer_aggro(r, p, i):
    d = 1.3
    v = voice(d, [(0, 95 * p), (.45, 165 * p), (d, 85 * p)], "aw", "ah", rough=.55, rate=20,
              breath=.3, drive=2.5, rng=r)
    return v + .5 * bubbles(d, 14, 150, 700, r) + .3 * squelch(d, 16, 6, 250, 1500, r, 1)

def boomer_attack(r, p, i):                         # ọc nôn ra axit
    out = newbuf(.8)
    place(out, squelch(.7, 22, 9, 200, 1600, r, 2.5), 0)
    place(out, voice(.5, [(0, 80 * p), (.25, 190 * p), (.5, 110 * p)], "aw", "uh", rough=.6, drive=2,
                     amp=[(0, 0), (.05, 1), (.5, 0)], rng=r), 0, .6)
    place(out, bubbles(.7, 10, 150, 500, r), 0, .5)
    return out

def boomer_hit(r, p, i):
    d = .35
    return squelch(d, 35, 10, 250, 2200, r, 9) + .6 * voice(
        d, [(0, 150 * p), (d, 90 * p)], "eh", "uh", rough=.4, drive=2,
        amp=[(0, 0), (.02, 1), (.35, 0)], rng=r)

def boomer_die(r, p, i):                            # phình rồi nổ tung
    out = newbuf(2.2)
    place(out, voice(.9, [(0, 90 * p), (.9, 130 * p)], "uh", "aw", rough=.6, drive=2,
                     amp=[(0, 0), (.1, .8), (.85, 1), (.9, 0)], rng=r), 0)
    place(out, burst(.7, 60, 3500, r, decay=7, attack=.003), .9)
    place(out, thud(.9, 75, 22, 4, 0, r), .9, 1.3)
    place(out, squelch(1.0, 30, 6, 200, 2500, r, 3), .92, .9)
    place(out, bubbles(1.0, 18, 120, 600, r), 1.0, .6)
    return out

def boomer_step(r, p, i):                           # bước chân nhầy nhụa
    out = newbuf(.35)
    place(out, squelch(.25, 40, 12, 250, 2000, r, 12), 0)
    place(out, thud(.2, 100, 45, 22, .2, r), .02, .6)
    return out


# ============================================================ 5. XÁC CHÁY: rít khàn, lách tách lửa
def burned_idle(r, p, i):
    d = r.uniform(1.3, 1.7)
    v = voice(d, [(0, 112 * p), (d * .4, 100 * p), (d, 80 * p)], "aw", "uh", rough=.45, breath=.6, drive=2.5, rng=r)
    return v + .9 * crackles(d, 45, 1500, 5500, r, .5) + .2 * bp(noise(d, r), 3500, 9000) * curve(d, [(0, 0), (.3, 1), (d, .4)])

def burned_aggro(r, p, i):
    d = 1.2
    v = voice(d, [(0, 120 * p), (.4, 210 * p), (d, 130 * p)], "ah", "aw", rough=.4, breath=.7, drive=3.5, rng=r)
    return v + .8 * crackles(d, 80, 1200, 6000, r, .6) + .35 * whoosh(d, 1500, 7000, r)

def burned_attack(r, p, i):
    d = .5
    v = voice(d, [(0, 170 * p), (d, 110 * p)], "ah", "uh", rough=.5, breath=.8, drive=3,
              amp=[(0, 0), (.03, 1), (.5, 0)], rng=r)
    return v + .8 * whoosh(d, 1000, 6500, r)

def burned_hit(r, p, i):
    d = .3
    return .8 * crackles(d, 150, 1500, 7000, r, 6) + .7 * voice(
        d, [(0, 160 * p), (d, 100 * p)], "eh", "uh", breath=.8, rough=.3, drive=2,
        amp=[(0, 0), (.02, 1), (.3, 0)], rng=r)

def burned_die(r, p, i):                            # sụp thành than vụn + hơi nước
    out = newbuf(2.3)
    place(out, voice(1.5, [(0, 125 * p), (1.5, 60 * p)], "aw", "oo", rough=.5, breath=.7, drive=2.5, rng=r), 0)
    place(out, crackles(2.0, 70, 1000, 6000, r, 1.2), 0, .9)
    place(out, crackles(.6, 250, 300, 3000, r, 5), 1.3, .9)
    place(out, thud(.5, 70, 32, 9, .3, r), 1.4, .8)
    place(out, .3 * bp(noise(1.0, r), 4000, 9000) * curve(1.0, [(0, 0), (.1, 1), (1.0, 0)]), 1.5)
    return out

def burned_step(r, p, i):                           # giẫm lên than
    out = newbuf(.3)
    place(out, crackles(.22, 170, 500, 4500, r, 9), 0)
    place(out, thud(.2, 95, 50, 22, .3, r), 0, .4)
    return out


# ============================================================ 6. DỊ BIẾN: gầm trầm méo tiếng, dậm rung đất
def mutant_idle(r, p, i):
    d = r.uniform(1.5, 2.0)
    a = voice(d, [(0, 55 * p), (d * .5, 62 * p), (d, 44 * p)], "oo", "uh", rough=.7, rate=28, breath=.2, drive=3.5, rng=r)
    b = voice(d, [(0, 58 * p), (d * .5, 66 * p), (d, 47 * p)], "uh", "oo", rough=.7, rate=31, breath=.2, drive=3.5, rng=r)
    sub = np.sin(2 * np.pi * np.cumsum(curve(d, [(0, 42), (d, 36)])) / SR) * curve(d, [(0, 0), (.3, 1), (d, 0)])
    return a + b + .5 * sub

def mutant_aggro(r, p, i):
    d = 1.6
    a = voice(d, [(0, 70 * p), (.5, 135 * p), (1.1, 120 * p), (d, 60 * p)], "ah", "aw",
              rough=.65, rate=30, breath=.4, drive=4.5, rng=r)
    s = voice(d, [(0, 210 * p), (.5, 400 * p), (1.1, 360 * p), (d, 160 * p)], "ah", "ee",
              rough=.4, breath=.5, drive=3, rng=r)
    return a + .35 * s + .3 * lp(noise(d, r), 2500) * curve(d, [(0, 0), (.4, 1), (d, 0)])

def mutant_attack(r, p, i):
    out = newbuf(.9)
    place(out, voice(.6, [(0, 85 * p), (.25, 150 * p), (.6, 80 * p)], "ah", "aw", rough=.6, drive=4,
                     amp=[(0, 0), (.03, 1), (.35, .9), (.6, 0)], rng=r), 0)
    place(out, thud(.5, 95, 28, 8, .6, r), .3, 1.1)
    place(out, crackles(.3, 200, 600, 4000, r, 8), .3, .6)
    return out

def mutant_hit(r, p, i):
    out = newbuf(.45)
    place(out, voice(.45, [(0, 120 * p), (.45, 70 * p)], "aw", "uh", rough=.55, drive=3.5,
                     amp=[(0, 0), (.02, 1), (.45, 0)], rng=r), 0)
    place(out, squelch(.25, 35, 10, 250, 2200, r, 10), 0, .5)
    return out

def mutant_die(r, p, i):
    out = newbuf(3.0)
    place(out, voice(2.2, [(0, 110 * p), (.4, 140 * p), (2.2, 36 * p)], "aw", "oo", rough=.8, rate=24, breath=.4,
                     drive=4, amp=[(0, 0), (.05, 1), (1.4, .8), (2.2, 0)], rng=r), 0)
    place(out, voice(2.2, [(0, 330 * p), (.4, 420 * p), (2.2, 90 * p)], "ah", "uh", rough=.5, breath=.5,
                     drive=3, amp=[(0, 0), (.05, .5), (1.4, .3), (2.2, 0)], rng=r), 0)
    place(out, thud(1.0, 80, 22, 4, .6, r), 2.0, 1.3)
    place(out, crackles(.8, 150, 500, 4000, r, 4), 2.02, .7)
    place(out, squelch(.7, 30, 6, 200, 2000, r, 4), 2.05, .6)
    return out

def mutant_step(r, p, i):                           # dậm chân rung đất
    out = newbuf(.55)
    place(out, thud(.5, 85 * p, 24, 7, .8, r), 0, 1.2)
    place(out, squelch(.2, 35, 12, 200, 1800, r, 14), .03, .5)
    place(out, lp(burst(.4, 60, 600, r, decay=8), 500), 0, .6)
    return out


# ------------------------------------------------------------ xuất file
TYPES = ["rotten", "ghoul", "butcher", "boomer", "burned", "mutant"]
EVENTS = {"idle": 3, "aggro": 1, "attack": 2, "hit": 2, "die": 1, "step": 3}
VOLUME = {"idle": .55, "aggro": 1.0, "attack": .9, "hit": .8, "die": 1.0, "step": .45}


def finish(x, peak=.89):
    x = x - np.mean(x)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fi, fo = int(SR * .004), int(SR * .03)
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo)
    return x.astype(np.float32)


def save(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    sounds, manifest, stats = {}, {}, []
    for zt in TYPES:
        os.makedirs(f"{AUDIO_DIR}/{zt}", exist_ok=True)
        sounds[zt], manifest[zt] = {}, {}
        for ev, count in EVENTS.items():
            sounds[zt][ev], manifest[zt][ev] = [], []
            for i in range(count):
                r = np.random.default_rng(zlib.crc32(f"{zt}/{ev}/{i}".encode()))
                x = finish(globals()[f"{zt}_{ev}"](r, r.uniform(.94, 1.06), i))
                rel = f"audio/{zt}/{ev}_{i + 1}.wav"
                save(f"{OUT_DIR}/{rel}", x)
                sounds[zt][ev].append(x)
                manifest[zt][ev].append(rel)
                stats.append((zt, ev, i + 1, len(x) / SR, float(np.max(np.abs(x))), float(np.sqrt(np.mean(x ** 2))),
                              bool(np.isfinite(x).all())))

    # bản demo nghe thử từng loại: rên -> gầm -> cắn x2 -> trúng đạn x2 -> bước x3 -> chết
    order = [("idle", 0), ("aggro", 0), ("attack", 0), ("attack", 1), ("hit", 0), ("hit", 1),
             ("step", 0), ("step", 1), ("step", 2), ("die", 0)]
    for zt in TYPES:
        reel = np.concatenate([np.concatenate([sounds[zt][ev][i] * VOLUME[ev], np.zeros(int(SR * .5))])
                               for ev, i in order])
        save(f"{OUT_DIR}/audio_demo_{zt}.wav", finish(reel, .9))

    json.dump({"sample_rate": SR, "format": "wav mono 16-bit",
               "volume": VOLUME, "pitch_jitter": [0.94, 1.06], "sounds": manifest},
              open(f"{OUT_DIR}/zombie_audio_manifest.json", "w"), indent=2)

    with zipfile.ZipFile(f"{OUT_DIR}/zombie_audio.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for zt in TYPES:
            for ev in EVENTS:
                for rel in manifest[zt][ev]:
                    z.write(f"{OUT_DIR}/{rel}", rel)
        z.write(f"{OUT_DIR}/zombie_audio_manifest.json", "zombie_audio_manifest.json")

    print(f"{'type':8} {'event':7} n  dur   peak  rms   ok")
    for s in stats:
        print(f"{s[0]:8} {s[1]:7} {s[2]}  {s[3]:.2f}s {s[4]:.2f}  {s[5]:.3f} {s[6]}")

    # ảnh phổ âm để kiểm tra bằng mắt
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, axs = plt.subplots(len(TYPES), len(EVENTS), figsize=(20, 11))
        for a, zt in enumerate(TYPES):
            for b, ev in enumerate(EVENTS):
                ax = axs[a][b]
                ax.specgram(sounds[zt][ev][0], NFFT=1024, Fs=SR, noverlap=768, cmap="magma")
                ax.set_ylim(0, 8000)
                ax.set_title(f"{zt} / {ev}", fontsize=8)
                ax.tick_params(labelsize=6)
        fig.tight_layout()
        fig.savefig(f"{OUT_DIR}/audio_overview.png", dpi=70)
    except Exception as e:
        print("bỏ qua ảnh phổ:", e)
