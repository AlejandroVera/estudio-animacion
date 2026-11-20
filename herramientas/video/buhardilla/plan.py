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


# Estructura del vídeo de referencia: PLANO FIJO de los dos (es_salon, se miran, siempre igual), PRIMEROS PLANOS de
# reacción (es_pprosa, es_ppagente) y los gags como planos aparte. Casi sin rótulos: los subtítulos cuentan.
P = [
    esc('es_entrada', 0, rosa=['es_entrada'], agente=['es_entrada']),                       # entra a gatas
    esc('es_pprosa', 3.52, rosa=['es_pprosa']),                                              # ¿por qué agachado?
    esc('es_salon', 5.70, rosa=['es_salon'], agente=['es_salon', 'es_salon_b'],
        cambios=[ch(5.78, 'es_salon_b')]),                                                   # techos con personalidad
    esc('es_viga', 10.63, rosa=['es_viga'], zoom=1.08, cy=0.42),                             # gag: la viga
    esc('es_ppagente', 12.26, agente=['es_ppagente'],
        rotulos=[R(13.6, '650 €/MES', 1640, 'rojo', 130, 15.8), R(15.82, '+ GASTOS', 1640, 'rojo', 130, 17.1)]),
    esc('es_salon', 17.18, rosa=['es_salon'], agente=['es_salon']),                          # ¿y el dormitorio?
    esc('es_dormitorio', 18.48, zoom=1.06, cy=0.44, sub_y=1700, agente=['es_dormitorio', 'es_dormitorio_b'], rosa=['es_dormitorio'],
        cambios=[ch(22.18, 'es_dormitorio_b')]),                                             # la cama, único sitio de pie
    esc('es_pie', 24.76, rosa=['es_pie']),                                                   # ¿y yo dónde?
    esc('es_dormitorio_b', 26.71, zoom=1.06, cy=0.42, sub_y=1700, agente=['es_dormitorio_b']),                               # por turnos: primero la cama
    esc('es_turnos', 28.90, zoom=1.18, cy=0.62, agente=['es_turnos']),                                           # luego tú
    esc('es_ducha', 29.82, zoom=1.12, cy=0.6, rosa=['es_ducha'], agente=['es_ducha'], cambios=[ch(32.75, 'es_ducha_b')]),
    esc('es_cocina', 33.63, zoom=1.07, rosa=['es_cocina'], agente=['es_cocina', 'es_cocina_b'],
        cambios=[ch(38.73, 'es_cocina_b')]),
    esc('es_pprosa', 40.04, rosa=['es_pprosa']),                                             # esto es un trastero
    esc('es_loft', 41.76, agente=['es_loft', 'es_loft_b', 'es_loft_c'],
        cambios=[ch(43.65, 'es_loft_b'), ch(46.80, 'es_loft_c')]),
    esc('es_metro', 47.75, rosa=['es_metro'], rotulos=[R(48.4, '1,20 m', 1600, 'rojo', 150, 49.45)]),
    esc('es_mini', 49.47, agente=['es_mini']),                                               # mini loft
    esc('es_pprosa', 53.28, rosa=['es_pprosa']),                                             # ¿y si vienen amigos?
    esc('es_amigos', 54.72),                                                                 # gag: amigos agachados
    esc('es_salon', 58.12, rosa=['es_salon'], agente=['es_salon']),                          # me lo tengo que pensar
    esc('es_ppagente', 59.65, agente=['es_ppagente']),                                       # tienes hasta las cinco
    esc('es_escalera', 61.61, zoom=1.12, cy=0.55, rotulos=[R(64.45, '20 iNTERESADOS', 1650, 'rojo', 105)]),
]
json.dump({'alineacion': 'voz/buhardilla.json', 'audio': 'voz/buhardilla.mp3', 'vel_letra': 0.03,
           'subtitulos': {'y': 250, 'tam': 96, 'max': 3, 'contorno': 14, 'colores': {'ROSA': [255, 100, 205], 'AGENTE': [255, 226, 40]}},
           'duracion': 66.4, 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
