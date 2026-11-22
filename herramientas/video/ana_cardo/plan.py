"""Plan del vídeo de presentación de Ana Cardo (vertical 9:16). Montar con herramientas/shorts/montar_vertical.py.
Los tiempos salen de la voz (T('palabra', n) = inicio de la n-ésima aparición), así que si se rehace la voz, todo
se recoloca solo. Escribe también efectos/efectos.json."""
import json
I = 'img/'
PAL = [w for w in json.load(open('voz/ana.json'))['palabras'] if w['tipo'] == 'word']


def T(palabra, n=0):
    lim = lambda x: x.strip('¿?¡!.,;:').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


c = 0.06   # cortes y cambios un pelín antes de su palabra


def boca(b):
    # un movimiento sin boca propia (la cabeza no cambió) usa la de su dibujo base
    import os
    while not os.path.exists(I + b + '_boca.png') and '_' in b[3:]:
        b = b.rsplit('_', 1)[0]
    return I + b + '_boca.png'


def esc(n, t0, bocas=None, **k):
    """bocas: dibujos del plano donde Ana tiene boca (cada uno con la suya: img/<dibujo>_boca.png)"""
    bocas = bocas if bocas is not None else [n]
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5,
         'bocas': {I + b + '.jpg': [boca(b)] for b in bocas},
         'habla': bool(bocas)}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b, cada, desde=0, hasta=999): return {'imgs': [I + a + '.jpg', I + b + '.jpg'], 'cada': cada, 'desde': desde, 'hasta': hasta}


def R(t0, txt, y=1560, col='negro', tam=120, t1=None):
    d = {'t0': t0, 'texto': txt, 'x': 540, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': True}
    if t1:
        d['t1'] = t1
    return d


P = [
    # «Bueno, soy Ana. Ana Cardo»: con el anacardo; «Sin chiste»: seria; «Nutricionista»: puño, orgullosa
    esc('es_consulta', 0, ['es_consulta', 'es_consulta_b', 'es_consulta_c'],
        cambios=[ch(T('sin') - c, 'es_consulta_b'), ch(T('nutricionista') - c, 'es_consulta_c')],
        rotulos=[R(T('ana', 1) - 0.1, 'ANA CARDO', 1600, 'verde', 120, T('sin') - 0.1)]),
    # «¿Que por qué me hice nutri? Porque en mi casa todo el mundo sabía de nutrición»: la familia opinando
    esc('es_familia', T('porque') - c, []),
    # «Mi madre decía que el huevo sube el colesterol»: el huevo como si fuera peligroso, el dedo moviéndose
    esc('es_madre', T('mi', 1) - c, ['es_madre', 'es_madre_b'], alterna=alt('es_madre', 'es_madre_b', 0.3)),
    # «Mi padre, que el colesterol se lo sube mi madre»
    esc('es_padre', T('mi', 2) - c),
    # «Mi abuela, que yo estaba en los huesos»: le llena el plato
    esc('es_abuela', T('mi', 4) - c, ['es_abuela', 'es_abuela_b'], alterna=alt('es_abuela', 'es_abuela_b', 0.45)),
    # «Y mi tía… solo piña… La cartera»: la cartera vacía
    esc('es_tia', T('y') - c, ['es_tia', 'es_tia_b'], cambios=[ch(T('cartera') - c, 'es_tia_b')]),
    # «Así que pensé: voy a estudiar esto… por fin tendré razón»: puño de triunfo en «por fin»
    esc('es_estudia2', T('así') - c, [], cambios=[ch(T('fin') - 0.25, 'es_estudia2_b')]),   # de lado estudiando (voz en off); se gira en «por fin»
    # «Cuatro años de carrera. Un máster»: el segundo título en «máster»
    esc('es_grad2', T('cuatro') - c, ['es_grad2'], cambios=[ch(T('un') - c, 'es_grad2_b')],
        bocas_fix=True,
        rotulos=[R(T('cuatro') - 0.1, '4 AÑOS', 1620, 'negro', 120, T('un') - 0.1), R(T('un') - 0.1, '+ MÁSTER', 1620, 'rojo', 120)]),
    # «Y en la primera Navidad con el título, mi tío: eso lo dirás tú, pero en la tele…»: el tío insiste
    esc('es_navidad', T('y', 3) - c, alterna=alt('es_navidad', 'es_navidad_b', 0.32, desde=T('tío') - c)),
    # «La tele. Que se ha sacado la carrera en anuncios de yogures»: la tele con birrete
    esc('br_tele', T('tele', 1) - 0.2, [], alterna=alt('br_tele', 'br_tele_b', 0.5)),
    # «Y claro, cuando te dedicas a esto, empiezas a fijarte en cosas»: con la lupa; en «cosas» la baja
    esc('es_lupa2', T('y', 4) - c, ['es_lupa2'], cambios=[ch(T('cosas') - c, 'es_lupa2_b')]),
    # «Como que el yogur cero por ciento tenga más azúcar que un dónut, pero con una vaca sonriendo»
    esc('es_yogur2', T('como') - c, ['es_yogur2', 'es_yogur2_b'], cambios=[ch(T('vaca') - c, 'es_yogur2_b')],
        rotulos=[R(T('cero') - 0.1, '0 %', 1620, 'azul', 150, T('más') - 0.1),
                 R(T('más') - 0.1, 'MÁS AZÚCAR', 1620, 'rojo', 120, T('vaca') - 0.1)]),
    # «O que en el súper lo sano esté abajo y las galletas a la altura de los ojos»: las galletas brillan
    esc('es_cereal', T('o') - c, ['es_cereal'], cambios=[ch(T('galletas') - c, 'es_cereal_b')]),   # pasillo de cereales realista
    # «Pues de eso voy a hablar aquí. De lo que comemos, de lo que nos venden y de lo que nos creemos»
    esc('es_habla', T('pues') - c, ['es_habla', 'es_habla_come', 'es_habla_vende', 'es_habla_cree'],
        cambios=[ch(T('comemos,') - c if False else T('comemos') - c, 'es_habla_come'),
                 ch(T('venden') - c, 'es_habla_vende'), ch(T('creemos') - c, 'es_habla_cree')]),
    # «Así que si estás harto… sígueme. Yo también te lo voy a decir, pero de jajas»: el guiño al final
    esc('es_sigue', T('así', 2) - c, ['es_sigue'], cambios=[ch(T('jajas') - c, 'es_jajas')]),
]

# GOLPES DE ZOOM (ritmo): en el remate de cada frase, corte seco acercándose a la cara de Ana (centro sacado de su
# capa de boca) y vuelta al plano abierto donde haga falta. [palabra, n, zoom, palabra de vuelta (o None), n]
import copy
from PIL import Image as _Im
import numpy as _np


CARA_FIJA = {'es_estudia2_b': (0.64, 0.5)}   # dibujos sin boca: centro de su cara a mano


def cara(fondo):
    import os
    alias = {'es_jajas': 'es_sigue', 'es_habla_come': 'es_habla', 'es_habla_vende': 'es_habla', 'es_habla_cree': 'es_habla'}
    n = os.path.basename(fondo)[:-4]
    n = alias.get(n, n)
    if n in CARA_FIJA:
        return CARA_FIJA[n]
    while not os.path.exists(f'img/{n}_boca.png') and '_' in n[3:]:
        n = n.rsplit('_', 1)[0]
    b = f'img/{n}_boca.png'
    a = _np.asarray(_Im.open(b).getchannel('A'))
    ys, xs = _np.nonzero(a > 10)
    return xs.mean() / a.shape[1], ys.mean() / a.shape[0] - 0.035


GOLPES = [('sin', 0, 1.45, 'porque', 0), ('madre', 1, 1.35, 'mi', 4), ('huesos', 0, 1.35, 'y', 0),
          ('cartera', 0, 1.35, 'así', 0), ('fin', 0, 1.4, 'cuatro', 0), ('tele', 0, 1.4, 'tele', 1),
          ('dónut', 0, 1.35, 'pero', 1), ('ojos', 0, 1.4, 'pues', 0), ('creemos', 0, 1.35, 'así', 2),
          ('sígueme', 0, 1.3, 'yo', 1), ('jajas', 0, 1.45, None, 0)]
nuevos = []
for pal, n, z, vuelta, nv in GOLPES:
    t = T(pal, n) - c
    base = [p for p in P if p['t0'] <= t][-1]
    g = copy.deepcopy(base)
    fondo_actual = base['fondo']
    for cmb in base.get('cambios', []):
        if cmb['t'] <= t:
            fondo_actual = cmb['fondo']
    cx, cy = cara(fondo_actual)
    g.update(t0=t, zoom=z, cx=round(cx, 3), cy=round(cy, 3))
    g.pop('rotulos', None)
    nuevos.append(g)
    if vuelta:
        tv = T(vuelta, nv) - c
        if not any(abs(p['t0'] - tv) < 0.35 for p in P):   # si ahí ya empieza otro plano, no hace falta volver
            v = copy.deepcopy(base); v['t0'] = tv; v.pop('rotulos', None); nuevos.append(v)
P = sorted(P + nuevos, key=lambda p: p['t0'])

for p in P:
    p.pop('bocas_fix', None)
FIN = PAL[-1]['fin'] + 2.0
json.dump({'alineacion': 'voz/ana.json', 'audio': 'voz/ana.mp3', 'sin_recolor': ['es_', 'br_'], 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 76, 'cola': 0.25, 'cambiar': {'cero por ciento': '0 %'}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)

EF = [[T('cardo') - 0.05, 'ding', -8], [T('porque') - 0.2, 'whoosh', -10], [T('mi', 1) - 0.15, 'whoosh2', -11],
      [T('mi', 4) + 0.3, 'plato', -8, 1.2], [T('cartera') + 0.1, 'polilla', -8, 1.2], [T('así') - 0.2, 'whoosh', -10],
      [T('fin') - 0.25, 'pop', -8], [T('cuatro') - 0.1, 'aplauso', -10, 2.2], [T('navidad') - 0.1, 'cascabel', -10, 1.2],
      [T('tele', 1) - 0.1, 'tele', -10, 1.0], [T('y', 4) - 0.2, 'whoosh2', -10], [T('vaca'), 'mu', -6, 1.4],
      [T('galletas') - 0.05, 'brillo', -8], [T('pues') - 0.2, 'whoosh', -10], [T('comemos'), 'pop', -9],
      [T('venden'), 'pop', -9], [T('creemos'), 'pop', -9], [T('jajas') - 0.05, 'ding', -8]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
