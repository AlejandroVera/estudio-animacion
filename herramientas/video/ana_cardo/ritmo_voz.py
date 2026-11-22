"""Da ritmo a la voz: deja cada silencio entre palabras en como mucho DEJA s (solo donde hay silencio real) y la
acelera TEMPO (atempo, sin cambiar el tono). Corrige los tiempos del json.
  python3 ritmo_voz.py entrada(.mp3/.json sin extensión) salida [tempo] [deja]"""
import json, subprocess, sys
import numpy as np
SR = 44100
ent, sal = sys.argv[1], sys.argv[2]
TEMPO = float(sys.argv[3]) if len(sys.argv) > 3 else 1.1
DEJA = float(sys.argv[4]) if len(sys.argv) > 4 else 0.22
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', ent + '.mp3', '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(np.float32)
d = json.load(open(ent + '.json'))
pal = d['palabras']
w = [p for p in pal if p['tipo'] == 'word']
rms = lambda a, b: float(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean())) if b > a else 0
cortes = []
for p, q in zip(w, w[1:]):
    hueco = q['inicio'] - p['fin']
    if hueco > DEJA + 0.05:
        a0 = p['fin'] + 0.08
        a1 = q['inicio'] - (DEJA - 0.08)
        if a1 > a0 and rms(a0, a1) < 400:
            cortes.append((a0, a1))
F = int(0.012 * SR)
partes, prev = [], 0
for a0, a1 in cortes:
    s = x[int(prev * SR):int(a0 * SR)].copy(); s[-F:] *= np.linspace(1, 0, F); partes.append(s); prev = a1
partes.append(x[int(prev * SR):].copy())
for i in range(1, len(partes)):
    partes[i][:F] *= np.linspace(0, 1, F)
y = np.concatenate(partes)
nuevo = lambda t: (t - sum(min(max(t - a0, 0), a1 - a0) for a0, a1 in cortes)) / TEMPO
for p in pal:
    p['inicio'], p['fin'] = round(nuevo(p['inicio']), 3), round(nuevo(p['fin']), 3)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                '-af', f'atempo={TEMPO}', '-b:a', '192k', sal + '.mp3'], input=np.clip(y, -32768, 32767).astype(np.int16).tobytes(), check=True)
json.dump(d, open(sal + '.json', 'w'), ensure_ascii=False)
print(sal, 'dura', round(len(y) / SR / TEMPO, 2), 's;', len(cortes), 'silencios acortados')
