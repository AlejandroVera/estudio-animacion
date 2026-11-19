"""Prepara los dibujos del vídeo de la pasta de dientes (vertical 9:16): bases elegidas a img/, de cada movimiento
X_b copia solo lo que cambia (protegiendo la cabeza magenta salvo en SIN_PROTEGER) y de cada boca una capa RGBA.
Copiado de qr_restaurante/preparar.py."""
import shutil, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ESC = ['entrada_1', 'fantasia_1', 'pasillo_1', 'fluor_1', 'carbon_1', 'doce_1', 'vino_1', 'menta_1', 'duda_1', 'medio_2',
       'caja_1', 'bano_2', 'cepillos_2']
BASES = {'es_' + e.rsplit('_', 1)[0]: 'es_' + e for e in ESC}
TAL_CUAL = ['br_estante', 'br_triple', 'br_onu', 'br_fila', 'br_fresca', 'es_fantasia_b']  # es_fantasia_b entera: la mezcla dejaba la caja fantasma en el estante
VARIANTES = {'es_entrada_b': 'es_entrada', 'es_pasillo_b': 'es_pasillo',
             'es_fluor_b': 'es_fluor', 'es_fluor_c': 'es_fluor', 'es_carbon_b': 'es_carbon', 'es_doce_b': 'es_doce',
             'es_menta_b': 'es_menta', 'es_medio_b': 'es_medio', 'es_vino_b': 'es_vino', 'es_caja_b': 'es_caja',
             'es_caja_c': 'es_caja', 'es_caja_d': 'es_caja', 'es_caja_e': 'es_caja', 'es_bano_b': 'es_bano',
             'es_bano_c': 'es_bano', 'es_cepillos_b': 'es_cepillos', 'br_onu_b': 'br_onu', 'br_fila_b': 'br_fila'}
SIN_PROTEGER = {'es_entrada_b', 'es_pasillo_b', 'es_carbon_b', 'es_doce_b', 'es_menta_b', 'es_medio_b', 'es_caja_e',
                'es_bano_b', 'es_bano_c', 'es_cepillos_b', 'br_onu_b', 'br_fila_b'}
ANTES = {}
BOCAS = [b + s for b in BASES for s in ('_boca', '_bocao')]
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
    Image.fromarray(np.dstack([b.astype('uint8'), al]), 'RGBA').save(f'img/{nom}.png')
    print(nom, 'boca %.2f%%' % (m.mean() * 100))
