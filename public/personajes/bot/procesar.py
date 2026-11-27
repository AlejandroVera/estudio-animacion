"""Procesa el repertorio del bot: quita el fondo blanco (relleno desde los bordes, así el blanco del cuello y los
papeles de dentro se quedan), recorta a lo que ocupa con un margen y guarda WebP con transparencia. Mide la
pantalla-cara (caja) y los pies, y escribe el manifest.
  python3 procesar.py"""
import glob, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def sin_fondo(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    blanco = (a.min(2) > 232) & (a.max(2) - a.min(2) < 18)
    lab, n = ndi.label(blanco)
    borde = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    fondo = np.isin(lab, list(borde))
    fondo = ndi.binary_opening(fondo, iterations=1)
    al = np.where(fondo, 0, 255).astype('uint8')
    al = np.asarray(Image.fromarray(al).filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(1)))
    return np.dstack([a.astype('uint8'), al])


def pantalla(rgba):
    a = rgba[..., :3].astype(int); osc = (a.max(2) < 75) & (rgba[..., 3] > 0); osc[int(0.42 * osc.shape[0]):] = False
    lab, k = ndi.label(osc)
    if not k: return None
    best = None
    for i in range(1, k + 1):
        s = (lab == i).sum()
        if s < 0.003 * osc.size: continue
        ys, xs = np.nonzero(lab == i)
        if best is None or ys.mean() < best[0]: best = (ys.mean(), [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())])
    return best[1] if best else None


def procesa(carpeta, salida, nombres_tipo=True):
    os.makedirs(salida, exist_ok=True)
    man = {}
    for f in sorted(glob.glob(os.path.join(carpeta, '*.png'))):
        n = os.path.basename(f)[:-4]
        rgba = sin_fondo(Image.open(f))
        ys, xs = np.nonzero(rgba[..., 3] > 20)
        y0, y1, x0, x1 = max(ys.min() - 20, 0), min(ys.max() + 20, rgba.shape[0]), max(xs.min() - 20, 0), min(xs.max() + 20, rgba.shape[1])
        rgba = rgba[y0:y1, x0:x1]
        Image.fromarray(rgba, 'RGBA').save(os.path.join(salida, n + '.webp'), quality=92)
        p = pantalla(rgba)
        fila = np.nonzero(rgba[..., 3].max(1) > 20)[0][-1]
        cols = np.nonzero(rgba[fila - 3, :, 3] > 20)[0]
        tipo = {'s': 'sentado', 't': 'tumbado'}.get(n[0], 'de pie') if n[1:2] == '_' else 'de pie'
        man[n] = {'tam': [rgba.shape[1], rgba.shape[0]], 'cara': p, 'pies': [float(cols.mean()) if len(cols) else rgba.shape[1] / 2, int(fila)], 'tipo': tipo}
    return man


if __name__ == '__main__':
    voz = {'nombre': 'Gabriel Blanco II (con eco corto metálico)', 'id': 'Xdk5eWaS3lO6Yz2HBOBv'}
    m = procesa('expresivo/con_bocas', 'expresivo')
    json.dump({'posturas': m, 'voz': voz}, open('expresivo/manifest.json', 'w'), indent=1, ensure_ascii=False)
    m = procesa('inventario/con_bocas', 'inventario/cuerpos')
    json.dump({'cuerpos': m, 'voz': voz}, open('inventario/inventario.json', 'w'), indent=1, ensure_ascii=False)
    print('procesado')
