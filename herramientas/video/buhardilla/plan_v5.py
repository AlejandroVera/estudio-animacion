"""Plan del sketch vertical «La buhardilla» (Chico rosa + agente inmobiliario). Montar con
herramientas/shorts/montar_vertical.py plan.json salida.mp4. Diálogo: voz/buhardilla.json lleva «quien» en cada
palabra y el montador abre solo la boca del que habla («hablan»)."""
import json, os, re
I = 'img/'


def boca(x, suf):
    # un movimiento (_b, _c) con la cabeza en el mismo sitio usa la boca de su dibujo base
    while not os.path.exists(I + x + suf + '.png') and '_' in x[3:]:
        x = x.rsplit('_', 1)[0]
    return I + x + suf + '.png'


def esc(n, t0, rosa=(), agente=(), **k):
    """rosa/agente: dibujos (sin «es_») donde a ese personaje se le puede abrir la boca."""
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': k.pop('zoom', 1.0), 'cx': 0.5, 'cy': 0.5,
         'hablan': {'ROSA': {I + x + '.jpg': [boca(x, '_boca')] for x in rosa},
                    'AGENTE': {I + x + '.jpg': [boca(x, '_aboca')] for x in agente}}}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}


def R(t0, txt, y=1560, col='negro', tam=120, t1=None, **k):
    d = {'t0': t0, 'texto': txt, 'x': 540, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': True}
    if t1:
        d['t1'] = t1
    d.update(k)
    return d


# v5: tiempos sacados de la voz (frases y palabras), así sirve aunque se rehaga la voz. El chico apenas se mueve
# mientras habla el agente (como pidió Alejandro); el agente, voz un 15 % más rápida.
VOZ = json.load(open('voz/buhardilla.json'))
L = [f['inicio'] for f in VOZ['frases']]
PAL = VOZ['palabras']


def T(palabra, n=0):
    """inicio de la n-ésima aparición de una palabra"""
    lim = lambda x: x.strip('¿?¡!.,;:').lower()
    v = [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)]
    return v[n]


C = I + 'cv_'
VIVAS = {'AGENTE': {'habla': [C + 'a_h1.png', C + 'a_h2.png', C + 'a_h3.png', C + 'a_h4.png', None],
                    'escucha': [None, None, C + 'a_e1.png'], 'parpadeo': C + 'a_parp.png',
                    'cada_habla': 0.8, 'cada_escucha': 2.6},
         'ROSA': {'habla': [C + 'r_h1.png', None, C + 'r_h1.png', C + 'r_h3.png'],
                  'escucha': [None, None, None, C + 'r_h3.png'], 'parpadeo': C + 'r_parp.png',
                  'cada_habla': 1.1, 'cada_escucha': 4.5}}


def G(t0, t1, quien, n, boca=None):
    return {'t0': t0, 't1': t1, 'quien': quien, 'img': C + n + '.png', **({'boca': C + boca + '.png'} if boca else {})}


def charla(t0, gestos=(), **k):
    return {'t0': t0, 'fondo': I + 'es_charla.jpg', 'zoom': 1.12, 'cx': 0.5, 'cy': 0.55,
            'hablan': {'ROSA': {I + 'es_charla.jpg': [C + 'rboca.png']}, 'AGENTE': {I + 'es_charla.jpg': [C + 'aboca.png']}},
            'vivas': VIVAS, 'gestos': list(gestos), **k}


def gag(base, t0, otro, hasta=99, **k):
    d = esc(base, t0, **k)
    d['alterna'] = {'imgs': [I + base + '.jpg', I + otro + '.jpg'], 'cada': 0.42, 'hasta': hasta}
    return d


c = 0.08   # los cortes y gestos, un pelín antes de su palabra
P = [
    charla(0, [G(L[2] - c, L[3] - c, 'AGENTE', 'g_techos'), G(L[3] - c, L[4] - c, 'ROSA', 'g_viga', 'g_viga_rboca')]),
    gag('es_ducha', L[6] - c, 'es_ducha_c', hasta=T('spa') - c, zoom=1.12, cy=0.6, agente=['es_ducha', 'es_ducha_c'],
        cambios=[ch(T('spa') - c, 'es_ducha_b')]),
    charla(L[7] - c),
    gag('es_cocina', L[8] - c, 'es_cocina_c', hasta=T('ergonomía') - c, zoom=1.07,
        agente=['es_cocina', 'es_cocina_c', 'es_cocina_b'], cambios=[ch(T('ergonomía') - c, 'es_cocina_b')]),
    esc('es_pprosa', L[9] - c, rosa=['es_pprosa']),
    charla(L[10] - c, [G(L[10] - c, T('abajo') - c, 'AGENTE', 'g_no'), G(T('abajo') - c, T('loft') - c, 'AGENTE', 'g_abajo'),
                       G(T('loft') - c, L[11] - c, 'AGENTE', 'g_loft'), G(L[11] - c, L[12] - c, 'ROSA', 'r_h2'),
                       G(L[12] - c, T('ahora') + 0.2, 'AGENTE', 'g_mini')]),
    gag('es_amigos', L[14] - c, 'es_amigos_b'),
    esc('es_pprosa', L[15] - c, rosa=['es_pprosa']),
    charla(L[16] - c, [G(L[16] - c, T('hay') - c, 'AGENTE', 'g_reloj')]),
    gag('es_escalera', T('hay') - c, 'es_escalera_b', zoom=1.12, cy=0.55),
]
FIN = PAL[-1]['fin'] + 2.4
# efectos de sonido sacados de los mismos tiempos (whoosh suave en cada corte a un gag)
EF = [[T('viga') - 0.3, 'golpe', -4], [L[6] - 0.14, 'whoosh', -9], [L[6], 'ducha', -9, 2.2], [T('spa') - c, 'ding', -7],
      [L[7] - 0.14, 'whoosh2', -10], [L[8] - 0.14, 'whoosh', -9], [L[8] + 0.1, 'sarten', -10, 3.2],
      [T('ergonomía') - c, 'pop', -8], [L[9] - 0.14, 'whoosh2', -10], [L[10] - 0.14, 'whoosh', -10],
      [T('loft') - c, 'ding', -7], [L[12] - c, 'pop', -9], [L[14] - 0.14, 'whoosh', -9], [L[15] - 0.14, 'whoosh2', -10],
      [L[16] - 0.14, 'whoosh', -10], [T('cinco'), 'tictac', -6, 0.9], [T('hay') - 0.14, 'whoosh2', -7],
      [T('hay') + 0.15, 'murmullo', -6, 4.8]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
json.dump({'alineacion': 'voz/buhardilla.json', 'audio': 'voz/buhardilla.mp3', 'vel_letra': 0.03,
           'subtitulos': {'y': 250, 'tam': 92, 'max': 3, 'contorno': 14, 'mayusculas': True, 'cola': 0.2, 'colores': {'ROSA': [255, 100, 205], 'AGENTE': [255, 226, 40]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
