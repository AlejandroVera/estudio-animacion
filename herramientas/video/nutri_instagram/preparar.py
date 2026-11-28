"""Prepara los dibujos del vídeo «Nutricionista de Instagram» (Ana Cardo, vertical): bases a img/, variantes que
copian solo lo que cambia (alineadas: las ediciones de Higgsfield salen ~1 % ampliadas) y bocas como capa RGBA.
  python3 preparar.py"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

BASES = {n: n for n in ['es_pregunta', 'es_movil', 'br_requisitos', 'br_kilos', 'br_experto', 'br_metabolismo',
                         'br_batido', 'br_panaderia', 'es_campeon', 'br_formacion', 'br_pdf', 'es_carrera', 'br_riesgo',
                         'br_detox', 'br_comer', 'es_final']}
BASES['br_pan'] = 'br_pan_b'
BASES['br_comer'] = 'br_comer2_1'      # el primero tenía tres manos
BASES['br_metabolismo'] = 'br_metabolismo2'   # el primero tenía tres brazos
BASES.update(br_reel='br_reel', br_comentario='br_comentario', br_impresora='br_impresora')          # la barra de pan rehecha (la primera parecía un pescado)
VARIANTES = {'es_pregunta_b': 'es_pregunta', 'br_kilos_b': 'br_kilos', 'br_experto_b': 'br_experto',
             'br_batido_b': 'br_batido', 'br_panaderia_b': 'br_panaderia', 'br_formacion_b': 'br_formacion',
             'br_pdf_b': 'br_pdf', 'br_riesgo_b': 'br_riesgo', 'br_detox_b': 'br_detox', 'es_final_b': 'es_final', 'br_comer_b': 'br_comer',
             # segunda tanda: gestos para que nadie se quede quieto
             'es_pregunta_c': 'es_pregunta', 'es_movil_b': 'es_movil', 'es_campeon_b': 'es_campeon',
             'es_carrera_b': 'es_carrera', 'es_final_c': 'es_final', 'br_requisitos_b': 'br_requisitos',
             'br_experto_c': 'br_experto', 'br_metabolismo_b': 'br_metabolismo', 'br_batido_c': 'br_batido',
             'br_pan_c': 'br_pan', 'br_panaderia_c': 'br_panaderia', 'br_formacion_c': 'br_formacion',
             'br_pdf_c': 'br_pdf', 'br_riesgo_c': 'br_riesgo', 'br_riesgo_d': 'br_riesgo', 'br_detox_c': 'br_detox',
             'br_detox_d': 'br_detox', 'br_kilos_c': 'br_kilos'}
HASTA_Y = {}
# capa de boca: base -> (edición con la boca abierta en crudo/, caja x0 x1 y0 y1 donde buscarla)
BOCAS = {'es_pregunta': ('es_pregunta_bk', (0.25, 0.75, 0.15, 0.42)), 'es_movil': ('es_movil_bk', (0.25, 0.75, 0.15, 0.42)),
         'es_campeon': ('es_campeon_bk', (0.25, 0.75, 0.15, 0.42)), 'es_carrera': ('es_carrera_bk', (0.5, 0.95, 0.15, 0.45)),
         'es_final': ('es_final_bk', (0.25, 0.75, 0.15, 0.42))}


def carga(n, tam=None):
    im = Image.open(f'crudo/{n}.png').convert('RGB')
    return im.resize(tam) if tam else im


def _pcc(a, b):
    a = a - a.mean(); b = b - b.mean()
    F = np.fft.fft2(a) * np.conj(np.fft.fft2(b)); F /= np.abs(F) + 1e-9
    c = np.fft.ifft2(F).real; y, x = np.unravel_index(np.argmax(c), c.shape)
    if y > a.shape[0] // 2: y -= a.shape[0]
    if x > a.shape[1] // 2: x -= a.shape[1]
    return y, x, c.max()


COEF = {}


def alineada(nom, base_img):
    """la edición de Higgsfield sale ampliada ~1 %: se mide la afín por parches y se devuelve la edición llevada
    al marco del dibujo base (si no, las capas «parten» al personaje)"""
    E = carga(nom, base_img.size)
    if nom in globals().get('EN_GESTO', {}) and EN_GESTO[nom] in COEF and globals().get('_SEGUNDO'):
        cx, cy = COEF[EN_GESTO[nom]]      # ya está en el marco de su gesto madre: misma afín que ella
        return _transforma(E, cx, cy)
    A = np.asarray(base_img.convert('L')).astype(float)
    B = np.asarray(E.convert('L')).astype(float)
    pts = []
    for y0 in range(100, A.shape[0] - 200, 180):
        for x0 in range(0, A.shape[1] - 192, 180):
            a, b = A[y0:y0 + 192, x0:x0 + 192], B[y0:y0 + 192, x0:x0 + 192]
            if a.std() < 12: continue
            dy, dx, q = _pcc(a, b)
            if q > 0.2 and abs(dy) < 60 and abs(dx) < 60: pts.append((x0 + 96, y0 + 96, -dx, -dy))
    P = np.array(pts, float)
    M = np.c_[P[:, 0], P[:, 1], np.ones(len(P))]
    for _ in range(3):
        cx = np.linalg.lstsq(M, P[:, 0] + P[:, 2], rcond=None)[0]; cy = np.linalg.lstsq(M, P[:, 1] + P[:, 3], rcond=None)[0]
        res = np.hypot(M @ cx - (P[:, 0] + P[:, 2]), M @ cy - (P[:, 1] + P[:, 3])); k = res <= np.percentile(res, 75)
        M, P = M[k], P[k]
    print('  ', nom, 'escala %.4f %.4f desplaz %.1f %.1f' % (cx[0], cy[1], cx[2], cy[2]))
    # salida en el marco base: pixel base (x,y) <- edición (cx·(x,y,1), cy·(x,y,1))
    COEF[nom] = (cx, cy)
    return _transforma(E, cx, cy)


def _transforma(E, cx, cy):
    s = np.asarray(E.transform(E.size, Image.AFFINE, tuple(cx) + tuple(cy), resample=Image.BICUBIC)).copy()
    v = s.max(2) > 14                     # la afín deja franjas negras en los bordes: se repite la última fila/columna buena
    f = np.nonzero(v.mean(1) > 0.5)[0]; c = np.nonzero(v.mean(0) > 0.5)[0]
    s[:f[0]] = s[f[0]]; s[f[-1] + 1:] = s[f[-1]]; s[:, :c[0]] = s[:, c[0]:c[0] + 1]; s[:, c[-1] + 1:] = s[:, c[-1]:c[-1] + 1]
    for y in range(s.shape[0] - 40, s.shape[0]):
        n = s[y].max(1) < 14; s[y][n] = s[y - 1][n]
    for x in range(s.shape[1] - 40, s.shape[1]):
        n = s[:, x].max(1) < 14; s[:, x][n] = s[:, x - 1][n]
    return Image.fromarray(s)


for k, v in BASES.items():
    carga(v).save(f'img/{k}.jpg', quality=92)
# gestos hechos editando OTRO gesto (no la escena): primero se pegan sobre ese gesto en bruto, en su marco, y luego se
# tratan como un gesto más de la escena (alinear dos veces de golpe fallaba: la imagen salía emborronada)
EN_GESTO = {'br_riesgo_d': 'br_riesgo_b', 'br_detox_d': 'br_detox_b'}
for nom, madre in EN_GESTO.items():
    A = carga(madre); a = np.asarray(A).astype(int)
    b = np.asarray(alineada(nom, A)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 45, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    m = ndi.binary_fill_holes(np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(d, lab, range(1, n + 1))) if t > 1500]))
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[..., None] / 255
    Image.fromarray((a * (1 - al) + b * al).astype('uint8')).save(f'crudo/{nom}_en_gesto.png')
_carga_orig = carga
_SEGUNDO = True
def carga(n, tam=None):
    return _carga_orig(n + '_en_gesto' if n in EN_GESTO else n, tam)
for nom, base in VARIANTES.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB'); a = np.asarray(A).astype(int)
    b = np.asarray(alineada(nom, A)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 45, iterations=2)
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=8))
    m = np.isin(lab, [i + 1 for i, t in enumerate(ndi.sum(d, lab, range(1, n + 1))) if t > 1500]) if n else d
    m = ndi.binary_fill_holes(m)
    m[:16] = False; m[-16:] = False; m[:, :16] = False; m[:, -16:] = False   # los bordes, siempre de la base (la afín deja rayas)
    if nom in HASTA_Y:
        m[int(HASTA_Y[nom] * m.shape[0]):] = False
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[..., None] / 255
    Image.fromarray((a * (1 - al) + b * al).astype('uint8')).save(f'img/{nom}.jpg', quality=92)
    print(nom, 'cambia %.1f%%' % (m.mean() * 100))
for base, (fuente, (x0, x1, y0, y1)) in BOCAS.items():
    A = Image.open(f'img/{base}.jpg').convert('RGB'); a = np.asarray(A).astype(int)
    b = np.asarray(alineada(fuente, A)).astype(int)
    d = ndi.binary_opening(np.abs(a - b).max(2) > 50, iterations=2)
    H, W = d.shape; z = np.zeros_like(d); z[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = True; d &= z
    lab, n = ndi.label(ndi.binary_dilation(d, iterations=6))
    k = int(np.argmax(ndi.sum(d, lab, range(1, n + 1)))) + 1
    ys, xs = np.nonzero((lab == k) & d)
    mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    rx, ry = (xs.max() - xs.min()) / 2 + 10, (ys.max() - ys.min()) / 2 + 10
    yy, xx = np.ogrid[:H, :W]
    m = ((xx - mx) / rx) ** 2 + ((yy - my) / ry) ** 2 <= 1
    al = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))
    out = np.dstack([b.astype('uint8'), al]); out[al == 0, :3] = 0
    Image.fromarray(out, 'RGBA').save(f'img/{base}_boca.png', optimize=True)
    print(base, 'boca en', int(mx), int(my))# los gestos alineados dos veces pueden dejar una franja mala abajo: esas filas, del gesto madre (mismo decorado)
for nom, madre in EN_GESTO.items():
    a = np.asarray(Image.open(f'img/{nom}.jpg')).copy(); m = np.asarray(Image.open(f'img/{madre}.jpg'))
    a[-100:] = m[-100:]
    Image.fromarray(a).save(f'img/{nom}.jpg', quality=92)
