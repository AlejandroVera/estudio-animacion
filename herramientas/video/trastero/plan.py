"""Plan del sketch vertical «El microloft» (Chico rosa + agente inmobiliario). Copiado de tinder/plan.py.
Montar: python3 ../../shorts/montar_vertical.py plan.json entrega/tinder_sin_efectos.mp4
Todos los tiempos salen de la voz (L[i] = inicio de la frase i, T(palabra, n)), también los efectos."""
import json, os
I = 'img/'
VOZ = json.load(open('voz/tr.json'))
L = [f['inicio'] for f in VOZ['frases']]
PAL = VOZ['palabras']


def T(palabra, n=0):
    lim = lambda x: x.strip('¿?¡!.,;:…').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


def esc(n, t0, rosa=(), ag=(), **k):
    """rosa/ana: dibujos donde a ese personaje se le abre la boca (img/<dibujo>_boca.png / _aboca.png)"""
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': k.pop('zoom', 1.0), 'cx': 0.5, 'cy': 0.5,
         'hablan': {'ROSA': {I + x + '.jpg': [I + n + '_boca.png'] for x in rosa},
                    'AGENTE': {I + x + '.jpg': [I + n + '_aboca.png'] for x in ag}}}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}


C = I + 'cv_'
VIVAS = {'AGENTE': {'habla': [], 'escucha': [], 'parpadeo': C + 'a_parp.png'},
         'ROSA': {'habla': [], 'escucha': [], 'parpadeo': C + 'r_parp.png'}}


def G(t0, t1, quien, n):
    return {'t0': t0, 't1': t1, 'quien': quien, 'img': C + n + '.png'}


def charla(t0, gestos=()):
    return {'t0': t0, 'fondo': I + 'es_charla.jpg', 'zoom': 1.1, 'cx': 0.5, 'cy': 0.56,
            'hablan': {'ROSA': {I + 'es_charla.jpg': [C + 'rboca.png']}, 'AGENTE': {I + 'es_charla.jpg': [C + 'aboca.png']}},
            'vivas': VIVAS, 'gestos': list(gestos)}


def gag(base, t0, otro, cada=0.42, **k):
    d = esc(base, t0, **k)
    d['alterna'] = {'imgs': [I + base + '.jpg', I + otro + '.jpg'], 'cada': cada, 'hasta': k.get('hasta', 99)}
    return d


c = 0.08


def R(t0, txt, x, y, col='negro', tam=80, t1=None):
    """texto dentro del dibujo (placa, carta): coordenadas de pantalla, y = arriba del texto"""
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True}
    if t1:
        d['t1'] = t1
    return d


P = [
    # «Bueno, pues este es el estudio. Setecientos cincuenta al mes. Zona Malasaña.»
    charla(0, [G(0, T('setecientos') - c, 'AGENTE', 'a_presenta'),
               G(T('setecientos') - c, T('zona') - c, 'AGENTE', 'a_dedo'),
               G(T('zona') - c, L[1] - c, 'AGENTE', 'a_presenta'),
               G(L[1] - c, L[3] - c, 'ROSA', 'r_cruzado'),                        # «Esto es un trastero»: brazos cruzados (y así escucha)
               G(L[2] - c, T('lo') - c, 'AGENTE', 'a_dedo'),                      # «Era un trastero. Ahora es un microloft»
               G(T('lo') - c, L[3], 'AGENTE', 'a_puerta')]),                      # «Lo pone en la puerta»
    # «…mira.»: la placa dorada de la puerta
    esc('br_puerta', T('puerta') - c, rotulos=[R(T('puerta') - c, 'MiCROLOFT', 538, 474, 'negro', 70)]),
    charla(L[3] - c, [G(L[3] - c, L[4] - c, 'ROSA', 'r_palmas'),                  # «¿Y la ventana?»
                      G(L[4] - c, T('mucho') - c, 'AGENTE', 'a_arriba'),          # «tienes respiradero»: señala la rejilla
                      G(T('mucho') - c, L[5] - c, 'AGENTE', 'a_pecho'),           # «mucho más íntimo… desconexión total»
                      G(L[5] - c, L[6], 'ROSA', 'r_palmas')]),                    # «¿Y el baño?»
    # «Aquí. Ducha, váter y, si cierras la puerta, armario. Tres en uno. Ahorras metros.»
    esc('es_armario', L[6] - c, cambios=[ch(T('cierras') - c, 'es_armario_b')]),
    charla(L[7] - c, [G(L[7] - c, L[8] - c, 'ROSA', 'r_palmas'),                  # «¿Y la cocina?»
                      G(L[8] - c, L[9], 'AGENTE', 'a_dedo')]),                    # «La ducha tiene agua caliente»
    # «Con un hervidor te apañas. Mucha gente cena fideos instantáneos, ¿eh? Es tendencia.»
    gag('es_fideos', T('hervidor') - 0.3, 'es_fideos_b', cada=0.45),
    charla(L[9] - c, [G(L[9] - c, L[10] - c, 'ROSA', 'r_oreja'),                  # «¿Y ese ruido?»
                      G(L[10] - c, L[11], 'AGENTE', 'a_arriba')]),                # «La caldera del edificio»
    # «Por la noche hace un ruidito, pero te acostumbras. Es como tener un gato… que ronca.»
    gag('es_caldera', T('noche') - 0.3, 'es_caldera_b', cada=0.6),
    charla(L[11] - c, [G(L[11] - c, L[12] - c, 'ROSA', 'r_palmas'),               # «¿Y qué pedís de fianza?»
                       G(L[12] - c, L[13], 'AGENTE', 'a_dedo')]),                 # «Seis meses. Un mes de agencia.»
    # «Y una carta de motivación.»: la carta escribiéndose
    gag('br_carta', T('carta') - c, 'br_carta_b', cada=0.35,
        rotulos=[R(T('carta') - c, 'CARTA DE MOTiVACiÓN', 511, 425, 'negro', 58)]),
    # «¿Una carta de motivación? ¿Para un trastero?»: primer plano, incrédulo
    esc('es_pprosa', L[13] - c, rosa=['es_pprosa']),
    charla(L[14] - c, [G(L[14] - c, T('date') - c, 'AGENTE', 'a_dedo'),         # «Microloft.»
                       G(T('date') - c, 99, 'AGENTE', 'a_reloj'),                 # «Y date prisa…»: el reloj
                       G(L[14] - c, 99, 'ROSA', 'r_cruzado')]),
    # «…tengo cuarenta visitas»: la cola de interesados
    gag('es_cola', T('cuarenta') - c, 'es_cola_b', cada=0.5),
]
# golpes de zoom a su cara en dos remates (los planos del armario y los fideos duraban 5-6 s)
import copy
P0 = list(P)
for pal, cx, cy in [('metros', 0.27, 0.33), ('tendencia', 0.5, 0.3)]:
    t = T(pal) - c
    base = [p for p in P0 if p['t0'] <= t][-1]
    g = copy.deepcopy(base); g.update(t0=t, zoom=1.4, cx=cx, cy=cy); g.pop('rotulos', None)
    if base['fondo'].endswith('es_armario.jpg'):
        g['fondo'] = I + 'es_armario_b.jpg'; g.pop('cambios', None)
    P.append(g)
P.sort(key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.4
EF = [[L[1] - 0.05, 'pop', -12], [T('puerta') - 0.14, 'whoosh2', -12], [T('puerta'), 'ding', -10],
      [L[3] - 0.14, 'whoosh', -13], [T('respiradero'), 'viento', -12, 1.5], [L[6] - 0.14, 'whoosh', -11], [L[6], 'taquilla', -8, 1.0],
      [T('cierras'), 'portazo', -9, 0.8], [T('hervidor') - 0.44, 'whoosh2', -11], [T('hervidor') - 0.2, 'hervidor', -11, 2.5],
      [L[9] - 0.2, 'caldera', -12, 1.4], [T('noche') - 0.44, 'whoosh', -11], [T('noche') - 0.2, 'ronquido', -9, 5.0],
      [T('carta') - 0.22, 'whoosh2', -11], [T('carta'), 'boli', -9, 2.0], [L[13] - 0.14, 'whoosh', -12],
      [T('date'), 'tictac', -10, 1.0], [T('cuarenta') - 0.22, 'whoosh', -10], [T('cuarenta') + 0.2, 'murmullo', -7, 3.6], [T('metros') - 0.1, 'whoosh', -15], [T('tendencia') - 0.1, 'whoosh', -15]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
json.dump({'alineacion': 'voz/tr.json', 'audio': 'voz/tr.mp3', 'vel_letra': 0.03,
           'subtitulos': {'y': 250, 'tam': 92, 'max': 3, 'contorno': 14, 'mayusculas': True, 'cola': 0.05,
                          'colores': {'ROSA': [255, 100, 205], 'AGENTE': [255, 226, 40]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']))
