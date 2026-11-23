"""Plan del vídeo vertical de la app de ligar (chico rosa narrador). Montar con
herramientas/shorts/montar_vertical.py. Todos los tiempos salen de la voz (T('palabra', n) = inicio de la n-ésima
aparición), así que si se rehace la voz todo se recoloca solo. Escribe también efectos/efectos.json."""
import copy, json, os
import numpy as np
from PIL import Image
I = 'img/'
PAL = [w for w in json.load(open('voz/al.json'))['palabras'] if w['tipo'] == 'word']


def T(palabra, n=0):
    lim = lambda x: x.strip('¿?¡!.,;:').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


c = 0.06


def boca(b):
    while not os.path.exists(I + b + '_boca.png') and '_' in b[3:]:
        b = b.rsplit('_', 1)[0]
    return I + b + '_boca.png'


def esc(n, t0, bocas=None, **k):
    """bocas: dibujos del plano donde él tiene boca (cada uno con la suya o la de su base)"""
    bocas = bocas if bocas is not None else [n]
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5,
         'bocas': {I + b + '.jpg': [boca(b)] for b in bocas}, 'habla': bool(bocas)}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b, cada, desde=0, hasta=999): return {'imgs': [I + a + '.jpg', I + b + '.jpg'], 'cada': cada, 'desde': desde, 'hasta': hasta}


def R(t0, txt, x, y, col='negro', tam=120, t1=None, caja=False):
    """rótulo en coordenadas de PANTALLA (1080x1920); y = parte de arriba del texto"""
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


def Rc(t0, txt, cx, cy, col='negro', tam=120, t1=None, caja=False):
    """rótulo centrado en un hueco del dibujo (centro del hueco en pantalla)"""
    return R(t0, txt, cx, cy - 0.62 * tam, col, tam, t1, caja)


b = 0.1
P = [
    # «Mi hermana dice que ya va siendo hora… me ha instalado una aplicación de ligar. Mientras yo cenaba.»
    # (v1: 7 s en el mismo plano de la cocina, «algo estático») «ya va siendo hora»: ella da golpecitos al reloj
    # (v4: «la intro no me convence»: la hermana alternando cada 0,45 s temblaba) un solo cambio en «conozca a alguien»
    esc('es_cena_reloj', 0, ['es_cena_reloj', 'es_cena_reloj_b'], cambios=[ch(T('conozca') - c, 'es_cena_reloj_b')]),
    # «Así que me ha instalado una aplicación de ligar»: la app instalándose; terminada en «ligar»
    esc('br_instala', T('así') - c, [], zoom=1.05, cambios=[ch(T('ligar') - c, 'br_instala_b')]),
    # «Mientras yo cenaba»: él sorbiendo espaguetis sin enterarse
    esc('es_cena', T('mientras') - c, [], alterna=alt('es_cena', 'es_cena_sorbe', 0.3)),
    # «Primero, seis fotos.»: la app pide seis huecos de foto
    esc('br_seis', T('primero') - c, [], zoom=1.05, rotulos=[R(T('seis') - b, '6 FOTOS', 540, 1580, 'rojo', 120, caja=True)]),
    # «Yo en el móvil tengo tres del DNI y una del ticket del parking.»: la galería
    esc('br_galeria', T('yo', 1) - c, []),
    # «Así que me hace una en el pasillo. 33 intentos.»: posa; el flash
    esc('es_pasillo', T('así', 1) - c, [], alterna=alt('es_pasillo', 'es_pasillo_b', 0.35, desde=T('33') - c),
        rotulos=[R(T('33') - b, '33 iNTENTOS', 540, 300, 'rojo', 110, T('en', 2) - 0.05, caja=True)]),
    # «En la buena salgo con los ojos cerrados. Dice que transmito paz.»: la foto en el móvil de ella
    esc('br_foto', T('en', 2) - c, [], rotulos=[R(T('transmito') - b, 'PAZ', 540, 1580, 'verde', 150, caja=True)]),
    # «En la descripción pongo la verdad. Me acuesto a las 11.»: en la cama escribiendo
    esc('es_cama', T('en', 3) - c, rotulos=[R(T('verdad') - b, 'ME ACUESTO A LAS 11', 540, 1640, 'negro', 85, caja=True)]),
    # «Cero matches en cuatro días.»: telarañas
    esc('es_cero', T('cero') - c, rotulos=[R(T('cero') - b, '0 MATCHES', 540, 330, 'rojo', 110, T('y', 1) - 0.05, caja=True)]),
    # «Y todos los perfiles son el mismo. Un tigre drogado en Tailandia, una montaña…, una boda…»
    esc('br_tigre', T('y', 1) - c, [], cambios=[ch(T('una', 3) - c, 'br_montana'), ch(T('una', 4) - c, 'br_boda')]),
    # «¿De quién es el brazo?»
    esc('es_brazo', T('de', 2) - c),
    # «Decido cambiar de estrategia y deslizo hacia la derecha a todo ser viviente…»
    # (v2: tenía TRES brazos) nuevo dibujo hecho editando es_brazo, que tiene los brazos bien
    esc('es_desliza4', T('decido') - c, ['es_desliza4', 'es_desliza4_b'], alterna=alt('es_desliza4', 'es_desliza4_b', 0.15, desde=T('deslizo') - c), rotulos=[R(T('47') - b, '47 EN 2 SEGUNDOS', 540, 330, 'rojo', 90, caja=True)]),
    # «Y me hace match una. Laura.»
    esc('br_match', T('y', 4) - c, [], rotulos=[R(T('laura') - b, 'LAURA', 540, 1500, 'rojo', 120, caja=True)]),
    # «Le escribo: hola, ¿qué tal? A media tarde me contesta: jajaja.»
    esc('br_chat', T('hola') - c, [], cambios=[ch(T('jajaja') - c, 'br_chat_b')],
        rotulos=[R(T('hola') - b, 'HOLA, ¿QUÉ TAL?', 660, 500, 'negro', 50, caja=False),
                 R(T('jajaja') - b, 'JAJAJA', 465, 740, 'negro', 70, caja=False),
                 R(T('media') - b, '17:42', 540, 1500, 'negro', 110, T('jajaja') - 0.1, caja=True)]),
    # «¿De qué se ríe? Le he dicho hola.»
    esc('es_brazo', T('le', 1) - c),
    # «Quedamos en un bar donde la caña te la ponen en un tarro de mermelada.»: esperando con el tarro
    esc('es_bar', T('quedamos') - c),
    # «Llega 20 minutos tarde, me habla 40 de su ex y a mitad de cita le entra otro match»
    esc('es_bar_b', T('llega') - c, [], cambios=[ch(T('habla') - c, 'es_bar_c'), ch(T('mitad') - c, 'es_bar_d')],
        rotulos=[R(T('20') - b, '+20 MiN', 540, 300, 'rojo', 110, T('habla') - 0.05, caja=True),
                 R(T('40') - b, '40 MiN DE SU EX', 540, 300, 'negro', 95, T('le', 2) - 0.05, caja=True)]),
    # «Nos despedimos sin beso.»: le da la mano y se va
    esc('es_despedida', T('nos') - c, [], cambios=[ch(T('beso') - c, 'es_despedida_b')]),
    # «Esa misma noche, match deshecho.»
    esc('es_deshecho', T('esa') - c, []),
    # «Siete días después, notificación de Instagram. Laura ha empezado a seguirte. Foto nueva…ojos cerrados»
    # (v1: 6 s quieto en la foto) primero la notificación en la pantalla bloqueada, luego la foto
    esc('br_notif', T('siete') - c, [], rotulos=[R(T('siete') - b, '7 DÍAS DESPUÉS', 540, 300, 'negro', 95, T('laura', 1) - 0.05, caja=True),
                                                R(T('laura', 1) - b, 'LAURA TE SiGUE', 540, 1500, 'rojo', 105, caja=True)]),
    esc('br_insta', T('foto') - c, []),
    # «Me ha copiado hasta la paz.»
    esc('es_copia', T('me', 7) - c),
    # «Mi madre me pregunta si estoy conociendo a alguien.»
    esc('br_madre', T('mi', 1) - c, [], alterna=alt('br_madre', 'br_madre_b', 0.22)),
    # «Yo sí, a 47 personas en dos segundos, pero ninguna me ha conocido a mí.»
    esc('es_madre_resp', T('yo', 2) - c, rotulos=[R(T('47', 1) - b, '47', 540, 330, 'rojo', 150, T('pero') - 0.05, caja=True)]),
    # «Me voy a la cama. A las 11, como ponía en mi perfil. Por lo menos en eso no mentí.»
    esc('es_cama', T('me', 10) - c, cambios=[ch(T('por') - c, 'es_cama_b')]),
]

# GOLPES DE ZOOM en los remates: copia del plano acercándose a su cara (centro sacado de su capa de boca)
CARA_FIJA = {'br_foto': (0.52, 0.31), 'br_insta': (0.5, 0.33), 'br_galeria': (0.5, 0.27)}


def cara(fondo):
    n = os.path.basename(fondo)[:-4]
    if n in CARA_FIJA:
        return CARA_FIJA[n]
    a = np.asarray(Image.open(boca(n)).getchannel('A'))
    ys, xs = np.nonzero(a > 10)
    return xs.mean() / a.shape[1], ys.mean() / a.shape[0] - 0.04


GOLPES = [('ticket', 0, 1.5, None, 0), ('brazo', 1, 1.35, None, 0), ('hola', 1, 1.35, None, 0),
          ('paz', 1, 1.35, None, 0), ('mí', 0, 1.3, None, 0), ('mentí', 0, 1.3, None, 0)]
_X = [
          ('ilusión', 0, 1.45, None, 0), ('precipitarse', 0, 1.35, None, 0), ('más', 0, 1.4, None, 0),
          ('siete', 1, 1.3, None, 0), ('razón', 0, 1.4, None, 0)]
nuevos = []
for pal, n, z, vuelta, nv in GOLPES:
    t = T(pal, n) - c
    base = [p for p in P if p['t0'] <= t][-1]
    g = copy.deepcopy(base)
    f = base['fondo']
    for cmb in base.get('cambios', []):
        if cmb['t'] <= t:
            f = cmb['fondo']
    cx, cy = cara(f)
    g.update(t0=t, zoom=z, cx=round(cx, 3), cy=round(cy, 3))
    g.pop('rotulos', None)
    nuevos.append(g)
    if vuelta:
        v = copy.deepcopy(base); v['t0'] = T(vuelta, nv) - c; nuevos.append(v)
P = sorted(P + nuevos, key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.0
json.dump({'alineacion': 'voz/al.json', 'audio': 'voz/al.mp3', 'sin_recolor': ['es_', 'br_'], 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 76, 'cola': 0.15, 'cambiar': {'air fryer': 'air fryer'}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))


EF = [[T('así') - 0.1, 'notificacion', -12], [T('ligar'), 'match', -12, 0.8], [T('primero') - 0.15, 'whoosh2', -13], [T('mientras') - 0.05, 'cuchara', -10, 0.9], [T('yo', 1) - 0.15, 'whoosh', -12], [T('así', 1) - 0.15, 'whoosh2', -12],
      [T('33'), 'camara', -8], [T('33') + 0.7, 'camara', -10], [T('en', 2), 'camara', -8], [T('en', 3), 'tecleo', -11, 1.5],
      [T('cero') + 0.1, 'grillos', -10, 1.7], [T('y', 1) - 0.15, 'whoosh', -12], [T('una', 3) - 0.05, 'pop', -12], [T('una', 4) - 0.05, 'pop', -12],
      [T('deslizo'), 'swipe', -9, 2.3], [T('match') - 0.05, 'match', -8], [T('hola'), 'tecleo', -11, 1.0],
      [T('jajaja') - 0.15, 'notificacion', -9], [T('quedamos') - 0.15, 'whoosh', -12], [T('quedamos'), 'murmullo', -14, 3.0],
      [T('mitad'), 'notificacion', -9], [T('beso') + 0.1, 'pasos', -10, 1.4], [T('deshecho') - 0.05, 'roto', -9, 1.3],
      [T('siete') - 0.15, 'whoosh2', -12], [T('siete') + 0.3, 'notificacion', -9], [T('foto') - 0.15, 'whoosh', -13], [T('47', 1), 'pop', -10]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
