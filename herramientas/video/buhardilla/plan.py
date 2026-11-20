"""Plan del sketch vertical «La buhardilla» (Chico rosa + agente inmobiliario). Montar con
herramientas/shorts/montar_vertical.py plan.json salida.mp4. Diálogo: voz/buhardilla.json lleva «quien» en cada
palabra y el montador abre solo la boca del que habla («hablan»)."""
import json, os, re
I = 'img/'


def boca(x, suf):
    # un movimiento (_b, _c) con la cabeza en el mismo sitio usa la boca de su dibujo base
    f = I + x + suf + '.png'
    return f if os.path.exists(f) else I + re.sub(r'_[bc]$', '', x) + suf + '.png'


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


P = [
    esc('es_entrada', 0, rosa=['es_entrada'], agente=['es_entrada']),
    esc('es_paris', 5.70, agente=['es_paris'], rotulos=[R(9.0, 'MUY DE PARÍS', 1580, 'azul', 110, 10.6)]),
    esc('es_viga', 10.63, rosa=['es_viga'], zoom=1.08, cy=0.42),
    esc('es_precio', 12.26, agente=['es_precio'],
        rotulos=[R(13.6, '650 €/MES', 1580, 'rojo', 130, 15.8), R(15.82, '+ GASTOS', 1580, 'rojo', 130, 17.1)]),
    esc('es_dormitorio', 17.18, rosa=['es_dormitorio'], agente=['es_dormitorio', 'es_dormitorio_b'],
        cambios=[ch(22.18, 'es_dormitorio_b')]),
    esc('es_pie', 24.76, rosa=['es_pie']),
    esc('es_dormitorio', 26.71, agente=['es_dormitorio'], rotulos=[R(26.95, 'POR TURNOS', 1580, 'negro', 120, 28.8)]),
    esc('es_turnos', 28.90, agente=['es_turnos']),
    esc('es_ducha', 29.82, rosa=['es_ducha'], agente=['es_ducha'], cambios=[ch(32.75, 'es_ducha_b')],
        rotulos=[R(32.75, 'SPA', 1600, 'verde', 160, 33.6)]),
    esc('es_cocina', 33.63, zoom=1.07, rosa=['es_cocina'], agente=['es_cocina', 'es_cocina_b'], cambios=[ch(38.73, 'es_cocina_b')],
        rotulos=[R(38.73, 'ERGONOMÍA', 1640, 'azul', 120, 40.0)]),
    esc('es_trastero', 40.04, rosa=['es_trastero']),
    esc('es_loft', 41.76, agente=['es_loft', 'es_loft_b', 'es_loft_c'],
        cambios=[ch(43.65, 'es_loft_b'), ch(46.80, 'es_loft_c')],
        rotulos=[R(44.9, 'TRASTERO: 700 €', 1620, 'rojo', 105, 46.7), R(46.82, 'LOFT', 1620, 'azul', 170, 47.75)]),
    esc('es_metro', 47.75, rosa=['es_metro'], rotulos=[R(48.4, '1,20 m', 1560, 'rojo', 150, 49.45)]),
    esc('es_mini', 49.47, rosa=['es_mini'], agente=['es_mini'], rotulos=[R(49.82, 'MiNi LOFT', 1640, 'azul', 130, 51.6)]),
    esc('es_amigos', 54.72, rotulos=[R(56.35, 'MÁS ÍNTiMO', 1640, 'rojo', 130, 57.9)]),
    esc('es_pensar', 58.12, rosa=['es_pensar'], agente=['es_pensar', 'es_pensar_b'], cambios=[ch(60.55, 'es_pensar_b')],
        rotulos=[R(60.55, 'HASTA LAS 5', 1600, 'rojo', 120, 61.55)]),
    esc('es_escalera', 61.61, zoom=1.12, cy=0.55, rotulos=[R(61.9, '20 iNTERESADOS', 1650, 'rojo', 105)]),
]
json.dump({'alineacion': 'voz/buhardilla.json', 'audio': 'voz/buhardilla.mp3', 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 70, 'colores': {'ROSA': [255, 120, 210], 'AGENTE': [255, 222, 90]}},
           'duracion': 66.4, 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
