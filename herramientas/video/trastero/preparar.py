"""Prepara los planos que no son el fijo (gags y primeros planos) del sketch del trastero: bases a img/, variantes que
copian solo lo que cambia sobre su base, y bocas (crudo/<plano>_boca.png = chico, _aboca = Ana) como capa RGBA con la
mancha de cambio de la cara de ese personaje (ZONA: franja horizontal donde está su cara, en fracción del ancho).
  python3 preparar.py"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASES = ['es_armario', 'es_fideos', 'es_caldera', 'br_carta', 'es_cola', 'br_puerta', 'es_pprosa', 'es_cola_b']
VARIANTES = {'es_armario_b': 'es_armario', 'es_fideos_b': 'es_fideos', 'es_caldera_b': 'es_caldera', 'br_carta_b': 'br_carta'}
ZONA = {}   # cara de Ana a la derecha


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
    # la boca se busca comparando con el dibujo del que se editó (es_ppana se limpió después: la mancha borrada no es boca)
    ORIGEN = {}
    A = Image.open(ORIGEN.get(base, f'img/{base}.jpg')).convert('RGB')
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

# es_armario_b (cierra la taquilla) traía la sonrisa ABIERTA y al hablar no se notaba la boca: se le pone la boca
# cerrada de es_armario (misma cabeza en el mismo sitio)
A = np.asarray(Image.open('img/es_armario.jpg').convert('RGB')).astype(float)
B = np.asarray(Image.open('img/es_armario_b.jpg').convert('RGB')).astype(float)
z = np.zeros(A.shape[:2]); z[700:1160, 1060:1400] = 1
z = np.asarray(Image.fromarray((z * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(6))).astype(float)[..., None] / 255
Image.fromarray((B * (1 - z) + A * z).astype('uint8')).save('img/es_armario_b.jpg', quality=92)
