"""Plan del sketch vertical «El veterano» (Chico rosa + el veterano en la oficina del DNI). Montar con
herramientas/shorts/montar_vertical.py plan.json salida.mp4. Diálogo: voz/vt.json lleva «quien» en cada palabra y
el montador abre solo la boca del que habla. Todos los tiempos salen de la voz (L[i] = inicio de la frase i)."""
import json, os
I = 'img/'
VOZ = json.load(open('voz/vt.json'))
L = [f['inicio'] for f in VOZ['frases']]
PAL = VOZ['palabras']
lim = lambda x: x.strip('¿?¡!.,;:…«»"').lower()


def T(palabra, n=0):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


def Tt(palabra, desde):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra) and p['inicio'] >= desde][0]


C = I + 'cv_'
VIVAS = {'VETERANO': {'habla': [], 'escucha': [], 'parpadeo': C + 'v_parp.png'},
         'ROSA': {'habla': [], 'escucha': [], 'parpadeo': C + 'r_parp.png'}}


def G(t0, t1, quien, n):
    return {'t0': t0, 't1': t1, 'quien': quien, 'img': C + n + '.png'}


def charla(t0, gestos=(), **k):
    d = {'t0': t0, 'fondo': I + 'es_charla.jpg', 'zoom': 1.04, 'cx': 0.5, 'cy': 0.56,
         'hablan': {'ROSA': {I + 'es_charla.jpg': [C + 'rboca.png']}, 'VETERANO': {I + 'es_charla.jpg': [C + 'vboca.png']}},
         'vivas': VIVAS, 'gestos': list(gestos)}
    d.update(k)
    return d


def esc(n, t0, hablan=None, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5, 'bocas': {}, 'habla': bool(hablan)}
    if hablan:
        d['hablan'] = {q: {I + x + '.jpg': [I + cp + '_boca.png'] for x, cp in m.items()} for q, m in hablan.items()}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}


def R(t0, txt, y=300, col='negro', tam=110, t1=None, caja=True, x=540):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


c = 0.08
P = [
    # MEGAFONÍA «Número A-003, mesa 2… se ha caído el sistema»: el panel de números de cerca
    esc('es_charla', 0, zoom=2.6, cx=0.5, cy=0.193, sub_y=1300,
        rotulos=[R(0.05, 'A-003   MESA 2', 740, 'rojo', 125, T('les') - 0.05, caja=False),
                 R(T('les') - c, 'SiSTEMA CAÍDO', 740, 'rojo', 125, caja=False)]),
    charla(L[1] - c, [G(L[1] - c, L[2] - c, 'ROSA', 'r_palmas'),          # «¿se ha caído el sistema? ¿y ahora qué?»
                      G(L[2] - c, L[3] - c, 'VETERANO', 'v_encoge'),       # «ahora nada… su rato de descanso»
                      G(L[3] - c, L[4] - c, 'ROSA', 'r_ticket'),           # «yo tengo el A-412»
                      G(L[4] - c, L[5] - c, 'VETERANO', 'v_ticket'),       # «yo tengo el B-7»
                      G(L[5] - c, L[6] - c, 'ROSA', 'r_dni'),              # «si solo vengo a renovar el DNI»
                      G(L[6] - c, L[7] - c, 'VETERANO', 'v_dedo')],        # «necesitas el DNI en vigor»
           rotulos=[R(Tt('a', L[3]) - c, 'A-412', 1560, 'negro', 110, L[4] - 0.05),
                    R(Tt('b', L[4]) - c, 'B-7', 1560, 'rojo', 120, L[5] - 0.05)]),
    esc('es_pprosa', L[7] - c, {'ROSA': {'es_pprosa': 'es_pprosa'}}),     # «pero está caducado, por eso lo renuevo»
    charla(L[8] - c, [G(L[8] - c, T('bienvenido') - c, 'VETERANO', 'v_dedo'),   # «necesitas cita… y para la cita, el DNI»
                      G(T('bienvenido') - c, L[9] - c, 'VETERANO', 'v_brazos'),  # «bienvenido»
                      G(L[10] - c, T('jubilación') - c, 'VETERANO', 'v_senala')]),  # «vino a pedir la jubilación»
    esc('es_senora', T('jubilación') - c, cambios=[ch(T('cobra') - c, 'es_senora_b')]),   # «se la concedieron… ya cobra»
    charla(L[11] - c, [G(L[12] - c, L[13] - c, 'VETERANO', 'v_dedo'),   # «para información también hay que coger número»
                       G(L[13] - c, L[14] - c, 'ROSA', 'r_palmas')]),   # «¿y la web?»
    esc('br_web', L[14] - c, rotulos=[R(T('martes') - c, 'MARTES 8:05', 300, 'rojo', 110, T('dura') - 0.05),
                                      R(T('dura') - c, '4 SEGUNDOS', 300, 'rojo', 110, T('como', -1) - 0.05)]),   # la web «como las entradas de un concierto»
    charla(L[15] - c, [G(L[15] - c, L[16] - c, 'ROSA', 'r_cruzado'),     # «pues me espero»
                       G(L[16] - c, L[17] - c, 'VETERANO', 'v_tique')]),  # «saca antes el tique de espera»
    esc('es_paco', L[17] - c, {'SENOR': {'es_paco': 'es_paco'}}),          # «perdona, ¿la mesa 4 atiende?»
    charla(L[18] - c, [G(L[18] - c, T('póster') - c, 'VETERANO', 'v_dedo')]),   # «la mesa cuatro…»: el veterano se lo explica
    esc('es_paco', T('póster') - c, zoom=1.3, cx=0.5, cy=0.42,             # «…es un póster, Paco»: el cartón de cerca
        rotulos=[R(T('desde') - c, 'DESDE 2019', 1560, 'rojo', 110)]),
    charla(L[19] - c),                                                     # «les informamos… »: todos escuchan, sentados
    esc('es_levantan', T('restablecido') - c),                             # «el sistema se ha restablecido…» todos se levantan
    esc('es_oscuro', T('ahora', -1) - c),                                  # «…termina ahora»: se apagan las luces
]
FIN = PAL[-1]['fin'] + 2.2
EF = [[0.0, 'ding', -8], [L[17] - 0.15, 'whoosh2', -12], [T('restablecido') - 0.1, 'ding', -8],
      [T('ahora', -1) + 0.25, 'apagon', -6], [L[7] - 0.14, 'whoosh', -12], [T('jubilación') - 0.15, 'whoosh2', -12],
      [T('cobra'), 'caja', -9], [L[14] - 0.15, 'whoosh', -12], [T('segundos') - 0.1, 'tictac', -10, 1.2],
      [T('póster') - 0.1, 'pop', -10], [0.3, 'sala', -16, round(T('ahora', -1) + 0.2, 2)]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in sorted(EF)]}, open('efectos/efectos.json', 'w'))
json.dump({'alineacion': 'voz/vt.json', 'audio': 'voz/vt.mp3', 'vel_letra': 0.03, 'sin_recolor': ['es_', 'br_'],
           'subtitulos': {'y': 250, 'tam': 88, 'max': 3, 'contorno': 14, 'mayusculas': True, 'cola': 0.2,
                          'colores': {'ROSA': [255, 100, 205], 'VETERANO': [255, 226, 40], 'MEGAFONIA': [140, 220, 255],
                                      'SENOR': [150, 240, 150]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))
