"""Plan del vídeo vertical «el Tetris de la agenda» (Ana Cardo). Montar con herramientas/shorts/montar_vertical.py.
Todos los tiempos salen de la voz: T('palabra', n) = n-ésima aparición; Tt('palabra', desde) = primera a partir de un
instante (anclado siempre a otra palabra, nunca a segundos fijos). Escribe también efectos/efectos.json."""
import copy, json, os
I = 'img/'
PAL = [w for w in json.load(open('voz/nt.json'))['palabras'] if w['tipo'] == 'word']
lim = lambda x: x.strip('¿?¡!.,;:«»"').lower()


def T(palabra, n=0):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


def Tt(palabra, desde):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra) and p['inicio'] >= desde][0]


c, b = 0.06, 0.1


def esc(n, t0, hablan=None, **k):
    """hablan = {QUIEN: {dibujo: capa de boca}}: cada boca se abre solo cuando habla ese personaje"""
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5, 'bocas': {}, 'habla': bool(hablan)}
    if hablan:
        d['hablan'] = {q: {I + x + '.jpg': [I + cp + '_boca.png'] for x, cp in m.items()} for q, m in hablan.items()}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}


def R(t0, txt, x, y, col='negro', tam=110, t1=None, caja=True):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


def ana(**m):
    return {'ANA': m}


P = [
    # «Soy nutricionista. Y mi trabajo no es hacer dietas, es jugar al Tetris.»
    esc('es_tetris', 0, ana(es_tetris='es_tetris_ana')),
    # «Lunes, nueve menos tres minutos. Me escribe la paciente de las nueve:»
    esc('es_reloj', T('lunes') - c, ana(es_reloj='es_reloj_ana'),
        rotulos=[R(T('lunes') - b, 'LUNES', 540, 300, 'rojo', 120, T('me') - 0.05),
                 R(T('menos') - b, '8:57', 540, 300, 'negro', 130)]),
    # «Hola, no puedo ir, me ha surgido algo.» (ella, en pijama con el mando)
    esc('br_p9', T('hola') - c, {'P9': {'br_p9': 'br_p9_p9'}}),
    # «A los diez minutos sube una story jugando al GTA. Está haciendo un alunizaje.»
    esc('br_story', Tt('a', T('algo')) - c, zoom=1.2, cx=0.49, cy=0.52, rotulos=[R(Tt('a', T('algo')) - b, '10 MiN DESPUÉS', 540, 230, 'rojo', 90, T('sube') + 0.6)]),
    # «Así que paso a la de las diez a las nueve.»
    esc('es_mueve', T('así') - c, ana(es_mueve='es_tetris_ana'), rotulos=[R(T('diez', 1) - b, 'LA DE LAS 10, A LAS 9', 540, 300, 'azul', 80)]),
    # «Me dice que sí, perfecto, genial.»
    esc('br_p10', Tt('me', T('así')) - c),
    # «Y llega a las diez.»
    esc('es_llega', Tt('y', T('genial')) - c, ana(es_llega='es_llega_ana'), rotulos=[R(Tt('diez', T('genial')) - b, '10:00', 540, 300, 'rojo', 130)]),
    # «Paso al de las once a las diez.»
    esc('es_mueve', Tt('paso', T('llega')) - c, ana(es_mueve='es_tetris_ana'), rotulos=[R(T('once') - b, 'EL DE LAS 11, A LAS 10', 540, 300, 'azul', 78)]),
    # «No contesta.»
    esc('es_espera', Tt('no', T('once')) - c, ana(es_espera='es_espera_ana')),
    # «Contesta los mensajes como se come la verdura. Nunca.»
    esc('br_verdura', Tt('contesta', Tt('no', T('once')) + 0.3) - c),
    # «Luego, el de las doce: ¿La podemos hacer online? Claro.»
    esc('es_portatil', T('luego') - c, ana(es_portatil='es_portatil_ana'), rotulos=[R(T('doce') - b, '12:00', 540, 300, 'negro', 120, T('claro') - 0.05)]),
    # «Se conecta desde el coche, en un semáforo, con medio cruasán en la mano. Le pregunto… y me enseña el cruasán.»
    esc('br_coche', Tt('se', T('claro')) - c, cambios=[ch(T('enseña') - c, 'br_coche_b')]),
    # «Por lo menos es sincero.»
    esc('es_sincero', Tt('por', T('enseña')) - c, ana(es_sincero='es_portatil_ana')),
    # «La de la una cancela porque esta semana no ha hecho bien la dieta y le da vergüenza venir.»
    esc('br_verguenza', Tt('la', T('sincero')) - c, rotulos=[R(Tt('una', T('sincero')) - b, '13:00', 540, 300, 'negro', 120, T('cancela') + 0.8)]),
    # «O sea, que no viene a la nutricionista porque come mal.»
    esc('es_incredula', Tt('o', T('vergüenza')) - c, ana(es_incredula='es_final_ana')),
    # «Es como no llamar al fontanero porque se te sale el agua.»
    esc('br_fontanero', Tt('es', T('mal')) - c, sub_y=1560),
    # «Y luego están los de los huecos: ¿Tienes algo por la tarde? Pero no muy tarde. O por la mañana… Y que no sea martes.»
    esc('br_huecos', Tt('y', T('agua')) - c, {'HUECOS': {'br_huecos': 'br_huecos_h', 'br_huecos_b': 'br_huecos_h'}},
        cambios=[ch(Tt('o', T('pero')) - c, 'br_huecos_b')],
        rotulos=[R(Tt('no', T('pero')) - b, 'NO MUY TARDE', 540, 330, 'rojo', 90),
                 R(Tt('no', T('mañana')) - b, 'NO MUY PRONTO', 540, 470, 'rojo', 90),
                 R(Tt('no', T('pronto')) - b, 'NO MARTES', 540, 610, 'rojo', 90)]),
    # «Le ofrezco lo único que me queda: las dos. Mi hora de comer.»
    esc('es_tupper', Tt('le', T('martes')) - c, ana(es_tupper='es_tupper_ana'),
        rotulos=[R(Tt('dos', T('martes')) - b, '14:00', 540, 300, 'negro', 130, Tt('uy', T('martes')) - 0.05)]),
    # «Uy, a las dos como yo.»
    esc('br_huecos', T('uy') - c, {'HUECOS': {'br_huecos': 'br_huecos_h'}}),
    # «Ya. Yo también comía.»
    esc('es_tupper_b', Tt('ya', T('uy')) - c, ana(es_tupper_b='es_tupper_ana')),
    # «Al final, la de la vergüenza me pide otra cita. Dentro de dos semanas.»
    esc('br_verguenza_b', T('final') - 0.3, rotulos=[R(T('dentro') - b, 'DENTRO DE 2 SEMANAS', 540, 300, 'azul', 85)]),
    # «Así le da tiempo a hacer la dieta antes de venir.»
    esc('es_final', Tt('así', T('dentro')) - c, ana(es_final='es_final_ana')),
]
# br_verguenza_b empieza en «Al»
P[-2]['t0'] = Tt('al', T('comía')) - c

# golpes de cámara (copian el plano sin sus rótulos): (instante, zoom, centro, vuelta o None)
GOLPES = [(T('tetris') - c, 1.45, (0.72, 0.42), None),                    # el planificador hecho Tetris
          (T('alunizaje') - c, 1.6, (0.47, 0.4), None),                 # el coche entrando en la tienda
          (T('nunca') - c, 1.35, (0.5, 0.33), None),                     # «Nunca.»
          (T('cruasán', 1) - c, 1.3, (0.6, 0.45), None),                  # le enseña el cruasán
          (Tt('no', T('pronto')) - c, 1.35, (0.5, 0.58), 'rotulos'),        # «Y que no sea martes»
          (T('comía') - c, 1.3, (0.5, 0.36), None),                       # «Yo también comía»
          (T('venir', 1) - c, 1.3, (0.5, 0.36), None)]                    # remate
nuevos = []
for t, z, (cx, cy), vuelta in GOLPES:
    base = [p for p in P if p['t0'] <= t][-1]
    g = copy.deepcopy(base)
    g.update(t0=t, zoom=z, cx=cx, cy=cy)
    if g.get('cambios'):
        f = g['fondo']
        for cmb in g['cambios']:
            if cmb['t'] <= t:
                f = cmb['fondo']
        g['fondo'], g['cambios'] = f, []
    if vuelta != 'rotulos':
        g.pop('rotulos', None)
    nuevos.append(g)
    if vuelta and vuelta != 'rotulos':
        v = copy.deepcopy(base); v['t0'] = vuelta; nuevos.append(v)
tg = {round(g['t0'], 3) for g in nuevos}
P = sorted([p for p in P if round(p['t0'], 3) not in tg] + nuevos, key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.2
json.dump({'alineacion': 'voz/nt.json', 'audio': 'voz/nt.mp3', 'sin_recolor': ['es_', 'br_'], 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 76, 'cola': 0.15,
                          'colores': {'P9': [255, 160, 210], 'P12': [120, 230, 255], 'HUECOS': [255, 226, 40]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))

EF = [[T('tetris'), 'bloque', -10], [T('lunes') - 0.15, 'whoosh', -12], [T('lunes') + 0.2, 'tictac', -14, 1.6],
      [T('escribe'), 'notificacion', -10], [T('hola') - 0.15, 'whoosh2', -13], [Tt('a', T('algo')) - 0.15, 'whoosh', -12],
      [T('alunizaje'), 'cristales', -10, 1.2], [T('así') - 0.15, 'whoosh2', -13], [T('nueve', 2), 'bloque', -10],
      [Tt('y', T('genial')) - 0.15, 'whoosh', -13], [Tt('y', T('genial')), 'puerta', -11, 0.8], [T('once'), 'bloque', -10],
      [Tt('no', T('once')) + 0.4, 'grillos', -13, 1.4], [T('nunca'), 'ding', -12], [T('luego') - 0.15, 'whoosh2', -13],
      [T('coche'), 'bocina', -13], [T('sincero'), 'ding', -12], [Tt('la', T('sincero')) - 0.15, 'whoosh', -12],
      [T('agua'), 'agua', -11, 1.6], [Tt('y', T('agua')) - 0.15, 'whoosh2', -13], [T('martes') + 0.1, 'pop', -12],
      [Tt('le', T('martes')) - 0.15, 'whoosh', -12], [T('final') - 0.15, 'whoosh2', -13], [T('venir', 1) + 0.4, 'ding', -12]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
