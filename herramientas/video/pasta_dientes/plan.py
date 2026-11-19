"""Plan del vídeo vertical de la pasta de dientes (montar con herramientas/shorts/montar_vertical.py)."""
import json
I = 'img/'
def esc(n, t0, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'boca': I + n + '_boca.png', 'boca_o': I + n + '_bocao.png', 'zoom': 1.15}
    d.update(k); return d
def br(n, t0, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'habla': False, 'zoom': 1.02, 'cx': 0.5, 'cy': 0.5}; d.update(k); return d
def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b, c, **k): d = {'imgs': [I + a + '.jpg', I + b + '.jpg'], 'cada': c}; d.update(k); return d
def solo(*n): return [I + x + '.jpg' for x in n]
def R(t0, txt, x=540, y=130, col='negro', tam=110, **k):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True}; d.update(k); return d
def D(t0, txt, x, cy, col='negro', tam=95, **k):  # dentro del dibujo (ancho del dibujo = 1920); cy = centro del hueco
    return R(t0, txt, x, cy - 0.6 * tam, col, tam, en_dibujo=True, **k)

FILA = (309, 736, 1179, 1603)   # etiquetas de las cuatro cajas de menta (cy 1749)
P = [
 esc('es_entrada', 0, cambios=[ch(2.50, 'es_entrada_b')], boca_en=solo('es_entrada'),
     rotulos=[R(2.45, 'ANSiEDAD', 540, 1560, 'rojo', 130, caja=True)]),
 esc('es_fantasia', 3.36, cambios=[ch(4.49, 'es_fantasia_b')], boca_en=solo('es_fantasia')),
 esc('es_pasillo', 5.99, zoom=1.15, cambios=[ch(7.19, 'es_pasillo_b')], boca_en=solo('es_pasillo'),
     rotulos=[R(7.13, 'UN PASiLLO ENTERO', 540, 140, 'negro', 95, caja=True)]),
 br('br_estante', 8.11, rotulos=[R(8.05, 'BLANQUEADORA', 540, 250, 'negro', 105, caja=True),
                                 R(9.11, 'ENCÍAS SENSIBLES', 540, 560, 'negro', 95, caja=True),
                                 R(10.12, 'ANTiSARRO', 540, 870, 'negro', 115, caja=True)]),
 esc('es_fluor', 11.13, zoom=1.0, cx=0.5, cy=0.5, cambios=[ch(11.36, 'es_fluor_b'), ch(12.15, 'es_fluor_c')],
     rotulos=[R(11.3, 'CON FLÚOR', 540, 1560, 'rojo', 110, caja=True, t1=12.05), R(12.09, 'SiN FLÚOR', 540, 1560, 'azul', 110, caja=True)]),
 esc('es_carbon', 12.95, cambios=[ch(15.66, 'es_carbon_b')], boca_en=solo('es_carbon'),
     rotulos=[R(13.2, 'CARBÓN', 540, 130, 'negro', 130)]),
 br('br_triple', 16.53, rotulos=[R(17.07, 'TRiPLE ACCiÓN', 540, 230, 'azul', 100, caja=True, t1=17.95),
                                 D(17.2, 'x3', 394, 1759, 'azul', 150),
                                 R(17.97, 'PROTECCiÓN TOTAL', 540, 230, 'rojo', 90, caja=True, t1=19.45),
                                 D(18.1, '100%', 924, 1759, 'rojo', 110),
                                 R(19.49, '12 EN 1', 540, 230, 'negro', 130, caja=True),
                                 D(19.55, '12', 1521, 1600, 'negro', 160), D(19.8, 'EN 1', 1521, 1800, 'negro', 95)]),
 esc('es_doce', 20.34, cambios=[ch(21.85, 'es_doce_b')], boca_en=solo('es_doce'),
     rotulos=[R(20.4, '¿12 QUÉ?', 540, 130, 'negro', 130, t1=21.6)]),
 br('br_onu', 22.84, alterna=alt('br_onu', 'br_onu_b', 0.4), rotulos=[R(23.7, 'ONU', 540, 1740, 'azul', 150)]),
 esc('es_menta', 24.45, cambios=[ch(26.25, 'es_menta_b')], boca_en=solo('es_menta'),
     rotulos=[R(25.5, 'MENTA', 540, 130, 'verde', 130)]),
 br('br_fresca', 27.36, rotulos=[D(28.45, 'MENTA', 976, 1640, 'verde', 80), D(28.75, 'FRESCA', 976, 1790, 'verde', 80)]),
 br('br_fila', 29.42, zoom=1.15, rotulos=[R(29.42, 'MENTA FRESCA', 540, 220, 'verde', 95, caja=True, t1=30.05),
                                          D(29.42, 'FRESCA', FILA[0], 1749, 'verde', 52),
                                          R(30.1, 'MENTA iNTENSA', 540, 220, 'verde', 95, caja=True),
                                          D(30.1, 'iNTENSA', FILA[1], 1749, 'verde', 50)]),
 esc('es_duda', 31.19, rotulos=[R(31.7, 'MENTA SUAVE', 540, 130, 'verde', 100, caja=True)]),
 br('br_fila', 32.71, zoom=1.15, cambios=[ch(33.2, 'br_fila_b')],
    rotulos=[D(32.71, 'FRESCA', FILA[0], 1749, 'verde', 52), D(32.71, 'iNTENSA', FILA[1], 1749, 'verde', 50),
             D(32.71, 'SUAVE', FILA[2], 1749, 'verde', 55), D(33.2, 'GLACiAL', FILA[3], 1749, 'azul', 50),
             R(33.2, 'MENTA GLACiAL', 540, 220, 'azul', 95, caja=True)]),
 esc('es_medio', 34.0, zoom=1.0, cx=0.5, cy=0.5, cambios=[ch(37.02, 'es_medio_b')], boca_en=solo('es_medio'),
     rotulos=[R(34.8, 'LA DEL MEDiO', 540, 130, 'negro', 110, caja=True)]),
 esc('es_vino', 37.86, zoom=1.2, cambios=[ch(38.85, 'es_vino_b')], boca_en=solo('es_vino', 'es_vino_b')),
 esc('es_caja', 39.95, zoom=1.0, cx=0.5, cy=0.5, cambios=[ch(40.59, 'es_caja_b'), ch(41.10, 'es_caja_c'), ch(42.15, 'es_caja_d'), ch(43.67, 'es_caja_e')],
     boca_en=solo('es_caja', 'es_caja_b', 'es_caja_c', 'es_caja_d'),
     rotulos=[R(40.53, '¿BOLSA?', 540, 1240, 'rojo', 95, caja=True),
              R(41.06, '¿GRANDE O PEQUEÑA?', 540, 1380, 'rojo', 85, caja=True),
              R(42.11, '¿TARJETA O EFECTiVO?', 540, 1520, 'rojo', 80, caja=True),
              R(43.65, '¿TiQUE EN PAPEL', 540, 1660, 'rojo', 80, caja=True), R(44.6, 'O EN LA APP?', 540, 1790, 'rojo', 80, caja=True)]),
 esc('es_bano', 46.05, cambios=[ch(48.03, 'es_bano_b'), ch(48.71, 'es_bano_c')], boca_en=solo('es_bano', 'es_bano_c')),
 esc('es_cepillos', 50.43, zoom=1.2, cambios=[ch(51.81, 'es_cepillos_b')], boca_en=solo('es_cepillos'),
     rotulos=[R(51.6, 'OTRO PASiLLO', 540, 140, 'rojo', 110, caja=True)]),
]
json.dump({'alineacion': 'voz/pasta.json', 'audio': 'voz/pasta.mp3', 'pantalon': 'gris', 'sin_recolor': ['br_'],
           'vel_letra': 0.03, 'subtitulos': {'y': 230, 'tam': 76, 'cambiar': {'búmer': 'boomer', 'Búmer': 'Boomer'}},
           'duracion': 54.4, 'planos': P}, open('plan.json', 'w'), indent=1, ensure_ascii=False)
