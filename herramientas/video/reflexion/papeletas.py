"""Escribe las 4 papeletas en el plano inicial (la IA escribe mal): detecta los 4 papeles blancos de la mesa y pinta en
cada uno, en perspectiva, la sigla, un logo sencillo y el lema con la letra de los rótulos.
  python3 papeletas.py entrada.jpg salida.jpg"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
F = '../../shorts/ComingSoon.ttf'
COL = {'rojo': (215, 30, 40), 'azul': (25, 90, 190), 'negro': (25, 25, 25), 'morado': (120, 40, 150)}
# orden: arriba izq, arriba der, abajo izq, abajo der
PAP = [('PSOE', 'Promesas Sujetas\na Otra Encuesta', 'rojo'), ('PP', 'Prometemos\nPasado', 'azul'),
       ('SUMAR, RESTAR', 'y dividirse', 'morado'), ('PARTiDO\nBiSAGRA', 'Votamos lo\nque nos den', 'negro')]


def papeles(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    m = ndi.binary_opening(a.min(2) > 232, iterations=3)
    m[: a.shape[0] // 3] = False                        # solo la mesa (mitad de abajo)
    lab, n = ndi.label(m)
    s = ndi.sum(m, lab, range(1, n + 1))
    idx = np.argsort(s)[::-1][:4] + 1
    qs = []
    for i in idx:
        ys, xs = np.nonzero(lab == i)
        p = np.c_[xs, ys]
        tl = p[np.argmin(xs + ys)]; br = p[np.argmax(xs + ys)]; tr = p[np.argmax(xs - ys)]; bl = p[np.argmin(xs - ys)]
        qs.append(np.array([tl, tr, br, bl], float))
    qs.sort(key=lambda q: (round(q[:, 1].mean() / 200), q[:, 0].mean()))
    return qs


def coefs(dst, src):
    """coeficientes de PIL PERSPECTIVE: para cada punto de salida (dst) da el de entrada (src)"""
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float))


def tarjeta(sig, lema, col, W, H):
    t = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(t); c = COL[col]
    d.rectangle([W * 0.05, H * 0.05, W * 0.95, H * 0.95], outline=c + (255,), width=max(4, W // 90))
    r = W * 0.075; cx, cy = W * 0.17, H * 0.2                   # logo: círculo de color con un aspa (la casilla de voto)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (255,))
    d.rectangle([W * 0.76, H * 0.12, W * 0.88, H * 0.12 + W * 0.12], outline=(30, 30, 30, 255), width=max(3, W // 140))

    def texto(txt, y0, y1, frac, color):
        tam = int(H * frac)
        while True:
            f = ImageFont.truetype(F, tam)
            bb = d.multiline_textbbox((0, 0), txt, font=f, align='center', spacing=tam * 0.05)
            if bb[2] - bb[0] <= W * 0.82 and bb[3] - bb[1] <= (y1 - y0) * H: break
            tam -= 2
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        x, y = (W - w) / 2 - bb[0], y0 * H + ((y1 - y0) * H - h) / 2 - bb[1]
        g = max(2, tam // 22)
        for dx, dy in [(i, j) for i in range(g + 1) for j in range(g + 1)]:
            d.multiline_text((x + dx, y + dy), txt, font=f, fill=color + (255,), align='center', spacing=tam * 0.05)
    texto(sig, 0.30, 0.62, 0.30, c)
    texto(lema, 0.64, 0.90, 0.13, (35, 35, 35))
    return t


def escribe(im):
    im = im.convert('RGB')
    for q, (sig, lema, col) in zip(papeles(im), PAP):
        W = int(max(np.hypot(*(q[1] - q[0])), np.hypot(*(q[2] - q[3]))) * 1.3)
        H = int(max(np.hypot(*(q[3] - q[0])), np.hypot(*(q[2] - q[1]))) * 1.3)
        t = tarjeta(sig, lema, col, W, H)
        k = coefs(q, [(0, 0), (W, 0), (W, H), (0, H)])
        cap = t.transform(im.size, Image.PERSPECTIVE, tuple(k), resample=Image.BICUBIC)
        im.paste(cap, (0, 0), cap)
    return im


if __name__ == '__main__':
    escribe(Image.open(sys.argv[1])).save(sys.argv[2], quality=92)
