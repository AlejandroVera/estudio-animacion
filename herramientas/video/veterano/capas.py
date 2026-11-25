"""Capas de animación limitada del plano fijo «la sala de espera» (crudo/mf_2.png): cada edición crudo/cv_*.png
deja solo lo que cambia en el lado de su personaje (chico rosa a la izquierda, veterano a la derecha), como RGBA
(img/cv_*.png). Bocas (cv_vboca, cv_rboca) y parpadeos: solo la mancha de cambio de la cara, en elipse.
  python3 capas.py"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASE = 'crudo/mf_2.png'
A = Image.open(BASE).convert('RGB')
a = np.asarray(A).astype(int)
H, W = a.shape[:2]
A.save('img/es_charla.jpg', quality=92)
yy, xx = np.ogrid[:H, :W]
# cabeza magenta del chico
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mag = (r > 150) & (g < 120) & (b > 110) & (r - g > 80)
lab, n = ndi.label(mag)
k = int(np.argmax(ndi.sum(mag, lab, range(1, n + 1)))) + 1
cab = ndi.binary_fill_holes(lab == k)
dt = ndi.distance_transform_edt(cab)
ry, rx = np.unravel_index(int(np.argmax(dt)), dt.shape)
rr = float(dt[ry, rx])
cab_chico = (xx - rx) ** 2 + (yy - ry) ** 2 <= (rr * 1.05) ** 2
# cara del veterano (medida a mano sobre mf_2)
vx, vy = 1166, 1400
print('chico', rx, ry, int(rr), 'cara veterano', vx, vy)
cab_vet = ((xx - vx) / (0.125 * W)) ** 2 + ((yy - vy) / (0.075 * H)) ** 2 <= 1
bajo = yy > int(0.3 * H)   # por debajo del panel de números (la IA lo redibuja en cada edición)
lado_chico = (xx < int(0.6 * W)) & bajo
lado_vet = (xx > int(0.3 * W)) & ~cab_chico & bajo


def guardar(e, m, nom, blur=3):
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(blur)))
    out = np.dstack([e.astype('uint8'), al]); out[al == 0, :3] = 0
    Image.fromarray(out, 'RGBA').save(f'img/{nom}.png', optimize=True)
    print(nom, '%.1f%%' % (m.mean() * 100))


def capa(nom):
    quien = 'ROSA' if nom.startswith('cv_r_') else 'VET'
    e = np.asarray(Image.open(f'crudo/{nom}.png').convert('RGB').resize(A.size)).astype(int)
    d = np.abs(a - e).max(2) > 45
    lado = lado_chico if quien == 'ROSA' else lado_vet
    d &= lado
    if quien == 'VET':
        d &= ~cab_vet
    else:
        d &= ~cab_chico
    d = ndi.binary_opening(d, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    m = np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(d, lab, range(1, n + 1))) if t > 1500]) if n else d
    m = ndi.binary_fill_holes(m) & lado
    m &= ~(cab_vet if quien == 'VET' else cab_chico)
    guardar(e, m, nom)


def cara(nom, zona, una=False):
    e = np.asarray(Image.open(f'crudo/{nom}.png').convert('RGB').resize(A.size)).astype(int)
    d = (np.abs(a - e).max(2) > 50) & zona
    d = ndi.binary_opening(d, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=6))
    if not n:
        print(nom, 'SIN CAMBIO'); return
    tam = ndi.sum(d, lab, range(1, n + 1))
    m = np.zeros(d.shape, bool)
    grupos = [[i + 1 for i, t in enumerate(tam) if t > 0.05 * tam.max()]] if una else [[i + 1] for i, t in enumerate(tam) if t > 0.25 * tam.max()]
    for kk in grupos:
        ys, xs = np.nonzero(np.isin(lab, kk) & d)
        mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        ex, ey = (xs.max() - xs.min()) / 2 + 10, (ys.max() - ys.min()) / 2 + 10
        m |= ((xx - mx) / ex) ** 2 + ((yy - my) / ey) ** 2 <= 1
    guardar(e, m, nom, blur=2)


for f in sorted(glob.glob('crudo/cv_*.png')):
    nom = os.path.basename(f)[:-4]
    if nom in ('cv_vboca', 'cv_rboca', 'cv_v_parp', 'cv_r_parp'):
        continue
    capa(nom)
cara('cv_vboca', cab_vet & (yy > vy + 0.012 * H))              # solo la boca (la edición le movía también los ojos)
cara('cv_rboca', cab_chico & (yy > ry + 0.5 * rr), una=True)
cara('cv_v_parp', cab_vet & (yy < vy + 0.02 * H))
cara('cv_r_parp', ((xx - rx) ** 2 + (yy - ry) ** 2 <= (rr * 1.3) ** 2) & (yy < ry + 0.3 * rr))   # el ojo derecho asoma por el borde
