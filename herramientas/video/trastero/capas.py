"""Capas de ANIMACIÓN LIMITADA del plano fijo de la cita (es_charla, de crudo/mf_2.png). Copiado de buhardilla/capas.py,
con el chico rosa a la IZQUIERDA y Ana a la derecha. Cada edición crudo/cv_*.png = el mismo dibujo con un gesto de
UN personaje; de ella se queda solo lo que cambia en el lado de ese personaje (img/cv_*.png, RGBA).
  python3 capas.py"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASE = 'crudo/mf_2.png'
A = Image.open(BASE).convert('RGB')
a = np.asarray(A).astype(int)
H, W = a.shape[:2]
Image.fromarray(a.astype('uint8')).save('img/es_charla.jpg', quality=92)

r, g, b = a[..., 0], a[..., 1], a[..., 2]
mag = (r > 150) & (g < 120) & (b > 110) & (r - g > 80)
lab, n = ndi.label(mag)
k = int(np.argmax(ndi.sum(mag, lab, range(1, n + 1)))) + 1
cab = ndi.binary_fill_holes(lab == k)
dt = ndi.distance_transform_edt(cab)
ry, rx = np.unravel_index(int(np.argmax(dt)), dt.shape)
rr = float(dt[ry, rx])
yy, xx = np.ogrid[:H, :W]


def cambio(nom, umbral=45):
    e = np.asarray(Image.open(f'crudo/{nom}.png').convert('RGB').resize(A.size)).astype(int)
    return e, np.abs(a - e).max(2) > umbral


def guardar(e, m, nom, blur=3):
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(blur)))
    out = np.dstack([e.astype('uint8'), al])
    out[al == 0, :3] = 0
    Image.fromarray(out, 'RGBA').save(f'img/{nom}.png', optimize=True)
    print(nom, '%.1f%%' % (m.mean() * 100))


# cara de Ana: de su edición de boca
e, d = cambio('cv_aboca', 50)
d[:, :int(rx + 1.1 * rr)] = False
d = ndi.binary_opening(d, iterations=2)
ys, xs = np.nonzero(d)
ax, ay = int(np.median(xs)), int(np.median(ys))
print('chico', rx, ry, int(rr), 'boca ana', ax, ay)
cab_ag = ((xx - ax) / (0.075 * W)) ** 2 + ((yy - (ay - 0.03 * H)) / (0.06 * H)) ** 2 <= 1
cab_chico = (xx - rx) ** 2 + (yy - ry) ** 2 <= (rr * 1.02) ** 2
lado_chico = xx < int(0.53 * W)
lado_ag = xx > (rx + 0.9 * rr)


def capa(nom):
    quien = 'ROSA' if nom.startswith('cv_r_') else 'AGENTE'
    e, d = cambio(nom)
    lado = lado_chico if quien == 'ROSA' else lado_ag
    d &= lado
    cabeza = False   # gafas bajadas / mira el papel: la cara cambia a propósito (a medias quedaba un ojo partido)
    if quien == 'AGENTE' and not cabeza:
        d &= ~cab_ag
    if quien == 'ROSA':
        d &= ~cab_chico   # sus gestos no cambian la cabeza (así no tiembla)
    d = ndi.binary_opening(d, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    m = np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(d, lab, range(1, n + 1))) if t > 1500]) if n else d
    m = ndi.binary_fill_holes(m) & lado
    if quien == 'ROSA' and m.any():
        # el borde de la capa cortaba el dibujo de la camiseta (la montaña con una costura): casco convexo de cada mancha
        from scipy.spatial import ConvexHull
        from PIL import ImageDraw
        lab2, n2 = ndi.label(m)
        hull = Image.new('L', (W, H), 0)
        for i in range(1, n2 + 1):
            ys, xs = np.nonzero(lab2 == i)
            pts = np.c_[xs, ys][::7]
            if len(pts) > 3:
                v = ConvexHull(pts).vertices
                ImageDraw.Draw(hull).polygon([tuple(map(int, pts[j])) for j in v], fill=255)
        m = (np.asarray(hull) > 0) & lado & ~cab_chico
        # solo los brazos (piel magenta, de antes o de después, con su contorno): la IA redibujaba la camiseta sin
        # la montaña y el dibujo palpitaría
        def piel(x):
            return (x[..., 0] > 150) & (x[..., 1] < 120) & (x[..., 2] > 110)
        m &= ndi.binary_dilation(piel(e), iterations=6) | ndi.binary_dilation(piel(a) & ~piel(e), iterations=10)
        m = ndi.binary_fill_holes(m)
    if quien == 'AGENTE' and not cabeza:
        m &= ~cab_ag
    if cabeza:
        m |= cab_ag   # la cara entera del dibujo nuevo (por bloques se mezclaban ojos viejos y nuevos)
    guardar(e, m, nom)


def cara(nom, base_img, zona):
    """boca o parpadeo: la mancha de cambio dentro de la cara, en elipse"""
    B = np.asarray(Image.open(base_img).convert('RGB').resize(A.size)).astype(int)
    e = np.asarray(Image.open(f'crudo/{nom}.png').convert('RGB').resize(A.size)).astype(int)
    d = (np.abs(B - e).max(2) > 50) & zona
    d = ndi.binary_opening(d, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=6))
    if not n:
        print(nom, 'SIN CAMBIO'); return
    tam = ndi.sum(d, lab, range(1, n + 1))
    keep = [i + 1 for i, t in enumerate(tam) if t > 0.25 * tam.max()]
    m = np.zeros(d.shape, bool)
    for kk in keep:
        ys, xs = np.nonzero((lab == kk) & d)
        mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        ex, ey = (xs.max() - xs.min()) / 2 + 10, (ys.max() - ys.min()) / 2 + 10
        m |= ((xx - mx) / ex) ** 2 + ((yy - my) / ey) ** 2 <= 1
    guardar(e, m, nom, blur=2)


for f in sorted(glob.glob('crudo/cv_*.png')):
    nom = os.path.basename(f)[:-4]
    if nom in ('cv_rboca', 'cv_aboca') or nom.endswith('_boca'):
        continue
    if nom == 'cv_a_parp':
        cara(nom, BASE, cab_ag)
    elif nom in ('cv_r_parp', 'cv_r_camara'):   # solo cambia su cara
        cara(nom, BASE, cab_chico)
    else:
        capa(nom)
cara('cv_rboca', BASE, cab_chico)
cara('cv_aboca', BASE, cab_ag)
# boca de Ana en el gesto final (sonriendo con la carpeta cerrada): su cara cambia, lleva boca propia
if os.path.exists('crudo/cv_a_cierra_boca.png'):
    cara('cv_a_cierra_boca', 'crudo/cv_a_cierra.png', cab_ag)
