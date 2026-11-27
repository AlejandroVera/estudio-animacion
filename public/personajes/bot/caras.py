"""Caras del bot: base y expresiones de pantalla (con su «~b» de boca abierta por código) sin fondo en
caras/expresiones, y los complementos (a_*) como capas RGBA de solo lo que añaden sobre la base (alineadas: Higgsfield
amplía ~1 %) en caras/capas, con capas.json (caja de la pantalla de la base y posición de cada capa).
  python3 caras.py"""
import glob, json, os, shutil, subprocess
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from procesar import sin_fondo, pantalla

os.makedirs('caras/tmp_e', exist_ok=True)
for f in glob.glob('caras/crudo/e_*.png') + ['caras/crudo/base.png']:
    shutil.copy(f, 'caras/tmp_e/')
subprocess.run(['python3', 'bocas_bot.py', 'caras/tmp_e', 'caras/tmp_eb'], env=dict(os.environ, CORTE='1.0'), check=True)
for n in ('e_cargando', 'e_pantallazo', 'e_estatica', 'e_dormido'):
    for s in ('~b',):
        p = f'caras/tmp_eb/{n}{s}.png'
        if os.path.exists(p): os.remove(p)
os.makedirs('caras/expresiones', exist_ok=True)
for f in sorted(glob.glob('caras/tmp_eb/*.png')):
    n = os.path.basename(f)[:-4]
    out = 'caras/base.webp' if n == 'base' else ('caras/base~b.webp' if n == 'base~b' else f'caras/expresiones/{n}.webp')
    Image.fromarray(sin_fondo(Image.open(f)), 'RGBA').save(out, quality=92)
base = Image.open('caras/crudo/base.png').convert('RGB'); a = np.asarray(base).astype(int)
caja = pantalla(sin_fondo(base))


def pcc(x, y):
    x = x - x.mean(); y = y - y.mean()
    F = np.fft.fft2(x) * np.conj(np.fft.fft2(y)); F /= np.abs(F) + 1e-9
    c = np.fft.ifft2(F).real; yy, xx = np.unravel_index(np.argmax(c), c.shape)
    if yy > x.shape[0] // 2: yy -= x.shape[0]
    if xx > x.shape[1] // 2: xx -= x.shape[1]
    return yy, xx, c.max()


def alinea(E):
    A = np.asarray(base.convert('L')).astype(float); B = np.asarray(E.convert('L')).astype(float); pts = []
    for y0 in range(100, A.shape[0] - 200, 160):
        for x0 in range(0, A.shape[1] - 192, 160):
            p, q = A[y0:y0 + 192, x0:x0 + 192], B[y0:y0 + 192, x0:x0 + 192]
            if p.std() < 12: continue
            dy, dx, c = pcc(p, q)
            if c > 0.2 and abs(dy) < 60 and abs(dx) < 60: pts.append((x0 + 96, y0 + 96, -dx, -dy))
    P = np.array(pts, float); M = np.c_[P[:, 0], P[:, 1], np.ones(len(P))]
    for _ in range(3):
        cx = np.linalg.lstsq(M, P[:, 0] + P[:, 2], rcond=None)[0]; cy = np.linalg.lstsq(M, P[:, 1] + P[:, 3], rcond=None)[0]
        r = np.hypot(M @ cx - (P[:, 0] + P[:, 2]), M @ cy - (P[:, 1] + P[:, 3])); k = r <= np.percentile(r, 75); M, P = M[k], P[k]
    return E.transform(E.size, Image.AFFINE, tuple(cx) + tuple(cy), resample=Image.BICUBIC, fillcolor=(255, 255, 255))


capas = {}
os.makedirs('caras/capas', exist_ok=True)
for f in sorted(glob.glob('caras/crudo/a_*.png')):
    n = os.path.basename(f)[:-4]
    e = np.asarray(alinea(Image.open(f).convert('RGB').resize(base.size))).astype(int)
    d = ndi.binary_opening(np.abs(a - e).max(2) > 45, iterations=2)
    lab, k = ndi.label(ndi.binary_dilation(d, iterations=6))
    m = np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(d, lab, range(1, k + 1))) if t > 400]) if k else d
    m = ndi.binary_fill_holes(m)
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))
    rgba = np.dstack([e.astype('uint8'), al]); rgba[al == 0, :3] = 0
    ys, xs = np.nonzero(al > 10)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(f'caras/capas/{n}.webp', quality=92)
    capas[n] = {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}
    print(n, capas[n])
json.dump({'tam': list(base.size), 'pantalla': caja, 'capas': capas,
           'nota': 'x,y,w,h en píxeles de base.webp; para pegarlas en un cuerpo, escalar por ancho de pantalla del cuerpo / ancho de pantalla de la base y colocar desde la esquina de la pantalla'},
          open('caras/capas.json', 'w'), indent=1, ensure_ascii=False)
shutil.rmtree('caras/tmp_e'); shutil.rmtree('caras/tmp_eb')
