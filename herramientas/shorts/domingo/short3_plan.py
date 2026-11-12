import json
from comun import *
def be(*n): return {'boca_en': [I + x + '.jpg' for x in n]}
P = [
 br('fabrica', 0, marco=1.5, cx=0.6, alterna=alt('fabrica', 'fabrica_b', 0.55), rotulos=[R(0.84, '40 AÑOS', 540, 250, 'rojo', 130)]),
 br('fabrica_sirena', 2.37, marco=1.5, cx=0.45, alterna=alt('fabrica_sirena', 'fabrica_sirena_b', 0.3, hasta=4.04), rotulos=[R(2.66, '18:00', 540, 250, 'rojo', 130)]),
 br('abuelo_sofa', 4.04, marco=1.5, cx=0.5, parpadeo=I + 'abuelo_sofa_b.jpg', rotulos=[R(5.42, 'NADA', 540, 250, 'negro', 140)]),
 esc('es_cama_cansado', 6.07, marco=1.5, cx=0.5, rotulos=[R(6.51, 'SiN ENCARGADO', 540, 230, 'negro', 90), R(7.08, 'SiN SiRENA', 540, 350, 'negro', 90),
     R(8.22, 'MÁS CANSADO', 540, 1650, 'rojo', 110)]),
 br('abuelo_nino', 9.21, marco=1.5, cx=0.85, cambios=[ch(9.5, 'abuelo_nino_b')],
    objetos=[{'t0': 9.3, 'img': 'inv:capas/a_interrogacion.webp', 'x': 1012, 'y': 900, 'w': 70}]),
 br('fabrica_encargado', 9.97, marco=1.5, cx=0.4, alterna=alt('fabrica_encargado', 'fabrica_encargado_b', 0.28, desde=10.5),
    rotulos=[R(11.3, 'NO', 540, 260, 'rojo', 190)]),
 esc('es_fab_no', 12.35, marco=1.45, cx=0.5, cambios=[ch(13.41, 'es_fab_no_b'), ch(14.28, 'es_fab_no_c')], **be('es_fab_no'),
     rotulos=[R(12.68, 'NO', 540, 260, 'rojo', 190)]),
 esc('es_gym_salto', 15.31, cx='auto', cambios=[ch(18.98, 'es_gym_salto_b'), ch(19.59, 'es_gym_salto_c')], **be('es_gym_salto'),
     bocas={I + 'es_gym_salto_c.jpg': [I + 'es_gym_salto_c_boca.png', I + 'es_gym_salto_c_bocao.png']},
     rotulos=[D(17.51, 'TÚ PUEDES', 1020, 60, tam=80)]),
 esc('es_gym_espejo', 20.07, marco=1.5, cx=0.6, boca_o=I+'es_gym_espejo_boca.png', alterna=alt('es_gym_espejo', 'es_gym_espejo_b', 0.35), rotulos=[R(21.06, 'A Ti', 540, 260, 'rojo', 170)]),
 esc('es_gym_senal', 22.14, marco=1.5, cx=0.6, cambios=[ch(23.08, 'es_gym_senal_b')], **be('es_gym_senal', 'es_gym_senal_b')),
 br('br_gym_cinta', 23.78, zoom=1.5, cx=0.3, cy=0.5, alterna=alt('br_gym_cinta', 'br_gym_cinta_b', 0.16), rotulos=[R(25.38, 'NUNCA', 540, 1720, 'rojo', 170)]),
 br('br_abuelo_banco', 26.3, marco=1.5, cx=0.45, alterna=alt('br_abuelo_banco', 'br_abuelo_banco_b', 0.6)),
 esc('es_banco_abuelo', 29.08, marco=1.5, cx=0.45, cambios=[ch(30.74, 'es_banco_abuelo_b'), ch(32.5, 'es_banco_abuelo_c')], **be('es_banco_abuelo', 'es_banco_abuelo_b')),
]
json.dump({'alineacion': 'voz/short3.json', 'audio': 'voz/short3.mp3', 'pantalon': 'gris', 'duracion': 34.6, 'planos': P},
          open('short3.json', 'w'), indent=1, ensure_ascii=False)
