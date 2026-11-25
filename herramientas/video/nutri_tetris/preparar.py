"""Prepara los dibujos del vídeo «el Tetris de la agenda» (Ana Cardo, vertical): bases a img/, variantes que copian
solo lo que cambia sobre su base, y bocas (crudo/<dibujo>_boca.png) como capa RGBA con la mancha de cambio más
grande (ZONA limita a una franja horizontal cuando hay dos personas).
  python3 preparar.py"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASES = {'es_tetris': 'es_tetris_2', 'es_juego': 'es_juego_1', 'br_story': 'br_story2_2', 'br_p9': 'br_p9_perfil_1'}
TAL_CUAL = ['es_reloj', 'br_p10', 'es_llega', 'es_espera', 'br_verdura', 'es_portatil', 'br_coche',
            'br_verguenza', 'br_fontanero', 'br_huecos', 'es_tupper', 'es_final']
VARIANTES = {'es_mueve': 'es_tetris', 'es_dieta': 'es_tetris', 'es_reloj_b': 'es_reloj', 'br_coche_b': 'br_coche', 'es_sincero': 'es_portatil', 'br_huecos_b': 'br_huecos',
             'es_tupper_b': 'es_tupper', 'br_verguenza_b': 'br_verguenza', 'es_incredula': 'es_final'}
ZONA = {}
TODO = (0, 1, 0, 1)
# capas de boca: capa -> (dibujo base en img/, dibujo con la boca en crudo/, caja x0 x1 y0 y1)
BOCAS = {'es_tetris_ana': ('es_tetris', 'es_tetris_bk', (0.2, 0.8, 0.15, 0.4)),
         'es_reloj_ana': ('es_reloj', 'es_reloj_bk', (0.2, 0.8, 0.15, 0.45)),
         'es_llega_ana': ('es_llega', 'es_llega_bk', (0.55, 1, 0.3, 0.55)),
         'es_espera_ana': ('es_espera', 'es_espera_bk', (0.2, 0.8, 0.15, 0.45)),
         'es_portatil_ana': ('es_portatil', 'es_portatil_bk', (0.2, 0.8, 0.15, 0.45)),
         'es_tupper_ana': ('es_tupper', 'es_tupper_bk', (0.2, 0.8, 0.15, 0.45)),
         'es_final_ana': ('es_final', 'es_final_bk', (0.2, 0.8, 0.15, 0.45)),
         'br_p9_p9': ('br_p9', 'br_p9_perfil_bk', (0.62, 0.85, 0.38, 0.46)),
         'br_coche_p12': ('br_coche', 'br_coche_bk', (0.2, 0.8, 0.15, 0.5)),
         'br_huecos_h': ('br_huecos', 'br_huecos_bk', (0.2, 0.8, 0.5, 0.75))}
CERRADAS = {}
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

# boca de la de las nueve (de perfil): la boca toca el contorno de la cara, así que se toma de la edición toda la parte
# baja de la cara (óvalo fijo) para que contorno y boca casen
A = Image.open('img/br_p9.jpg').convert('RGB')
b = np.asarray(carga('br_p9_perfil_bk', A.size)).astype(int)
H, W = b.shape[:2]
yy, xx = np.ogrid[:H, :W]
m = ((xx - 985) / 175) ** 2 + ((yy - 1150) / 95) ** 2 <= 1
capa(b, np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(4))), 'br_p9_p9')
