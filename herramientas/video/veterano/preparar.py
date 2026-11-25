"""Prepara los planos sueltos del sketch del veterano (gags, primer plano, final): bases a img/, variantes que copian
solo lo que cambia y bocas como capa RGBA (mancha de cambio dentro de una caja).
  python3 preparar.py"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASES = {'es_pprosa': 'es_pprosa', 'es_senora': 'es_senora', 'br_web': 'br_web', 'es_paco': 'es_paco',
         'es_levantan': 'es_levantan_3', 'es_oscuro': 'es_oscuro_1'}
VARIANTES = {'es_senora_b': 'es_senora'}
BOCAS = {'es_pprosa': ('es_pprosa_bk', (0.3, 0.75, 0.45, 0.65)), 'es_paco': ('es_paco_bk', (0.6, 1, 0.3, 0.5))}


def carga(n, tam=None):
    im = Image.open(f'crudo/{n}.png').convert('RGB')
    return im.resize(tam) if tam else im


for k, v in BASES.items():
    try:
        carga(v).save(f'img/{k}.jpg', quality=92)
    except FileNotFoundError:
        print('falta', v)
for nom, base in VARIANTES.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB'); a = np.asarray(A).astype(int)
    b = np.asarray(carga(nom, A.size)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 45, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    m = np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(d, lab, range(1, n + 1))) if t > 1500]) if n else d
    m = ndi.binary_fill_holes(m)
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[..., None] / 255
    Image.fromarray((a * (1 - al) + b * al).astype('uint8')).save(f'img/{nom}.jpg', quality=92)
    print(nom, 'cambia %.1f%%' % (m.mean() * 100))
for base, (fuente, (x0, x1, y0, y1)) in BOCAS.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB'); a = np.asarray(A).astype(int)
    b = np.asarray(carga(fuente, A.size)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 50, iterations=2)
    H, W = d.shape; z = np.zeros_like(d); z[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = True; d &= z
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=6))
    k = int(np.argmax(ndi.sum(d, lab, range(1, n + 1)))) + 1
    ys, xs = np.nonzero((lab == k) & d)
    mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    rx, ry = (xs.max() - xs.min()) / 2 + 10, (ys.max() - ys.min()) / 2 + 10
    yy, xx = np.ogrid[:H, :W]
    m = ((xx - mx) / rx) ** 2 + ((yy - my) / ry) ** 2 <= 1
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))
    out = np.dstack([b.astype('uint8'), al]); out[al == 0, :3] = 0
    Image.fromarray(out, 'RGBA').save(f'img/{base}_boca.png', optimize=True)
    print(base, 'boca en', int(mx), int(my))
