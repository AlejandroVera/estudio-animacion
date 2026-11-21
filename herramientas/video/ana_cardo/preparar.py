"""Prepara los dibujos del vídeo de Ana Cardo (vertical 9:16): bases elegidas a img/, de cada movimiento copia solo
lo que cambia sobre su base, y de cada boca (crudo/<dibujo>_boca.png = el mismo dibujo con la boca abierta) una capa
RGBA con la mancha de cambio más grande (la boca de Ana; no hay cabezas magenta: es una persona normal)."""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ELEGIDOS = ['es_consulta_1', 'es_familia_1', 'es_estudia_1', 'es_grad_1', 'es_lupa_1', 'es_yogur_1', 'es_estante_2',
            'br_tele_2', 'es_madre_1', 'es_padre_1', 'es_abuela_2', 'es_tia_1', 'es_navidad_2', 'es_habla_1']
BASES = {e.rsplit('_', 1)[0]: e for e in ELEGIDOS}
TAL_CUAL = {'es_sigue': 'es_sigue_1', 'es_jajas': 'es_jajas_1', 'es_estudia_b': 'es_estudia_b', 'es_yogur_b': 'es_yogur_b'}  # estos movieron el encuadre: enteros
VARIANTES = {'es_consulta_b': 'es_consulta', 'es_consulta_c': 'es_consulta', 'es_grad_b': 'es_grad', 'br_tele_b': 'br_tele', 'es_lupa_b': 'es_lupa',
             'es_estante_b': 'es_estante', 'es_tia_b': 'es_tia', 'es_madre_b': 'es_madre', 'es_abuela_b': 'es_abuela',
             'es_navidad_b': 'es_navidad', 'es_habla_come': 'es_habla', 'es_habla_vende': 'es_habla',
             'es_habla_cree': 'es_habla'}
os.makedirs('img', exist_ok=True)


def carga(n, tam=None):
    im = Image.open(f'crudo/{n}.png').convert('RGB')
    return im.resize(tam) if tam else im


for k, v in {**BASES, **TAL_CUAL}.items():
    carga(v).save(f'img/{k}.jpg', quality=92)

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
