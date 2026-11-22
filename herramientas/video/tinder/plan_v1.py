"""Plan del sketch vertical «¿Tú qué buscas en Tinder?» (Chico rosa + Ana Cardo). Copiado de buhardilla/plan.py.
Montar: python3 ../../shorts/montar_vertical.py plan.json entrega/tinder_sin_efectos.mp4
Todos los tiempos salen de la voz (L[i] = inicio de la frase i, T(palabra, n)), también los efectos."""
import json, os
I = 'img/'
VOZ = json.load(open('voz/tinder.json'))
L = [f['inicio'] for f in VOZ['frases']]
PAL = VOZ['palabras']


def T(palabra, n=0):
    lim = lambda x: x.strip('¿?¡!.,;:…').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


def esc(n, t0, rosa=(), ana=(), **k):
    """rosa/ana: dibujos donde a ese personaje se le abre la boca (img/<dibujo>_boca.png / _aboca.png)"""
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': k.pop('zoom', 1.0), 'cx': 0.5, 'cy': 0.5,
         'hablan': {'ROSA': {I + x + '.jpg': [I + n + '_boca.png'] for x in rosa},
                    'ANA': {I + x + '.jpg': [I + n + '_aboca.png'] for x in ana}}}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}


C = I + 'cv_'
VIVAS = {'ANA': {'habla': [], 'escucha': [], 'parpadeo': C + 'a_parp.png'},
         'ROSA': {'habla': [], 'escucha': [], 'parpadeo': C + 'r_parp.png'}}


def G(t0, t1, quien, n):
    return {'t0': t0, 't1': t1, 'quien': quien, 'img': C + n + '.png'}


def charla(t0, gestos=()):
    return {'t0': t0, 'fondo': I + 'es_charla.jpg', 'zoom': 1.1, 'cx': 0.5, 'cy': 0.56,
            'hablan': {'ROSA': {I + 'es_charla.jpg': [C + 'rboca.png']}, 'ANA': {I + 'es_charla.jpg': [C + 'aboca.png']}},
            'vivas': VIVAS, 'gestos': list(gestos)}


def gag(base, t0, otro, cada=0.42, **k):
    d = esc(base, t0, **k)
    d['alterna'] = {'imgs': [I + base + '.jpg', I + otro + '.jpg'], 'cada': cada, 'hasta': k.get('hasta', 99)}
    return d


c = 0.08
P = [
    charla(0, [G(0, L[1] - c, 'ANA', 'a_boli'),                                    # «¿tú qué buscas en Tinder?»: le apunta con el boli
               G(L[1] - c, L[2] - c, 'ROSA', 'r_pecho'),                           # «algo estable»: mano al pecho, sincero
               G(L[2] - c, T('indefinido') - c, 'ANA', 'a_escribe'),               # «Estable.»: lo apunta
               G(T('indefinido') - c, L[3] - c, 'ANA', 'a_boli')]),                # «¿indefinido o de prácticas?»
    esc('es_pprosa', L[3] - c, rosa=['es_pprosa']),                                # «¿Perdona?»: primer plano, pasmado
    charla(T('ves') - c, [G(T('ves') - c, L[5] - c, 'ANA', 'a_boli'),               # «¿dónde te ves dentro de cinco años?»
                          G(L[5] - c, L[6] - c, 'ROSA', 'r_palmas'),               # «en un sofá contigo, ¿no?»
                          G(T('dos') - c, T('porque') - c, 'ANA', 'a_dos')]),      # «¿de dos o de tres plazas?»: dos dedos
    # «Porque yo tengo un gato» → el sofá diminuto con el gato; «alérgico» → estornudo
    esc('es_sofa', T('porque') - c, ana=['es_sofa'], cambios=[ch(T('alérgico') - c, 'es_sofa_b')]),
    charla(L[8] - c, [G(L[8] - c, T('alguna') - c, 'ANA', 'a_escribe'),            # «Apuntado. Punto débil.»
                      G(T('alguna') - c, L[9] - c, 'ANA', 'a_boli'),               # «¿alguna otra debilidad?»
                      G(L[9] - c, L[10] - c, 'ROSA', 'r_pecho'),                   # «soy demasiado perfeccionista»
                      G(L[10] - c, T('qué', 1) - c, 'ANA', 'a_gafas'),             # «eso lo dicen todos»: se baja las gafas
                      G(T('qué', 1) - c, L[11] - c, 'ANA', 'a_boli'),              # «¿qué cenaste ayer?»
                      G(L[11] - c, L[12] - c, 'ROSA', 'r_dedo')]),                 # «una pizza»
    esc('es_ppana', L[12] - c, ana=['es_ppana']),                                  # «¿Entera?»: primer plano, recelosa
    gag('es_pizza', L[13] - c, 'es_pizza_b', cada=0.45),                           # «Familiar.»: la pizza gigante
    charla(T('alguna', 1) - c, [G(T('alguna', 1) - c, L[15] - c, 'ANA', 'a_boli')]),   # «¿alguna ex que hable bien de ti?»
    # «Mi madre» → su madre en otra mesa con el cartel; «Tu madre no cuenta» en el mismo plano
    gag('es_madre', L[15] - c, 'es_madre_b', cada=0.5, ana=['es_madre', 'es_madre_b']),
    charla(L[17] - c, [G(L[17] - c, L[18] - c, 'ROSA', 'r_palmas'),               # «¿y tú qué buscas en Tinder?»
                       G(L[18] - c, L[19] - c, 'ANA', 'a_boli'),                   # «alguien que coma verdura…»
                       G(L[19] - c, L[20] - c, 'ROSA', 'r_dedo'),                  # «el kétchup es tomate»
                       G(L[20] - c, T('siguiente!') - 0.4, 'ANA', 'a_escribe')]),  # «ya te llamaremos»
    esc('es_cola', T('siguiente!') - 0.4, ana=['es_cola']),                        # «¡El siguiente!»: la cola de chicos
]
FIN = PAL[-1]['fin'] + 2.4
EF = [[0, 'cafe', -10, 2.5], [L[2] + 0.1, 'boli', -6, 1.0], [L[3] - 0.14, 'whoosh2', -11], [T('ves') - 0.14, 'whoosh', -12],
      [T('porque') - 0.14, 'whoosh', -10], [T('alérgico') - c + 0.05, 'estornudo', -6, 1.4], [T('alérgico') + 0.5, 'bufido', -8, 1.0],
      [L[8] - 0.14, 'whoosh2', -11], [L[8], 'boli', -6, 1.0], [T('todos'), 'ding', -9], [L[12] - 0.14, 'whoosh2', -11],
      [L[13] - 0.14, 'whoosh', -10], [L[13] + 0.3, 'mordisco', -7, 1.3], [T('alguna', 1) - 0.14, 'whoosh2', -12],
      [L[15] - 0.14, 'whoosh', -10], [L[17] - 0.14, 'whoosh2', -12], [L[20] + 0.1, 'boli', -7, 0.9],
      [T('siguiente!') - 0.5, 'whoosh', -9], [T('siguiente!') + 0.3, 'murmullo', -7, 2.8]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
json.dump({'alineacion': 'voz/tinder.json', 'audio': 'voz/tinder.mp3', 'vel_letra': 0.03,
           'subtitulos': {'y': 250, 'tam': 92, 'max': 3, 'contorno': 14, 'mayusculas': True, 'cola': 0.2,
                          'colores': {'ROSA': [255, 100, 205], 'ANA': [120, 230, 90]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']))
