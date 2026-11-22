"""Prepara los dibujos del vídeo de la air fryer (vertical 9:16): bases a img/, variantes que copian solo lo que
cambia sobre su base, y bocas (crudo/<dibujo>_boca.png = el mismo dibujo con la boca abierta) como capa RGBA con la
mancha de cambio dentro de su cabeza magenta.
  python3 preparar.py"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASES = {'es_espera': 'es_espera_1', 'es_verano': 'es_verano_1', 'br_web': 'br_web_1', 'es_hospital': 'es_hospital_1',
         'br_correo': 'br_correo_1', 'br_reyes': 'br_reyes_1', 'br_punto': 'br_punto_1', 'es_oficina': 'es_oficina_1',
         'br_madre': 'br_madre_1'}
TAL_CUAL = ['es_espera_seco', 'es_espera_ilusion', 'es_espera_compra', 'es_cyber', 'es_lee', 'es_final', 'es_calendario',
            'es_corre', 'es_carrito', 'es_puerta', 'es_verano_c', 'es_hospital_c', 'es_oficina_b', 'es_final_b', 'es_corre2', 'es_puerta2', 'es_decide', 'br_web_clic']
VARIANTES = {'es_espera_ventana': 'es_espera', 'es_verano_b': 'es_verano', 'es_hospital_b': 'es_hospital',
             'br_reyes_b': 'br_reyes', 'br_punto_b': 'br_punto', 'br_madre_b': 'br_madre', 'br_madre_c': 'br_madre',
             'es_corre_b': 'es_corre', 'es_corre2_b': 'es_corre2'}
os.makedirs('img', exist_ok=True)


def carga(n, tam=None):
    im = Image.open(f'crudo/{n}.png').convert('RGB')
    return im.resize(tam) if tam else im


for k, v in BASES.items():
    carga(v).save(f'img/{k}.jpg', quality=92)
for k in TAL_CUAL:
    carga(k).save(f'img/{k}.jpg', quality=92)

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


def cabeza(a):
    r, g, bb = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 150) & (g < 120) & (bb > 110) & (r - g > 80)
    lab, n = ndi.label(mag)
    k = int(np.argmax(ndi.sum(mag, lab, range(1, n + 1)))) + 1
    return ndi.binary_dilation(ndi.binary_fill_holes(lab == k), iterations=6)


ZONA = {'es_cyber': (0.2, 0.25, 0.65, 0.5)}
for f in sorted(os.listdir('crudo')):
    if not f.endswith('_boca.png'):
        continue
    base = f[:-9]
    if base.endswith('_1'):
        base = base[:-2]
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a = np.asarray(A).astype(int)
    b = np.asarray(carga(f[:-4], A.size)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 50, iterations=2)
    if base in ZONA:   # de noche la cabeza no es magenta: zona de la cara a mano (fracciones x0, y0, x1, y1)
        x0, y0, x1, y1 = ZONA[base]
        z = np.zeros(d.shape, bool); z[int(y0 * d.shape[0]):int(y1 * d.shape[0]), int(x0 * d.shape[1]):int(x1 * d.shape[1])] = True
        d &= z
    else:
        d &= cabeza(a)
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
    Image.fromarray(out, 'RGBA').save(f'img/{base}_boca.png', optimize=True)
    print(base, 'boca %.2f%%' % (m.mean() * 100), 'en', int(mx) if n else '-', int(my) if n else '-')
