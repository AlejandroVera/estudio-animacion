# Despieza el personaje rosa en piezas PNG + manifiesto de articulaciones.
import json, sys, os
import numpy as np, cv2
from PIL import Image, ImageDraw

src_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
rgba = np.array(Image.open(os.path.join(src_dir, 'cut_isnet-anime.png')).convert('RGBA'))
H, W = rgba.shape[:2]
alpha = rgba[..., 3].astype(np.float32) / 255
alpha = np.clip((alpha - 0.35) / 0.3, 0, 1)  # bordes nítidos, sin halos
rgb = rgba[..., :3].copy()
# El contorno del dibujo es una línea negra: los píxeles del borde del recorte se tiñen de ese negro
# para que no quede un filo rojizo de la pared.
outside = (alpha < 0.5).astype(np.uint8)
rim = (cv2.dilate(outside, np.ones((5, 5), np.uint8)) > 0) & (alpha > 0)
rgb[rim] = (28, 24, 26)
# Restos del rojo de la pared atrapados entre líneas (ningún color del personaje es así de rojo)
c = rgb.astype(int)
wall = (c[..., 0] > 150) & (c[..., 1] < 110) & (c[..., 2] < 110) & (alpha > 0)
rgb[wall] = (28, 24, 26)
print('píxeles de pared corregidos:', int(wall.sum()))

def poly(points):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return np.array(m) > 0

def circle(c, r):
    yy, xx = np.mgrid[0:H, 0:W]
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r

YY = np.mgrid[0:H, 0:W][0]
yy, xx = np.mgrid[0:H, 0:W]

# ---- cabeza: círculo ajustado a la silueta
rows = [(y, np.where(alpha[y] > 0.5)[0]) for y in range(100, 430)]
pts = []
for y, xs in rows:
    if len(xs):
        pts += [(xs[0], y), (xs[-1], y)]
pts = np.array(pts, np.float32)
(cx, cy), r = cv2.minEnclosingCircle(pts)
print('cabeza', cx, cy, r)
head_c = (cx, cy)

pieces = {}

def joint_rgb(center, rr):
    out = rgb.copy()
    dist = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2)
    ring = (dist >= rr - 6) & (dist <= rr) & (yy < center[1]) & (alpha > 0)
    out[ring] = (28, 24, 26)
    return out

def save(pid, mask, pivot, rgb_img=None, alpha_img=None):
    a = (alpha_img if alpha_img is not None else alpha) * mask
    ys, xs = np.where(a > 0.01)
    x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
    img = np.dstack([(rgb_img if rgb_img is not None else rgb), (a * 255).astype(np.uint8)])[y0:y1, x0:x1]
    Image.fromarray(img, 'RGBA').save(os.path.join(out_dir, pid + '.png'), optimize=True)
    pieces[pid] = {'box': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)], 'pivot': [float(pivot[0]), float(pivot[1])]}

# ---- cabeza con la cara limpia (sin ojos ni boca: se dibujan aparte)
head_mask = circle(head_c, r + 2)
face_rgb = rgb.copy()
holes = np.zeros((H, W), np.uint8)
holes[circle((595, 298), 44)] = 255
holes[circle((752, 296), 44)] = 255
holes[((xx - 673) / 66) ** 2 + ((yy - 401) / 23) ** 2 <= 1] = 255
# Antes de rellenar, quitamos las líneas negras cercanas para que no se "corran" dentro del hueco.
skin = np.median(rgb[circle(head_c, r - 20) & (rgb.sum(-1) > 400)], axis=0)
dark = (rgb.astype(int).sum(-1) < 330)
near = cv2.dilate(holes, np.ones((25, 25), np.uint8)) > 0
src = face_rgb.copy()
src[dark & near] = skin
face_rgb = cv2.inpaint(np.ascontiguousarray(src), holes, 9, cv2.INPAINT_TELEA)
face_rgb[(dark & near) & (holes == 0)] = rgb[(dark & near) & (holes == 0)]  # las líneas fuera del hueco se quedan
save('cabeza', head_mask, (672, 448), rgb_img=face_rgb)

# ---- torso (camiseta + cuello). Las mangas van con los brazos.
L_CUT = [(465, 590), (502, 792)]
R_CUT = [(880, 590), (839, 792)]
torso_poly = poly([(598, 428), (747, 428), (747, 470), R_CUT[0], R_CUT[1], (843, 1136), (500, 1136), L_CUT[1], L_CUT[0], (598, 470)])
t_rgb = rgb.copy()
t_alpha = alpha.copy()
NECK_ROW = 480
for y in range(428, NECK_ROW):
    t_rgb[y, 595:750] = rgb[NECK_ROW, 595:750]
    t_alpha[y, 595:750] = alpha[NECK_ROW, 595:750]
# contorno donde se cortó la manga, para que se vea limpio al levantar el brazo
ol = Image.fromarray(t_rgb)
d = ImageDraw.Draw(ol)
d.line(L_CUT, fill=(25, 22, 24), width=6)
d.line(R_CUT, fill=(25, 22, 24), width=6)
t_rgb = np.array(ol)
save('torso', torso_poly, (672, 1150), rgb_img=t_rgb, alpha_img=t_alpha)

# ---- cadera (raíz)
save('cadera', poly([(503, 1112), (841, 1112), (845, 1272), (500, 1272)]), (672, 1190))

# ---- brazos: brazo (manga + hasta el codo) y antebrazo (con la mano)
def arm(side, upper_poly, fore_poly, shoulder, elbow, rr=37):
    upper = upper_poly & ((YY <= elbow[1]) | circle(elbow, rr - 10))
    fore = fore_poly & ((YY >= elbow[1]) | circle(elbow, rr))
    save('brazo_' + side, upper, shoulder)
    save('antebrazo_' + side, fore, elbow, rgb_img=joint_rgb(elbow, rr))

arm('izq',
    poly([(370, 540), L_CUT[0], L_CUT[1], (501, 850), (499, 960), (370, 960)]),
    poly([(370, 860), (499, 860), (499, 1100), (503, 1330), (370, 1330)]),
    (480, 655), (457, 905))
arm('der',
    poly([(975, 540), R_CUT[0], R_CUT[1], (841, 850), (843, 960), (975, 960)]),
    poly([(843, 860), (975, 860), (975, 1330), (840, 1330), (843, 1100)]),
    (864, 655), (887, 905))

# ---- piernas: muslo y pierna (con la zapatilla)
def leg(side, x0, x1, hip, knee, rr=56):
    thigh = poly([(x0, 1180), (x1, 1180), (x1, 1530), (x0, 1530)]) & ~poly([(0, 0), (503, 0), (503, 1330), (0, 1330)]) & ~poly([(842, 0), (W, 0), (W, 1330), (842, 1330)]) & ((YY <= knee[1]) | circle(knee, rr - 12))
    shin = poly([(x0 - 30, 1450), (x1 + 30, 1450), (x1 + 30, 1950), (x0 - 30, 1950)]) & ((YY >= knee[1]) | circle(knee, rr))
    if side == 'izq':
        shin &= ~poly([(661, 1440), (900, 1440), (900, 1960), (661, 1960)])
    else:
        shin &= ~poly([(400, 1440), (660, 1440), (660, 1960), (400, 1960)])
    save('muslo_' + side, thigh, hip)
    save('pierna_' + side, shin, knee, rgb_img=joint_rgb(knee, rr))

leg('izq', 495, 660, (585, 1232), (588, 1490))
leg('der', 661, 852, (762, 1232), (762, 1490))

json.dump({'size': [W, H], 'head': [cx, cy, r], 'pieces': pieces}, open(os.path.join(out_dir, 'manifest.json'), 'w'), indent=1)
print(json.dumps(pieces))
