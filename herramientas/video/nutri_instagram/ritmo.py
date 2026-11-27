"""Acorta las pausas de la locución (voz/ni_crudo -> voz/ni): toda pausa entre palabras de más de MAXP se deja en
MAXP; el gancho (hasta «móvil») conserva pausas de hasta 0,45 s. Corrige los tiempos del json."""
import json, subprocess
import numpy as np
SR = 44100
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', 'voz/ni_crudo.mp3', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                                 capture_output=True).stdout, np.int16).astype(float)
J = json.load(open('voz/ni_crudo.json'))
P = [p for p in J['palabras'] if p['tipo'] == 'word']
fin_gancho = [p['fin'] for p in P if 'móvil' in p['texto']][0]
MAXP = 0.16
quitar = []
for a, b in zip(P, P[1:]):
    hueco = b['inicio'] - a['fin']
    lim = 0.45 if a['fin'] <= fin_gancho + 0.01 else MAXP
    if hueco > lim:
        c = (a['fin'] + b['inicio']) / 2
        quitar.append((int((c - (hueco - lim) / 2) * SR), int((c + (hueco - lim) / 2) * SR)))
F = int(0.008 * SR)
keep = np.ones(len(x), bool)
for a, b in quitar:
    x[a - F:a] *= np.linspace(1, 0, F); x[b:b + F] *= np.linspace(0, 1, F); keep[a:b] = False
y = x[keep]
def nt(t):
    s = t * SR
    return round((s - sum(min(b, s) - a for a, b in quitar if a < s)) / SR, 3)
# cortar justo después de la última palabra (sin resoplidos) con fundido
fin = nt(P[-1]['fin']) + 0.12
y = y[:int(fin * SR)]; y[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '192k', 'voz/ni.mp3'],
               input=np.clip(y, -32768, 32767).astype(np.int16).tobytes(), check=True)
# «quien» en cada palabra: sin él el montador no sabe que habla Ana y no le abre la boca
J['palabras'] = [dict(p, inicio=nt(p['inicio']), fin=nt(p['fin']), quien='ANA') for p in J['palabras']]
json.dump(J, open('voz/ni.json', 'w'), ensure_ascii=False)
print('pausas acortadas', len(quitar), '->', round(len(y) / SR, 2), 's')
