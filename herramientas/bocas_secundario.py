"""Versión «~b» (boca al revés) de cada postura de un personaje secundario de persona normal (p. ej. la nutri):
de la edición de IA (misma imagen con la boca abierta o cerrada) copia SOLO la zona de la boca, así el resto del
dibujo queda idéntico al píxel y no «salta» al hablar.

  python3 herramientas/bocas_secundario.py <carpeta_posturas> <carpeta_ediciones> nombre1 nombre2 ...
  -> escribe <carpeta_posturas>/<nombre>~b.jpg y una hoja de comprobación <carpeta_posturas>/bocas_revision.jpg
La cara se localiza por el color de piel (la mancha de piel más grande en el tercio de arriba).
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

carp, edic, nombres = sys.argv[1], sys.argv[2], sys.argv[3:]


def cara(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    piel = (r > 200) & (g > 140) & (g < 215) & (b > 100) & (b < 190) & (r - b > 40)
    piel[int(a.shape[0] * 0.38):] = False
    lab, n = ndi.label(piel)
    if not n:
        raise SystemExit('no encuentro la cara')
    k = np.argmax(ndi.sum(piel, lab, range(1, n + 1))) + 1
    ys, xs = np.where(lab == k)
    return xs.min(), ys.min(), xs.max(), ys.max()


def desplazamiento(a, b, caja):
    """La edición a veces sale movida unos píxeles: busca el desplazamiento que mejor encaja la cara."""
    x0, y0, x1, y1 = caja
    ref = a[y0:y1, x0:x1].astype(int)
    mejor = (1e18, 0, 0)
    for dy in range(-12, 13, 2):
        for dx in range(-12, 13, 2):
            c = b[y0 + dy:y1 + dy, x0 + dx:x1 + dx].astype(int)
            if c.shape != ref.shape:
                continue
            d = np.abs(c - ref).mean()
            if d < mejor[0]:
                mejor = (d, dx, dy)
    return mejor[1], mejor[2]


hoja = []
for n in nombres:
    base = Image.open(f'{carp}/{n}.jpg').convert('RGB')
    ed = Image.open(f'{edic}/{n}.jpg').convert('RGB').resize(base.size, Image.LANCZOS)
    a, b = np.asarray(base), np.asarray(ed)
    x0, y0, x1, y1 = cara(a)
    dx, dy = desplazamiento(a, b, (x0, y0, x1, y1))
    b = np.roll(np.roll(b, -dy, 0), -dx, 1)
    h = y1 - y0
    # zona de la boca: mitad de abajo de la cara (debajo de las gafas) y un poco por debajo de la barbilla
    zx0, zx1 = x0 + int((x1 - x0) * 0.15), x1 - int((x1 - x0) * 0.15)
    zy0, zy1 = y0 + int(h * 0.58), min(a.shape[0], y1 + int(h * 0.12))
    d = np.abs(a.astype(int) - b.astype(int)).max(2) > 45
    m = np.zeros(d.shape, bool)
    m[zy0:zy1, zx0:zx1] = d[zy0:zy1, zx0:zx1]
    lab, k = ndi.label(m)
    if k:
        tam = ndi.sum(m, lab, range(1, k + 1))
        m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t > 30])
    if m.any():
        ys, xs = np.where(m)
        caja = np.zeros(d.shape, bool)
        caja[max(zy0, ys.min() - 14):min(zy1, ys.max() + 14), max(zx0, xs.min() - 14):min(zx1, xs.max() + 14)] = True
        mask = Image.fromarray((caja * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
    else:
        mask = Image.new('L', base.size, 0)
        print(n, 'SIN CAMBIO de boca')
    out = Image.composite(Image.fromarray(b), base, mask)
    out.save(f'{carp}/{n}~b.jpg', quality=92)
    print(n, 'boca', 'desplazamiento', dx, dy)
    cx0, cy0 = max(0, x0 - 40), max(0, y0 - 40)
    for im in (base, out):
        hoja.append(im.crop((cx0, cy0, x1 + 40, y1 + int(h * 0.3))).resize((260, 300)))
s = Image.new('RGB', (260 * 2 * 7, 300 * ((len(hoja) + 13) // 14)), 'white')
for i, im in enumerate(hoja):
    s.paste(im, ((i % 14) * 260, (i // 14) * 300))
s.save(f'{carp}/bocas_revision.jpg', quality=88)
