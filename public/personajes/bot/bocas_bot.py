"""Versión «~b» (boca abierta) de cada dibujo del bot, por código: en la pantalla-cara (la mancha oscura más grande de
la parte de arriba) busca los trazos luminosos (ojos y boca, azul claro o rojo); la boca es el trazo más bajo y ancho;
se tapa con el color de la pantalla y se pinta una boca abierta luminosa del mismo color, con brillo.
  python3 bocas_bot.py carpeta_entrada carpeta_salida   (escribe <nombre>.png y <nombre>~b.png)"""
import glob, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ent, sal = sys.argv[1], sys.argv[2]
os.makedirs(sal, exist_ok=True)
for f in sorted(glob.glob(os.path.join(ent, '*.png'))):
    n = os.path.basename(f)[:-4]
    im = Image.open(f).convert('RGB'); a = np.asarray(im).astype(int); H, W = a.shape[:2]
    osc = (a.max(2) < 75)
    osc[int(float(os.environ.get('CORTE', '0.42')) * H):] = False   # la pantalla está arriba (si no, se colaban latas, cables o sombras)
    lab, k = ndi.label(osc)
    if not k:
        print(n, 'sin pantalla'); continue
    sz = ndi.sum(osc, lab, range(1, k + 1))
    cand = [(s, i + 1) for i, s in enumerate(sz) if s > 0.004 * H * W]
    # la pantalla: la mancha oscura grande que esté más arriba
    best = None
    for s, i in cand:
        ys, xs = np.nonzero(lab == i)
        if best is None or ys.mean() < best[0]:
            best = (ys.mean(), i)
    if best is None:
        print(n, 'sin pantalla'); continue
    scr = ndi.binary_fill_holes(lab == best[1])
    anch = scr.sum(1)                       # filas anchas = la pantalla (las mangas o cables pegados son estrechos)
    filas = np.nonzero(anch >= 0.6 * anch.max())[0]
    y0, y1 = filas.min(), filas.max()
    scr[:y0] = False; scr[y1 + 1:] = False
    ys, xs = np.nonzero(scr); x0, x1 = xs.min(), xs.max()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    luz = scr & (((g > 150) & (b > 150) & (r < 170)) | ((r > 170) & (g < 110)))
    luz = ndi.binary_opening(luz, iterations=1)
    lb, kk = ndi.label(luz)
    blobs = []
    for i in range(1, kk + 1):
        yy, xx = np.nonzero(lb == i)
        if len(yy) < 25: continue
        blobs.append((yy.mean(), xx.mean(), yy.min(), yy.max(), xx.min(), xx.max(), len(yy)))
    bajos = [bb for bb in blobs if bb[0] > y0 + 0.55 * (y1 - y0) and abs(bb[1] - (x0 + x1) / 2) < 0.3 * (x1 - x0)]
    im.save(os.path.join(sal, n + '.png'))
    if not bajos:
        print(n, 'sin boca visible'); continue
    m = max(bajos, key=lambda bb: bb[0])
    cy, cx = (m[2] + m[3]) / 2, (m[4] + m[5]) / 2
    col = tuple(int(v) for v in np.median(a[(lb > 0) & (np.abs(np.arange(H)[:, None] - m[0]) < 40)], 0)) if True else (90, 230, 230)
    fondo = tuple(int(v) for v in np.median(a[scr & ~luz], 0))
    w = float(max(m[5] - m[4], 0.14 * (x1 - x0))); h = 0.55 * w; cx, cy = float(cx), float(cy)
    out = im.copy(); d = ImageDraw.Draw(out)
    d.rectangle((m[4] - 6, m[2] - 6, m[5] + 6, m[3] + 6), fill=fondo)
    glow = Image.new('L', im.size, 0); dg = ImageDraw.Draw(glow)
    dg.ellipse((cx - w * 0.62, cy - h * 0.62, cx + w * 0.62, cy + h * 0.62), fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.12))
    out = Image.composite(Image.new('RGB', im.size, col), out, glow)
    d = ImageDraw.Draw(out)
    d.ellipse((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), fill=col)
    inner = tuple(min(255, int(v * 0.55 + 255 * 0.45)) for v in col)
    d.ellipse((cx - w * 0.28, cy - h * 0.18, cx + w * 0.28, cy + h * 0.3), fill=tuple(int(v * 0.75) for v in col))
    # sólo dentro de la pantalla
    msk = Image.fromarray((scr * 255).astype('uint8'))
    Image.composite(out, im, msk).save(os.path.join(sal, n + '~b.png'))
print('hecho')
