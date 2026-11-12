import json
from comun import *
P = [
 esc('es_ofi_doble', 0, cx=0.76, rotulos=[R(0.69, 'TÓXICO', 540, 1680, 'verde', 150)]),
 esc('es_ofi_doble', 2.25, fondo=I + 'es_ofi_doble_b.jpg', marco=1.35, cx=0.52, boca_en=[I + 'es_ofi_doble.jpg', I + 'es_ofi_doble_b.jpg'],
     rotulos=[R(2.57, 'YO', 540, 260, 'rojo', 190)]),
 esc('es_ofi_jefa', 3.4, marco=1.6, cx=0.66, alterna=alt('es_ofi_jefa', 'es_ofi_jefa_b', 0.35)),
 esc('es_ofi_puerta', 5.8, cambios=[ch(6.91, 'es_ofi_puerta_b')]),
 esc('es_sofa_mini', 7.55, marco=1.6, cx=0.46, cambios=[ch(7.87, 'es_sofa_mini_b')]),
 br('pulsera_quieta', 8.5, cx=0.5, cambios=[ch(9.07, 'pulsera_vibra')], rotulos=[R(9.07, '8.432 PASOS', 540, 330, 'negro', 110)]),
 esc('es_cama_mini', 10.38, marco=1.55, cx=0.38, cambios=[ch(12.34, 'es_cama_mini_b')],
     rotulos=[D(10.94, '62', 602, 105, tam=60, t1=12.34), D(12.37, '4', 580, 60, 'rojo', 70)]),
 esc('es_bib_mito', 13.89, marco=1.6, cx=0.62, cambios=[ch(16.75, 'es_bib_mito_b')],
     objetos=[{'t0': 14.96, 't1': 16.79, 'img': I+'foto_han.png', 'x': 540, 'y': 300, 'w': 300}],
     rotulos=[R(14.96, 'BYUNG-CHUL HAN', 540, 70, 'blanco', 58, t1=16.79), R(14.96, 'Foto: ActuaLitté (CC BY-SA 2.0)', 540, 1860, 'blanco', 26, t1=16.79),
              R(16.8, 'PROMETEO', 540, 230, 'blanco', 110)]),
 br('br_prometeo', 17.83, marco=1.45, cx=0.5, cambios=[ch(19.97, 'br_prometeo_b')],
    alterna=alt('br_prometeo_b', 'br_prometeo_c', 0.3, desde=20.61, hasta=22.17)),
 esc('es_ofi_cadena', 22.17, alterna=alt('es_ofi_cadena', 'es_ofi_cadena_b', 0.18)),
 esc('es_roca_aguila', 25.34, marco=1.5, cx=0.42, alterna=alt('es_roca_aguila', 'es_roca_aguila_b', 0.35, desde=26.23)),
 br('br_prompul', 27.15, cx=0.42, alterna=alt('br_prompul_b', 'br_prompul', 0.09, desde=28.57)),
 br('br_muneca_b', 29.53, cx=0.5, alterna=alt('br_muneca_b', 'br_muneca', 0.09, desde=29.53, hasta=30.54),
    rotulos=[R(29.58, 'ENHORABUENA', 540, 230, 'negro', 110), D(32.11, '+12%', 995, 500, tam=44)]),
 esc('es_ofi_doble', 33.77, marco=1.35, cx=0.52, cambios=[ch(34.32, 'es_ofi_doble_b'), ch(34.94, 'es_ofi_doble_c'), ch(37.07, 'es_ofi_doble_d')],
     rotulos=[D(37.1, 'HUELGA', 417, 140, tam=44), D(37.1, 'HUELGA', 1745, 150, tam=44)]),
 esc('es_bano_pancarta', 37.93, marco=1.45, cx=0.56, rotulos=[D(38.0, 'HUELGA', 1180, 320, tam=60)]),
]
P = lleno(P)
json.dump({'alineacion': 'voz/short1.json', 'audio': 'voz/short1.mp3', 'pantalon': 'gris', 'sin_recolor': ['es_cama_mini'], 'duracion': 42.6, 'planos': P},
          open('short1.json', 'w'), indent=1, ensure_ascii=False)
