"""Voz del sketch: iguala el volumen de cada frase (cada voz de ElevenLabs sale a un nivel) y da a la megafonía
sonido de altavoz (banda estrecha y eco). Parte de voz/vt_v1 (salida de dialogo.py) y escribe voz/vt.mp3."""
import json, subprocess
import numpy as np
SR = 44100
L = lambda f, af='': np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout, np.int16).astype(float)
x = L('voz/vt_v1.mp3')
pa = L('voz/vt_v1.mp3', 'highpass=f=350,lowpass=f=3400,aecho=0.8:0.6:60|120:0.35|0.2')
n = min(len(x), len(pa)); x, pa = x[:n], pa[:n]
J = json.load(open('voz/vt_v1.json'))
EXTRA = {'MEGAFONIA': 1.5, 'SENOR': 1.0, 'ROSA': 0.92, 'VETERANO': 1.0}
voz = lambda s: s[np.abs(s) > 300]
obj = np.sqrt((voz(x) ** 2).mean())
g = np.ones(n); m = np.zeros(n)
for f in J['frases']:
    a, b = int(f['inicio'] * SR), min(int((f['fin'] + 0.3) * SR), n)
    src = pa if f['quien'] == 'MEGAFONIA' else x
    s = voz(src[a:b])
    e = EXTRA.get(f['quien'], 1) * (1.3 if f['quien'] == 'MEGAFONIA' and f['inicio'] > 60 else 1)  # los avisos finales salían flojos
    g[a:b] = obj / max(np.sqrt((s ** 2).mean()), 1) * e
    if f['quien'] == 'MEGAFONIA':
        m[a:b] = 1
k = np.ones(int(0.03 * SR)) / int(0.03 * SR)
g = np.convolve(g, k, 'same'); m = np.convolve(m, k, 'same')
y = (x * (1 - m) + pa * m) * g
y *= 0.9 * 32767 / np.abs(y).max()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '192k', 'voz/vt.mp3'],
               input=np.clip(y, -32768, 32767).astype(np.int16).tobytes(), check=True)
print('voz igualada por frases')
