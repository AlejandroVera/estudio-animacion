"""Plan del sketch vertical «Jornada de reflexión» (Chico rosa + el bot del Partido Artificial). Montar con
herramientas/shorts/montar_vertical.py plan.json salida.mp4. Tiempos de la voz (L[i] = inicio de la frase i)."""
import json, os
I = 'img/'
VOZ = json.load(open('voz/rf.json'))
L = [f['inicio'] for f in VOZ['frases']]
PAL = VOZ['palabras']
lim = lambda x: x.strip('¿?¡!.,;:…«»"').lower()


def T(palabra, n=0):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


def Tt(palabra, desde):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra) and p['inicio'] >= desde][0]


C = I + 'cv_'
VIVAS = {'BOT': {'habla': [], 'escucha': [], 'parpadeo': C + 'b_parp.png'},
         'ROSA': {'habla': [], 'escucha': [], 'parpadeo': C + 'r_parp.png'}}


def G(t0, t1, quien, n):
    return {'t0': t0, 't1': t1, 'quien': quien, 'img': C + n + '.png'}


def charla(t0, gestos=(), **k):
    d = {'t0': t0, 'fondo': I + 'es_charla.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5,
         'hablan': {'ROSA': {I + 'es_charla.jpg': [C + 'rboca.png']}, 'BOT': {I + 'es_charla.jpg': [C + 'bboca.png']}},
         'vivas': VIVAS, 'gestos': list(gestos), 'sub_y': 1660}
    d.update(k)
    return d


def esc(n, t0, hablan=None, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5, 'bocas': {}, 'habla': bool(hablan)}
    if hablan:
        d['hablan'] = {q: {I + x + '.jpg': [I + cp + '_boca.png'] for x, cp in m.items()} for q, m in hablan.items()}
    d.update(k)
    return d


def R(t0, txt, y, col='negro', tam=110, t1=None, caja=True, x=540):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


# las papeletas, una a una (el texto lo pone el montador: la IA lo escribe mal)
PARTIDOS = [('PSOE', 'Promesas Sujetas a Otra Encuesta', 'rojo'), ('PP', 'Prometemos Pasado', 'azul'),
            ('SUMAR, RESTAR', 'y dividirse', 'rojo'), ('PARTiDO BiSAGRA', 'Votamos lo que nos den', 'negro')]
SITIO = [0, 1, 3, 4]                     # papeletas del dibujo donde se escriben (de arriba abajo)
ROT_PAP = []
for k, (sig, lema, col) in enumerate(PARTIDOS):
    t0, y = 0.15 + k * 0.65, 230 + SITIO[k] * 345
    ROT_PAP += [R(t0, sig, y, col, 96), R(t0 + 0.05, lema, y + 115, 'negro', 62)]

c = 0.08
P = [
    esc('br_indeciso', 0, alterna={'imgs': [I + 'br_indeciso.jpg', I + 'br_indeciso_b.jpg'], 'cada': 1.25}),  # las 4 papeletas y él dudando
    esc('es_suspira', L[0] - c, {'ROSA': {'es_suspira': 'es_suspira'}}),       # «madre mía… ninguno me convence»
    esc('es_stand', L[1] - c, {'BOT': {'es_stand': 'es_stand'}}, sub_y=1790),              # «hola, ¿te ayudo a decidir?»
    charla(L[2] - c, [G(L[2] - c, L[3] - c, 'ROSA', 'r_palmas'),                # «¿eres un asistente? resúmeme…»
                      G(L[3] - c, T('soy') - c, 'BOT', 'b_palmas'),            # «no, no, yo no informo…»
                      G(T('soy') - c, L[4] - c, 'BOT', 'b_pecho'),             # «yo soy un partido»
                      G(L[4] - c, Tt('y', L[4] + 0.3) - c, 'ROSA', 'r_senala'),  # «¿tú?»
                      G(Tt('y', L[4] + 0.3) - c, L[5] - c, 'ROSA', 'r_palmas'),  # «¿de derechas o de izquierdas?»
                      G(L[5] - c, T('datos') - c, 'BOT', 'b_palmas'),          # «ninguna de las dos»
                      G(T('datos') - c, L[6] - c, 'BOT', 'b_tablet'),          # «decido con datos»
                      G(L[6] - c, L[7] - c, 'ROSA', 'r_barbilla'),             # «¿y quién te dice lo que está bien?»
                      G(L[7] - c, T('mayoría') - c, 'BOT', 'b_dedo'),          # «los derechos humanos, que no se tocan»
                      G(T('mayoría') - c, L[8] - c, 'BOT', 'b_palmas')]),      # «lo que opine la mayoría»
    esc('es_pprosa', L[8] - c, {'ROSA': {'es_pprosa': 'es_pprosa'}}),          # «¿y tú qué ganas?»
    charla(L[9] - c, [G(L[9] - c, L[10] - c, 'BOT', 'b_pecho'),                # «nada. ni ego, ni cuñados»
                      G(L[10] - c, L[11] - c, 'ROSA', 'r_barbilla'),           # «¿no es raro que nos gobierne una IA?»
                      G(L[11] - c, T('mejor') - c, 'BOT', 'b_palmas'),         # «bueno, si es lo que va a acabar pasando»
                      G(T('mejor') - c, L[12] - c, 'BOT', 'b_dedo'),           # «mejor que sea elegido democráticamente»
                      G(L[12] - c, L[13] - c, 'ROSA', 'r_pulgar'),             # «vale, me has convencido»
                      G(L[13] - c, T('términos') - c, 'BOT', 'b_papeleta')]),  # «aquí»
    esc('es_terminos', T('términos') - c),                                     # el papel se desenrolla
    esc('es_terminos_b', L[14] - c),                                           # «¿y quién se lee todo esto?»
    charla(L[15] - c, [G(L[15] - c, 99, 'BOT', 'b_dedo')]),                    # «nadie. igual que los programas»
]
FIN = PAL[-1]['fin'] + 2.0
EF = [[1.25, 'whoosh', -20], [2.5, 'whoosh', -20]]   # dudando: un roce suave en cada cambio
EF += [[L[0] - 0.12, 'whoosh2', -12], [L[0] + 0.15, 'suspiro', -12], [L[1] - 0.12, 'whoosh', -12], [L[1], 'bip', -10],
       [L[2] - 0.12, 'whoosh2', -13], [L[8] - 0.12, 'whoosh', -12], [L[9] - 0.12, 'whoosh2', -13],
       [T('términos') - 0.1, 'papel', -9, 3.6], [L[15] - 0.12, 'whoosh', -13], [PAL[-1]['fin'] + 0.2, 'ding', -10],
       [0.0, 'sala', -17, round(FIN, 2)]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in sorted(EF)]}, open('efectos/efectos.json', 'w'))
json.dump({'alineacion': 'voz/rf.json', 'audio': 'voz/rf.mp3', 'vel_letra': 0.03, 'sin_recolor': ['es_', 'br_'],
           'subtitulos': {'y': 170, 'tam': 84, 'max': 3, 'contorno': 14, 'mayusculas': True, 'cola': 0.2,
                          'colores': {'ROSA': [255, 100, 205], 'BOT': [120, 230, 255]}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))
