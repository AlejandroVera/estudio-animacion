# Prepara un personaje EXPRESIVO (estilo «Estoy Tiesa»): cada postura es un dibujo completo con su
# cara y su emoción, hecho con IA editando el mismo dibujo base (así encajan: cabeza y pies en el
# mismo sitio). Para hablar, cada postura tiene una segunda versión con la boca en la otra posición
# (abierta si está cerrada o al revés), también hecha con IA; de esa versión solo se toma la boca.
# Parpadeo (opcional): una imagen con los ojos cerrados de una postura base; sus ojos se copian sobre
# todas las posturas de la misma familia (mismo prefijo, misma cabeza) como «<pose>~c».
# Uso: python preparar_expresivo.py <recortes *.png> <originales *.png> <bocas *.png> <medidas.json> <salida>
#        [<parpadeo.png> <postura base> <prefijo de la familia>]
import json, os, sys
import numpy as np, cv2
from PIL import Image

cut, orig, bocas, medidas, dst = sys.argv[1:6]
os.makedirs(dst, exist_ok=True)
M = json.load(open(medidas))
INK = (28, 24, 26)

def limpia(a):
    alpha = np.clip((a[..., 3].astype(np.float32) / 255 - 0.35) / 0.3, 0, 1)
    n, lab, st, _ = cv2.connectedComponentsWithStats((alpha > 0.05).astype(np.uint8), 8)
    alpha[~np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 3000])] = 0
    rgb = a[..., :3].copy()
    borde = (cv2.dilate((alpha < 0.5).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & (alpha > 0)
    rgb[borde] = INK
    return rgb, alpha

poses = {}
union = None
for f in sorted(os.listdir(cut)):
    if not f.endswith('.png'):
        continue
    n = f[:-4]
    rgb, alpha = limpia(np.array(Image.open(os.path.join(cut, f)).convert('RGBA')))
    poses[n] = [rgb, alpha, None]
    m = alpha > 0.02
    union = m if union is None else union | m
    b = os.path.join(bocas, f)
    if os.path.exists(b):
        base = np.array(Image.open(os.path.join(orig, f)).convert('RGB')).astype(int)
        alt = np.array(Image.open(b).convert('RGB').resize(base.shape[1::-1])).astype(int)
        H, W = alpha.shape
        yy, xx = np.mgrid[0:H, 0:W]
        cx, cy, r = M[n]['cx'], M[n]['cy'], M[n]['r']
        # solo la boca: diferencias en la mitad baja de la cara
        cara = ((xx - cx) ** 2 + (yy - cy) ** 2 < (0.93 * r) ** 2) & (yy > cy + 0.12 * r)
        dif = (np.abs(alt - base).sum(-1) > 60) & cara
        dif = cv2.morphologyEx(dif.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        dif = cv2.dilate(dif, np.ones((15, 15), np.uint8)).astype(np.float32) * cara
        dif = cv2.GaussianBlur(dif, (11, 11), 0)
        rgb2 = (rgb * (1 - dif[..., None]) + alt * dif[..., None]).astype(np.uint8)
        poses[n][2] = rgb2

# Parpadeo: ojos cerrados copiados de la imagen de parpadeo (solo donde cambian los ojos)
parp = {}
if len(sys.argv) > 8:
    pimg, pbase, pref = sys.argv[6], sys.argv[7], sys.argv[8]
    base = np.array(Image.open(os.path.join(orig, pbase + '.png')).convert('RGB')).astype(int)
    cerr = np.array(Image.open(pimg).convert('RGB').resize(base.shape[1::-1])).astype(int)
    m0 = M[pbase]
    H, W = base.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    ojos = ((xx - m0['cx']) ** 2 + (yy - m0['cy']) ** 2 < (0.9 * m0['r']) ** 2) & (yy > m0['cy'] - 0.25 * m0['r']) & (yy < m0['cy'] + 0.15 * m0['r'])
    dif = (np.abs(cerr - base).sum(-1) > 60) & ojos
    dif = cv2.dilate(cv2.morphologyEx(dif.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)), np.ones((13, 13), np.uint8)).astype(np.float32) * ojos
    dif = cv2.GaussianBlur(dif, (9, 9), 0)
    for n, (rgb, alpha, _) in poses.items():
        if n.startswith(pref):
            parp[n] = (rgb * (1 - dif[..., None]) + cerr * dif[..., None]).astype(np.uint8)

ys, xs = np.where(union)
x0, y0, x1, y1 = max(0, xs.min() - 6), max(0, ys.min() - 6), min(union.shape[1], xs.max() + 7), min(union.shape[0], ys.max() + 7)
bocas_ok = []
for n, (rgb, alpha, rgb2) in poses.items():
    for nombre, im in [(n, rgb), (n + '~b', rgb2), (n + '~c', parp.get(n))]:
        if im is None:
            continue
        img = np.dstack([im, (alpha * 255).astype(np.uint8)])[y0:y1, x0:x1]
        Image.fromarray(img, 'RGBA').save(os.path.join(dst, nombre + '.webp'), quality=88, method=6)
    if rgb2 is not None:
        bocas_ok.append(n)
ref = M['reposo']
json.dump({
    'lienzo': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
    'pies': [(ref['feet_x'][0] + ref['feet_x'][1]) / 2, ref['bottom']],
    'cabeza': [ref['cx'], ref['cy'], ref['r']],
    'poses': sorted(poses),
    'bocas': sorted(bocas_ok),
    'parpadeo': sorted(parp),
}, open(os.path.join(dst, 'manifest.json'), 'w'), indent=1)
print('lienzo', x0, y0, x1 - x0, y1 - y0, 'bocas', len(bocas_ok))
