"""Voz de un DIÁLOGO entre personajes (cada uno con su voz de ElevenLabs, por la web publicada).

  python3 herramientas/video/dialogo.py guion.txt salida [--hueco 0.28]
      guion.txt: una línea por frase «QUIEN: texto»; las líneas entre paréntesis o sin «:» se ignoran.
      Voces en VOCES (o «# voz QUIEN ID» en el propio guion). Cada frase se genera aparte con la anterior y la
      siguiente como contexto (entonación de conversación), se le quita el silencio de los bordes y se pegan con
      un hueco corto. Escribe salida.mp3 y salida.json ({palabras: [{texto, inicio, fin, tipo, quien}],
      frases: [{quien, texto, inicio, fin}]}). Cada frase se guarda también en salida_frases/NN.mp3/json, así
      `--rehacer N` vuelve a generar solo esa frase y se monta todo otra vez. `--preguntas 4`: cada frase con «?» se
      genera 4 veces y se queda la toma cuyo tono más SUBE al final (tono.py), porque la voz a veces las dice como
      afirmaciones. `--pausa 11=0.6` alarga el silencio tras la frase 11 (un gag que respire). `--tempo AGENTE=1.15` acelera a un personaje sin cambiar su tono.
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
# velocidad por personaje (atempo de ffmpeg: no cambia el tono), p. ej. --tempo AGENTE=1.15
PREGUNTAS = int(opcion('--preguntas', '0'))  # tomas por cada pregunta: se queda la que más SUBE al final
TEMPO = {k: float(v) for k, v in (x.split('=') for x in (opcion('--tempo', '') or '').split(',') if x)}
# pausa extra tras una frase (para que respire un gag), p. ej. --pausa 11=0.6
PAUSA = {int(k): float(v) for k, v in (x.split('=') for x in (opcion('--pausa', '') or '').split(',') if x)}
rehacer = opcion('--rehacer')
rehacer = {int(x) for x in rehacer.split(',')} if rehacer else set()

def voz_entera(texto, voz, antes, despues):
    """ElevenLabs a veces entrega la frase con la última sílaba a medias (el audio acaba en plena vocal: se cortaba
    «colocar», «¿…todo esto?»). Con «...» al final la termina; si aun así acaba en pleno sonido, otra toma."""
    t = texto.rstrip()
    if not t.endswith(('...', '…', '?')):   # a las preguntas los puntos les quitan la subida final
        t += '...'
    for _ in range(6 if t.endswith('?') else 3):
        mp3, al = api_voz(t, voz, antes, despues)
        open('/tmp/_voz_entera.mp3', 'wb').write(mp3)
        x = leer('/tmp/_voz_entera.mp3')
        W = int(0.01 * SR)
        env = np.array([np.sqrt((x[k:k + W] ** 2).mean()) for k in range(0, len(x) - W, W)])
        if env[-4:].max() < env.max() * 0.1:
            break
        print('   la frase sale cortada, otra toma')
    # quitar los puntos añadidos de la alineación (que no salgan en los subtítulos)
    n = len(t) - len(texto.rstrip())
    if n:
        al = {k: v[:-n] for k, v in al.items()}
    return mp3, al

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
        mp3, al = voz_entera(texto, VOCES[quien], antes, despues)
        open(f + '.mp3', 'wb').write(mp3)
        json.dump({'palabras': palabras_de(al)}, open(f + '.json', 'w'), ensure_ascii=False)
        print('generada', i, quien, texto)
        if PREGUNTAS > 1 and texto.rstrip().endswith('?'):
            # la voz a veces dice las preguntas como afirmaciones: varias tomas y la de más subida de tono final
            from tono import subida
            mejor = (subida(f + '.mp3'), None)
            for k in range(PREGUNTAS - 1):
                mp3, al = voz_entera(texto, VOCES[quien], antes, despues)
                open(f + '_t.mp3', 'wb').write(mp3)
                st = subida(f + '_t.mp3')
                if st > mejor[0]:
                    mejor = (st, (mp3, al))
            if mejor[1]:
                open(f + '.mp3', 'wb').write(mejor[1][0])
                json.dump({'palabras': palabras_de(mejor[1][1])}, open(f + '.json', 'w'), ensure_ascii=False)
            print('   pregunta: subida final %.1f semitonos' % mejor[0])
    x = decodificar(open(f + '.mp3', 'rb').read())
    pal = json.load(open(f + '.json'))['palabras']
    tp = TEMPO.get(quien, 1.0)
    if tp != 1.0:
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                              '-af', f'atempo={tp}', '-f', 's16le', '-'], input=x.astype(np.int16).tobytes(),
                             capture_output=True).stdout
        x = np.frombuffer(raw, np.int16).astype(np.float32)
        pal = [{**p, 'inicio': p['inicio'] / tp, 'fin': p['fin'] / tp} for p in pal]
    # bordes por el SONIDO, no solo por la alineación: ElevenLabs a veces da el final de la última palabra antes de
    # que acabe de sonar (se cortaba «colocar», «¿…todo esto?») o el inicio después de que empiece («No, no»)
    W = int(0.01 * SR)
    env = np.array([np.sqrt((x[k:k + W] ** 2).mean()) for k in range(0, len(x) - W, W)])
    umbral = max(60.0, env.max() * 0.012)
    k = max(0, int((pal[0]['inicio'] - 0.06) * 100))
    while k > 0 and env[max(0, k - 8):k].max(initial=0) > umbral:
        k -= 1
    a = max(0.0, k / 100 - 0.04)
    k = min(len(env) - 1, int(pal[-1]['fin'] * 100))
    while k < len(env) - 1 and env[k:k + 8].max() > umbral:
        k += 1
    b = min(len(x) / SR, max(pal[-1]['fin'] + 0.12, k / 100 + 0.06))
    seg = x[int(a * SR):int(b * SR)].copy()
    F = int(0.015 * SR)
    seg[:F] *= np.linspace(0, 1, F); seg[-F:] *= np.linspace(1, 0, F)
    for p in pal:
        palabras.append({**p, 'inicio': round(p['inicio'] - a + t, 3), 'fin': round(p['fin'] - a + t, 3), 'quien': quien})
    info.append({'quien': quien, 'texto': texto, 'inicio': round(t, 3), 'fin': round(t + len(seg) / SR, 3)})
    h = hueco + PAUSA.get(i, 0.0)
    partes += [seg, np.zeros(int(h * SR), np.float32)]
    t += len(seg) / SR + h
y = np.concatenate(partes)
escribir(salida + '.mp3', y)
json.dump({'palabras': palabras, 'frases': info}, open(salida + '.json', 'w'), ensure_ascii=False, indent=0)
print(salida, 'dura', round(len(y) / SR, 2), 's,', len(frases), 'frases')
for k, fr in enumerate(info):
    print(k, fr['inicio'], fr['quien'], fr['texto'])
