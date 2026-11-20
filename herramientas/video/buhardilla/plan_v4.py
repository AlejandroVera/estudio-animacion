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


# v4: plano fijo con los dos MIRÁNDOSE (es_charla) y ANIMACIÓN LIMITADA por personaje: capas de gesto que cambian
# solas mientras cada uno habla (cada ~0,8 s) o escucha (cada ~2 s), parpadeos, y gestos concretos en su palabra.
# Primer plano de reacción del chico y clips de gag animados como en v3.
C = I + 'cv_'
VIVAS = {'AGENTE': {'habla': [C + 'a_h1.png', C + 'a_h2.png', C + 'a_h3.png', C + 'a_h4.png', None],
                    'escucha': [None, None, C + 'a_e1.png'], 'parpadeo': C + 'a_parp.png',
                    'cada_habla': 0.8, 'cada_escucha': 2.2},
         'ROSA': {'habla': [C + 'r_h1.png', None, C + 'r_h1.png', C + 'r_h3.png'],
                  'escucha': [None, C + 'r_h3.png', C + 'r_e1.png', None], 'parpadeo': C + 'r_parp.png',
                  'cada_habla': 0.9, 'cada_escucha': 2.0}}


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


P = [
    charla(0, [G(6.30, 11.1, 'AGENTE', 'g_techos'), G(11.14, 12.9, 'ROSA', 'g_viga', 'g_viga_rboca')]),
    gag('es_ducha', 18.81, 'es_ducha_c', hasta=20.36, zoom=1.12, cy=0.6, agente=['es_ducha', 'es_ducha_c'],
        cambios=[ch(20.36, 'es_ducha_b')]),
    charla(21.04),
    gag('es_cocina', 22.29, 'es_cocina_c', hasta=25.68, zoom=1.07, agente=['es_cocina', 'es_cocina_c', 'es_cocina_b'],
        cambios=[ch(25.68, 'es_cocina_b')]),
    esc('es_pprosa', 27.40, rosa=['es_pprosa']),
    charla(29.12, [G(29.12, 31.2, 'AGENTE', 'g_no'), G(31.24, 33.7, 'AGENTE', 'g_abajo'),
                   G(34.66, 35.6, 'AGENTE', 'g_loft'), G(35.44, 37.0, 'ROSA', 'r_h2'), G(37.07, 41.2, 'AGENTE', 'g_mini')]),
    gag('es_amigos', 42.83, 'es_amigos_b'),
    esc('es_pprosa', 45.90, rosa=['es_pprosa']),
    charla(47.43, [G(47.43, 48.9, 'AGENTE', 'g_reloj')]),
    gag('es_escalera', 48.93, 'es_escalera_b', zoom=1.12, cy=0.55),
]
json.dump({'alineacion': 'voz/buhardilla.json', 'audio': 'voz/buhardilla.mp3', 'vel_letra': 0.03,
           'subtitulos': {'y': 250, 'tam': 92, 'max': 3, 'contorno': 14, 'mayusculas': True, 'colores': {'ROSA': [255, 100, 205], 'AGENTE': [255, 226, 40]}},
           'duracion': 54.0, 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
