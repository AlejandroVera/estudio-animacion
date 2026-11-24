"""Prepara los dibujos del vídeo «la báscula» (Ana Cardo, vertical): bases a img/, variantes que copian
solo lo que cambia sobre su base, y bocas (crudo/<dibujo>_boca.png) como capa RGBA con la mancha de cambio más
grande (ZONA limita a una franja horizontal cuando hay dos personas).
  python3 preparar.py"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASES = {'es_zapatos': 'es_zapatos_1', 'es_habla': 'es_habla_1', 'es_cuanto': 'es_habla_2', 'es_miercoles': 'es_miercoles_2',
         'br_abuela': 'br_abuela_1'}
TAL_CUAL = ['es_saca', 'br_armario', 'es_hueco', 'es_martes', 'br_resenas', 'br_fontanero', 'es_orgullosa', 'es_tel', 'br_abuela_c']
VARIANTES = {'es_zapatos_b': 'es_zapatos', 'es_habla_b': 'es_habla', 'es_cuanto_b': 'es_cuanto', 'es_martes_b': 'es_martes',
             'es_miercoles_b': 'es_miercoles', 'es_miercoles_s': 'es_miercoles', 'br_fontanero_b': 'br_fontanero', 'es_saca_b': 'es_saca', 'br_armario_b': 'br_armario'}
ZONA = {}
# capas de boca de cada personaje: capa -> (dibujo base en img/, dibujo con la boca en crudo/, caja x0 x1 y0 y1)
BOCAS = {'es_zapatos_ana': ('es_zapatos', 'es_zapatos_ana_bk', (0.55, 1, 0.2, 0.5)),
         'es_hueco_ana': ('es_hueco', 'es_hueco_ana_bk', (0.68, 1, 0.22, 0.45)),
         'es_hueco_pac': ('es_hueco', 'es_hueco_pac_bk', (0.3, 0.68, 0.22, 0.45)),
         'es_cuanto_ana': ('es_cuanto', 'es_cuanto_ana_bk', (0.55, 1, 0.25, 0.5)),
         'es_martes_ana': ('es_martes', 'es_martes_ana_bk', (0, 0.42, 0.22, 0.45)),
         'es_miercoles_ana': ('es_miercoles', 'es_miercoles_ana_bk', (0, 0.45, 0.25, 0.5))}
# dibujos con la boca CERRADA del que habla (base nueva) -> (dibujo, edición cerrada, caja); su boca hablando = la del dibujo
CERRADAS = {'es_hueco_c': ('es_hueco', 'es_hueco_c', (0.68, 1, 0.22, 0.45)),
            'es_habla_bc': ('es_habla_b', 'es_habla_bc', (0, 0.48, 0.42, 0.65)),
            'es_miercoles_bc': ('es_miercoles_b', 'es_miercoles_bc', (0.48, 0.95, 0.42, 0.65))}
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

for f in sorted(os.listdir('crudo')):
    if not f.endswith('_boca.png'):
        continue
    base = f[:-9]
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a = np.asarray(A).astype(int)
    b = np.asarray(carga(f[:-4], A.size)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 50, iterations=2)
    if base in ZONA:
        x0, x1 = ZONA[base]
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
    Image.fromarray(out, 'RGBA').save(f'img/{base}_boca.png', optimize=True)
    print(base, 'boca %.2f%%' % (m.mean() * 100), 'en', int(mx) if n else '-', int(my) if n else '-')


def mancha(a, b, caja):
    d = ndi.binary_opening(np.abs(a - b).max(2) > 50, iterations=2)
    x0, x1, y0, y1 = caja
    H, W = d.shape
    z = np.zeros_like(d); z[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = True
    d &= z
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=6))
    k = int(np.argmax(ndi.sum(d, lab, range(1, n + 1)))) + 1
    ys, xs = np.nonzero((lab == k) & d)
    mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    rx, ry = (xs.max() - xs.min()) / 2 + 10, (ys.max() - ys.min()) / 2 + 10
    yy, xx = np.ogrid[:H, :W]
    m = ((xx - mx) / rx) ** 2 + ((yy - my) / ry) ** 2 <= 1
    print('   mancha en', int(mx), int(my), 'radios', int(rx), int(ry))
    return np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))


def capa(b, al, nombre):
    out = np.dstack([b.astype('uint8'), al]); out[al == 0, :3] = 0
    Image.fromarray(out, 'RGBA').save(f'img/{nombre}_boca.png', optimize=True)


for nom, (base, fuente, caja) in BOCAS.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a, b = np.asarray(A).astype(int), np.asarray(carga(fuente, A.size)).astype(int)
    print(nom); capa(b, mancha(a, b, caja), nom)
for nom, (base, fuente, caja) in CERRADAS.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB')
    a, b = np.asarray(A).astype(int), np.asarray(carga(fuente, A.size)).astype(int)
    print(nom); al = mancha(a, b, caja)
    f = al.astype(float)[..., None] / 255
    Image.fromarray((a * (1 - f) + b * f).astype('uint8')).save(f'img/{nom}.jpg', quality=92)
    capa(a, al, nom)   # la boca abierta original, para cuando habla
