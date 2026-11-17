"""Plan del vídeo vertical del QR (montar con herramientas/shorts/montar_vertical.py)."""
import json
I = 'img/'
def esc(n, t0, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'boca': I + n + '_boca.png', 'boca_o': I + n + '_bocao.png', 'zoom': 1.45}
    d.update(k); return d
def br(n, t0, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'habla': False, 'zoom': 1.02, 'cx': 0.5, 'cy': 0.5}; d.update(k); return d
def movil(n, t0, **k):
    return br(n, t0, zoom=1.35, cx=0.498, cy=0.38, **k)
def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b, c, **k): d = {'imgs': [I + a + '.jpg', I + b + '.jpg'], 'cada': c}; d.update(k); return d
def R(t0, txt, x, y, col='negro', tam=110, **k):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True}; d.update(k); return d
def D(t0, txt, x, cy, col='negro', tam=95, **k):  # dentro del dibujo (unidades: ancho del dibujo = 1920); cy = centro del hueco
    return R(t0, txt, x, cy - 0.6 * tam, col, tam, en_dibujo=True, **k)

P = [
 esc('es_llega', 0, cambios=[ch(3.16, 'es_llega_b')], boca_en=[I + 'es_llega.jpg', I + 'es_llega_b.jpg']),
 br('br_qr', 3.85, cambios=[ch(5.17, 'br_qr_ketchup')]),
 esc('es_escanea', 6.56),
 movil('br_cookies', 7.74, rotulos=[R(8.85, 'COOKiES', 540, 120, 'negro', 120)]),
 esc('es_cubiertos', 9.95, cambios=[ch(11.44, 'es_cubiertos_b')], boca_en=[I + 'es_cubiertos.jpg', I + 'es_cubiertos_b.jpg']),
 movil('br_acepto', 12.25),
 movil('br_form', 13.33, rotulos=[R(13.85, 'REGÍSTRATE', 540, 110, 'negro', 110)]),
 esc('es_lee', 14.85, rotulos=[R(14.95, 'MEJOR EXPERiENCiA', 540, 150, 'negro', 85, caja=True)]),
 movil('br_form', 16.25, rotulos=[R(15.6, 'REGÍSTRATE', 540, 110, 'negro', 110),
                                 D(16.25, 'NOMBRE', 960, 1124), D(16.81, 'CORREO', 960, 1356), D(17.6, 'FECHA', 960, 1581)]),
 esc('es_serio', 18.88),
 movil('br_codigo', 20.09, cambios=[ch(22.15, 'br_cerrada')],
       rotulos=[D(20.56 + 0.12 * i, c, x, 1337, 'negro', 85, t1=22.15) for i, (c, x) in enumerate(zip('4815', (716, 880, 1045, 1201)))]),
 esc('es_escanea', 22.72, cambios=[ch(24.6, 'es_escanea_b')], boca_en=[I + 'es_escanea.jpg', I + 'es_escanea_b.jpg']),
 movil('br_pdf', 25.22, rotulos=[R(26.86, 'PDF', 540, 110, 'rojo', 160)]),
 esc('es_zum', 27.9, habla=False),
 br('br_pdf_postres', 29.05, zoom=1.0, rotulos=[R(28.99, 'POSTRES', 540, 140, 'rojo', 130, caja=True)]),
 esc('es_zum_b', 30.13, habla=False),
 br('br_pdf_legal', 31.7, zoom=1.0, rotulos=[R(31.64, 'AViSO LEGAL', 540, 140, 'rojo', 120, caja=True)]),
 esc('es_camarero', 32.87, zoom=1.25, cx=0.55, cambios=[ch(36.18, 'es_camarero_b')],
     boca_en=[I + 'es_camarero.jpg', I + 'es_camarero_b.jpg'], rotulos=[R(37.2, 'QR', 540, 130, 'negro', 140)]),
 br('br_memoria', 38.1, zoom=1.05, sub_y=1700, alterna=alt('br_memoria', 'br_memoria_b', 0.35)),
 br('es_camarero_c', 39.84, zoom=1.25, cx=0.55, cambios=[ch(41.04, 'es_camarero_d')]),
 br('br_cuenta', 41.69, zoom=1.05, alterna=alt('br_cuenta', 'br_cuenta_b', 0.3), rotulos=[R(42.7, 'OTRO QR', 540, 120, 'negro', 120)]),
 movil('br_propina', 43.75, rotulos=[R(44.3, '¿PROPiNA?', 540, 110, 'negro', 110, t1=47.4),
                                     D(45.12, '10%', 960, 1228), D(45.55, '15%', 960, 1466), D(46.19, '20%', 960, 1734),
                                     R(47.46, '0%', 540, 100, 'rojo', 170)]),
 movil('br_seguro', 48.3, rotulos=[R(48.85, '¿SEGURO?', 540, 110, 'rojo', 120)]),
 esc('es_seguro', 49.98, cambios=[ch(52.1, 'es_seguro_b')], boca_en=[I + 'es_seguro.jpg', I + 'es_seguro_b.jpg']),
 esc('es_barra', 53.66, zoom=1.2, cx=0.5, rotulos=[R(55.0, 'EN EFECTiVO', 540, 120, 'negro', 110, caja=True)]),
 br('es_barra_b', 56.13, zoom=1.2, cx=0.55, rotulos=[R(55.0, 'EN EFECTiVO', 540, 120, 'negro', 110, caja=True, t1=56.9)]),
 br('es_barra_c', 57.91, zoom=1.2, cx=0.55, alterna=alt('es_barra_c', 'es_barra_c_b', 0.5)),
]
json.dump({'alineacion': 'voz/qr_v1.json', 'audio': 'voz/qr_v1.mp3', 'pantalon': 'gris', 'sin_recolor': ['br_'], 'vel_letra': 0.03, 'subtitulos': {'y': 250, 'tam': 62}, 'duracion': 61.4, 'planos': P},
          open('plan_v1.json', 'w'), indent=1, ensure_ascii=False)

# la voz se rehízo (primera frase): los tiempos se llevan a la voz nueva por sus palabras
import subprocess
subprocess.run(['python3', '../reajustar.py', 'plan_v1.json', 'voz/qr_v1.json', 'voz/qr.json', 'plan.json', '--audio', 'voz/qr.mp3'], check=True)
p = json.load(open('plan.json'))
p.update(duracion=61.95, vel_letra=0.03, subtitulos={'y': 230, 'tam': 76, 'cambiar': {'zum': 'zoom'}}, audio='voz/qr_final.mp3', sin_recolor=['br_'], pantalon='gris')
json.dump(p, open('plan.json', 'w'), indent=1, ensure_ascii=False)
