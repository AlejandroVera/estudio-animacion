# Prepara un personaje «por poses»: cada pose es un dibujo completo del personaje (misma cabeza y
# piernas, solo cambian los brazos), generado con IA a partir de un dibujo base. Este script:
#  - quita motas y limpia el borde del recorte (contorno negro),
#  - borra la cabeza de cada pose (la pone una cabeza común animable),
#  - crea la cabeza común a partir de la pose de reposo, con ojos, cejas y boca borrados,
#  - recorta todas las poses al mismo lienzo y las guarda en WebP,
#  - escribe manifest.json con el lienzo, la cabeza y la lista de poses.
# Uso: python preparar_poses.py <carpeta con poses recortadas *.png> <carpeta salida> <medidas.json>
import json, os, sys
import numpy as np, cv2
from PIL import Image

src, dst, medidas = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(dst, exist_ok=True)
M = json.load(open(medidas))
INK = (28, 24, 26)
ref = M['reposo']
CX, CY, R = ref['cx'], ref['cy'], ref['r']

# Zonas de la cara que se redibujan (coordenadas de la imagen de 1536×2752)
BORRAR = [
    ('circulo', (666, 482), 34), ('circulo', (872, 477), 34),        # ojos
    ('elipse', (668, 441), (47, 16)), ('elipse', (873, 437), (38, 13)),  # cejas
    ('elipse', (775, 624), (79, 37)),                                # boca, labio y barbilla
]

def limpia(a):
    alpha = np.clip((a[..., 3].astype(np.float32) / 255 - 0.35) / 0.3, 0, 1)
    n, lab, st, _ = cv2.connectedComponentsWithStats((alpha > 0.05).astype(np.uint8), 8)
    grandes = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 3000]
    alpha[~np.isin(lab, grandes)] = 0
    rgb = a[..., :3].copy()
    fuera = (alpha < 0.5).astype(np.uint8)
    borde = (cv2.dilate(fuera, np.ones((5, 5), np.uint8)) > 0) & (alpha > 0)
    rgb[borde] = INK
    return rgb, alpha

H = W = None
yy = xx = None
poses = {}
union = None
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'):
        continue
    a = np.array(Image.open(os.path.join(src, f)).convert('RGBA'))
    rgb, alpha = limpia(a)
    if H is None:
        H, W = alpha.shape
        yy, xx = np.mgrid[0:H, 0:W]
    poses[f[:-4]] = (rgb, alpha)
    m = alpha > 0.02
    union = m if union is None else (union | m)

# Lienzo común: la unión de todas las poses con margen
ys, xs = np.where(union)
x0, y0, x1, y1 = max(0, xs.min() - 6), max(0, ys.min() - 6), min(W, xs.max() + 7), min(H, ys.max() + 7)
# Se borra la cabeza con margen (también su contorno), salvo abajo, donde empieza el cuello
cabeza = ((xx - CX) ** 2 + (yy - CY) ** 2 <= (R + 8) ** 2) & (yy < CY + 0.6 * R) | ((xx - CX) ** 2 + (yy - CY) ** 2 <= (R + 2) ** 2)

for nombre, (rgb, alpha) in poses.items():
    al = alpha.copy()
    al[cabeza] = 0  # la cabeza la dibuja la cabeza común
    img = np.dstack([rgb, (al * 255).astype(np.uint8)])[y0:y1, x0:x1]
    Image.fromarray(img, 'RGBA').save(os.path.join(dst, f'{nombre}.webp'), quality=90, method=6)

# Cabeza común (de la pose de reposo) con la cara limpia
rgb, alpha = poses['reposo']
huecos = np.zeros((H, W), np.uint8)
for tipo, c, s in BORRAR:
    if tipo == 'circulo':
        huecos[(xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= s * s] = 255
    else:
        huecos[((xx - c[0]) / s[0]) ** 2 + ((yy - c[1]) / s[1]) ** 2 <= 1] = 255
piel = np.median(rgb[((xx - CX) ** 2 + (yy - CY) ** 2 <= (R - 30) ** 2) & (rgb.astype(int).sum(-1) > 450)], axis=0)
oscuro = rgb.astype(int).sum(-1) < 330
cerca = cv2.dilate(huecos, np.ones((21, 21), np.uint8)) > 0
src_img = rgb.copy()
src_img[oscuro & cerca] = piel
cara = cv2.inpaint(np.ascontiguousarray(src_img), huecos, 9, cv2.INPAINT_TELEA)
fuera_huecos = oscuro & cerca & (huecos == 0)
cara[fuera_huecos] = rgb[fuera_huecos]
mask_c = (xx - CX) ** 2 + (yy - CY) ** 2 <= (R + 4) ** 2
hx0, hy0 = int(CX - R - 6), int(CY - R - 6)
hx1, hy1 = int(CX + R + 7), int(CY + R + 7)
al = alpha * mask_c
img = np.dstack([cara, (al * 255).astype(np.uint8)])[hy0:hy1, hx0:hx1]
Image.fromarray(img, 'RGBA').save(os.path.join(dst, 'cabeza.webp'), quality=92, method=6)

json.dump(
    {
        'lienzo': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
        'cabeza': {'caja': [hx0, hy0, hx1 - hx0, hy1 - hy0], 'centro': [CX, CY], 'r': R, 'cuello': [CX, 652]},
        'pies': [(ref['feet_x'][0] + ref['feet_x'][1]) / 2, ref['bottom']],
        'poses': sorted(poses),
    },
    open(os.path.join(dst, 'manifest.json'), 'w'),
    indent=1,
)
print('lienzo', x0, y0, x1 - x0, y1 - y0)
