"""Voz de un DIÁLOGO entre personajes (cada uno con su voz de ElevenLabs, por la web publicada).

  python3 herramientas/video/dialogo.py guion.txt salida [--hueco 0.28]
      guion.txt: una línea por frase «QUIEN: texto»; las líneas entre paréntesis o sin «:» se ignoran.
      Voces en VOCES (o «# voz QUIEN ID» en el propio guion). Cada frase se genera aparte con la anterior y la
      siguiente como contexto (entonación de conversación), se le quita el silencio de los bordes y se pegan con
      un hueco corto. Escribe salida.mp3 y salida.json ({palabras: [{texto, inicio, fin, tipo, quien}],
      frases: [{quien, texto, inicio, fin}]}). Cada frase se guarda también en salida_frases/NN.mp3/json, así
      `--rehacer N` vuelve a generar solo esa frase y se monta todo otra vez.
"""
import json, os, re, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voz.py')).read()
exec(_src.split('\norden = sys.argv[1]')[0])  # solo las funciones de voz.py (sin su parte de órdenes)
import subprocess

VOCES = {'ROSA': 't9LRTh3y1ioN00e9wsNh',      # Aaron Abad (Chico rosa)
         'AGENTE': 'Zb72NBThGN2Rv3y1RSTT'}    # Rafa N – Confident Sales Agent

hueco = float(opcion('--hueco', '0.28'))
rehacer = opcion('--rehacer')
rehacer = {int(x) for x in rehacer.split(',')} if rehacer else set()
guion, salida = sys.argv[1], sys.argv[2]
frases = []
for l in open(guion):
    l = l.strip()
    m = re.match(r'#\s*voz\s+(\S+)\s+(\S+)', l)
    if m:
        VOCES[m.group(1)] = m.group(2); continue
    m = re.match(r'([A-ZÁÉÍÓÚÑ]+):\s*(.+)', l)
    if m:
        frases.append((m.group(1), m.group(2)))
carp = salida + '_frases'
os.makedirs(carp, exist_ok=True)


def decodificar(mp3):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '-', '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'],
                         input=mp3, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32)


partes, palabras, info, t = [], [], [], 0.0
for i, (quien, texto) in enumerate(frases):
    f = f'{carp}/{i:02d}'
    if i in rehacer or not os.path.exists(f + '.json'):
        antes = ' '.join(x for _, x in frases[max(0, i - 2):i])
        despues = frases[i + 1][1] if i + 1 < len(frases) else ''
        mp3, al = api_voz(texto, VOCES[quien], antes, despues)
        open(f + '.mp3', 'wb').write(mp3)
        json.dump({'palabras': palabras_de(al)}, open(f + '.json', 'w'), ensure_ascii=False)
        print('generada', i, quien, texto)
    x = decodificar(open(f + '.mp3', 'rb').read())
    pal = json.load(open(f + '.json'))['palabras']
    a = max(0.0, pal[0]['inicio'] - 0.06)
    b = min(len(x) / SR, pal[-1]['fin'] + 0.12)
    seg = x[int(a * SR):int(b * SR)].copy()
    F = int(0.015 * SR)
    seg[:F] *= np.linspace(0, 1, F); seg[-F:] *= np.linspace(1, 0, F)
    for p in pal:
        palabras.append({**p, 'inicio': round(p['inicio'] - a + t, 3), 'fin': round(p['fin'] - a + t, 3), 'quien': quien})
    info.append({'quien': quien, 'texto': texto, 'inicio': round(t, 3), 'fin': round(t + len(seg) / SR, 3)})
    partes += [seg, np.zeros(int(hueco * SR), np.float32)]
    t += len(seg) / SR + hueco
y = np.concatenate(partes)
escribir(salida + '.mp3', y)
json.dump({'palabras': palabras, 'frases': info}, open(salida + '.json', 'w'), ensure_ascii=False, indent=0)
print(salida, 'dura', round(len(y) / SR, 2), 's,', len(frases), 'frases')
for k, fr in enumerate(info):
    print(k, fr['inicio'], fr['quien'], fr['texto'])
