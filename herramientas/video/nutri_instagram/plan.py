"""Plan del vídeo vertical «Nutricionista de Instagram» (Ana Cardo narra; el «gurú» hace los gags). Montar con
herramientas/shorts/montar_vertical.py plan.json salida.mp4. Todos los tiempos salen de la voz (T = n-ésima aparición
de una palabra, Tt = primera a partir de un instante). Escribe también efectos/efectos.json."""
import json, os
I = 'img/'
PAL = [w for w in json.load(open('voz/ni.json'))['palabras'] if w['tipo'] == 'word']
lim = lambda x: x.strip('¿?¡!.,;:«»"…').lower()


def T(palabra, n=0):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


def Tt(palabra, desde):
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra) and p['inicio'] >= desde][0]


c, b = 0.06, 0.1


def esc(n, t0, ana=None, **k):
    """ana = {dibujo: capa de boca}: la boca de Ana se abre con la voz en esos dibujos"""
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5, 'bocas': {}, 'habla': bool(ana)}
    if ana:
        d['hablan'] = {'ANA': {I + x + '.jpg': [I + cp + '_boca.png'] for x, cp in ana.items()}}
    if n.startswith('br_') and n.split('_')[0] + '_' + n.split('_')[1] not in ('br_panaderia', 'br_formacion', 'br_metabolismo'):
        d['sub_y'] = 1680
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}


def R(t0, txt, y, col='negro', tam=120, t1=None, x=540):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': True}
    if t1:
        d['t1'] = t1
    return d


def alt(imgs, cada, desde=0, hasta=999):
    return {'imgs': [I + x + '.jpg' for x in imgs], 'cada': cada, 'desde': desde, 'hasta': hasta}


P = [
    # «¿Sabías que en España existe una forma de ser nutricionista sin pisar la universidad?»
    esc('es_pregunta', 0, {x: 'es_pregunta' for x in ('es_pregunta', 'es_pregunta_b', 'es_pregunta_c')},
        
        cambios=[ch(T('forma') - c, 'es_pregunta_c'), ch(T('universidad') - c, 'es_pregunta_b')]),
    # «Se llama tener un móvil.»
    esc('es_movil', T('se') - c, {'es_movil': 'es_movil', 'es_movil_b': 'es_movil'},
        cambios=[ch(T('tener') - c, 'es_movil_b'), ch(T('móvil') + 0.35, 'es_movil')],
        rotulos=[R(T('móvil') - b, 'UN MÓVIL', 1640, 'rojo', 150)]),
    # «Y para conseguirlo solo necesitas dos requisitos fundamentales:»
    esc('br_reel', T('y') - c, zoom=1.08, cy=0.5),
    esc('br_requisitos', T('dos') - c, zoom=1.3, cy=0.33, alterna=alt(['br_requisitos', 'br_requisitos_b'], 0.5),
        rotulos=[R(T('dos') - b, '2 REQUiSiTOS', 1450, 'negro', 120)]),
    # «haber perdido tres kilos una vez»
    esc('br_kilos', T('haber') - c, alterna=alt(['br_kilos', 'br_kilos_b', 'br_kilos_c'], 0.35),
        rotulos=[R(T('tres') - b, '-3 KG', 1640, 'rojo', 170)]),
    # «y hablar como si parecieses un experto.»
    esc('br_experto', Tt('y', T('vez')) - c, zoom=1.15, cy=0.4, alterna=alt(['br_experto', 'br_experto_c'], 0.45, hasta=T('experto') - c),
        cambios=[ch(T('experto') - c, 'br_experto_b')]),
    # «Da igual que no sepas qué significa la palabra metabolismo.»
    esc('br_metabolismo', T('da') - c, zoom=1.3, cy=0.35, alterna=alt(['br_metabolismo', 'br_metabolismo_b'], 0.6),
        rotulos=[R(T('metabolismo') - b, 'METABOLiSMO', 300, 'azul', 120)]),
    # «Da igual que confundas una proteína con un batido de fresa.»
    esc('br_batido', T('da', 1) - c, zoom=1.2, cy=0.38, alterna=alt(['br_batido', 'br_batido_c'], 0.55, hasta=T('fresa') - c),
        cambios=[ch(T('fresa') - c, 'br_batido_b')], rotulos=[R(T('proteína') - b, 'PROTEÍNA', 1450, 'rojo', 130)]),
    # «Tú dices que el pan engorda.»
    esc('br_pan', T('tú') - c, zoom=1.12, cy=0.42, cambios=[ch(T('engorda') - c, 'br_pan_c')],
        rotulos=[R(T('engorda') - b, 'ENGORDA', 1450, 'rojo', 140)]),
    # «Y si tú dices que el pan engorda, medio Instagram deja de comer pan.»
    esc('br_panaderia', Tt('y', T('engorda')) - c, alterna=alt(['br_panaderia', 'br_panaderia_c'], 0.4, hasta=T('medio') - c),
        cambios=[ch(T('medio') - c, 'br_panaderia_b')],
        rotulos=[R(Tt('y', T('engorda')) - c, 'ENGORDA', 230, 'rojo', 140, T('medio') - b - 0.05),
                 R(T('medio') - b, 'MEDiO iNSTAGRAM', 230, 'negro', 110)]),
    # «Porque aquí la ciencia la pones tú, campeón.»
    esc('es_campeon', T('porque') - c, {'es_campeon': 'es_campeon', 'es_campeon_b': 'es_campeon'},
        cambios=[ch(T('tú', 2) - c, 'es_campeon_b')], rotulos=[R(T('tú', 2) - b, 'CAMPEÓN', 1650, 'verde', 150)]),
    # «¿Que alguien te pregunta por tu formación?»
    esc('br_comentario', Tt('que', T('campeón')) - c, zoom=1.05),
    esc('br_formacion', T('formación') - c, zoom=1.3, cy=0.42, alterna=alt(['br_formacion', 'br_formacion_c'], 0.3, hasta=T('formación') + 0.45),
        cambios=[ch(T('formación') + 0.45, 'br_formacion_b')]),
    # «Un curso de fin de semana con diploma en PDF. Que es casi lo mismo que una carrera,»
    esc('br_impresora', Tt('un', T('formación')) - c),
    esc('br_pdf', T('diploma') - c, zoom=1.15, cy=0.4, cambios=[ch(T('pdf') + 0.3, 'br_pdf_c'), ch(T('casi') - c, 'br_pdf_b')],
        rotulos=[R(T('pdf') - b, 'PDF', 1450, 'rojo', 190, T('casi') - 0.05)]),
    # «pero sin tanto examen.»
    esc('es_carrera', T('pero') - c, {'es_carrera': 'es_carrera', 'es_carrera_b': 'es_carrera'},
        alterna=alt(['es_carrera', 'es_carrera_b'], 0.3)),
    # «Tú no estás poniendo en riesgo la salud de nadie.»
    esc('br_riesgo', Tt('tú', T('examen')) - c, alterna=alt(['br_riesgo', 'br_riesgo_c'], 0.5)),
    esc('br_riesgo_b', T('salud') - c, alterna=alt(['br_riesgo_b', 'br_riesgo_d'], 0.55), seguido=True),
    # «Estás ayudando a tus seguidores a eliminar toxinas.»
    esc('br_detox', T('estás', 1) - c, zoom=1.15, cy=0.4, alterna=alt(['br_detox', 'br_detox_c'], 0.6),
        rotulos=[R(T('toxinas') - b, 'TOXiNAS', 1450, 'verde', 140, Tt('no', T('toxinas')) - 0.05)]),
    # «Que no sabes cuáles son, pero se eliminan igual.»
    esc('br_detox_b', Tt('no', T('toxinas')) - c, alterna=alt(['br_detox_b', 'br_detox_d'], 0.6), seguido=True),
    # «Total… si comer, comemos todos, ¿no?»
    esc('br_comer', T('total') - c, zoom=1.2, cy=0.36, alterna=alt(['br_comer_b', 'br_comer'], 0.45)),
    # «¿Para qué vas a estudiar cuatro años, luego hacer un máster y continuar formándote durante toda tu vida?»
    esc('es_final', T('para', 1) - c, {'es_final': 'es_final', 'es_final_c': 'es_final'},
        cambios=[ch(T('cuatro') - c, 'es_final_c'), ch(T('máster') - c, 'es_final'), ch(T('toda') - c, 'es_final_b')],
        rotulos=[R(T('cuatro') - b, '4 AÑOS', 1600, 'negro', 130, T('luego') - 0.05),
                 R(T('máster') - b, '+ MÁSTER', 1600, 'negro', 130, T('continuar') - 0.05),
                 R(T('toda') - b, 'TODA LA ViDA', 1600, 'rojo', 130)]),
]

# GOLPES de cámara en el remate de cada frase (como en «El Tetris»): copia del plano, sin rótulos, acercándose a la cara
GOLPES = [(T('móvil') + 0.1, 1.3, 0.55, 0.38), (T('vez') - c, 1.6, 0.5, 0.2), (T('experto') - c, 1.7, 0.52, 0.19),
          (T('metabolismo') + 0.25, 1.5, 0.5, 0.3), (T('fresa') - c, 1.5, 0.5, 0.25), (T('pan', 2) - c, 1.9, 0.68, 0.22),
          (T('campeón') - c, 1.3, 0.5, 0.38), (T('examen') - c, 1.4, 0.55, 0.4), (T('nadie') - c, 1.7, 0.24, 0.6),
          (T('igual', 2) - c, 1.55, 0.5, 0.22), (T('no', -1) - c, 1.5, 0.5, 0.24), (T('vida') + 0.2, 1.3, 0.5, 0.4)]
import copy
nuevos = []
for t, z, gx, gy in GOLPES:
    base = [p for p in P if p['t0'] <= t][-1]
    g = copy.deepcopy(base)
    f = g['fondo']
    for cmb in g.get('cambios', []):
        if cmb['t'] <= t:
            f = cmb['fondo']
    g.update(t0=t, zoom=z, cx=gx, cy=gy, fondo=f, cambios=[], seguido=True, golpe=True)
    g.pop('rotulos', None)
    if g.get('alterna', {}).get('hasta', 999) < t:
        g.pop('alterna')
    nuevos.append(g)
P = sorted(P + nuevos, key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.0
EF = []
for i, p in enumerate(P):                                   # golpe de aire en cada corte, pop en cada rótulo
    if i and not p.get('seguido'):
        EF.append([p['t0'] - 0.1, 'whoosh' if i % 2 else 'whoosh2', -16])
    if p.get('golpe'):
        EF.append([p['t0'] - 0.08, 'whoosh2', -18])
    EF += [[r['t0'], 'pop', -13] for r in p.get('rotulos', [])]
EF += [[T('haber') - 0.05, 'fanfarria', -12, 2.4], [T('medio'), 'basura', -11], [T('deja'), 'llanto', -16],
       [T('pdf') - 0.4, 'impresora', -16, 1.6], [T('casi'), 'ding', -16], [T('salud') - 0.05, 'desmayo', -10],
       [T('toxinas') - 0.2, 'brillo', -12], [T('total') - 0.05, 'mordisco', -12], [T('formación') - 0.4, 'trago', -12],
       [T('móvil') - 0.2, 'notificacion', -14]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in sorted(EF)]}, open('efectos/efectos.json', 'w'))
json.dump({'alineacion': 'voz/ni.json', 'audio': 'voz/ni.mp3', 'vel_letra': 0.03, 'sin_recolor': ['es_', 'br_'],
           'subtitulos': {'y': 230, 'tam': 80, 'max': 4, 'contorno': 14, 'mayusculas': True, 'cola': 0.2},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']))
