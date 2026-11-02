# Despieza la versión animable del Chico rosa (pose en A, 1696×2528) en piezas PNG + manifiesto.
# Uso: python despiece_chico_rosa.py <carpeta con original.png y cut_isnet-anime.png> <carpeta salida>
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw

src_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
rgba = np.array(Image.open(os.path.join(src_dir, 'cut_isnet-anime.png')).convert('RGBA'))
H, W = rgba.shape[:2]
alpha = np.clip((rgba[..., 3].astype(np.float32) / 255 - 0.35) / 0.3, 0, 1)
rgb = rgba[..., :3].copy()
INK = (28, 24, 26)

# Borde del recorte = línea negra del dibujo (evita filos claros del fondo blanco)
outside = (alpha < 0.5).astype(np.uint8)
rim = (cv2.dilate(outside, np.ones((5, 5), np.uint8)) > 0) & (alpha > 0)
rgb[rim] = INK

yy, xx = np.mgrid[0:H, 0:W]

def poly(points):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([tuple(map(float, p)) for p in points], fill=255)
    return np.array(m) > 0

def circle(c, r):
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r

def side_of(c, d):
    """Proyección sobre la dirección d desde c (negativo = lado de arriba de la articulación)."""
    n = np.hypot(*d)
    return ((xx - c[0]) * d[0] + (yy - c[1]) * d[1]) / n

pieces = {}

def save(pid, mask, pivot, rgb_img=None, alpha_img=None):
    a = (alpha_img if alpha_img is not None else alpha) * mask
    ys, xs = np.where(a > 0.01)
    x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
    img = np.dstack([(rgb_img if rgb_img is not None else rgb), (a * 255).astype(np.uint8)])[y0:y1, x0:x1]
    Image.fromarray(img, 'RGBA').save(os.path.join(out_dir, pid + '.png'), optimize=True)
    pieces[pid] = {'box': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)], 'pivot': [float(pivot[0]), float(pivot[1])]}

def joint_rgb(center, rr, d):
    """Remate redondo con contorno en la parte de arriba de la pieza inferior (oculto en reposo)."""
    out = rgb.copy()
    dist = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2)
    ring = (dist >= rr - 7) & (dist <= rr) & (side_of(center, d) < 0) & (alpha > 0)
    out[ring] = INK
    return out

# ---- cabeza con la cara limpia (ojos y boca se redibujan en SVG)
rows = [(y, np.where(alpha[y] > 0.5)[0]) for y in range(140, 560)]
pts = np.array([p for y, xs in rows if len(xs) for p in ((xs[0], y), (xs[-1], y))], np.float32)
(cx, cy), r = cv2.minEnclosingCircle(pts)
print('cabeza', cx, cy, r)
holes = np.zeros((H, W), np.uint8)
holes[circle((750, 375), 52)] = 255
holes[circle((948, 372), 52)] = 255
holes[((xx - 853) / 74) ** 2 + ((yy - 511) / 29) ** 2 <= 1] = 255
skin = np.median(rgb[circle((cx, cy), r - 30) & (rgb.astype(int).sum(-1) > 400)], axis=0)
dark = rgb.astype(int).sum(-1) < 330
near = cv2.dilate(holes, np.ones((25, 25), np.uint8)) > 0
src = rgb.copy()
src[dark & near] = skin
face = cv2.inpaint(np.ascontiguousarray(src), holes, 9, cv2.INPAINT_TELEA)
keep = dark & near & (holes == 0)
face[keep] = rgb[keep]
save('cabeza', circle((cx, cy), r + 2), (852, 590), rgb_img=face)

# ---- torso (camiseta + cuello); las mangas van con los brazos
L_CUT = [(598, 748), (632, 1020)]
R_CUT = [(1106, 748), (1068, 1020)]
t_rgb, t_alpha = rgb.copy(), alpha.copy()
NECK_ROW, NECK_TOP = 618, 555
for y in range(NECK_TOP, NECK_ROW):
    t_rgb[y, 760:945] = rgb[NECK_ROW, 760:945]
    t_alpha[y, 760:945] = alpha[NECK_ROW, 760:945]
img = Image.fromarray(t_rgb)
dr = ImageDraw.Draw(img)
dr.line(L_CUT, fill=INK, width=7)
dr.line(R_CUT, fill=INK, width=7)
t_rgb = np.array(img)
torso = poly([(760, NECK_TOP), (945, NECK_TOP), (945, 640), R_CUT[0], R_CUT[1], (1070, 1442), (634, 1442), L_CUT[1], L_CUT[0], (760, 640)])
save('torso', torso, (852, 1420), rgb_img=t_rgb, alpha_img=t_alpha)

# ---- cadera (raíz)
save('cadera', poly([(634, 1398), (1070, 1398), (1076, 1580), (628, 1580)]), (852, 1480))

# ---- brazos: manga + brazo hasta el codo, y antebrazo con la mano
def arm(side, region, shoulder, elbow, wrist, rr=46):
    d = (wrist[0] - elbow[0], wrist[1] - elbow[1])
    s = side_of(elbow, d)
    save('brazo_' + side, region & ((s <= 0) | circle(elbow, rr - 12)), shoulder)
    save('antebrazo_' + side, region & ((s >= 0) | circle(elbow, rr)), elbow, rgb_img=joint_rgb(elbow, rr, d))

arm('izq', poly([(150, 690), (598, 690), L_CUT[0], L_CUT[1], (628, 1720), (150, 1720)]), (612, 870), (478, 1180), (392, 1365))
arm('der', poly([(1550, 690), (1106, 690), R_CUT[0], R_CUT[1], (1074, 1720), (1550, 1720)]), (1092, 870), (1220, 1180), (1310, 1365))

# ---- piernas: muslo y pierna con la zapatilla
def leg(side, region_x, hip, knee, rr=66):
    x0, x1 = region_x
    thigh = poly([(x0, 1440), (x1, 1440), (x1, 1960), (x0, 1960)]) & ((yy <= knee[1]) | circle(knee, rr - 14))
    shin = poly([(x0 - 40, 1800), (x1 + 50, 1800), (x1 + 50, 2470), (x0 - 40, 2470)]) & ((yy >= knee[1]) | circle(knee, rr))
    save('muslo_' + side, thigh, hip)
    save('pierna_' + side, shin, knee, rgb_img=joint_rgb(knee, rr, (0, 1)))

leg('izq', (630, 852), (742, 1500), (722, 1880))
leg('der', (853, 1078), (962, 1500), (982, 1880))

json.dump({'size': [W, H], 'head': [cx, cy, r], 'pieces': pieces}, open(os.path.join(out_dir, 'manifest.json'), 'w'), indent=1)
print(json.dumps(pieces))
