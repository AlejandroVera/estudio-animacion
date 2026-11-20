"""Capas de ANIMACIÓN LIMITADA para el plano fijo de diálogo (es_charla, a partir de crudo/mc_1.png).
Cada edición crudo/cv_*.png es el mismo dibujo con un gesto de UN personaje: de ella se queda solo lo que cambia,
en el lado de ese personaje, como RGBA del tamaño del dibujo (img/cv_*.png), para pegarla encima en el montador
(`vivas`/`gestos`). Las capas de gesto no tocan la cabeza de su personaje (así la boca y el parpadeo encajan),
salvo las que la cambian a propósito (CABEZA). Bocas (cv_rboca, cv_aboca, cv_g_viga_rboca) y parpadeos: solo la
mancha de cambio de la cara.
  python3 capas.py"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASE = 'crudo/mc_1.png'
A = Image.open(BASE).convert('RGB')
a = np.asarray(A).astype(int)
H, W = a.shape[:2]
Image.fromarray(a.astype('uint8')).save('img/es_charla.jpg', quality=92)

# dónde está cada uno: la cabeza magenta del chico y la cara del agente (por su boca)
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


# cara del agente: de su edición de boca
e, d = cambio('cv_aboca', 50)
d[:, int(rx - 1.1 * rr):] = False
d = ndi.binary_opening(d, iterations=2)
ys, xs = np.nonzero(d)
ax, ay = int(np.median(xs)), int(np.median(ys))
print('chico', rx, ry, int(rr), 'boca agente', ax, ay)
cab_agente = (np.abs(xx - ax) < 0.085 * W) & (yy > ay - 0.11 * H) & (yy < ay + 0.035 * H)
cab_chico = (xx - rx) ** 2 + (yy - ry) ** 2 <= (rr * 1.02) ** 2
lado_chico = xx > (rx - 1.9 * rr)           # zona del chico (su mano al señalar el techo llega lejos)
lado_agente = xx < (rx - 0.9 * rr)          # zona del agente (su mano al señalar al chico)
CABEZA = {'cv_g_viga', 'cv_g_metro'}


def capa(nom):
    quien = 'ROSA' if nom.startswith('cv_r_') or nom in ('cv_g_viga', 'cv_g_metro') else 'AGENTE'
    e, d = cambio(nom)
    lado = lado_chico if quien == 'ROSA' else lado_agente
    d &= lado
    if nom not in CABEZA:
        d &= ~(cab_chico if quien == 'ROSA' else cab_agente)
    d = ndi.binary_opening(d, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    if n:
        tam = ndi.sum(d, lab, range(1, n + 1))
        m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t > 1500])
    else:
        m = d
    m = ndi.binary_fill_holes(m) & lado
    if nom not in CABEZA:
        m &= ~(cab_chico if quien == 'ROSA' else cab_agente)
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
    if nom in ('cv_rboca', 'cv_aboca', 'cv_g_viga_rboca'):
        continue
    if nom == 'cv_a_parp':
        cara(nom, BASE, cab_agente)
    elif nom == 'cv_r_parp':
        cara(nom, BASE, cab_chico)
    else:
        capa(nom)
cara('cv_rboca', BASE, cab_chico)
cara('cv_aboca', BASE, cab_agente)
if os.path.exists('crudo/cv_g_viga_rboca.png'):
    cara('cv_g_viga_rboca', 'crudo/cv_g_viga.png', (xx - rx) ** 2 + (yy - ry) ** 2 <= (rr * 1.4) ** 2)
