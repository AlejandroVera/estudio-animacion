# Capas de cara independientes (como en «Estoy Tiesa»: brazos, ojos y boca cambian por separado).
# Todas las posturas tranquilas t_* tienen la cabeza en el mismo sitio, así que los ojos y la boca se
# pueden recortar de un dibujo y pegar encima de cualquier otro. Saca parches con borde suave:
#   ojos_<nombre>.webp  (región de los dos ojos)   boca_<nombre>.webp (región de la boca)
# Uso: python capas_cara.py <salida> <regiones.json> ojos:nombre=imagen.png ... boca:nombre=imagen.png ...
# regiones.json: {"ojos": [[cx,cy,rx,ry], ...], "boca": [[cx,cy,rx,ry]]} en píxeles del dibujo original.
import json, os, sys
import numpy as np, cv2
from PIL import Image

dst, regiones = sys.argv[1], json.load(open(sys.argv[2]))
os.makedirs(dst, exist_ok=True)
cajas = {}
for arg in sys.argv[3:]:
    tipo, resto = arg.split(':', 1)
    nombre, ruta = resto.split('=', 1)
    im = np.array(Image.open(ruta).convert('RGB'))
    H, W = im.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    m = np.zeros((H, W), np.float32)
    for cx, cy, rx, ry in regiones[tipo]:
        m[((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1] = 1
    m = cv2.GaussianBlur(m, (15, 15), 0)
    ys, xs = np.where(m > 0.01)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    rgba = np.dstack([im, (m * 255).astype(np.uint8)])[y0:y1, x0:x1]
    Image.fromarray(rgba, 'RGBA').save(os.path.join(dst, f'{tipo}_{nombre}.webp'), quality=90, method=6)
    cajas[tipo] = [x0, y0, x1 - x0, y1 - y0]
# Imagen vacía para «sin capa» (se ve la cara propia de la postura)
Image.new('RGBA', (4, 4), (0, 0, 0, 0)).save(os.path.join(dst, 'vacio.webp'))
json.dump(cajas, open(os.path.join(dst, 'capas.json'), 'w'))
print(cajas)
