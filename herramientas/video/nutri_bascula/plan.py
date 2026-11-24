"""Plan del vídeo vertical «la báscula» (Ana Cardo). Montar con herramientas/shorts/montar_vertical.py.
Tiempos sacados de la voz (T('palabra', n) = inicio de la n-ésima aparición). Escribe también efectos/efectos.json."""
import copy, json, os
import numpy as np
from PIL import Image
I = 'img/'
PAL = [w for w in json.load(open('voz/nb.json'))['palabras'] if w['tipo'] == 'word']


def T(palabra, n=0):
    lim = lambda x: x.strip('¿?¡!.,;:«»"').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


c = 0.06


def Tt(palabra, desde):
    """primera aparición de la palabra a partir del segundo «desde» (más seguro que contar apariciones)"""
    lim = lambda x: x.strip('¿?¡!.,;:«»"').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra) and p['inicio'] >= desde][0]
b = 0.1


def boca(x):
    while not os.path.exists(I + x + '_boca.png') and '_' in x[3:]:
        x = x.rsplit('_', 1)[0]
    return I + x + '_boca.png'


def esc(n, t0, bocas=None, hablan=None, **k):
    """hablan = {QUIEN: {dibujo: capa de boca}}: cada boca se abre solo cuando habla ese personaje"""
    bocas = bocas if bocas is not None else [n]
    if hablan:
        bocas, k['hablan'] = [], {q: {I + d + '.jpg': [I + c + '_boca.png'] for d, c in m.items()} for q, m in hablan.items()}
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5,
         'bocas': {I + x + '.jpg': [boca(x)] for x in bocas}, 'habla': bool(bocas)}
    d.update(k)
    if hablan:
        d['habla'] = True
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b_, cada): return {'imgs': [I + a + '.jpg', I + b_ + '.jpg'], 'cada': cada}


def R(t0, txt, x, y, col='negro', tam=120, t1=None, caja=True):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


def DIA(t0, txt, t1):
    return R(t0, txt, 540, 300, 'rojo', 120, t1)


def Rr(t0, txt, cx, cy, tam=36, t1=None):
    """texto dentro de una tarjeta de reseña (sin caja)"""
    return R(t0, txt, cx, cy - 0.62 * tam, 'negro', tam, t1, caja=False)


P = [
    # «Hace un mes decidí quitar la báscula de la consulta.»: se la lleva andando
    esc('es_saca', 0, ['es_saca', 'es_saca_b'], alterna=alt('es_saca', 'es_saca_b', 0.3)),
    # «Así que la guardé en el armario de la limpieza. Al lado de la fregona.»: cierra la puerta en «fregona»
    esc('br_armario', T('así') - c, [], zoom=1.27, cy=0.49, cambios=[ch(T('fregona') + 0.2, 'br_armario_b')]),
    # «Primera paciente del lunes. Entra y se quita los zapatos, el reloj y los pendientes.»
    esc('es_zapatos', T('primera') - c, hablan={'ANA': {'es_zapatos': 'es_zapatos_ana', 'es_zapatos_b': 'es_zapatos_ana'}}, cambios=[ch(T('pendientes') - c, 'es_zapatos_b')],
        rotulos=[DIA(T('lunes') - b, 'LUNES', T('entra') + 0.6)]),
    # «Y se queda mirando el hueco donde estaba la báscula, como quien busca el coche en el parking. ¿Y la báscula?»
    esc('es_hueco_c', Tt('y', 11.5) - c, hablan={'ANA': {'es_hueco_c': 'es_hueco_ana'}, 'PACIENTE': {'es_hueco_c': 'es_hueco_pac'}}),
    # «Le digo que ya no pesamos. Que vamos a hablar de cómo come, de cómo duerme, de cómo se siente.»
    esc('es_habla', T('le') - c, ['es_habla']),
    # «Vale, me dice. Pero ¿cuánto peso?»: la paciente se echa encima de la mesa
    esc('es_habla_bc', T('vale') - c, hablan={'ANA': {'es_habla_bc': 'es_habla'}, 'PACIENTE': {'es_habla_bc': 'es_habla_bc'}}),
    # «Cincuenta minutos de consulta. Cuarenta y ocho preguntándome cuánto pesa.»: Ana derrotada
    esc('es_cuanto', T('cincuenta') - c, hablan={'ANA': {'es_cuanto': 'es_cuanto_ana'}}, cambios=[ch(T('cuarenta') - c, 'es_cuanto_b')],
        rotulos=[R(T('cincuenta') - b, '50 MiN', 540, 300, 'negro', 110, T('cuarenta') - 0.05),
                 R(T('cuarenta') - b, '48 PREGUNTANDO', 540, 300, 'rojo', 95)]),
    # «El martes viene otro en ayunas… en noviembre. Para pesarse.»
    esc('es_martes', Tt('el', 30.5) - c, hablan={'ANA': {'es_martes': 'es_martes_ana', 'es_martes_b': 'es_martes_ana'}}, alterna=alt('es_martes', 'es_martes_b', 0.12),
        rotulos=[DIA(T('martes') - b, 'MARTES', T('sin') - 0.05), R(T('noviembre') - b, 'NOViEMBRE', 540, 300, 'azul', 110, T('para') - 0.05)]),
    # «El miércoles una señora se trae la báscula de su casa. En una bolsa del Mercadona.»
    esc('es_miercoles', Tt('el', 38) - c, cambios=[ch(T('sube') - c, 'es_miercoles_bc')],
        hablan={'ANA': {'es_miercoles': 'es_miercoles_ana', 'es_miercoles_bc': 'es_miercoles_ana'}, 'SENORA': {'es_miercoles_bc': 'es_miercoles_bc'}},
        rotulos=[DIA(T('miércoles') - b, 'MiÉRCOLES', Tt('en', 40.5) - 0.05)]),
    # «El jueves tengo tres reseñas en Google. Una estrella. «La nutricionista no pesa».»
    esc('br_resenas', Tt('el', 47.5) - c, [], rotulos=[DIA(T('jueves') - b, 'JUEVES', Tt('una', 49.8) - 0.05),
        R(Tt('la', 50.8) - b, '«LA NUTRiCiONiSTA', 540, 1450, 'negro', 82), R(Tt('la', 50.8) - b, 'NO PESA»', 540, 1560, 'negro', 82)]),
    # «Como un fontanero sin llave inglesa.»
    esc('br_fontanero', T('como', 1) - c, [], zoom=1.06, cy=0.48, alterna=alt('br_fontanero', 'br_fontanero_b', 0.2)),
    # «Y otra: «Muy maja, pero no sé si he adelgazado».»: vuelve a las reseñas
    esc('br_resenas', Tt('y', 54.8) - c, [], rotulos=[R(T('muy') - b, '«MUY MAJA, PERO', 540, 1400, 'negro', 72),
        R(T('muy') - b, 'NO SÉ Si HE', 540, 1500, 'negro', 72), R(T('muy') - b, 'ADELGAZADO»', 540, 1600, 'negro', 72)]),
    # «Esa era justo la idea.»
    esc('es_orgullosa', T('esa') - c),
    # «El viernes me llama mi abuela. Que me ha visto en un vídeo en Instagram y me dice: «Hija, te veo más delgada…»»
    esc('br_abuela', Tt('el', 59.5) - c, [], rotulos=[DIA(T('viernes') - b, 'ViERNES', Tt('que', 61.3) - 0.05)]),
    esc('br_abuela', T('hija') - c, hablan={'ABUELA': {'br_abuela': 'br_abuela'}}),
    # «No lo sé, abuela, no me peso.»
    esc('es_tel', Tt('no', 69.2) - c),
    # «Pues pésate, que para eso eres nutricionista.»: la abuela, mandona
    esc('br_abuela_c', T('pues') - c, hablan={'ABUELA': {'br_abuela_c': 'br_abuela_c'}}),
    # remate: Ana, sin palabras
    esc('es_tel', PAL[-1]['fin'] + 0.25, []),
]

CARA_FIJA = {'br_fontanero': (0.4, 0.42), 'es_cuanto_b': (0.6, 0.45), 'br_abuela_c': (0.42, 0.42), 'es_hueco_c': (0.48, 0.25)}


def cara(fondo):
    n = os.path.basename(fondo)[:-4]
    if n in CARA_FIJA:
        return CARA_FIJA[n]
    a = np.asarray(Image.open(boca(n)).getchannel('A'))
    ys, xs = np.nonzero(a > 10)
    return xs.mean() / a.shape[1], ys.mean() / a.shape[0] - 0.04


# (instante, zoom, centro o None = la cara, vuelta al plano entero o None)
GOLPES = [(T('hueco') - c, 1.2, (0.58, 0.52), None),                        # el hueco con polvo
          (T('parking') - c, 1.35, None, None), (T('fontanero') - c, 1.25, None, None),
          (T('camiseta') - c, 1.45, (0.6, 0.36), T('noviembre') - c),          # el del martes, tiritando
          (Tt('una', 49.8) - c, 1.5, (0.45, 0.28), Tt('la', 50.8) - c),           # «una estrella»
          (Tt('y', 54.8) - c, 1.5, (0.5, 0.55), T('muy') - c),                  # otra reseña de una estrella
          (T('idea') - c, 1.3, None, None), (T('nutricionista', 1) - c, 1.35, None, None)]
nuevos = []
for t, z, centro, vuelta in GOLPES:
    base = [p for p in P if p['t0'] <= t][-1]
    g = copy.deepcopy(base)
    f = base['fondo']
    for cmb in base.get('cambios', []):
        if cmb['t'] <= t:
            f = cmb['fondo']
    cx, cy = centro or cara(f)
    g.update(t0=t, zoom=z, cx=round(cx, 3), cy=round(cy, 3))
    g.pop('rotulos', None)
    nuevos.append(g)
    if vuelta:
        v = copy.deepcopy(base); v['t0'] = vuelta; nuevos.append(v)
tg = {round(g['t0'], 3) for g in nuevos}
P = sorted([p for p in P if round(p['t0'], 3) not in tg] + nuevos, key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.2
json.dump({'alineacion': 'voz/nb.json', 'audio': 'voz/nb.mp3', 'sin_recolor': ['es_', 'br_'], 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 76, 'cola': 0.15, 'colores': {'PACIENTE': [255, 226, 40], 'SENORA': [120, 230, 255], 'ABUELA': [255, 160, 90]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))

EF = [[T('así') - 0.15, 'whoosh', -12], [T('fregona') + 0.2, 'puerta', -9, 0.8],
      [T('primera') - 0.15, 'whoosh2', -12], [T('zapatos'), 'zapato', -9], [T('pendientes'), 'pop', -12],
      [T('parking') - 0.1, 'whoosh', -15], [Tt('el', 30.5) - 0.15, 'whoosh', -12], [T('noviembre'), 'viento', -10, 1.8],
      [Tt('el', 30.5) + 0.3, 'tirita', -12, 3.0], [Tt('el', 38) - 0.15, 'whoosh2', -12], [T('bolsa'), 'bolsa', -9, 1.2],
      [T('sube'), 'bascula', -9], [Tt('el', 47.5) - 0.15, 'whoosh', -12], [Tt('una', 49.8), 'notificacion', -10],
      [T('como', 1) - 0.15, 'whoosh2', -12], [T('como', 1), 'agua', -10, 1.8], [T('esa'), 'ding', -11],
      [Tt('el', 59.5) - 0.15, 'whoosh', -12], [Tt('el', 59.5) + 0.1, 'telefono', -11, 1.2]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
