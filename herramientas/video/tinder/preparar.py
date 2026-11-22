"""Prepara los planos que no son el fijo (gags y primeros planos) del sketch de Tinder: bases a img/, variantes que
copian solo lo que cambia sobre su base, y bocas (crudo/<plano>_boca.png = chico, _aboca = Ana) como capa RGBA con la
mancha de cambio de la cara de ese personaje (ZONA: franja horizontal donde está su cara, en fracción del ancho).
  python3 preparar.py"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASES = ['es_sofa', 'es_pizza', 'es_madre', 'es_cola', 'es_pprosa', 'es_ppana']
VARIANTES = {'es_sofa_b': 'es_sofa', 'es_pizza_b': 'es_pizza', 'es_madre_b': 'es_madre'}
ZONA = {'es_sofa_aboca': (0.55, 1), 'es_madre_aboca': (0.55, 1), 'es_cola_aboca': (0.5, 1)}   # cara de Ana a la derecha


def carga(n, tam=None):
    im = Image.open(f'crudo/{n}.png').convert('RGB')
    return im.resize(tam) if tam else im


for n in BASES:
    carga(n).save(f'img/{n}.jpg', quality=92)

for nom, base in VARIANTES.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a = np.asarray(A).astype(int)
    b = np.asarray(carga(nom, A.size)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 45, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    m = np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(d, lab, range(1, n + 1))) if t > 1500]) if n else d
    m = ndi.binary_fill_holes(m)
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[..., None] / 255
    Image.fromarray((a * (1 - al) + b * al).astype('uint8')).save(f'img/{nom}.jpg', quality=92)
    print(nom, 'cambia %.1f%%' % (m.mean() * 100))

for f in sorted(glob.glob('crudo/es_*boca.png')):
    nom = os.path.basename(f)[:-4]
    base = nom.rsplit('_', 1)[0]
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a = np.asarray(A).astype(int)
    b = np.asarray(carga(nom, A.size)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 50, iterations=2)
    if nom in ZONA:
        x0, x1 = ZONA[nom]
        d[:, :int(x0 * d.shape[1])] = False
        d[:, int(x1 * d.shape[1]):] = False
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=6))
    m = np.zeros(d.shape, bool)
    if n:
        k = int(np.argmax(ndi.sum(d, lab, range(1, n + 1)))) + 1
        ys, xs = np.nonzero((lab == k) & d)
        mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        rx, ry = (xs.max() - xs.min()) / 2 + 10, (ys.max() - ys.min()) / 2 + 10
        yy, xx = np.ogrid[:d.shape[0], :d.shape[1]]
        m = ((xx - mx) / rx) ** 2 + ((yy - my) / ry) ** 2 <= 1
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))
    out = np.dstack([b.astype('uint8'), al])
    out[al == 0, :3] = 0
    Image.fromarray(out, 'RGBA').save(f'img/{nom}.png', optimize=True)
    print(nom, 'boca %.2f%%' % (m.mean() * 100), 'en', int(mx) if n else '-', int(my) if n else '-')
