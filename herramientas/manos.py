# Separa las manos de los antebrazos y prepara manos intercambiables a partir de una hoja de
# manos generada con IA (seis manos DERECHAS con la muñeca abajo, sobre fondo blanco).
# Sirve para cualquier personaje despiezado con el esqueleto estándar.
#
# Uso: python manos.py <carpeta piezas (PNG + manifest.json)> <hoja_manos.png> <carpeta salida>
# Escribe en la salida los antebrazos recortados en la muñeca, una imagen por variante de mano y
# lado (mano_<lado>__<variante>.png, todas con la misma caja) y manifest.json actualizado.
import json, os, sys
import numpy as np, cv2
from PIL import Image

piezas, hoja_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
man = json.load(open(os.path.join(piezas, 'manifest.json')))
W, H = man['size']
# Orden de la hoja: arriba abierta, palma_arriba, puno; abajo indice, dorso, pulgar
NOMBRES = ['abierta', 'palma_arriba', 'puno', 'indice', 'dorso', 'pulgar']


def pieza(pid):
    b = man['pieces'][pid]['box']
    img = np.array(Image.open(os.path.join(piezas, pid + '.png')).convert('RGBA'))
    full = np.zeros((H, W, 4), np.uint8)
    full[b[1]:b[1] + b[3], b[0]:b[0] + b[2]] = img
    return full


def guardar(pid, rgba, pivot, nombre=None):
    ys, xs = np.where(rgba[..., 3] > 2)
    x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
    Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(os.path.join(out, (nombre or pid) + '.png'), optimize=True)
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]


# ---------- Manos de la hoja ----------
hoja = np.array(Image.open(hoja_path).convert('RGB')).astype(np.int32)
fondo = np.median(np.concatenate([hoja[:20].reshape(-1, 3), hoja[-20:].reshape(-1, 3)]), axis=0)
dif = np.abs(hoja - fondo).sum(-1)
mask = (dif > 40).astype(np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
contornos, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
contornos = sorted([c for c in contornos if cv2.contourArea(c) > 20000], key=cv2.contourArea, reverse=True)[:6]
cajas = [cv2.boundingRect(c) for c in contornos]
filas = sorted(range(len(cajas)), key=lambda i: cajas[i][1])
arriba, abajo = sorted(filas[:3], key=lambda i: cajas[i][0]), sorted(filas[3:], key=lambda i: cajas[i][0])
orden = arriba + abajo
oscuro = hoja.sum(-1) < 250

manos = {}
for nombre, i in zip(NOMBRES, orden):
    c = contornos[i]
    relleno = np.zeros(mask.shape, np.uint8)
    cv2.drawContours(relleno, [c], -1, 1, -1)
    # Extremo abierto del muñón: borde del contorno sin línea negra cerca.
    pts = c[:, 0, :]
    abierto = []
    for x, y in pts:
        y0, y1, x0, x1 = max(0, y - 6), y + 7, max(0, x - 6), x + 7
        if not oscuro[y0:y1, x0:x1].any():
            abierto.append((x, y))
    abierto = np.array(abierto, np.float32)
    B = abierto.mean(0)
    ancho = float(np.linalg.norm(abierto.max(0) - abierto.min(0)))
    # Eje del muñón: componentes principales de la piel cerca del extremo abierto.
    ys, xs = np.where(relleno > 0)
    cerca = (xs - B[0]) ** 2 + (ys - B[1]) ** 2 < (1.2 * ancho) ** 2
    P = np.stack([xs[cerca], ys[cerca]], 1).astype(np.float32)
    cen = P.mean(0)
    _, _, vt = np.linalg.svd(P - cen, full_matrices=False)
    eje = vt[0] if np.dot(vt[0], cen - B) > 0 else -vt[0]  # del extremo hacia la mano
    # Anchura real del muñón, perpendicular al eje.
    perp = np.array([-eje[1], eje[0]])
    proy = (P - B) @ perp
    ancho = float(np.percentile(proy, 98) - np.percentile(proy, 2))
    muneca = B + eje * 0.75 * ancho
    rgba = np.dstack([hoja.astype(np.uint8), (relleno * 255).astype(np.uint8)])
    manos[nombre] = dict(rgba=rgba, muneca=muneca, eje=eje, ancho=ancho)
    print(nombre, 'muñeca', muneca.round(), 'eje', eje.round(2), 'ancho', round(ancho))

# ---------- Por cada lado ----------
alpha_total = None
for lado in ('izq', 'der'):
    aid = f'antebrazo_{lado}'
    codo = np.array(man['pieces'][aid]['pivot'], np.float32)
    ante = pieza(aid)
    a = ante[..., 3] > 128
    ys, xs = np.where(a)
    P = np.stack([xs, ys], 1).astype(np.float32)
    lejos = P[np.argmax(((P - codo) ** 2).sum(1))]
    eje = (lejos - codo) / np.linalg.norm(lejos - codo)
    perp = np.array([-eje[1], eje[0]])
    s = (P - codo) @ eje
    L = s.max()
    # Perfil de anchura: la muñeca es el punto más estrecho entre el 45 % y el 80 % del largo.
    best = None
    for si in np.arange(0.45 * L, 0.8 * L, 2):
        franja = np.abs(s - si) < 2
        if franja.sum() < 5:
            continue
        q = (P[franja] - codo) @ perp
        w = q.max() - q.min()
        if best is None or w < best[1]:
            best = (si, w, (q.max() + q.min()) / 2)
    s_m, ancho_m, centro_q = best
    muneca = codo + eje * s_m + perp * centro_q
    print(lado, 'muñeca', muneca.round(), 'ancho', round(ancho_m), 'eje', eje.round(2))

    yy, xx = np.mgrid[0:H, 0:W]
    sp = (xx - codo[0]) * eje[0] + (yy - codo[1]) * eje[1]
    corte = s_m + 0.1 * ancho_m
    ante_cut = ante.copy()
    ante_cut[..., 3] = np.where(sp <= corte, ante[..., 3], 0)
    caja_a = guardar(aid, ante_cut, codo)
    man['pieces'][aid]['box'] = caja_a

    # Mano original (la del dibujo), con un trozo de antebrazo que queda tapado.
    natural = ante.copy()
    natural[..., 3] = np.where(sp >= s_m - 0.35 * ancho_m, ante[..., 3], 0)
    variantes = {'natural': natural}

    # Manos de la hoja: escaladas a la muñeca, giradas al eje del antebrazo y colocadas.
    ang_dest = np.degrees(np.arctan2(eje[1], eje[0]))
    for nombre, m in manos.items():
        src = m['rgba']
        mun = m['muneca'].copy()
        ej = m['eje'].copy()
        if lado == 'der':  # la hoja tiene manos derechas (lado izquierdo de la pantalla)
            src = src[:, ::-1].copy()
            mun[0] = src.shape[1] - 1 - mun[0]
            ej[0] = -ej[0]
        esc = ancho_m / m['ancho'] * 1.02
        ang_src = np.degrees(np.arctan2(ej[1], ej[0]))
        rot = ang_dest - ang_src
        M = cv2.getRotationMatrix2D((float(mun[0]), float(mun[1])), -rot, esc)
        M[0, 2] += muneca[0] - mun[0]
        M[1, 2] += muneca[1] - mun[1]
        warped = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
        # Muñón corto con el final difuminado para fundirse con el antebrazo.
        d = sp - s_m
        fade = np.clip((d + 0.45 * ancho_m) / (0.3 * ancho_m), 0, 1)
        warped[..., 3] = (warped[..., 3] * fade).astype(np.uint8)
        variantes[nombre] = warped

    union = np.zeros((H, W), bool)
    for v in variantes.values():
        union |= v[..., 3] > 2
    ys, xs = np.where(union)
    x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
    for nombre, v in variantes.items():
        Image.fromarray(v[y0:y1, x0:x1], 'RGBA').save(os.path.join(out, f'mano_{lado}__{nombre}.png'), optimize=True)
    man['pieces'][f'mano_{lado}'] = {
        'box': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
        'pivot': [float(muneca[0]), float(muneca[1])],
        'variants': list(variantes),
    }

json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
