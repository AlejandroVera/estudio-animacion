"""Plan del vídeo vertical «un día de nutricionista» (Ana Cardo). Montar con herramientas/shorts/montar_vertical.py.
Tiempos sacados de la voz (T('palabra', n) = inicio de la n-ésima aparición). Escribe también efectos/efectos.json."""
import copy, json, os
import numpy as np
from PIL import Image
I = 'img/'
PAL = [w for w in json.load(open('voz/nd.json'))['palabras'] if w['tipo'] == 'word']


def T(palabra, n=0):
    lim = lambda x: x.strip('¿?¡!.,;:').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


c = 0.06
b = 0.1


def boca(x):
    while not os.path.exists(I + x + '_boca.png') and '_' in x[3:]:
        x = x.rsplit('_', 1)[0]
    return I + x + '_boca.png'


def esc(n, t0, bocas=None, **k):
    bocas = bocas if bocas is not None else [n]
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5,
         'bocas': {I + x + '.jpg': [boca(x)] for x in bocas}, 'habla': bool(bocas)}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b_, cada): return {'imgs': [I + a + '.jpg', I + b_ + '.jpg'], 'cada': cada}


def R(t0, txt, x, y, col='negro', tam=120, t1=None, caja=True):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


P = [
    # «Soy nutricionista. De las de verdad,»: en su consulta, orgullosa
    esc('es_presenta', 0, rotulos=[R(T('verdad') - b, 'DE VERDAD', 540, 1560, 'verde', 110, T('no') - 0.05)]),
    # «no de las de batidos con código de descuento»: la influencer con su batido
    esc('br_influ', T('no') - c, [], alterna=alt('br_influ', 'br_influ_b', 0.4),
        rotulos=[R(T('código') - b, 'CÓDiGO -10 %', 540, 1600, 'rojo', 100)]),
    # «A las nueve, primera consulta. Mi paciente me pregunta si el pan engorda.»: la barra de pan
    # «Le digo que depende.»: se encoge de hombros; «en TikTok una chica dice que sí»: él le enseña el móvil
    esc('es_consulta1', T('a') - c, ['es_consulta1_c'],
        cambios=[ch(T('pan') - c, 'es_consulta1_b'), ch(T('le') - c, 'es_consulta1_c'), ch(T('tiktok') - c, 'es_consulta1_d')],
        rotulos=[R(T('nueve') - b, '9:00', 540, 1580, 'negro', 120, T('mi') - 0.05)]),
    # «La chica vende batidos. Con códigos de descuento.»: vuelve la influencer
    esc('br_influ', T('la') - c, [], alterna=alt('br_influ', 'br_influ_b', 0.4),
        rotulos=[R(T('códigos') - b, 'CÓDiGO -10 %', 540, 1600, 'rojo', 100)]),
    # «A las diez, otra. Viene con un plan…»
    esc('es_consulta2', T('a', 1) - c, [], rotulos=[R(T('diez') - b, '10:00', 540, 1580, 'negro', 120)]),
    # «…que le ha hecho la inteligencia artificial: sin hidratos, sin fruta y sin alegría.»: el plan tachado
    esc('br_plan', T('plan') - c, [], rotulos=[R(T('sin') - b, 'SiN HiDRATOS', 540, 1640, 'rojo', 100, T('sin', 1) - 0.05),
                                              R(T('sin', 1) - b, 'SiN FRUTA', 540, 1640, 'rojo', 100, T('sin', 2) - 0.05),
                                              R(T('sin', 2) - b, 'SiN ALEGRÍA', 540, 1640, 'rojo', 110)]),
    # «Y me pide que se lo revise. Para no tener que volver.»: le da el papel y se va despidiéndose
    esc('es_consulta2_b', T('y', 2) - c, [], cambios=[ch(T('para') - c, 'es_consulta2_c')]),
    # «Y entre consulta y consulta, el WhatsApp.»: con el móvil, harta
    esc('es_ojos', T('y', 3) - c),
    # «¿Puedo comer pulpo? ¿El kétchup cuenta como verdura? ¿Y si es kétchup de tomate natural?»: los mensajes
    esc('br_whatsapp', T('puedo') - c, [], cambios=[ch(T('el', 2) - c, 'br_whatsapp_b'), ch(T('y', 5) - c, 'br_whatsapp_c')]),
    # «Todo es natural si lo lees con ganas.»
    esc('es_ojos', T('todo') - c),
    # «A las ocho cierro el chiringuito.»: cierra la persiana del chiringuito de la playa
    esc('es_chiringuito', T('a', 2) - c),
    # «A las ocho y media, en casa. Sin fuerzas para cocinar.»: tirada en el sofá
    esc('es_casa', T('a', 3) - c, [], rotulos=[R(T('ocho', 1) - b, '20:30', 540, 300, 'negro', 120, T('sin', 3) - 0.05)]),
    # «Así que croquetas, a la air fryer.»
    esc('es_cocina', T('así') - c),
    # «Y justo me llama mi madre.»
    esc('es_llamada', T('y', 7) - c),
    # «¿Qué has cenado?»: su madre al teléfono
    esc('br_madre', T('qué') - c, zoom=1.15, cx=0.62, cy=0.55),
    # «Croquetas.»: pillada con la croqueta en la mano
    esc('es_llamada', T('croquetas', 1) - c),
    # «Y me dice: ¿y tú eres la nutricionista?»: la madre con la ceja levantada
    esc('br_madre', T('y', 8) - c, ['br_madre'], zoom=1.15, cx=0.62, cy=0.55, cambios=[ch(T('y', 9) - c, 'br_madre_b')]),
    # «Pues sí. La misma que les dice a sus pacientes que para comer bien hacen falta tiempo y descanso. Y yo, de esas
    # dos cosas, no tengo ninguna.»: en el sofá con las croquetas; al final se queda dormida
    esc('es_final', T('pues') - c, cambios=[ch(PAL[-1]['fin'] + 0.3, 'es_final_b')],
        rotulos=[R(T('tiempo') - b, 'TiEMPO Y DESCANSO', 540, 1640, 'verde', 90, T('y', 11) - 0.05)]),
]

CARA_FIJA = {'br_madre_b': (0.73, 0.47)}


def cara(fondo):
    n = os.path.basename(fondo)[:-4]
    if n in CARA_FIJA:
        return CARA_FIJA[n]
    a = np.asarray(Image.open(boca(n)).getchannel('A'))
    ys, xs = np.nonzero(a > 10)
    return xs.mean() / a.shape[1], ys.mean() / a.shape[0] - 0.04


GOLPES = [('depende', 0, 1.35, ('y', 0)), ('ganas', 0, 1.35, None), ('nutricionista', 1, 1.35, None),
          ('pacientes', 0, 1.25, ('tiempo', 0)), ('ninguna', 0, 1.35, None)]
nuevos = []
for pal, n, z, vuelta in GOLPES:
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
        v = copy.deepcopy(base); v['t0'] = T(*vuelta) - c; nuevos.append(v)
P = sorted(P + nuevos, key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.2
json.dump({'alineacion': 'voz/nd.json', 'audio': 'voz/nd.mp3', 'sin_recolor': ['es_', 'br_'], 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 76, 'cola': 0.15},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))

EF = [[T('no') - 0.15, 'whoosh', -12], [T('no') + 0.2, 'batido', -9, 1.0], [T('nueve') - 0.05, 'tictac', -10, 0.9],
      [T('pan'), 'pop', -10], [T('tiktok'), 'notificacion', -12], [T('la') - 0.15, 'whoosh2', -12], [T('la') + 0.2, 'batido', -10, 1.0],
      [T('diez') - 0.05, 'tictac', -10, 0.9], [T('plan') - 0.15, 'whoosh', -12], [T('plan'), 'papel', -9],
      [T('sin'), 'pop', -10], [T('sin', 1), 'pop', -10], [T('sin', 2), 'pop', -9], [T('y', 2), 'papel', -10],
      [T('puedo') - 0.1, 'notificacion', -9], [T('el', 2) - 0.1, 'notificacion', -9], [T('y', 5) - 0.1, 'notificacion', -9],
      [T('a', 2) + 0.1, 'persiana', -10, 1.5], [T('a', 3) + 0.05, 'plof', -8], [T('así') + 0.2, 'croquetas', -9, 1.1],
      [T('y', 7) - 0.1, 'timbre', -10, 1.2], [T('ninguna') + 0.9, 'ronquido', -9, 1.8]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
