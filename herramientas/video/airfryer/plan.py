"""Plan del vídeo vertical de la air fryer y el Black Friday (chico rosa narrador). Montar con
herramientas/shorts/montar_vertical.py. Todos los tiempos salen de la voz (T('palabra', n) = inicio de la n-ésima
aparición), así que si se rehace la voz todo se recoloca solo. Escribe también efectos/efectos.json."""
import copy, json, os
import numpy as np
from PIL import Image
I = 'img/'
PAL = [w for w in json.load(open('voz/air.json'))['palabras'] if w['tipo'] == 'word']


def T(palabra, n=0):
    lim = lambda x: x.strip('¿?¡!.,;:').lower()
    return [p['inicio'] for p in PAL if lim(p['texto']) == lim(palabra)][n]


c = 0.06


def boca(b):
    while not os.path.exists(I + b + '_boca.png') and '_' in b[3:]:
        b = b.rsplit('_', 1)[0]
    return I + b + '_boca.png'


def esc(n, t0, bocas=None, **k):
    """bocas: dibujos del plano donde él tiene boca (cada uno con la suya o la de su base)"""
    bocas = bocas if bocas is not None else [n]
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'zoom': 1.0, 'cx': 0.5, 'cy': 0.5,
         'bocas': {I + b + '.jpg': [boca(b)] for b in bocas}, 'habla': bool(bocas)}
    d.update(k)
    return d


def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b, cada, desde=0, hasta=999): return {'imgs': [I + a + '.jpg', I + b + '.jpg'], 'cada': cada, 'desde': desde, 'hasta': hasta}


def R(t0, txt, x, y, col='negro', tam=120, t1=None, caja=False):
    """rótulo en coordenadas de PANTALLA (1080x1920); y = parte de arriba del texto"""
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True, 'caja': caja}
    if t1:
        d['t1'] = t1
    return d


def Rc(t0, txt, cx, cy, col='negro', tam=120, t1=None, caja=False):
    """rótulo centrado en un hueco del dibujo (centro del hueco en pantalla)"""
    return R(t0, txt, cx, cy - 0.62 * tam, col, tam, t1, caja)


b = 0.1   # rótulos un poco antes de su palabra
P = [
    # «Llevo cinco meses esperando al Black Friday para comprarme la air fryer»: en su sofá, abrazado al portátil
    esc('es_espera', 0, rotulos=[R(T('cinco') - b, '5 MESES', 760, 300, 'rojo', 110, T('black') + 0.3, caja=True)]),
    # «Desde junio. Que en verano no se fríe nada, pero yo ya la vigilaba»: en la playa; prismáticos en «vigilaba»
    esc('es_verano_c', T('desde') - c, ['es_verano_c'], cambios=[ch(T('pero') - c, 'es_verano_b')],
        rotulos=[R(T('junio') - b, 'JUNiO', 700, 1450, 'rojo', 120, T('que') - 0.05, caja=True)]),
    # «A 69.»: la web, el precio en su recuadro
    esc('br_web', T('a', 0) - c, [], rotulos=[Rc(T('69') - b, '69 €', 607, 1116, 'negro', 170)]),
    # «Todas las semanas entraba a mirarla, como quien va a ver a un familiar al hospital»: la air fryer en la cama
    # del hospital; «69. 69. 69.» en el monitor (la acaricia); «en octubre, de repente, 129»: alarma y salta
    # «Todas las semanas entraba a mirarla»: en el sofá mirándola en el portátil (el hospital entra en «como quien»)
    esc('es_espera', T('todas') - c),
    esc('es_hospital', T('como') - c, ['es_hospital', 'es_hospital_b'],
        cambios=[ch(T('69', 1) - c, 'es_hospital_b'), ch(T('129') - c, 'es_hospital_c')],
        rotulos=[Rc(T('69', 1) - 0.05, '69', 518, 480, 'verde', 120, T('69', 2) - 0.05),
                 Rc(T('69', 2) - 0.05, '69', 518, 480, 'verde', 120, T('69', 3) - 0.05),
                 Rc(T('69', 3) - 0.05, '69', 518, 480, 'verde', 120, T('y', 0) - 0.05),
                 R(T('octubre') - b, 'OCTUBRE', 540, 1500, 'negro', 110, T('129') - c, caja=True),
                 Rc(T('129') - 0.02, '129', 505, 485, 'blanco', 120)]),
    # «Y me llega el correo. Black Friday. El 3 de noviembre.»: el móvil con el correo
    esc('br_correo', T('y', 1) - c, [], rotulos=[Rc(T('black', 1) - b, 'BLACK', 548, 590, 'blanco', 120),
                                                 Rc(T('friday', 1) - b, 'FRiDAY', 548, 730, 'blanco', 120),
                                                 Rc(T('3') - b, '3 NOV', 548, 880, 'rojo', 110, caja=True)]),
    # «Que el viernes es el 28, pero por lo visto ahora el viernes dura un mes entero»: el calendario todo negro
    esc('es_calendario', T('que', 1) - c, rotulos=[Rc(T('28') - b, '28', 766, 987, 'rojo', 80),
                                                   R(T('mes') - b, '1 MES ENTERO', 540, 1640, 'rojo', 110, caja=True)]),
    # «Entro corriendo y ahí está mi air fryer»: corre hacia el sofá
    # (la v1 alternaba dos posturas distintas y parecía que daba saltitos: ahora de lado, con líneas de velocidad)
    esc('es_corre2', T('entro') - c, [], zoom=1.55, cx=0.36, cy=0.6),
    # «…y ahí está mi air fryer. Antes 129, ahora 69. Un 46 % de descuento.»: la web
    esc('br_web', T('ahí') - c, [], rotulos=[Rc(T('129', 1) - b, '129 €', 607, 1116, 'negro', 170, T('69', 4) - b),
                                               Rc(T('69', 4) - b, '69 €', 607, 1116, 'rojo', 170),
                                               R(T('46') - b, '-46 %', 760, 330, 'rojo', 130, caja=True)]),
    # «O sea que he esperado cinco meses para pagar lo mismo que en junio.»: serio a cámara; «Pero con ilusión»: sonrisa forzada
    esc('es_espera_seco', T('o', 0) - c, ['es_espera_seco'], cambios=[ch(T('ilusión') - c, 'es_espera_ilusion')]),
    # «Y encima me pone que solo quedan 3 unidades y que 14 personas la están viendo ahora mismo»: la gente en la ventana
    esc('es_espera', T('y', 3) - c, ['es_espera', 'es_espera_ventana'], cambios=[ch(T('14') - c, 'es_espera_ventana')],
        rotulos=[R(T('3', 1) - b, 'QUEDAN 3', 760, 1480, 'rojo', 110, T('14') - 0.15, caja=True)]),
    # «Así que la meto en el carrito para pensármelo…»: el carrito del súper en el salón, tomando té
    esc('es_carrito', T('así') - c),
    # «Decido comprarla. Envío gratis, de 7 a 10 días laborables.»: aprieta la tecla
    # (la v1 tenía una mano rara aporreando el teclado: ahora cara decidida y el dedo pulsando el botón de la web)
    esc('es_decide', T('decido') - c),
    esc('br_web_clic', T('envío') - 0.25, [], rotulos=[Rc(T('envío') - b, 'ENViO GRATiS', 607, 1116, 'verde', 80, T('7') - 0.05),
                                                          Rc(T('7') - b, '7-10 DÍAS', 607, 1116, 'negro', 95, T('o', 1) - 0.1)]),
    # «O sea que llega para Reyes»: los Reyes Magos con la caja en el camello
    esc('br_reyes', T('reyes') - c, [], alterna=alt('br_reyes', 'br_reyes_b', 0.4)),
    # «Y el lunes, Cyber Monday. La misma air fryer, a 59. Diez euros menos por esperar tres días más.»: de noche, llorando
    esc('es_cyber', T('cyber') - c, rotulos=[R(T('59') - b, '59 €', 760, 1500, 'rojo', 140, T('diez') - 0.05, caja=True),
                                             R(T('diez') - b, '-10 €', 760, 1500, 'rojo', 140, T('por', 1) - 0.05, caja=True)]),
    # «Quiero devolverla, pero para devolverla primero tiene que llegar»: esperando en la puerta, sin paquete
    esc('es_puerta2', T('quiero') - c),
    # «Luego hay que llevarla a un punto de recogida que cierra a las siete»: bajan la persiana; cerrada en «siete»
    esc('br_punto', T('luego') - c, [], cambios=[ch(T('siete') - c, 'br_punto_b')]),
    # «Yo salgo a las siete»: en la oficina con el reloj a las siete; se levanta en «siete»
    esc('es_oficina', T('yo', 1) - c, ['es_oficina'], sub_y=1700, cambios=[ch(T('siete', 1) - c, 'es_oficina_b')]),
    # «Me escribe mi madre. Hijo, ¿qué te pido para Navidad?»: su madre escribiendo
    esc('br_madre', T('me', 2) - c, [], alterna=alt('br_madre', 'br_madre_b', 0.22)),
    # «Le digo que nada, que ya tengo la air fryer»: contestando orgulloso
    esc('es_lee', T('le') - c),
    # «¿Y para qué la quieres tú, si no cocinas?, me dice»: la madre con la ceja levantada
    esc('br_madre_c', T('y', 6) - c, []),
    # «Pues tiene toda la razón»: resignado a cámara
    esc('es_final', T('pues') - c, cambios=[ch(PAL[-1]['fin'] + 0.35, 'es_final_b')]),   # remate: suspiro derrotado
]

# GOLPES DE ZOOM en los remates: copia del plano acercándose a su cara (centro sacado de su capa de boca)
CARA_FIJA = {'es_hospital_c': (0.72, 0.36), 'es_espera_ilusion': (0.45, 0.32)}


def cara(fondo):
    n = os.path.basename(fondo)[:-4]
    if n in CARA_FIJA:
        return CARA_FIJA[n]
    a = np.asarray(Image.open(boca(n)).getchannel('A'))
    ys, xs = np.nonzero(a > 10)
    return xs.mean() / a.shape[1], ys.mean() / a.shape[0] - 0.04


GOLPES = [('hospital', 0, 1.4, '69', 1),
          ('ilusión', 0, 1.45, None, 0), ('precipitarse', 0, 1.35, None, 0), ('más', 0, 1.4, None, 0),
          ('siete', 1, 1.3, None, 0), ('razón', 0, 1.4, None, 0)]
nuevos = []
for pal, n, z, vuelta, nv in GOLPES:
    t = T(pal, n) - c
    base = [p for p in P if p['t0'] <= t][-1]
    g = copy.deepcopy(base)
    f = base['fondo']
    for cmb in base.get('cambios', []):
        if cmb['t'] <= t:
            f = cmb['fondo']
    cx, cy = cara(f)
    g.update(t0=t, zoom=z, cx=round(cx, 3), cy=round(cy, 3))
    g.pop('rotulos', None)
    nuevos.append(g)
    if vuelta:
        v = copy.deepcopy(base); v['t0'] = T(vuelta, nv) - c; nuevos.append(v)
P = sorted(P + nuevos, key=lambda p: p['t0'])
FIN = PAL[-1]['fin'] + 2.0
json.dump({'alineacion': 'voz/air.json', 'audio': 'voz/air.mp3', 'sin_recolor': ['es_', 'br_'], 'vel_letra': 0.03,
           'subtitulos': {'y': 230, 'tam': 76, 'cola': 0.15, 'cambiar': {'air fryer': 'air fryer'}},
           'duracion': round(FIN, 2), 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
for p in P:
    print(round(p['t0'], 2), os.path.basename(p['fondo']), p.get('zoom'))

# EFECTOS (sin música), en el segundo de su gag
EF = [[T('desde') - 0.1, 'olas', -10, 3.4], [T('69') - 0.05, 'pop', -9], [T('todas') - 0.2, 'whoosh', -12],
      [T('69', 1), 'pitido', -8, 0.5], [T('69', 2), 'pitido', -8, 0.5], [T('69', 3), 'pitido', -8, 0.5],
      [T('129'), 'alarma', -7, 1.0], [T('me', 0) - 0.05, 'notificacion', -8], [T('28'), 'pop', -10],
      [T('entro') - 0.05, 'pasos', -8, 2.1], [T('69', 4), 'caja', -8], [T('46'), 'pop', -9],
      [T('14'), 'murmullo', -9, 1.8], [T('envío') - 0.2, 'clic', -6], [T('reyes') - 0.2, 'whoosh2', -12],
      [T('reyes'), 'cascabel', -10, 1.3], [T('59'), 'golpe', -8], [T('quiero'), 'tap', -9, 2.8],
      [T('luego') + 0.1, 'persiana', -9, 2.4], [T('yo', 1), 'tictac', -9, 1.0], [T('me', 2) - 0.15, 'whoosh', -12],
      [T('me', 2) + 0.2, 'tecleo', -10, 2.4], [T('le') - 0.1, 'notificacion', -10], [T('y', 6) - 0.1, 'tecleo', -11, 1.6], [PAL[-1]['fin'] + 0.35, 'suspiro', -9, 1.6]]
json.dump({'nivel': -24, 'efectos': [[round(e[0], 2)] + e[1:] for e in EF]}, open('efectos/efectos.json', 'w'))
