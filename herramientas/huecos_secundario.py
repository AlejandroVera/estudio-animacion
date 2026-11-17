"""Borra el blanco encerrado (huecos entre brazo y cuerpo, detrás del pelo…) de las posturas ya sin fondo de un
secundario, respetando el blanco de los ojos y de las zapatillas.

  python3 herramientas/huecos_secundario.py <carpeta_webp> <manifest.json>
La zona de ojos es la caja de la cara (color de piel) en reposo.webp: se ejecuta sobre las webp recién preparadas.
"""
import glob, json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

carp, man = sys.argv[1], sys.argv[2]
# caja de la cara (mancha de piel más grande arriba en la postura de reposo): ahí dentro está el blanco de los ojos
_r = np.array(Image.open(f'{carp}/reposo.webp').convert('RGBA')).astype(int)
_piel = (_r[..., 0] > 200) & (_r[..., 1] > 140) & (_r[..., 1] < 215) & (_r[..., 2] > 100) & (_r[..., 2] < 190) & (_r[..., 0] - _r[..., 2] > 40)
_piel[int(_r.shape[0] * 0.3):] = False
_lab, _n = ndi.label(_piel)
_k = np.argmax(ndi.sum(_piel, _lab, range(1, _n + 1))) + 1
_ys, _xs = np.where(_lab == _k)
_m = 0.06 * (_xs.max() - _xs.min())
ojos = (_xs.min() - _m, _ys.min() - _m, _xs.max() + _m, _ys.max() + _m)
for f in sorted(glob.glob(f'{carp}/*.webp')):
    a = np.array(Image.open(f).convert('RGBA'))
    H = a.shape[0]
    blanco = (a[..., :3].min(2) > 230) & (a[..., 3] > 0)
    lab, n = ndi.label(blanco)
    quitados = 0
    for k, sl in enumerate(ndi.find_objects(lab), 1):
        m = lab[sl] == k
        area = m.sum()
        if area < 250:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        ycen, xcen = (y0 + y1) / 2, (x0 + x1) / 2
        if x0 < ojos[2] and x1 > ojos[0] and y0 < ojos[3] and y1 > ojos[1] and area < 20000:
            continue  # toca la cara: blanco de los ojos (con párpados entornados la mancha no queda centrada)
        if ycen > H * 0.88:
            continue  # zapatillas
        sub = a[sl]
        sub[m, 3] = 0
        quitados += 1
    Image.fromarray(a).save(f, quality=90)
    print(f.split('/')[-1], 'huecos borrados:', quitados)
