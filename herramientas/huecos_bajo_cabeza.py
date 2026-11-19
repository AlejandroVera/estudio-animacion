"""Borra el blanco encerrado (huecos entre brazos y cuerpo) SOLO por debajo de la cabeza, para personajes con ojos
grandes que huecos_secundario.py confunde con huecos (el cabezón de Alejandro). Respeta las zapatillas (10 % de abajo).

  python3 herramientas/huecos_bajo_cabeza.py <carpeta_webp> <manifest.json>
"""
import json, glob, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
carp, man = sys.argv[1], sys.argv[2]
cx, cy, r = json.load(open(man))['cabeza']
for f in sorted(glob.glob(f'{carp}/*.webp')):
    a = np.array(Image.open(f).convert('RGBA'))
    bl = (a[..., 3] > 40) & (a[..., :3].min(2) > 232)
    lab, n = ndi.label(bl); k = 0
    for i, s in enumerate(ndi.find_objects(lab)):
        comp = lab[s] == i + 1
        yc = np.nonzero(comp)[0].mean() + s[0].start
        if comp.sum() > 300 and cy + r * 0.95 < yc < a.shape[0] * 0.9:
            a[s][comp, 3] = 0; k += 1
    Image.fromarray(a).save(f, quality=92)
    print(f.split('/')[-1], 'huecos', k)
