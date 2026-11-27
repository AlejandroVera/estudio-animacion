"""Voz del sketch: iguala el volumen de cada frase (cada voz de ElevenLabs sale a un nivel) y da al bot un timbre algo metálico. Parte de voz/rf_v0 (salida de dialogo.py) y escribe voz/rf.mp3."""
import json, subprocess
import numpy as np
SR = 44100
L = lambda f, af='': np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout, np.int16).astype(float)
x = L('voz/rf_v0.mp3')
pa = L('voz/rf_v0.mp3', 'aecho=0.8:0.6:9:0.32,highpass=f=120,treble=g=2')  # bot: timbre algo metálico (eco muy corto)
n = min(len(x), len(pa)); x, pa = x[:n], pa[:n]
J = json.load(open('voz/rf_v0.json'))
EXTRA = {'BOT': 1.0, 'ROSA': 0.95}
voz = lambda s: s[np.abs(s) > 300]
obj = np.sqrt((voz(x) ** 2).mean())
g = np.ones(n); m = np.zeros(n)
for f in J['frases']:
    a, b = int(f['inicio'] * SR), min(int((f['fin'] + 0.3) * SR), n)
    src = pa if f['quien'] == 'BOT' else x
    s = voz(src[a:b])
    e = EXTRA.get(f['quien'], 1)
    g[a:b] = obj / max(np.sqrt((s ** 2).mean()), 1) * e
    if f['quien'] == 'BOT':
        m[a:b] = 1
k = np.ones(int(0.03 * SR)) / int(0.03 * SR)
g = np.convolve(g, k, 'same'); m = np.convolve(m, k, 'same')
y = (x * (1 - m) + pa * m) * g
y *= 0.9 * 32767 / np.abs(y).max()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '192k', 'voz/rf.mp3'],
               input=np.clip(y, -32768, 32767).astype(np.int16).tobytes(), check=True)
print('voz igualada por frases')

# intro sin voz para leer las papeletas: se adelanta todo INTRO segundos
INTRO = 5.6
y2 = np.r_[np.zeros(int(INTRO * SR)), np.clip(y, -32768, 32767)]
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '192k', 'voz/rf.mp3'],
               input=y2.astype(np.int16).tobytes(), check=True)
J2 = dict(J, palabras=[dict(p, inicio=round(p['inicio'] + INTRO, 3), fin=round(p['fin'] + INTRO, 3)) for p in J['palabras']],
          frases=[dict(f, inicio=round(f['inicio'] + INTRO, 3), fin=round(f['fin'] + INTRO, 3)) for f in J['frases']])
json.dump(J2, open('voz/rf.json', 'w'), ensure_ascii=False)
print('intro de', INTRO, 's')
