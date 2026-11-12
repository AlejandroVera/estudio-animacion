import json
from comun import *
def be(n): return {'boca_en': [I + n + '.jpg']}
M = lambda t: R(t, 'MÓVIL', 540, 250, 'rojo', 130)
P = [
 esc('es_salon_prohibido', 0, marco=1.5, cx=0.42, cambios=[ch(1.23, 'es_salon_prohibido_b')], **be('es_salon_prohibido'),
     rotulos=[R(1.25, 'ABURRIRSE', 540, 250, 'negro', 120)]),
 esc('es_super_cola', 2.29, marco=1.45, cx=0.62, cambios=[ch(3.52, 'es_super_cola_b')], **be('es_super_cola'), rotulos=[M(3.52)]),
 esc('es_cocina_micro', 4.41, marco=1.5, cx=0.6, cambios=[ch(6.41, 'es_cocina_micro_b')], **be('es_cocina_micro'),
     rotulos=[D(5.32, '1:30', 1506, 562, 'verde', 34), M(6.41)]),
 esc('es_calle_semaforo', 7.3, marco=1.55, cx=0.58, cambios=[ch(8.56, 'es_calle_semaforo_b')], **be('es_calle_semaforo'), rotulos=[M(8.56)]),
 esc('es_sofa_movil', 9.58, marco=1.5, cx=0.5, cambios=[ch(11.59, 'es_sofa_movil_b')], **be('es_sofa_movil'),
     rotulos=[R(10.94, '+4 HORAS', 540, 230, 'rojo', 130), R(11.0, 'AL DÍA', 540, 370, 'rojo', 90), R(9.6, 'Fuente: Rastreator', 540, 1860, 'blanco', 26)]),
 esc('es_balcon_hamaca', 12.33, marco=1.45, cx=0.6, cambios=[ch(14.01, 'es_balcon_hamaca_b')], habla=False,
     rotulos=[R(14.03, 'OPTiMiZAMOS', 540, 250, 'negro', 110)]),
 esc('es_cama_mini', 15.19, marco=1.55, cx=0.38, rotulos=[D(15.73, '62', 602, 105, tam=60)]),
 esc('es_salon_medita', 16.64, marco=1.5, cx=0.4, cambios=[ch(17.45, 'es_salon_medita_b')], habla=False,
     rotulos=[R(17.47, 'RACHA: 14 DÍAS', 540, 250, 'rojo', 90)]),
 br('es_ofi_siesta', 18.25, marco=1.5, cx=0.55, cambios=[ch(18.96, 'es_ofi_siesta_b')]),
 br('br_evolucion', 19.97, marco=1.0, cx=0.5, alterna=alt('br_evolucion', 'br_evolucion_b', 0.3),
    objetos=[{'t0': 19.97, 't1': 21.3, 'img': I + 'foto_han.png', 'x': 540, 'y': 330, 'w': 300}],
    rotulos=[R(19.97, 'BYUNG-CHUL HAN', 540, 90, 'blanco', 58, t1=21.3), R(21.4, 'MULTiTAREA', 540, 300, 'negro', 120),
             R(23.12, 'VOLVER ATRÁS', 540, 1620, 'rojo', 100)]),
 br('br_conejo', 24.23, marco=1.3, cx=0.5, alterna=alt('br_conejo', 'br_conejo_b', 0.4), rotulos=[R(24.89, 'ANiMAL SALVAJE', 540, 250, 'negro', 100)]),
 esc('es_sofa_multi', 28.69, marco=1.45, cx=0.5, cambios=[ch(30.46, 'es_sofa_multi_b'), ch(30.92, 'es_sofa_multi_c'), ch(31.51, 'es_sofa_multi_d')],
     **be('es_sofa_multi')),
 esc('es_sofa_ardilla', 33.81, cx='auto', alterna=alt('es_sofa_ardilla', 'es_sofa_ardilla_b', 0.3, hasta=36.6),
     cambios=[ch(36.6, 'es_sofa_ardilla_c')], **be('es_sofa_ardilla')),
]
json.dump({'alineacion': 'voz/short2.json', 'audio': 'voz/short2.mp3', 'pantalon': 'gris', 'sin_recolor': ['es_cama_mini'], 'duracion': 39.1, 'planos': P},
          open('short2.json', 'w'), indent=1, ensure_ascii=False)
