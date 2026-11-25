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
def alt(a, b_, cada): return {'imgs': [I + a + '.jpg', I + b_ + '.jpg'], 'cada': cada}


def R(t0, txt, x, y, col='negro', tam=110, t1=None, caja=True):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


def ana(**m):
    return {'ANA': m}


P = [
    # «Soy nutricionista. Y mi trabajo no es hacer dietas, es jugar al Tetris.»
    esc('es_tetris', 0, ana(es_tetris='es_tetris_ana', es_dieta='es_tetris_ana'), cambios=[ch(T('hacer') - c, 'es_dieta')]),
    # «Lunes, nueve menos tres minutos. Me escribe la paciente de las nueve:»
    esc('es_reloj', T('lunes') - c, ana(es_reloj='es_reloj_ana', es_reloj_b='es_reloj_ana'), cambios=[ch(T('escribe') - c, 'es_reloj_b')],
        rotulos=[R(T('lunes') - b, 'LUNES', 540, 300, 'rojo', 120, T('menos') - b - 0.02),
                 R(T('menos') - b, '8:57', 540, 300, 'negro', 130)]),
    # «Hola, no puedo ir, me ha surgido algo.» (ella, en pijama con el mando)
    esc('br_p9', T('hola') - c, {'P9': {'br_p9': 'br_p9_p9', 'br_p9_b': 'br_p9_p9'}}, alterna=alt('br_p9', 'br_p9_b', 0.3)),
    # «A los diez minutos sube una story jugando al GTA. Está haciendo un alunizaje.»
    esc('br_story', Tt('a', T('algo')) - c, zoom=1.2, cx=0.49, cy=0.52, sub_y=1560, rotulos=[R(Tt('a', T('algo')) - b, '10 MiN DESPUÉS', 540, 230, 'rojo', 90, T('sube') + 0.6)]),
    # «Así que paso a la de las diez a las nueve.»
    esc('es_mueve', T('así') - c, ana(es_mueve='es_tetris_ana'), rotulos=[R(T('diez', 1) - b, 'LA DE LAS 10, A LAS 9', 540, 300, 'azul', 80)]),
    # «Me dice que sí, perfecto, genial.»
    esc('br_p10', Tt('me', T('así')) - c, ana(br_p10='br_p10_x'), alterna=alt('br_p10', 'br_p10_b', 0.45)),
    # «Paso al de las once a las diez.»
    esc('es_mueve', Tt('y', T('genial')) - c, ana(es_mueve='es_tetris_ana'), rotulos=[R(T('once') - b, 'EL DE LAS 11, A LAS 10', 540, 300, 'azul', 78)]),
    # «No contesta.»
    esc('es_espera', Tt('no', T('once')) - c, ana(es_espera='es_espera_ana')),
    # «Contesta los mensajes como se come la verdura. Nunca.»
    esc('br_verdura', Tt('contesta', Tt('no', T('once')) + 0.3) - c, alterna=alt('br_verdura', 'br_verdura_b', 0.35)),
    # «Y la de las diez… llega a las diez.» (el remate de la de las diez, al final del lío)
    esc('es_llega2', Tt('y', T('nunca')) - c, ana(es_llega2='es_llega_ana'), rotulos=[R(Tt('diez', Tt('llega', T('nunca'))) - b, '10:00', 540, 300, 'rojo', 130)]),
    # «Luego, el de las doce: ¿La podemos hacer online? Claro.»
    esc('es_portatil', T('luego') - c, ana(es_portatil='es_portatil_ana'), rotulos=[R(T('doce') - b, '12:00', 540, 300, 'negro', 120, T('claro') - 0.05)]),
    # «Se conecta desde el coche, en un semáforo, con medio cruasán en la mano. Le pregunto… y me enseña el cruasán.»
    esc('br_coche', Tt('se', T('claro')) - c, zoom=1.2, cx=0.498, cy=0.507, alterna=dict(alt('br_coche', 'br_coche_c', 0.6), hasta=T('pregunto') - c)),
    esc('br_coche_b', T('enseña') - c, zoom=1.2, cx=0.498, cy=0.507),
    # «Por lo menos es sincero.»
    esc('es_sincero', Tt('por', T('enseña')) - c, ana(es_sincero='es_portatil_ana')),
    # «La de la una cancela porque esta semana no ha hecho bien la dieta y le da vergüenza venir.»
    esc('br_verguenza', Tt('la', T('sincero')) - c, zoom=1.15, cy=0.45, alterna=alt('br_verguenza', 'br_verguenza_c', 0.7), rotulos=[R(Tt('una', T('sincero')) - b, '13:00', 540, 300, 'negro', 120, T('cancela') + 0.8)]),
    # «O sea, que no viene a la nutricionista porque come mal.»
    esc('es_incredula', Tt('o', T('vergüenza')) - c, ana(es_incredula='es_final_ana')),
    # «Es como no llamar al fontanero porque se te sale el agua.»
    esc('br_fontanero', Tt('es', T('mal')) - c, sub_y=1560, alterna=alt('br_fontanero', 'br_fontanero_b', 0.25)),
    # «Y luego están los de los huecos: ¿Tienes algo por la tarde? Pero no muy tarde. O por la mañana… Y que no sea martes.»
    esc('br_huecos', Tt('y', T('agua')) - c, {'HUECOS': {'br_huecos': 'br_huecos_h', 'br_huecos_b': 'br_huecos_h', 'br_huecos_d': 'br_huecos_h'}},
        cambios=[ch(Tt('o', T('pero')) - c, 'br_huecos_b'), ch(Tt('y', T('pronto')) - c, 'br_huecos_d')],
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
    esc('br_verguenza_b', T('final') - 0.3, hablan=ana(br_verguenza_b='br_verguenza_b_x'), alterna=alt('br_verguenza_b', 'br_verguenza_b2', 0.6), rotulos=[R(T('dentro') - b, 'DENTRO DE 2 SEMANAS', 540, 300, 'azul', 85)]),
    # «Así le da tiempo a hacer la dieta antes de venir.»
    esc('es_final', Tt('así', T('dentro')) - c, ana(es_final='es_final_ana')),
]
# br_verguenza_b empieza en «Al»
P[-2]['t0'] = Tt('al', T('comía')) - c

# golpes de cámara (copian el plano sin sus rótulos): (instante, zoom, centro, vuelta o None)
GOLPES = [(T('alunizaje') - c, 1.45, (0.52, 0.42), None),                 # el coche entrando en la tienda
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
# «es jugar al Tetris»: Ana con el mando delante del juego; en «Tetris», la pantalla de cerca y cae una pieza
nuevos.append(esc('es_juego', T('jugar') - 0.12, sub_y=800))
z, cx, cy = 1.3, 0.47, 0.39
tz = T('tetris') - c
gz = esc('es_juego', tz, zoom=z, cx=cx, cy=cy, sub_y=800)
gz['objetos'] = [{'img': I + 'bloque_T.png', 'x': 569, 'y': 600, 'w': 80, 't0': tz + 0.05, 'cae': 0.45, 'y0': 300, 'pop': False}]
nuevos.append(gz)
tg = {round(g['t0'], 3) for g in nuevos}
P = sorted([p for p in P if round(p['t0'], 3) not in tg] + nuevos, key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.2
json.dump({'alineacion': 'voz/nt.json', 'audio': 'voz/nt.mp3', 'sin_recolor': ['es_', 'br_'], 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 76, 'cola': 0.15,
                          'colores': {'P9': [255, 160, 210], 'P12': [120, 230, 255], 'HUECOS': [255, 226, 40]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))

EF = [[T('jugar') - 0.12, 'whoosh2', -14], [T('es', 1) - 0.1, 'tetris', -7, 2.6], [T('así') - 0.05, 'tetris', -10, 1.9], [Tt('y', T('genial')) - 0.05, 'tetris', -10, 1.9], [T('tetris') + 0.45, 'bloque', -10], [T('lunes') - 0.15, 'whoosh', -12], [T('lunes') + 0.2, 'tictac', -14, 1.6],
      [T('escribe'), 'notificacion', -10], [T('hola') - 0.15, 'whoosh2', -13], [Tt('a', T('algo')) - 0.15, 'whoosh', -12],
      [T('alunizaje'), 'cristales', -10, 1.2], [T('así') - 0.15, 'whoosh2', -13], [T('nueve', 2), 'bloque', -10],
      [Tt('y', T('nunca')) - 0.15, 'whoosh', -13], [Tt('llega', T('nunca')), 'puerta', -11, 0.8], [T('once'), 'bloque', -10],
      [Tt('no', T('once')) + 0.4, 'grillos', -13, 1.4], [T('nunca'), 'ding', -12], [T('luego') - 0.15, 'whoosh2', -13],
      [T('coche'), 'bocina', -13], [T('sincero'), 'ding', -12], [Tt('la', T('sincero')) - 0.15, 'whoosh', -12],
      [Tt('es', T('mal')) - 0.05, 'agua', -12, round(Tt('y', T('agua')) - Tt('es', T('mal')), 2)], [Tt('y', T('agua')) - 0.15, 'whoosh2', -13], [T('martes') + 0.1, 'pop', -12],
      [Tt('le', T('martes')) - 0.15, 'whoosh', -12], [T('final') - 0.15, 'whoosh2', -13], [T('venir', 1) + 0.4, 'ding', -12]]
# ritmo: un golpe de aire en cada corte que no tenga ya un efecto cerca, y un «pop» en cada rótulo
cortes = sorted({round(p['t0'], 2) for p in P if p['t0'] > 0.5})
for k, t in enumerate(cortes):
    if not any(abs(e[0] - t) < 0.35 for e in EF):
        EF.append([t - 0.12, 'whoosh' if k % 2 else 'whoosh2', -15])
for p in P:
    for r in p.get('rotulos', []):
        if not any(abs(e[0] - r['t0']) < 0.2 for e in EF):
            EF.append([r['t0'], 'pop', -15])
# base de 8 bits de fondo todo el vídeo, que se calla mientras suena la melodía del Tetris
mel = sorted((e[0], e[0] + e[3]) for e in EF if e[1] == 'tetris')
t = 0.0
for a0, a1 in mel + [(FIN, FIN)]:
    if a0 - t > 0.5:
        EF.append([t, 'fondo', -13, round(a0 - t + 0.25, 2)])
    t = a1 - 0.1
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in sorted(EF)]}, open('efectos/efectos.json', 'w'))
