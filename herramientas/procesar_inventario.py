"""Procesa el INVENTARIO del chico magenta (dibujos hechos con Magnific).

Uso: python3 herramientas/procesar_inventario.py <carpeta_crudo> <cabeza_base.png> <cabeza_peq.png> <salida>

- Cuerpos (p_ de pie, s_ sentado, t_ tumbado): quita el fondo blanco (y los huecos blancos
  encerrados entre brazo y cuerpo), mide la cabeza (círculo inscrito más grande de la mancha
  magenta) y, si nada le tapa la cara, le pega la CARA CANÓNICA (la de la cabeza base) para que
  todas las capas de ojos y bocas encajen igual en cualquier postura. Si una mano tapa la cara,
  se queda con la suya (`sinCara`).
- Capas (o_ ojos, b_ boca, a_/ap_ complementos): son ediciones de la cabeza base; se queda solo
  con lo que cambia (diferencia con la base) y lo guarda recortado con su posición respecto al
  centro de la cabeza en unidades de radio.
Escribe <salida>/inventario.json y las imágenes WebP.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CRUDO, BASE, PEQ, OUT = sys.argv[1:5]
os.makedirs(os.path.join(OUT, 'cuerpos'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'capas'), exist_ok=True)

# Fondos blancos a respetar (papel, taza, periódico… son blancos de verdad)
PIES_ALTOS = {'p_salta', 's_relajado', 's_hundido', 'p_furioso', 'p_andando'}
CON_BLANCO = {'p_papel', 's_periodico', 'p_taza', 's_taza', 's_come'}


def rgb(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.int16)


def magenta(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 150) & (g < 120) & (b > 110) & (r - g > 80)


def cabeza(a, mascara=None):
    """Centro y radio de la cabeza: el círculo inscrito más grande dentro de la mancha magenta
    (con los ojos y el aro rellenos). Los brazos son finos y no cambian el máximo."""
    m = magenta(a)
    if mascara is not None:
        m &= mascara
    lab, n = ndi.label(m)
    if n == 0:
        return None
    tam = ndi.sum(m, lab, range(1, n + 1))
    grande = lab == (int(np.argmax(tam)) + 1)
    lleno = ndi.binary_fill_holes(grande)
    dt = ndi.distance_transform_edt(lleno)
    y, x = np.unravel_index(int(np.argmax(dt)), dt.shape)
    return float(x), float(y), float(dt[y, x])


def medir(a, nom):
    cx, cy, r = cabeza(a)
    if nom[0] in 'ps' and r < 150:
        # una mano parte la cabeza: radio típico y centro desde lo más alto de la cabeza
        r = 178.0 if nom[0] == 'p' else 185.0
        m = ndi.binary_fill_holes(magenta(a))
        ys, xs = np.nonzero(m[: int(a.shape[0] * 0.4)])
        top = ys.min()
        cx = float(xs[ys < top + 6].mean())
        cy = float(top + r)
    return cx, cy, r


def quitar_fondo(a, nombre):
    blanco = (a.min(2) > 228)
    lab, n = ndi.label(blanco)
    borde = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fondo = np.isin(lab, list(borde))
    fondo0 = fondo.copy()
    if True:
        # huecos encerrados: blancos grandes que no son ojos (dentro de la cabeza) ni zapatillas
        h = a.shape[0]
        cab = medir(a, nombre)
        tam = ndi.sum(blanco, lab, range(1, n + 1))
        for i in range(1, n + 1):
            if i in borde or tam[i - 1] < 350:
                continue
            ys, xs = np.nonzero(lab == i)
            cy, cx = ys.mean(), xs.mean()
            if cab and (cx - cab[0]) ** 2 + (cy - cab[1]) ** 2 < (cab[2] * 0.9) ** 2:
                continue
            if cy > h * 0.84:
                continue  # zapatillas
            if nombre in PIES_ALTOS and cy > h * 0.55:
                continue  # zapatilla levantada (salto, pierna cruzada…)
            if nombre in ('p_papel', 's_periodico'):
                continue
            if nombre in CON_BLANCO:
                # taza, papel, táper… son blancos de verdad: solo se borran huecos alargados
                # (el blanco entre el brazo y el cuerpo)
                if (ys.max() - ys.min() + 1) < 1.3 * (xs.max() - xs.min() + 1):
                    continue
            # una zapatilla (o cualquier cosa blanca del dibujo) toca el fondo tras su contorno;
            # un hueco entre brazo y cuerpo está rodeado de dibujo
            comp = lab == i
            anillo = ndi.binary_dilation(comp, iterations=9) & ~ndi.binary_dilation(comp, iterations=2)
            if (anillo & fondo0).sum() > anillo.sum() * 0.03:
                continue
            if nombre.startswith('t_'):
                continue  # tumbados: zapatillas en cualquier sitio, no se toca
            fondo |= lab == i
    # borde suave: el blanco que roza el fondo se aclara a transparente
    alfa = np.where(fondo, 0, 255).astype(np.uint8)
    alfa = cv2.GaussianBlur(alfa, (3, 3), 0)
    alfa[~fondo] = 255
    return alfa


def disco(shape, cx, cy, r):
    yy, xx = np.ogrid[:shape[0], :shape[1]]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


base = rgb(BASE)
peq = rgb(PEQ)
cb = cabeza(base)
cp = cabeza(peq)
print('cabeza base', cb, 'pequeña', cp)

# cara canónica: el interior de la cabeza base (sin el contorno)
oscuro_base = base.max(2) < 90


def cara_canonica(r, ):
    s = r / cb[2]
    L = int(cb[2] * 1.0)
    x0, y0 = int(cb[0] - L), int(cb[1] - L)
    trozo = base[y0:y0 + 2 * L, x0:x0 + 2 * L].astype(np.uint8)
    n = max(4, int(round(2 * L * s)))
    return cv2.resize(trozo, (n, n), interpolation=cv2.INTER_AREA), n


def tapada(a, cx, cy, r):
    """¿Algo tapa la cara? Busca trazo oscuro dentro de la cabeza donde la cara base no lo tiene
    (con margen): una mano encima deja su contorno negro en medio de la cara."""
    cara, n = cara_canonica(r)
    oc = cara.max(2) < 90
    oc = cv2.dilate(oc.astype(np.uint8), np.ones((int(r * 0.18) | 1,) * 2, np.uint8)) > 0
    x0, y0 = int(round(cx - n / 2)), int(round(cy - n / 2))
    h, w = a.shape[:2]
    if x0 < 0 or y0 < 0 or x0 + n > w or y0 + n > h:
        return True
    trozo = a[y0:y0 + n, x0:x0 + n]
    ot = trozo.max(2) < 90
    dentro = disco((n, n), n / 2, n / 2, r * 0.82)
    extra = ot & ~oc & dentro
    # y que la cabeza sea magenta por dentro (no una mano de otro color, ni girada)
    return extra.sum() > (r * r) * 0.012


def buscar_boca(a, cx, cy, r):
    """Caja de la raya de la boca (trazo oscuro en la parte baja de la cara) y color de la cabeza.
    Sirve para borrarla antes de pegar la boca que habla."""
    y0, y1 = int(cy + 0.36 * r), int(cy + 0.82 * r)
    x0, x1 = int(cx - 0.5 * r), int(cx + 0.5 * r)
    zona = a[y0:y1, x0:x1]
    osc = zona.max(2) < 100
    lab, n = ndi.label(osc)
    if n == 0:
        return None, None
    mejor, ys, xs = 0, None, None
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        alto, ancho = yy.max() - yy.min() + 1, xx.max() - xx.min() + 1
        # una raya de boca es ancha y fina (el aro, la nariz o una mano no)
        if ancho < 0.18 * r or alto > 0.16 * r or yy.min() == 0:
            continue
        if len(yy) > mejor:
            mejor, ys, xs = len(yy), yy, xx
    if ys is None:
        return None, None
    mag = magenta(zona)
    col = [int(v) for v in np.median(zona[mag], 0)] if mag.sum() > 50 else [221, 60, 190]
    return [int(x0 + xs.min()), int(y0 + ys.min()), int(x0 + xs.max() + 1), int(y0 + ys.max() + 1)], col


def pegar_cara(a, cx, cy, r):
    cara, n = cara_canonica(r)
    x0, y0 = int(round(cx - n / 2)), int(round(cy - n / 2))
    m = disco((n, n), n / 2, n / 2, r * 0.97).astype(np.float32)
    m = cv2.GaussianBlur(m, (5, 5), 0)[..., None]
    zona = a[y0:y0 + n, x0:x0 + n].astype(np.float32)
    a[y0:y0 + n, x0:x0 + n] = (zona * (1 - m) + cara.astype(np.float32) * m).astype(np.int16)


bb, _ = buscar_boca(base, *cb)
manifest = {'radioBase': cb[2], 'bocaBase': [round((bb[0] - cb[0]) / cb[2], 4), round((bb[1] - cb[1]) / cb[2], 4), round((bb[2] - cb[0]) / cb[2], 4), round((bb[3] - cb[1]) / cb[2], 4)], 'cuerpos': {}, 'capas': {}}
nombres = sorted(f[:-4] for f in os.listdir(CRUDO) if f.endswith('.png'))

for nom in nombres:
    a = rgb(os.path.join(CRUDO, nom + '.png'))
    if nom[:2] in ('p_', 's_', 't_'):
        cx, cy, r = medir(a, nom)
        alfa = quitar_fondo(a, nom)
        sin = nom.startswith('t_') or tapada(a, cx, cy, r)
        if not sin:
            pegar_cara(a, cx, cy, r)
        bk, colk = buscar_boca(a, cx, cy, r)
        im = np.dstack([np.clip(a, 0, 255).astype(np.uint8), alfa])
        ys, xs = np.nonzero(alfa > 20)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        Image.fromarray(im[y0:y1, x0:x1]).save(os.path.join(OUT, 'cuerpos', nom + '.webp'), quality=90)
        manifest['cuerpos'][nom] = {
            'w': int(x1 - x0), 'h': int(y1 - y0),
            'cabeza': [round(cx - x0, 1), round(cy - y0, 1), round(r, 1)],
            'pies': int(y1 - y0),
            'tipo': {'p': 'pie', 's': 'sentado', 't': 'tumbado'}[nom[0]],
            'sinCara': bool(sin),
            'boca': [bk[0] - int(x0), bk[1] - int(y0), bk[2] - int(x0), bk[3] - int(y0)] if bk else None,
            'colorCabeza': colk,
        }
        print(nom, 'r=%.0f' % r, 'SIN CARA' if sin else '')
    else:
        b, c = (peq, cp) if nom.startswith('ap_') else (base, cb)
        if a.shape != b.shape:
            a = np.asarray(Image.fromarray(a.astype(np.uint8)).resize(b.shape[1::-1])).astype(np.int16)
        d = np.abs(a - b).max(2) > 42
        d = ndi.binary_opening(d, iterations=1)
        lab, n = ndi.label(d)
        if n:
            tam = ndi.sum(d, lab, range(1, n + 1))
            d = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t >= 60])
        d = ndi.binary_dilation(d, iterations=3)
        d = ndi.binary_fill_holes(d)
        # lo que no cambió y en la base era fondo blanco (dentro de la aureola, entre corazones…) no va
        igual = np.abs(a - b).max(2) <= 42
        d &= ~(igual & (b.min(2) > 225))
        alfa = cv2.GaussianBlur((d * 255).astype(np.uint8), (3, 3), 0)
        alfa[d] = 255
        ys, xs = np.nonzero(alfa > 10)
        if len(xs) == 0:
            print(nom, 'SIN CAMBIOS')
            continue
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        im = np.dstack([np.clip(a, 0, 255).astype(np.uint8), alfa])[y0:y1, x0:x1]
        nomf = nom.replace('ap_', 'a_')
        Image.fromarray(im).save(os.path.join(OUT, 'capas', nomf + '.webp'), quality=92)
        manifest['capas'][nomf] = {
            'tipo': {'o': 'ojos', 'b': 'boca', 'a': 'extra'}[nom[0]],
            # posición y tamaño en radios de cabeza, desde el centro
            'x': round((x0 - c[0]) / c[2], 4), 'y': round((y0 - c[1]) / c[2], 4),
            'w': round((x1 - x0) / c[2], 4), 'h': round((y1 - y0) / c[2], 4),
        }
        print(nom, 'capa', x1 - x0, y1 - y0)

desc = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inventario_desc.json')))
for grupo in ('cuerpos', 'capas'):
    for k, v in manifest[grupo].items():
        v['desc'] = desc.get(k, k)
json.dump(manifest, open(os.path.join(OUT, 'inventario.json'), 'w'), ensure_ascii=False, indent=1)
print('cuerpos', len(manifest['cuerpos']), 'capas', len(manifest['capas']))
