"""Voz del sketch: iguala el volumen de cada frase (cada voz de ElevenLabs sale a un nivel) y da al bot un timbre algo metálico. Parte de voz/rf_v0 (salida de dialogo.py) y escribe voz/rf.mp3."""
import json, subprocess
import numpy as np
SR = 44100
L = lambda f, af='': np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout, np.int16).astype(float)
x = L('voz/rf_v0.mp3')
pa = L('voz/rf_v0.mp3', 'aecho=0.8:0.6:9:0.32,highpass=f=120,treble=g=2')  # bot: timbre algo metálico (eco muy corto)
n = min(len(x), len(pa)); x, pa = x[:n], pa[:n]
J = json.load(open('voz/rf_v0.json'))

# pausas largas DENTRO de las frases (ElevenLabs deja hasta 1 s tras un punto): se dejan en MAXP
MAXP, W = 0.30, int(0.01 * SR)
env = np.array([np.sqrt((x[k:k + W] ** 2).mean()) for k in range(0, n - W, W)])
quitar = []                                    # tramos [a, b) en muestras que se eliminan
for f in J['frases']:
    i0, i1 = int(f['inicio'] * 100) + 2, int(f['fin'] * 100) - 2
    k = i0
    while k < i1:
        if env[k] < 80:
            j = k
            while j < i1 and env[j] < 80:
                j += 1
            mp = 0.45 if f['texto'].startswith('Bueno…') else MAXP   # esta frase pide pausas (iba atropellada)
            if (j - k) / 100 > mp:
                c = (k + j) / 2 / 100
                quitar.append((int((c - (j - k) / 200 + mp / 2) * SR), int((c + (j - k) / 200 - mp / 2) * SR)))
            k = j
        k += 1
def nuevo_t(t):
    s = t * SR
    return round((s - sum(min(b, s) - a for a, b in quitar if a < s)) / SR, 3)
keep = np.ones(n, bool)
for a, b in quitar:
    keep[a:b] = False
F8 = int(0.008 * SR)
for a, b in quitar:                            # fundido corto en cada empalme
    x[max(0, a - F8):a] *= np.linspace(1, 0, min(F8, a)); pa[max(0, a - F8):a] *= np.linspace(1, 0, min(F8, a))
    x[b:b + F8] *= np.linspace(0, 1, len(x[b:b + F8])); pa[b:b + F8] *= np.linspace(0, 1, len(pa[b:b + F8]))
x, pa = x[keep], pa[keep]; n = len(x)
J = dict(J, palabras=[dict(p, inicio=nuevo_t(p['inicio']), fin=nuevo_t(p['fin'])) for p in J['palabras']],
         frases=[dict(f, inicio=nuevo_t(f['inicio']), fin=nuevo_t(f['fin'])) for f in J['frases']])
print('pausas acortadas:', len(quitar), 'quitado %.2f s' % (sum(b - a for a, b in quitar) / SR))
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
INTRO = 3.8
y2 = np.r_[np.zeros(int(INTRO * SR)), np.clip(y, -32768, 32767)]
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '192k', 'voz/rf.mp3'],
               input=y2.astype(np.int16).tobytes(), check=True)
J2 = dict(J, palabras=[dict(p, inicio=round(p['inicio'] + INTRO, 3), fin=round(p['fin'] + INTRO, 3)) for p in J['palabras']],
          frases=[dict(f, inicio=round(f['inicio'] + INTRO, 3), fin=round(f['fin'] + INTRO, 3)) for f in J['frases']])
json.dump(J2, open('voz/rf.json', 'w'), ensure_ascii=False)
print('intro de', INTRO, 's')
