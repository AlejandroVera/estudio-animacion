"""Montador del MODO INVENTARIO: fondo dibujado + personaje del inventario (postura, ojos, boca, complementos)
+ boca que habla con la voz + rótulos a mano + objetos + dibujos alternos de los secundarios.

python3 herramientas/video/montar.py <proyecto>/plan.json <salida.mp4> [--frames t1,t2,...]
  --frames: solo saca JPG de esos instantes (junto a la salida) para revisar antes de renderizar.
Las rutas del plan son relativas a la carpeta del plan; «inv:capas/x.webp» = una pieza del inventario.
Formato del plan: ver .claude/skills/video-inventario/SKILL.md.
"""
import json, sys, os, math, random, subprocess, unicodedata
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
INV = os.path.normpath(os.path.join(AQUI, '..', '..', 'public', 'personajes', 'chico-magenta', 'inventario'))
M = json.load(open(INV + '/inventario.json'))
W, H, FPS = 1920, 1080, 25

plan = json.load(open(sys.argv[1]))
BASE = os.path.dirname(os.path.abspath(sys.argv[1]))
OUT = sys.argv[2]
SOLO = None
if '--frames' in sys.argv:
    SOLO = [float(x) for x in sys.argv[sys.argv.index('--frames') + 1].split(',')]

palabras = [w for w in json.load(open(os.path.join(BASE, plan['alineacion'])))['palabras'] if w['tipo'] == 'word']
DUR = plan.get('duracion') or palabras[-1]['fin'] + 0.4


def img(p):
    if p.startswith('inv:'):
        return _img(os.path.join(INV, p[4:]))
    return _img(p if p.startswith('/') else os.path.join(BASE, p))


@lru_cache(None)
def _img(p):
    return Image.open(p).convert('RGBA')


@lru_cache(None)
@lru_cache(None)
def pantalon_escena(nombre):
    """En los dibujos de escena con él dentro, pasa a gris el pantalón vaquero (solo por debajo de su cabeza)."""
    import numpy as np
    from scipy import ndimage as ndi
    im = img(nombre).convert('RGB')
    if PANTALON != 'gris':
        return im
    a = np.asarray(im).astype(np.float32)
    r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
    mag = (r_ > 150) & (g_ < 120) & (b_ > 110) & (r_ - g_ > 80)
    lab, n = ndi.label(mag)
    if not n:
        return im
    tam = ndi.sum(mag, lab, range(1, n + 1))
    i = int(np.argmax(tam))
    if tam[i] < 2000:
        return im
    dt = ndi.distance_transform_edt(ndi.binary_fill_holes(lab == i + 1))
    y, x = np.unravel_index(int(np.argmax(dt)), dt.shape)
    r = float(dt[y, x])
    zona = np.zeros(mag.shape, bool)
    zona[int(y + r * 1.1):, max(0, int(x - 3 * r)):int(x + 3 * r)] = True
    azul = zona & (b_ > r_ + 25) & (b_ > g_ + 5) & (b_ < 215)
    lum = 0.3 * r_ + 0.59 * g_ + 0.11 * b_
    gris = np.clip(lum * 0.95 + 28, 0, 255)
    for k in range(3):
        a[..., k] = np.where(azul, gris + (k - 1) * 2, a[..., k])
    return Image.fromarray(a.astype('uint8'))


def fondo(nombre, zoom, cx, cy):
    """Fondo a 1920x1080 con encuadre (zoom y centro en fracciones)."""
    im = pantalon_escena(nombre) if os.path.basename(nombre).startswith(('es_', 'br_')) else img(nombre).convert('RGB')
    w, h = im.size
    cw, ch = w / zoom, h / zoom
    x0 = min(max(cx * w - cw / 2, 0), w - cw)
    y0 = min(max(cy * h - ch / 2, 0), h - ch)
    return im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.LANCZOS)


def encuadre(nombre, zoom, cx, cy):
    """Origen y escala del recorte de `fondo` (para pasar coordenadas del dibujo a la pantalla)."""
    w, h = img(nombre).size
    cw, ch = w / zoom, h / zoom
    x0 = min(max(cx * w - cw / 2, 0), w - cw)
    y0 = min(max(cy * h - ch / 2, 0), h - ch)
    return x0, y0, W / cw


@lru_cache(None)
def cara_escena(nombre):
    """Cara del protagonista dentro de un dibujo de escena: su cabeza es la única mancha magenta grande.
    Devuelve (cx, cy, r, caja_boca, color) en píxeles del dibujo, o None si no se le ve la boca."""
    import numpy as np
    from scipy import ndimage as ndi
    a = np.asarray(img(nombre).convert('RGB')).astype(int)
    r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
    mag = (r_ > 150) & (g_ < 120) & (b_ > 110) & (r_ - g_ > 80)
    lab, n = ndi.label(mag)
    if not n:
        return None
    tam = ndi.sum(mag, lab, range(1, n + 1))
    for i in np.argsort(tam)[::-1][:3]:
        if tam[i] < 2000:
            break
        m = ndi.binary_fill_holes(lab == i + 1)
        dt = ndi.distance_transform_edt(m)
        y, x = np.unravel_index(int(np.argmax(dt)), dt.shape)
        r = float(dt[y, x])
        y0, y1, x0, x1 = int(y + 0.3 * r), int(y + 0.85 * r), int(x - 0.55 * r), int(x + 0.55 * r)
        zona = a[y0:y1, x0:x1]
        dentro = m[y0:y1, x0:x1]
        osc = (zona.max(2) < 100) & ndi.binary_dilation(dentro, iterations=3)
        lb, k = ndi.label(osc)
        mejor = None
        for j in range(1, k + 1):
            yy, xx = np.nonzero(lb == j)
            alto, ancho = yy.max() - yy.min() + 1, xx.max() - xx.min() + 1
            if ancho < 0.15 * r or alto > 0.3 * r or ancho > 0.9 * r:
                continue
            if mejor is None or len(yy) > mejor[0]:
                mejor = (len(yy), [x0 + xx.min(), y0 + yy.min(), x0 + xx.max() + 1, y0 + yy.max() + 1])
        if mejor:
            col = tuple(int(v) for v in np.median(a[m & mag], 0))
            return x, y, r, mejor[1], col
    return None


def boca_en_escena(im, nombre, z, cx, cy, forma):
    """Pega la boca que habla en la cara de un dibujo de escena (borra antes su raya de boca)."""
    c = cara_escena(nombre)
    if not c:
        return
    hx, hy, r, bk, col = c
    x0, y0, k = encuadre(nombre, z, cx, cy)
    rr = r * k
    caja = [(bk[0] - x0) * k, (bk[1] - y0) * k, (bk[2] - x0) * k, (bk[3] - y0) * k]
    m = rr * 0.06
    ImageDraw.Draw(im).rounded_rectangle((caja[0] - m, caja[1] - m, caja[2] + m, caja[3] + m), radius=m * 1.5,
                                          fill=col + (255,))
    L = M['capas'][forma]
    bb = M['bocaBase']
    # la boca nueva, centrada donde estaba la raya, al tamaño de esa cabeza (un poco menor: la cabeza
    # de la escena se mide por dentro del contorno)
    ancho_raya = caja[2] - caja[0]
    esc = max(rr, ancho_raya / max(bb[2] - bb[0], 0.1)) * 0.95
    li = capa(forma).resize((max(1, round(L['w'] * esc)), max(1, round(L['h'] * esc))), Image.LANCZOS)
    bcx, bcy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    mx, my = (caja[0] + caja[2]) / 2, (caja[1] + caja[3]) / 2
    im.alpha_composite(li, (round(mx + (L['x'] - bcx) * esc), round(my + (L['y'] - bcy) * esc)))


def capa(nombre):
    return img(f'{INV}/capas/{nombre}.webp')


PANTALON = plan.get('pantalon')


@lru_cache(None)
def cuerpo_img(cuerpo):
    base = img(f'{INV}/cuerpos/{cuerpo}.webp').copy()
    if PANTALON == 'gris':
        import numpy as np
        a = np.asarray(base).astype(np.float32)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        azul = (b > r + 25) & (b > g + 5)
        lum = 0.3 * r + 0.59 * g + 0.11 * b
        gris = np.clip(lum * 0.95 + 28, 0, 255)
        for k in range(3):
            a[..., k] = np.where(azul, gris + (k - 1) * 2, a[..., k])
        base = Image.fromarray(a.astype('uint8'), 'RGBA')
    return base


@lru_cache(None)
def cadera(cuerpo):
    """Fila donde se apoya en el asiento (arriba del pantalón o de la manta), desde los pies."""
    import numpy as np
    a = np.asarray(img(f'{INV}/cuerpos/{cuerpo}.webp')).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = (al > 200) & (((b > r + 25) & (b > g + 5)) | ((r > 150) & (g < 90) & (b < 90)))
    filas = np.nonzero(m.sum(1) > a.shape[1] * 0.12)[0]
    return int(filas.min()) if len(filas) else int(a.shape[0] * 0.55)


@lru_cache(None)
def apoyo(cuerpo):
    """Fila más baja donde el cuerpo es ancho (para tumbados: lo que descansa en el cojín, no una mano que cuelga)."""
    import numpy as np
    a = np.asarray(img(f'{INV}/cuerpos/{cuerpo}.webp'))[..., 3] > 128
    filas = np.nonzero(a.sum(1) > a.shape[1] * 0.6)[0]
    return int(filas.max()) if len(filas) else a.shape[0]


def personaje(cuerpo, capas, alto, espejo):
    return _personaje(cuerpo, capas, int(round(alto)), espejo)


@lru_cache(None)
def _personaje(cuerpo, capas, alto, espejo):
    """Cuerpo del inventario con sus capas, escalado a `alto` px. Devuelve imagen y punto de los pies."""
    c = M['cuerpos'][cuerpo]
    base = cuerpo_img(cuerpo)
    cx, cy, r = c['cabeza']
    pad = int(r * 1.6)
    lienzo = Image.new('RGBA', (base.width + 2 * pad, base.height + 2 * pad), (0, 0, 0, 0))
    lienzo.paste(base, (pad, pad))
    hay_boca = any(k and M['capas'][k]['tipo'] == 'boca' for k in capas)
    bk = c.get('boca')
    if hay_boca and not bk:
        capas = tuple(k for k in capas if not k or M['capas'][k]['tipo'] != 'boca')  # boca tapada
        hay_boca = False
    dx = dy = 0.0
    if hay_boca:
        # se borra la raya de la boca dibujada (con un poco de margen) antes de pegar la nueva
        m = r * 0.05
        col = tuple(c.get('colorCabeza') or (221, 60, 190)) + (255,)
        ImageDraw.Draw(lienzo).rounded_rectangle(
            (pad + bk[0] - m, pad + bk[1] - m, pad + bk[2] + m, pad + bk[3] + m), radius=m * 1.5, fill=col)
        bb = M['bocaBase']
        dx = (bk[0] + bk[2]) / 2 - (cx + (bb[0] + bb[2]) / 2 * r)
        dy = (bk[1] + bk[3]) / 2 - (cy + (bb[1] + bb[3]) / 2 * r)
    for k in capas:
        if not k:
            continue
        L = M['capas'][k]
        if c['sinCara'] and L['tipo'] != 'boca':
            continue
        ox, oy = (dx, dy) if L['tipo'] == 'boca' else (0, 0)
        li = capa(k).resize((max(1, round(L['w'] * r)), max(1, round(L['h'] * r))), Image.LANCZOS)
        lienzo.alpha_composite(li, (round(pad + cx + L['x'] * r + ox), round(pad + cy + L['y'] * r + oy)))
    s = alto / c['h']
    im = lienzo.resize((max(1, round(lienzo.width * s)), max(1, round(lienzo.height * s))), Image.LANCZOS)
    if espejo:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    pie_x = (pad + c['w'] / 2) * s
    if espejo:
        pie_x = im.width - pie_x
    return im, pie_x, (pad + c['h']) * s


def vocales(texto):
    t = unicodedata.normalize('NFD', texto.lower())
    return [ch for ch in t if ch in 'aeiou']


def boca_en(t):
    """Forma de boca al hablar en el instante t (None = cerrada)."""
    for w in palabras:
        if w['inicio'] - 0.02 <= t < w['fin']:
            vs = vocales(w['texto']) or ['a']
            d = (w['fin'] - w['inicio']) / len(vs)
            i = min(int((t - w['inicio']) / d), len(vs) - 1)
            fr = (t - w['inicio'] - i * d) / d
            if fr > 0.7 and d > 0.12:
                return None
            v = vs[i]
            return {'a': 'b_habla_e', 'e': 'b_habla_a', 'i': 'b_habla_a', 'o': 'b_o', 'u': 'b_o'}[v]
    return None


random.seed(3)
PARPADEOS = []
t = 1.2
while t < DUR:
    PARPADEOS.append(t)
    t += random.uniform(2.8, 4.6)


def parpadea(t):
    return any(p <= t < p + 0.12 for p in PARPADEOS)


FUENTE = os.path.join(AQUI, 'ComingSoon.ttf')
COLORES = {'blanco': (245, 245, 245), 'negro': (25, 25, 25), 'rojo': (214, 40, 40), 'azul': (40, 90, 200), 'verde': (30, 140, 60)}


OCUPADO = []
SITIOS = {}


def choca(a, b, m=30):
    return not (a[2] + m <= b[0] or b[2] + m <= a[0] or a[3] + m <= b[1] or b[3] + m <= a[1])


def sitio_rotulo(r, w, h):
    """Donde pone el rótulo sin tapar al personaje: el sitio pedido si está libre; si no, al lado de la
    cabeza (el lado con más hueco), arriba en las esquinas o abajo. Se decide una vez por rótulo."""
    k = id(r)
    if r.get('fijo'):
        return (r['x'] - (w / 2 if r.get('centro') else 0), r['y'])
    if k in SITIOS:
        return SITIOS[k]
    x = r['x'] - (w / 2 if r.get('centro') else 0)
    cands = [(x, r['y'])]
    for o in OCUPADO:
        cy = o[1] + (o[3] - o[1]) * 0.15
        hueco_izq, hueco_der = o[0], W - o[2]
        lados = [(o[2] + 50, cy), (o[0] - 50 - w, cy)]
        if hueco_izq > hueco_der:
            lados.reverse()
        cands += lados + [(o[2] + 50, cy + h * 1.3), (o[0] - 50 - w, cy + h * 1.3)]
    cands += [(60, 60), (W - 60 - w, 60), (W / 2 - w / 2, 50), (60, H - 60 - h), (W - 60 - w, H - 60 - h)]
    elegido = cands[0]
    for cx, cy in cands:
        rect = (cx, cy, cx + w, cy + h)
        if cx < 30 or cy < 20 or cx + w > W - 30 or cy + h > H - 20:
            continue
        if any(choca(rect, o) for o in OCUPADO):
            continue
        elegido = (cx, cy)
        break
    SITIOS[k] = elegido
    return elegido


def rotulo(d, r, t):
    """Texto a mano escribiéndose letra a letra, cada letra algo torcida."""
    texto = r['texto']
    n = min(len(texto), int((t - r['t0']) / 0.045) + 1)
    tam = r.get('tam', 110)
    f = ImageFont.truetype(FUENTE, tam)
    col = COLORES.get(r.get('color', 'negro'))
    rnd = random.Random(hash(texto) & 0xffff)
    anchos = [f.getlength(ch) for ch in texto]
    x, y = sitio_rotulo(r, sum(anchos) * 1.04, tam * 1.25)
    OCUPADO.append((x, y, x + sum(anchos) * 1.04, y + tam * 1.25))
    for i, ch in enumerate(texto[:n]):
        dy = rnd.uniform(-6, 6)
        ang = rnd.uniform(-7, 7)
        g = Image.new('RGBA', (int(tam * 1.6), int(tam * 1.6)), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        gd.text((tam * 0.3, tam * 0.1), ch, font=f, fill=col + (255,), stroke_width=max(2, tam // 22), stroke_fill=col + (255,))
        g = g.rotate(ang, resample=Image.BICUBIC)
        d.alpha_composite(g, (int(x - tam * 0.3), int(y + dy - tam * 0.1)))
        x += anchos[i] * 1.04


def estado(plano, t):
    """Postura, ojos y extras vigentes en t dentro del plano."""
    ev = {'cuerpo': None, 'ojos': '', 'boca': '', 'extras': []}
    for e in plano.get('eventos', []):
        if e['t'] <= t:
            for k in ('cuerpo', 'ojos', 'boca', 'extras', 'x', 'alto', 'espejo'):
                if k in e:
                    ev[k] = e[k]
    return ev


def frame(t):
    OCUPADO.clear()
    plano = [p for p in plan['planos'] if p['t0'] <= t][-1]
    z = plano.get('zoom', 1)
    nombre = plano['fondo']
    for cmb in plano.get('cambios', []):
        if cmb['t'] <= t:
            nombre = cmb['fondo']
    alt = plano.get('alterna')
    if alt and t >= alt.get('desde', 0) and t < alt.get('hasta', 999):
        # dibujos alternos a golpes (animación limitada), con un ritmo algo irregular
        k = int((t - plano['t0']) / alt['cada'])
        rnd = random.Random(k * 7919 + int(plano['t0'] * 100))
        seq = alt['imgs']
        nombre = seq[k % len(seq)] if not alt.get('azar') else seq[rnd.randrange(len(seq))]
    if plano.get('parpadeo') and parpadea(t + plano['t0'] * 0.37):
        nombre = plano['parpadeo']
    im = fondo(nombre, z, plano.get('cx', 0.5), plano.get('cy', 0.5)).convert('RGBA')
    for o in plano.get('objetos', []):
        if o['t0'] <= t < o.get('t1', 99) and o.get('detras'):
            pegar_objeto(im, o, t)
    ev = estado(plano, t)
    if not ev['cuerpo'] and plano.get('habla', True):
        forma = boca_en(t)
        if forma:
            boca_en_escena(im, nombre, z, plano.get('cx', 0.5), plano.get('cy', 0.5), forma)
    if ev['cuerpo']:
        capas = []
        ojos = ev['ojos']
        if parpadea(t) and ojos in ('', 'o_frente', 'o_mira_lado', 'o_mira_abajo', 'o_mira_arriba'):
            ojos = 'o_cerrados'
        capas.append(ojos)
        b = boca_en(t) if plano.get('habla', True) else None
        capas.append(b or ev['boca'])
        capas += ev['extras']
        c = M['cuerpos'][ev['cuerpo']]
        pie = plano.get('pie', 1000)
        if c['tipo'] == 'tumbado' and 'asiento' in plano:
            # tumbado en el sofá: apoyado en el cojín, con el largo pedido
            alto = plano.get('largo', 1000) * c['h'] / c['w']
            pie = plano['asiento'] + 15 + (c['h'] - apoyo(ev['cuerpo'])) * alto / c['h']
        elif c['tipo'] == 'sentado' and 'asiento' in plano:
            # la cadera en el asiento y los pies en el suelo: de ahí sale el tamaño
            alto = (pie - plano['asiento']) * c['h'] / (c['h'] - cadera(ev['cuerpo']))
        else:
            alto = ev.get('alto', plano.get('alto', 800))
        x0 = min(max(plano.get('cx', 0.5) * W - W / (2 * z), 0), W - W / z)
        y0 = min(max(plano.get('cy', 0.5) * H - H / (2 * z), 0), H - H / z)
        alto *= z
        p, px, py = personaje(ev['cuerpo'], tuple(capas), alto, bool(ev.get('espejo')))
        x = (ev.get('x', plano.get('x', 0.5)) * W - x0) * z
        y = (pie - y0) * z
        if plano.get('sombra', True) and c['tipo'] != 'tumbado':
            sw = int(alto * 0.42)
            sh = Image.new('RGBA', (sw, int(sw * 0.16)), (0, 0, 0, 0))
            ImageDraw.Draw(sh).ellipse((0, 0, sw - 1, sh.height - 1), fill=(0, 0, 0, 55))
            from PIL import ImageFilter
            sh = sh.filter(ImageFilter.GaussianBlur(sw * 0.03))
            im.alpha_composite(sh, (int(x - sw / 2), int(y - sh.height * 0.55)))
        im.alpha_composite(p, (int(x - px), int(y - py)))
        bb = p.getchannel('A').getbbox()
        if bb:
            OCUPADO.append((int(x - px) + bb[0], int(y - py) + bb[1], int(x - px) + bb[2], int(y - py) + bb[3]))
    for o in plano.get('objetos', []):
        if o['t0'] <= t < o.get('t1', 99) and not o.get('detras'):
            pegar_objeto(im, o, t)
    for r in plano.get('rotulos', []):
        if r['t0'] <= t < r.get('t1', 99):
            rotulo(im, r, t)
    return im.convert('RGB')


def pegar_objeto(im, o, t):
    ob = img(o['img'])
    w = o['w']
    k = min(1, (t - o['t0']) / 0.12)
    s = (0.6 + 0.4 * k) if o.get('pop', True) else 1
    ob = ob.resize((max(1, int(w * s)), max(1, int(ob.height * w / ob.width * s))), Image.LANCZOS)
    im.alpha_composite(ob, (int(o['x'] - ob.width / 2), int(o['y'] - ob.height / 2)))


if SOLO:
    for t in SOLO:
        frame(t).save(os.path.join(os.path.dirname(OUT) or '.', 'f_%05.2f.jpg' % t), quality=88)
    sys.exit()

n = int(DUR * FPS)
cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
       '-i', '-', '-i', os.path.join(BASE, plan['audio']), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT]
pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for i in range(n):
    try:
        pr.stdin.write(frame(i / FPS).tobytes())
    except BrokenPipeError:
        break
    if i % 100 == 0:
        print(i, '/', n, flush=True)
try:
    pr.stdin.close()
except BrokenPipeError:
    pass
pr.wait()
print('listo', OUT)
