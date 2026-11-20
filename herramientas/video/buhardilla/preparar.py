"""Prepara los dibujos del vídeo de la pasta de dientes (vertical 9:16): bases elegidas a img/, de cada movimiento
X_b copia solo lo que cambia (protegiendo la cabeza magenta salvo en SIN_PROTEGER) y de cada boca una capa RGBA.
Copiado de qr_restaurante/preparar.py."""
import shutil, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ESC = ['entrada_1', 'paris_1', 'viga_1', 'precio_1', 'dormitorio_2', 'pie_1', 'turnos_1', 'ducha_1', 'cocina_1',
       'trastero_1', 'loft_1', 'metro_1', 'mini_1', 'amigos_2', 'pensar_1', 'escalera_1', 'salon_1', 'pprosa_1', 'ppagente_1']
BASES = {'es_' + e.rsplit('_', 1)[0]: 'es_' + e for e in ESC}
TAL_CUAL = []
VARIANTES = {'es_dormitorio_b': 'es_dormitorio', 'es_ducha_b': 'es_ducha', 'es_cocina_b': 'es_cocina',
             'es_loft_b': 'es_loft', 'es_loft_c': 'es_loft', 'es_pensar_b': 'es_pensar', 'es_salon_b': 'es_salon'}
SIN_PROTEGER = {'es_ducha_b'}
ANTES = {}
import glob as _g
BOCAS = sorted(os.path.basename(f)[:-4] for f in _g.glob('crudo/*_rboca.png'))   # boca del chico rosa
BOCAS_AG = sorted(os.path.basename(f)[:-4] for f in _g.glob('crudo/*_aboca.png'))  # boca del agente
os.makedirs('img', exist_ok=True)




def jpg(src, dst):
    Image.open(f'crudo/{src}.png').convert('RGB').save(f'img/{dst}.jpg', quality=92)


def cabezas(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 150) & (g < 120) & (b > 110) & (r - g > 80)
    lab, n = ndi.label(mag)
    out = []
    if not n:
        return out
    tam = ndi.sum(mag, lab, range(1, n + 1))
    for i in np.argsort(tam)[::-1][:1]:
        if tam[i] < 4000:
            break
        m = ndi.binary_fill_holes(lab == i + 1)
        dt = ndi.distance_transform_edt(m)
        y, x = np.unravel_index(int(np.argmax(dt)), dt.shape)
        out.append((x, y, float(dt[y, x])))
    return out


def disco(sh, x, y, r):
    yy, xx = np.ogrid[:sh[0], :sh[1]]
    return (xx - x) ** 2 + (yy - y) ** 2 <= r * r


for k, v in BASES.items():
    jpg(v, k)
for k in TAL_CUAL:
    jpg(k, k)
for nom, base in VARIANTES.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a = np.asarray(A).astype(int)
    b = np.asarray(Image.open(f'crudo/{nom}.png').convert('RGB').resize(A.size)).astype(int)
    d = np.abs(a - b).max(2) > 45
    prot = np.zeros(d.shape, bool)
    if nom not in SIN_PROTEGER:
        for (x, y, r) in cabezas(a):
            prot |= disco(d.shape, x, y, r * 1.08)
    if base in ANTES:  # donde se borró la planta, la variante no debe volver a pintarla
        o = np.asarray(Image.open(f'crudo/{ANTES[base]}.png').convert('RGB').resize(A.size)).astype(int)
        prot |= ndi.binary_dilation(np.abs(o - a).max(2) > 30, iterations=6)
    d &= ~prot
    d = ndi.binary_opening(d, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    m = np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(np.ones_like(d), lab, range(1, n + 1))) if t > 2500]) if n else d
    m = ndi.binary_fill_holes(m) & ~prot
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[..., None] / 255
    Image.fromarray((a * (1 - al) + b * al).astype('uint8')).save(f'img/{nom}.jpg', quality=92)
    print(nom, 'cambia %.1f%%' % (m.mean() * 100))
for nom in BOCAS:
    base = nom.rsplit('_', 1)[0]
    salida = base + '_boca'
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a = np.asarray(A).astype(int)
    b = np.asarray(Image.open(f'crudo/{nom}.png').convert('RGB').resize(A.size)).astype(int)
    d = np.abs(a - b).max(2) > 45
    heads = cabezas(a)
    rb, gb, bb = b[..., 0], b[..., 1], b[..., 2]
    magb = (rb > 150) & (gb < 120) & (bb > 110) & (rb - gb > 80)
    oro = (rb > 150) & (gb > 110) & (bb < 120)
    m = np.zeros(d.shape, bool)
    if heads:
        x, y, r = heads[0]
        z = disco(d.shape, x, y, r * 0.86) & (np.arange(d.shape[0])[:, None] > y + 0.18 * r)
        nm = z & ~magb & ~oro
        cand = nm & d
        if cand.sum() > 40:
            lab, n = ndi.label(ndi.binary_dilation(nm, iterations=2))
            t = ndi.sum(d & z, lab, range(1, n + 1))
            kk = int(np.argmax(t)) + 1
            ys, xs = np.nonzero((lab == kk) & nm)
            x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
            mx, my = (x0 + x1) / 2, (y0 + y1) / 2
            rx, ry = (x1 - x0) / 2 + 8, (y1 - y0) / 2 + 8
            yy, xx = np.ogrid[:d.shape[0], :d.shape[1]]
            m = (((xx - mx) / rx) ** 2 + ((yy - my) / ry) ** 2 <= 1) & disco(d.shape, x, y, r * 0.98)
            vieja = z & (a.max(2) < 100)
            lv, nv = ndi.label(ndi.binary_dilation(vieja, iterations=2))
            for j in range(1, nv + 1):
                if (m & (lv == j)).any():
                    m |= ndi.binary_dilation(lv == j, iterations=3) & disco(d.shape, x, y, r * 0.95)
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))
    Image.fromarray(np.dstack([b.astype('uint8'), al]), 'RGBA').save(f'img/{salida}.png')
    print(nom, 'boca %.2f%%' % (m.mean() * 100))

# boca del agente (persona normal, con barba): lo que cambia en la edición fuera de la cabeza magenta,
# la mancha de cambio más grande y compacta, en elipse con borde suave
for nom in BOCAS_AG:
    base = nom.rsplit('_', 1)[0]
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a = np.asarray(A).astype(int)
    b = np.asarray(Image.open(f'crudo/{nom}.png').convert('RGB').resize(A.size)).astype(int)
    d = np.abs(a - b).max(2) > 50
    for (x, y, r) in cabezas(a):
        d &= ~disco(d.shape, x, y, r * 1.1)
    d = ndi.binary_opening(d, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=6))
    m = np.zeros(d.shape, bool)
    if n:
        tam = ndi.sum(d, lab, range(1, n + 1))
        k = int(np.argmax(tam)) + 1
        ys, xs = np.nonzero((lab == k) & d)
        mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        rx, ry = (xs.max() - xs.min()) / 2 + 10, (ys.max() - ys.min()) / 2 + 10
        yy, xx = np.ogrid[:d.shape[0], :d.shape[1]]
        m = ((xx - mx) / rx) ** 2 + ((yy - my) / ry) ** 2 <= 1
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))
    Image.fromarray(np.dstack([b.astype('uint8'), al]), 'RGBA').save(f'img/{base}_aboca.png')
    print(nom, 'boca agente %.2f%%' % (m.mean() * 100), 'en', int(mx) if n else '-', int(my) if n else '-')
