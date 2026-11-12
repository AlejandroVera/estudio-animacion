import json
from comun import *
def be(*n): return {'boca_en': [I + x + '.jpg' for x in n]}
P = [
 br('fabrica', 0, marco=1.5, cx=0.6, alterna=alt('fabrica', 'fabrica_b', 0.55), rotulos=[R(0.8, '40 AÑOS', 540, 250, 'rojo', 130)]),
 br('abuelo_sofa', 2.12, marco=1.5, cx=0.5, parpadeo=I + 'abuelo_sofa_b.jpg', rotulos=[R(3.38, 'NUNCA CANSADO', 540, 250, 'negro', 100)]),
 esc('es_ofi_humo', 4.27, marco=1.6, cx=0.45, cambios=[ch(7.23, 'es_ofi_humo_b')],
     rotulos=[R(5.5, 'SiN ENCARGADO', 540, 200, 'negro', 95), R(6.07, 'SiN SiRENA', 540, 330, 'negro', 95)]),
 br('abuelo_nino', 7.88, marco=1.5, cx=0.85, cambios=[ch(8.13, 'abuelo_nino_b')],
    objetos=[{'t0': 7.95, 'img': 'inv:capas/a_interrogacion.webp', 'x': 1012, 'y': 900, 'w': 70}]),
 br('fabrica_encargado', 8.96, marco=1.5, cx=0.4, alterna=alt('fabrica_encargado', 'fabrica_encargado_b', 0.28, desde=9.87),
    rotulos=[R(9.87, 'NO', 540, 230, 'rojo', 170), R(10.59, 'NO TE PARES', 540, 1580, 'rojo', 90), R(11.45, 'NO HABLES', 540, 1710, 'rojo', 90)]),
 br('fabrica_sirena', 12.21, marco=1.5, cx=0.45, alterna=alt('fabrica_sirena', 'fabrica_sirena_b', 0.3), rotulos=[R(12.57, '18:00', 540, 1700, 'rojo', 150)]),
 esc('es_fab_no', 13.8, marco=1.45, cx=0.5, cambios=[ch(15.17, 'es_fab_no_b'), ch(16.15, 'es_fab_no_c')], **be('es_fab_no'),
     rotulos=[R(14.22, 'NO', 540, 260, 'rojo', 190)]),
 esc('es_gym_salto', 17.76, cx='auto', cambios=[ch(21.18, 'es_gym_salto_b'), ch(21.78, 'es_gym_salto_c')], **be('es_gym_salto'),
     bocas={I + 'es_gym_salto_c.jpg': [I + 'es_gym_salto_c_boca.png', I + 'es_gym_salto_c_bocao.png']},
     rotulos=[D(19.73, 'TÚ PUEDES', 1020, 60, tam=80)]),
 esc('es_gym_espejo', 22.4, marco=1.5, cx=0.6, boca_o=I + 'es_gym_espejo_boca.png', alterna=alt('es_gym_espejo', 'es_gym_espejo_b', 0.35),
     rotulos=[R(22.52, 'CULPA TUYA', 540, 260, 'rojo', 120)]),
 esc('es_gym_senal', 23.86, marco=1.5, cx=0.6, cambios=[ch(25.0, 'es_gym_senal_b')], **be('es_gym_senal', 'es_gym_senal_b')),
 br('br_gym_cinta', 25.91, zoom=1.5, cx=0.3, cy=0.5, alterna=alt('br_gym_cinta', 'br_gym_cinta_b', 0.16), rotulos=[R(27.99, 'NUNCA', 540, 1720, 'rojo', 170)]),
 br('br_abuelo_banco', 28.84, marco=1.8, cx=0.45, alterna=alt('br_abuelo_banco', 'br_abuelo_banco_b', 0.6), rotulos=[R(31.3, 'SiN HACER NADA', 540, 250, 'negro', 100)]),
 esc('es_parque_banco', 32.37, marco=1.8, cx=0.4, **be('es_parque_banco', 'es_parque_banco_b'),
     alterna=alt('es_parque_banco', 'es_parque_banco_b', 0.25, desde=33.99), rotulos=[R(34.44, '2 MiNUTOS', 540, 250, 'rojo', 120)]),
]
P = lleno(P)
json.dump({'alineacion': 'voz/short3.json', 'audio': 'voz/short3.mp3', 'pantalon': 'gris', 'duracion': 37.6, 'planos': P},
          open('short3.json', 'w'), indent=1, ensure_ascii=False)
