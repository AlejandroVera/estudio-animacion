"""Dibujo alterno ESTABLE para animar a los secundarios (animación limitada a golpes, sin vídeo generativo).

  python3 herramientas/video/variante.py base.png edicion.png salida.png [--zona x0,y0,x1,y1] [--min 3000]

`edicion.png` es la misma escena editada en Magnific («keep everything exactly the same, pixel for pixel…
change ONLY …»). Como la IA siempre cambia algo más, aquí se copia de la edición SOLO lo que cambia de verdad
(manchas grandes de diferencia) y el resto queda idéntico al píxel a la base: al alternar no tiembla nada.
--zona (fracciones del ancho/alto) limita el cambio a una parte (p. ej. solo los ojos para un parpadeo, que
si no cambiaba también un cuadro de la pared). --min: tamaño mínimo de mancha (bájalo para cambios pequeños).
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi


def opcion(nombre, defecto=None):
    if nombre in sys.argv:
        i = sys.argv.index(nombre)
        v = sys.argv[i + 1]
        del sys.argv[i:i + 2]
        return v
    return defecto


zona = opcion('--zona')
minimo = int(opcion('--min', '3000'))
base, edic, sal = sys.argv[1:4]
a = np.asarray(Image.open(base).convert('RGB')).astype(int)
b = np.asarray(Image.open(edic).convert('RGB').resize(a.shape[1::-1])).astype(int)
d = np.abs(a - b).max(2) > 45
h, w = d.shape
z = np.ones_like(d)
if zona:
    x0, y0, x1, y1 = (float(v) for v in zona.split(','))
    z = np.zeros_like(d)
    z[int(h * y0):int(h * y1), int(w * x0):int(w * x1)] = True
    d &= z
d = ndi.binary_opening(d, iterations=1 if zona else 2)
lab, n = ndi.label(ndi.binary_dilation(d, iterations=8 if not zona else 6))
if n:
    tam = ndi.sum(np.ones_like(d), lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t >= (minimo if not zona else 50)])
else:
    m = d
m = ndi.binary_fill_holes(m) & z
al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[..., None] / 255
Image.fromarray((a * (1 - al) + b * al).astype('uint8')).save(sal)
print(sal, 'cambia el', round(m.mean() * 100, 1), '% de la imagen')
