# Mide la cabeza (círculo del color de la cabeza) y los pies de cada postura recortada.
# El color de la cabeza se toma del centro de la parte de arriba del dibujo de reposo.
import sys, os, json
import numpy as np, cv2
from PIL import Image
d = sys.argv[1]
fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))
ref = np.array(Image.open(os.path.join(d, 't_reposo.png' if 't_reposo.png' in fs else fs[0])).convert('RGBA')).astype(int)
al = ref[..., 3] > 128
ys, xs = np.where(al)
top = ys.min(); cxr = int(np.median(xs[ys < top + 60]))
col = np.median(ref[top + 40:top + 120, cxr - 30:cxr + 30, :3].reshape(-1, 3), axis=0)
out = {}
for f in fs:
    a = np.array(Image.open(os.path.join(d, f)).convert('RGBA')).astype(int)
    al = a[..., 3] > 128
    m = al & (np.abs(a[..., :3] - col).sum(-1) < 90)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    h = min((i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 20000), key=lambda i: st[i, 1])
    mm = lab == h
    yy = np.where(mm.any(1))[0]
    widths = np.array([mm[y].sum() for y in yy]); imax = int(widths.argmax())
    cut = next((k for k in range(imax, len(yy)) if widths[k] < widths[imax] * 0.55), len(yy) - 1)
    py, px = np.where(mm[: yy[cut]])
    (cx, cy), r = cv2.minEnclosingCircle(cv2.convexHull(np.stack([px, py], 1).astype(np.float32)))
    y2, x2 = np.where(al); bottom = y2.max(); feet = x2[y2 > bottom - 40]
    out[f[:-4]] = dict(cx=round(float(cx), 1), cy=round(float(cy), 1), r=round(float(r), 1), bottom=int(bottom), feet_x=[int(feet.min()), int(feet.max())])
json.dump(out, open(os.path.join(d, 'medidas.json'), 'w'), indent=1)
for k, v in out.items(): print(k.ljust(12), v)
