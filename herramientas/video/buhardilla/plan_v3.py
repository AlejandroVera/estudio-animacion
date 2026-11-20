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


# v3, montado como la referencia: UN PLANO FIJO de los dos (es_fijo, cuerpo entero, el chiste siempre a la vista)
# casi todo el rato, con los gestos como cambios; primer plano de reacción del chico (es_pprosa) en las quejas clave;
# y clips de gag ANIMADOS (dos dibujos que se alternan) en la frase que los cuenta. Sin rótulos.
F = ['es_fijo', 'es_fijo_b', 'es_fijo_no', 'es_fijo_abajo', 'es_fijo_loft', 'es_fijo_mini', 'es_fijo_reloj']


def fijo(t0, cambios=(), **k):
    return esc('es_fijo', t0, rosa=['es_fijo', 'es_fijo_viga', 'es_fijo_metro'], agente=F,
               cambios=[ch(t, n) for t, n in cambios], **k)


def gag(base, t0, otro, hasta=99, **k):
    d = esc(base, t0, **k)
    d['alterna'] = {'imgs': [I + base + '.jpg', I + otro + '.jpg'], 'cada': 0.42, 'hasta': hasta}
    return d


P = [
    fijo(0, [(6.30, 'es_fijo_b'), (11.14, 'es_fijo_viga'), (12.88, 'es_fijo')]),   # piso, agachado, techos, viga, encanto
    gag('es_ducha', 18.81, 'es_ducha_c', hasta=20.36, zoom=1.12, cy=0.6, agente=['es_ducha', 'es_ducha_c'],
        cambios=[ch(20.36, 'es_ducha_b')]),                                          # ducha sentado... spa
    fijo(21.04),                                                                     # ¿y la cocina?
    gag('es_cocina', 22.29, 'es_cocina_c', hasta=25.68, zoom=1.07, agente=['es_cocina', 'es_cocina_c', 'es_cocina_b'],
        cambios=[ch(25.68, 'es_cocina_b')]),                                         # de rodillas... ergonomía
    esc('es_pprosa', 27.40, rosa=['es_pprosa']),                                     # esto es un trastero
    fijo(29.12, [(29.12, 'es_fijo_no'), (31.24, 'es_fijo_abajo'), (34.66, 'es_fijo_loft'), (35.44, 'es_fijo_metro'),
                 (37.07, 'es_fijo_mini'), (41.30, 'es_fijo')]),                      # no no no... mini... ¿amigos?
    gag('es_amigos', 42.83, 'es_amigos_b'),                                          # que vengan agachados
    esc('es_pprosa', 45.90, rosa=['es_pprosa']),                                     # me lo tengo que pensar
    fijo(47.43, [(47.43, 'es_fijo_reloj')]),                                         # tienes hasta las cinco
    gag('es_escalera', 48.93, 'es_escalera_b', zoom=1.12, cy=0.55),                  # veinte interesados
]
# en el plano fijo con la boca de su base salvo los dibujos con la cabeza movida (viga y metro tienen la suya)
json.dump({'alineacion': 'voz/buhardilla.json', 'audio': 'voz/buhardilla.mp3', 'vel_letra': 0.03,
           'subtitulos': {'y': 250, 'tam': 92, 'max': 3, 'contorno': 14, 'mayusculas': True, 'colores': {'ROSA': [255, 100, 205], 'AGENTE': [255, 226, 40]}},
           'duracion': 54.0, 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
