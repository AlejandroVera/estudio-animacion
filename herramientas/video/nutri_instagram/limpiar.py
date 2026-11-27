"""Arregla los textos que la IA escribe mal (en inglés o inventados) en los dibujos ya preparados (img/). Se ejecuta
después de preparar.py.  python3 limpiar.py"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
F = '../../shorts/ComingSoon.ttf'


def papel(a, x0, y0, x1, y1):
    """color de papel: la mediana de los píxeles claros de la caja"""
    z = a[y0:y1, x0:x1].reshape(-1, 3); z = z[z.mean(1) > 180]
    return tuple(int(v) for v in np.median(z, 0))


def escribe(d, txt, cx, cy, tam, col=(40, 40, 40)):
    f = ImageFont.truetype(F, tam)
    bb = d.multiline_textbbox((0, 0), txt, font=f, align='center', spacing=4)
    x, y = cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]
    for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1), (2, 1)]:
        d.multiline_text((x + dx, y + dy), txt, font=f, fill=col, align='center', spacing=4)


def titulo_pregunta(n):
    im = Image.open(f'img/{n}.jpg').convert('RGB'); a = np.asarray(im).copy()
    c = papel(a, 1150, 300, 1400, 460)
    a[315:450, 1150:1400] = c
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    escribe(d, 'Grado en\nNutrición', 1272, 382, 46)
    im.save(f'img/{n}.jpg', quality=92)


def titulo_campeon(n):
    im = Image.open(f'img/{n}.jpg').convert('RGB'); a = np.asarray(im).copy()
    c = np.array(papel(a, 1050, 330, 1350, 560))
    a[340:562, 1010:1395] = c
    a[306:342, 1000:1350] = c                                  # restos del título viejo
    # franja izquierda, donde asoma el pelo: solo los píxeles grises del texto borroso (no el pelo negro/marrón)
    z = a[340:562, 950:1010].astype(int)
    gris = (z.max(2) - z.min(2) < 40) & (z.mean(2) > 70)
    z[gris] = c; a[340:562, 950:1010] = z
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    escribe(d, 'Grado en Nutrición', 1185, 395, 44, (60, 45, 30))
    for y, x0, x1 in [(470, 1060, 1320), (505, 1090, 1290), (540, 1110, 1270)]:
        d.line([(x0, y), (x1, y)], fill=(150, 140, 125), width=7)
    im.save(f'img/{n}.jpg', quality=92)


def diplomal(n):
    im = Image.open(f'img/{n}.jpg').convert('RGB'); a = np.asarray(im).copy()
    a[108:165, 800:824] = papel(a, 600, 100, 880, 180)          # «DIPLOMAL» -> «DIPLOMA»
    Image.fromarray(a).save(f'img/{n}.jpg', quality=92)


def bocadillo(n):
    im = Image.open(f'img/{n}.jpg').convert('RGB'); a = np.asarray(im).copy()
    x0, y0, x1, y1 = 980, 1440, 1360, 1570
    z = a[y0:y1, x0:x1].astype(int)
    blanco = z.min(2) > 200
    lab, k = ndi.label(blanco)
    if k == 0 or blanco.sum() < 3000:
        print('  sin bocadillo en', n); return
    s = ndi.sum(blanco, lab, range(1, k + 1)); i = int(np.argmax(s)) + 1
    m = ndi.binary_fill_holes(ndi.binary_closing(lab == i, iterations=6))
    m = ndi.binary_erosion(m, iterations=4)
    z[m] = 255; a[y0:y1, x0:x1] = z
    ys, xs = np.nonzero(m)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    escribe(d, '¿Y tu formación?', x0 + (xs.min() + xs.max()) / 2, y0 + (ys.min() + ys.max()) / 2, 27, (20, 20, 20))
    im.save(f'img/{n}.jpg', quality=92)


for n in ('es_pregunta', 'es_pregunta_b', 'es_pregunta_c'):
    titulo_pregunta(n)
titulo_campeon('es_campeon')
for n in ('es_final', 'es_final_b', 'es_final_c'):
    diplomal(n)
for n in ('br_formacion', 'br_formacion_b', 'br_formacion_c'):
    bocadillo(n)
print('textos arreglados')
