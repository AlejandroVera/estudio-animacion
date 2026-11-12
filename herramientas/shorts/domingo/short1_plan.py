import json
from comun import *
P = [
 esc('es_cama_mini', 0, fondo=I+'es_cama_mini_c.jpg', marco=1.55, cx=0.38, cambios=[ch(2.2, 'es_cama_mini_d')], rotulos=[R(0.62, 'TÓXICO', 540, 250, 'verde', 140)]),
 esc('es_ofi_jefa', 3.4, marco=1.6, cx=0.66, alterna=alt('es_ofi_jefa', 'es_ofi_jefa_b', 0.35)),
 esc('es_ofi_puerta', 5.8, cambios=[ch(6.88, 'es_ofi_puerta_b')]),
 esc('es_sofa_mini', 7.8, marco=1.6, cx=0.46, cambios=[ch(8.12, 'es_sofa_mini_b'), ch(9.42, 'es_sofa_mini_c')]),
 esc('es_cama_mini', 9.98, marco=1.55, cx=0.38, cambios=[ch(12.0, 'es_cama_mini_b')],
     rotulos=[D(10.6, '62', 602, 105, tam=60, t1=12.0), D(12.03, '4', 580, 60, 'rojo', 70)]),
 esc('es_bib_mito', 12.88, marco=1.75, cx=0.66, ly=-0.07, cambios=[ch(15.75, 'es_bib_mito_b')],
     objetos=[{'t0': 13.95, 't1': 15.78, 'img': I+'foto_han.png', 'x': 540, 'y': 300, 'w': 300}],
     rotulos=[R(13.95, 'BYUNG-CHUL HAN', 540, 70, 'blanco', 58, t1=15.78), R(13.95, 'Foto: ActuaLitté (CC BY-SA 2.0)', 540, 1860, 'blanco', 26, t1=15.78),
              R(15.8, 'PROMETEO', 540, 230, 'blanco', 110)]),
 br('br_prometeo', 16.82, marco=1.45, cx=0.5, cambios=[ch(18.93, 'br_prometeo_b')],
    alterna=alt('br_prometeo_b', 'br_prometeo_c', 0.3, desde=19.55, hasta=21.16)),
 esc('es_ofi_cadena', 21.16, alterna=alt('es_ofi_cadena', 'es_ofi_cadena_b', 0.18)),
 esc('es_roca_aguila', 24.33, marco=1.5, cx=0.42, alterna=alt('es_roca_aguila', 'es_roca_aguila_b', 0.35, desde=25.2)),
 br('br_prompul', 26.24, cx=0.42, alterna=alt('br_prompul_b', 'br_prompul', 0.09, desde=27.45)),
 br('br_muneca_b', 28.4, cx=0.5, alterna=alt('br_muneca_b', 'br_muneca', 0.09, desde=28.4, hasta=29.4),
    rotulos=[R(28.45, 'ENHORABUENA', 540, 230, 'negro', 110), D(30.96, '+12%', 995, 500, tam=44)]),
 esc('es_ofi_doble', 32.64, marco=1.35, cx=0.52, cambios=[ch(33.17, 'es_ofi_doble_b'), ch(33.78, 'es_ofi_doble_c'), ch(35.9, 'es_ofi_doble_d')],
     rotulos=[D(35.93, 'HUELGA', 417, 140, tam=44), D(35.93, 'HUELGA', 1745, 150, tam=44)]),
 esc('es_bano_pancarta', 36.8, marco=1.45, cx=0.56, cambios=[ch(39.05, 'es_bano_pancarta_b')], rotulos=[D(36.9, 'HUELGA', 1180, 320, tam=60)]),
]
P = lleno(P)
json.dump({'alineacion': 'voz/short1.json', 'audio': 'voz/short1.mp3', 'pantalon': 'gris', 'sin_recolor': ['es_cama_mini'], 'duracion': 41.6, 'planos': P},
          open('short1.json', 'w'), indent=1, ensure_ascii=False)
