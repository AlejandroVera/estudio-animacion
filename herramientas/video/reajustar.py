"""Mueve todos los tiempos de un plan cuando cambia la voz (otra voz, una frase rehecha, una pausa nueva).

  python3 herramientas/video/reajustar.py plan.json palabras_viejas.json palabras_nuevas.json plan_nuevo.json \
      [--audio voz.mp3]

Cada tiempo (corte de plano, gesto, rótulo, objeto) se lleva por la palabra a la que estaba pegado: se queda a
la misma distancia de la palabra más cercana. Las dos listas deben tener el mismo número de palabras (la misma
frase con otra voz, o una palabra cambiada por otra).
"""
import bisect, json, os, sys

audio = None
if '--audio' in sys.argv:
    i = sys.argv.index('--audio')
    audio = sys.argv[i + 1]
    del sys.argv[i:i + 2]
plan_f, viejas_f, nuevas_f, salida = sys.argv[1:5]
v = json.load(open(viejas_f))['palabras']
n = json.load(open(nuevas_f))['palabras']
if len(v) != len(n):
    sys.exit(f'Distinto número de palabras: {len(v)} y {len(n)}')
xs = [w['inicio'] for w in v]
ys = [w['inicio'] for w in n]


def mapa(t):
    i = bisect.bisect_right(xs, t) - 1
    if i < 0:
        return t
    if i >= len(xs) - 1:
        return round(ys[-1] + (t - xs[-1]), 3)
    if t - xs[i] <= xs[i + 1] - t:
        return round(ys[i] + (t - xs[i]), 3)
    return round(ys[i + 1] - (xs[i + 1] - t), 3)


p = json.load(open(plan_f))
base = os.path.dirname(os.path.abspath(salida))
p['alineacion'] = os.path.relpath(os.path.abspath(nuevas_f), base)
if audio:
    p['audio'] = os.path.relpath(os.path.abspath(audio), base)
p.pop('duracion', None)
for pl in p['planos']:
    pl['t0'] = mapa(pl['t0'])
    for e in pl.get('eventos', []) + pl.get('cambios', []):
        e['t'] = mapa(e['t'])
    for o in pl.get('objetos', []) + pl.get('rotulos', []):
        o['t0'] = mapa(o['t0'])
        if 't1' in o:
            o['t1'] = mapa(o['t1'])
    for k in ('desde', 'hasta'):
        if k in pl.get('alterna', {}):
            pl['alterna'][k] = mapa(pl['alterna'][k])
json.dump(p, open(salida, 'w'), indent=1, ensure_ascii=False)
print('plan reajustado:', salida)
