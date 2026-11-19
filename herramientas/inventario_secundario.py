"""Inventario de un personaje secundario de persona normal (p. ej. la nutri): de cada dibujo de cuerpo entero sobre
fondo blanco (crudo/<nombre>.jpg) quita el fondo y los huecos blancos encerrados (respetando ojos, gafas, zapatillas
y objetos blancos de la lista CON_BLANCO), recorta a lo que ocupa y guarda cuerpos/<nombre>.webp; escribe
inventario.json con, por cuerpo: tamaño, caja de la cara (piel), pies (centro de la fila opaca más baja) y tipo
(p de pie, s sentada sin silla, t tumbada).

  python3 herramientas/inventario_secundario.py public/personajes/nutri/inventario
"""
import glob, json, os, sys
from collections import deque
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

D = sys.argv[1]
CABEZON = '--cabezon' in sys.argv  # ojos enormes (Alejandro): no se borra ningún blanco a la altura de la cabeza
CON_BLANCO = {'p_libreta', 's_consulta', 'p_taza', 'p_ensalada', 's_come', 'p_movil_ensena'}


def cara(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    piel = (r > 200) & (g > 140) & (g < 215) & (b > 100) & (b < 190) & (r - b > 40)
    lab, n = ndi.label(piel)
    if not n:
        return None
    k = np.argmax(ndi.sum(piel, lab, range(1, n + 1))) + 1
    ys, xs = np.where(lab == k)
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


inv = {}
for f in sorted(glob.glob(f'{D}/crudo/*.jpg')):
    n = os.path.basename(f)[:-4]
    a = np.array(Image.open(f).convert('RGBA'))
    H, W = a.shape[:2]
    blanco = a[..., :3].min(2) > 228
    lab, k = ndi.label(blanco)
    borde = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fondo = np.isin(lab, list(borde))
    a[fondo, 3] = 0
    cerca = ndi.binary_dilation(fondo) & ~fondo & (a[..., :3].min(2) > 200)
    a[cerca, 3] = 90
    c = cara(a)
    # huecos: manchas blancas grandes que no tocan el borde, fuera de la cara (ojos/gafas) y de los pies
    if n not in CON_BLANCO and c and not n.startswith('t_'):  # tumbada: la cara de lado, no se tocan sus blancos
        cx0, cy0, cx1, cy1 = c
        m = 0.15 * (cx1 - cx0)
        for i, sl in enumerate(ndi.find_objects(lab), 1):
            if i in borde or sl is None:
                continue
            zona = lab[sl] == i
            area = zona.sum()
            if area < 400:
                continue
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            xc, yc, cw, chh = (x0 + x1) / 2, (y0 + y1) / 2, cx1 - cx0, cy1 - cy0
            # la piel de la cara queda partida por las gafas: su caja suele ser solo la mitad de abajo, y los ojos
            # quedan justo encima; las manchas junto a las orejas (fuera de esa franja horizontal) sí se borran
            if CABEZON and yc < cy1 + 0.7 * chh:
                # a la altura de la cabeza solo se quedan los blancos redondos (los ojos); los huecos entre brazo
                # y cabeza son irregulares
                w_, h_ = x1 - x0, y1 - y0
                if area / (0.785 * w_ * h_) > 0.8 and 0.6 < w_ / h_ < 1.6:
                    continue
                if x0 >= cx0 - 0.03 * cw and x1 <= cx1 + 0.03 * cw and yc > cy0:
                    continue  # dientes, ojos con brillos: dentro del ancho de la cara
            if cx0 + 0.08 * cw < xc < cx1 - 0.08 * cw and cy0 - 0.9 * chh < yc < cy0 + 0.45 * chh and area < 30000:
                continue  # blanco de los ojos (dentro de las gafas); el blanco junto a las orejas sí se borra
            op = a[..., 3] > 40
            ys = np.where(op.any(1))[0]
            if (y0 + y1) / 2 > ys.max() - (ys.max() - ys.min()) * 0.1:
                continue  # zapatillas
            a[sl][zona, 3] = 0
    op = a[..., 3] > 40
    lab2, k2 = ndi.label(op)
    if k2:
        t = ndi.sum(op, lab2, range(1, k2 + 1))
        keep = np.isin(lab2, [i + 1 for i, v in enumerate(t) if v > 2000])
        a[~keep & op, 3] = 0
    ys, xs = np.where(a[..., 3] > 40)
    x0, y0, x1, y1 = max(0, xs.min() - 8), max(0, ys.min() - 8), min(W, xs.max() + 9), min(H, ys.max() + 9)
    a = a[y0:y1, x0:x1]
    Image.fromarray(a).save(f'{D}/cuerpos/{n}.webp', quality=90)
    op = a[..., 3] > 40
    fy = int(np.where(op.any(1))[0].max())
    fx = np.where(op[max(0, fy - 30):fy + 1].any(0))[0]
    c = cara(a)
    inv[n] = {'tam': [int(a.shape[1]), int(a.shape[0])], 'cara': c, 'pies': [float((fx.min() + fx.max()) / 2), fy],
              'tipo': {'p': 'de pie', 's': 'sentada', 't': 'tumbada'}[n[0]]}
    print(n, inv[n]['tam'])
json.dump({'cuerpos': inv}, open(f'{D}/inventario.json', 'w'), indent=1, ensure_ascii=False)
