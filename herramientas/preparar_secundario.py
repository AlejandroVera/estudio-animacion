"""Prepara un personaje SECUNDARIO (p. ej. la hermana) a partir de sus dibujos de fal (misma base editada):
quita el fondo blanco, borra restos sueltos (rayas de suelo), alinea cada postura por la cabeza con la base,
recorta todas a un lienzo común y escribe el manifest (lienzo, pies, cabeza) que usa personajeExpresivo.

Uso: python3 preparar_secundario.py <carpeta_jpgs> <carpeta_salida> <manifest.json> base=reposo nombre=archivo ...
  (cada «nombre=archivo» es una postura; «base» es la de reposo, con la que se alinean las demás)
"""
import json, sys
from collections import deque
import numpy as np
from PIL import Image

src, out, man = sys.argv[1], sys.argv[2], sys.argv[3]
pares = dict(a.split('=', 1) for a in sys.argv[4:])

def sin_fondo(img):
    a = np.array(img.convert('RGBA')).astype(np.int32)
    H, W = a.shape[:2]
    blanco = (a[:, :, :3].min(2) > 228)
    fondo = np.zeros((H, W), bool)
    q = deque([(y, x) for y in range(H) for x in (0, W - 1)] + [(y, x) for x in range(W) for y in (0, H - 1)])
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= H or x >= W or fondo[y, x] or not blanco[y, x]:
            continue
        fondo[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    a[fondo, 3] = 0
    # borde suave: píxeles casi blancos pegados al fondo
    cerca = np.zeros_like(fondo)
    cerca[1:] |= fondo[:-1]; cerca[:-1] |= fondo[1:]; cerca[:, 1:] |= fondo[:, :-1]; cerca[:, :-1] |= fondo[:, 1:]
    claro = cerca & ~fondo & (a[:, :, :3].min(2) > 200)
    a[claro, 3] = 90
    # solo la figura: la mancha opaca más grande (fuera rayas de suelo y motas)
    op = a[:, :, 3] > 40
    lab = np.zeros((H, W), np.int32); n = 0; tam = {}
    for y0 in range(0, H):
        for x0 in np.where(op[y0] & (lab[y0] == 0))[0]:
            if lab[y0, x0]:
                continue
            n += 1; cnt = 0; dq = deque([(y0, x0)]); lab[y0, x0] = n
            while dq:
                y, x = dq.popleft(); cnt += 1
                for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= yy < H and 0 <= xx < W and op[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; dq.append((yy, xx))
            tam[n] = cnt
    grande = max(tam, key=tam.get)
    fuera = op & (lab != grande) & np.isin(lab, [k for k, v in tam.items() if v < 3000])
    a[fuera, 3] = 0
    return a.astype(np.uint8)

imgs = {k: sin_fondo(Image.open(f'{src}/{v}')) for k, v in pares.items()}
base = imgs['reposo']
H, W = base.shape[:2]
alpha = base[:, :, 3] > 40
ys, xs = np.where(alpha)
top = ys.min()
# Cabeza: franja de arriba (hasta ~ 1/4 de la altura de la figura)
alto = ys.max() - top
hy0, hy1 = top, top + int(alto * 0.24)
cols = np.where(alpha[hy0:hy1].any(0))[0]
hx0, hx1 = cols.min(), cols.max()
gris = lambda a: (a[:, :, :3].mean(2) * (a[:, :, 3] / 255.0))
ref = gris(base)[hy0:hy1, hx0:hx1]

def alinear(a):
    g = gris(a); mejor = (1e18, 0, 0)
    for dy in range(-40, 41, 2):
        for dx in range(-60, 61, 2):
            y0, x0 = hy0 + dy, hx0 + dx
            if y0 < 0 or x0 < 0 or y0 + ref.shape[0] > H or x0 + ref.shape[1] > W:
                continue
            d = np.abs(g[y0:y0 + ref.shape[0], x0:x0 + ref.shape[1]] - ref).mean()
            if d < mejor[0]:
                mejor = (d, dx, dy)
    _, dx, dy = mejor
    out = np.zeros_like(a)
    sy0, sy1 = max(0, dy), min(H, H + dy); sx0, sx1 = max(0, dx), min(W, W + dx)
    out[sy0 - dy:sy1 - dy, sx0 - dx:sx1 - dx] = a[sy0:sy1, sx0:sx1]
    return out, dx, dy

alin = {}
for k, a in imgs.items():
    if k == 'reposo':
        alin[k] = a; continue
    alin[k], dx, dy = alinear(a)
    print(k, 'desplazada', dx, dy)
# Lienzo común: lo que ocupa cualquiera de las posturas, con margen
union = np.zeros((H, W), bool)
for a in alin.values():
    union |= a[:, :, 3] > 40
uy, ux = np.where(union)
m = 12
lx, ly = max(0, ux.min() - m), max(0, uy.min() - m)
lw, lh = min(W, ux.max() + m) - lx, min(H, uy.max() + m) - ly
for k, a in alin.items():
    Image.fromarray(a[ly:ly + lh, lx:lx + lw]).save(f'{out}/{k}.webp', quality=90)
# Pies de la base: centro de la fila opaca más baja
fy = ys.max()
fx = np.where(alpha[fy - 30:fy + 1].any(0))[0]
pies = [float((fx.min() + fx.max()) / 2), float(fy)]
cab = [float((hx0 + hx1) / 2), float((hy0 + hy1) / 2), float((hx1 - hx0) / 2)]
json.dump({'lienzo': [int(lx), int(ly), int(lw), int(lh)], 'pies': pies, 'cabeza': cab, 'poses': list(alin.keys()), 'bocas': [], 'original': [W, H]},
          open(man, 'w'), indent=2)
print('lienzo', lx, ly, lw, lh, 'pies', pies, 'cabeza', cab)
