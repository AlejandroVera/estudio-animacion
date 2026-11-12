"""Voz para los vídeos del modo inventario (ElevenLabs a través de la web publicada: la clave está en Vercel).

  python3 herramientas/video/voz.py generar guion.txt salida [--voz ID] [--antes previo.txt]
      Lee el texto ENTERO de una vez (entonación seguida). Admite <break time="0.8s" /> para pausas que haga
      la propia voz. Escribe salida.mp3 y salida.json ({palabras: [{texto, inicio, fin, tipo}]}).
      Solo acorta pausas de más de 0,6 s y SOLO donde hay silencio real (nunca mete silencios a mano).
  python3 herramientas/video/voz.py trozo salida.mp3 salida.json "primera palabra" "última palabra" trozo
      Corta un trozo entre dos palabras (por su texto, primera aparición) en mitad de los silencios.
  python3 herramientas/video/voz.py rehacer salida.mp3 salida.json guion.txt "frase vieja" "frase nueva" nueva [--voz ID]
      Vuelve a generar UNA frase con el texto de alrededor como contexto y la encaja en los silencios de
      antes y después (sin cortes). Escribe nueva.mp3 y nueva.json para todo el audio.
  python3 herramientas/video/voz.py comprobar audio.mp3 [desde hasta]
      Transcribe (ElevenLabs Scribe) para comprobar que dice exactamente el texto.
"""
import base64, json, re, subprocess, sys, urllib.request
import numpy as np

WEB = 'https://estudio-animacion-psi.vercel.app'
VOZ = 't9LRTh3y1ioN00e9wsNh'  # Aaron Abad - Storyteller en Castellano (elegida por Alejandro)
SR = 44100


def opcion(nombre, defecto=None):
    if nombre in sys.argv:
        i = sys.argv.index(nombre)
        v = sys.argv[i + 1]
        del sys.argv[i:i + 2]
        return v
    return defecto


def api_voz(texto, voz, antes='', despues=''):
    body = {'texto': texto, 'voz': voz, 'modelo': 'eleven_multilingual_v2', 'tiempos': True}
    if antes:
        body['antes'] = antes
    if despues:
        body['despues'] = despues
    req = urllib.request.Request(WEB + '/api/voz', data=json.dumps(body).encode(), headers={'content-type': 'application/json'})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    if 'error' in d:
        sys.exit(d['error'])
    return base64.b64decode(d['audio']), d['alineacion']


def palabras_de(al):
    """Palabras con tiempos a partir de la alineación por letras (sin las etiquetas <break>)."""
    ch, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
    s = ''.join(ch)
    fuera = set()
    for m in re.finditer(r'<[^>]*>', s):
        fuera.update(range(m.start(), m.end()))
    pal, cur = [], None
    for k, (c, a, e) in enumerate(zip(ch, st, en)):
        if k in fuera or c.isspace():
            if cur:
                pal.append(cur)
                cur = None
            continue
        if cur is None:
            cur = {'texto': c, 'inicio': a, 'fin': e, 'tipo': 'word'}
        else:
            cur['texto'] += c
            cur['fin'] = e
    if cur:
        pal.append(cur)
    return pal


def leer(f):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32)


def escribir(f, y):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '192k', f],
                   input=np.clip(y, -32768, 32767).astype(np.int16).tobytes(), check=True)


def acortar_pausas(x, pal, maximo=0.6, deja=0.45):
    rms = lambda a, b: float(np.sqrt((x[int(a * SR):int(b * SR)] ** 2).mean())) if b > a else 0
    cortes = []
    for p, q in zip(pal, pal[1:]):
        hueco = q['inicio'] - p['fin']
        if hueco > maximo:
            a0 = p['fin'] + 0.15
            a1 = a0 + (hueco - deja)
            if rms(a0, a1) < 300:
                cortes.append((a0, a1))
    F = int(0.02 * SR)
    partes, prev = [], 0
    for a0, a1 in cortes:
        seg = x[int(prev * SR):int(a0 * SR)].copy()
        seg[-F:] *= np.linspace(1, 0, F)
        partes.append(seg)
        prev = a1
    partes.append(x[int(prev * SR):].copy())
    for i in range(1, len(partes)):
        partes[i][:F] *= np.linspace(0, 1, F)

    def nuevo(t):
        return t - sum(min(max(t - a0, 0), a1 - a0) for a0, a1 in cortes)
    for p in pal:
        p['inicio'], p['fin'] = round(nuevo(p['inicio']), 3), round(nuevo(p['fin']), 3)
    return np.concatenate(partes), pal


def guardar(prefijo, y, pal):
    escribir(prefijo + '.mp3', y)
    json.dump({'palabras': pal}, open(prefijo + '.json', 'w'), ensure_ascii=False)
    print(prefijo, 'dura', round(len(y) / SR, 2), 's,', len(pal), 'palabras')


def buscar(pal, texto, desde=0):
    for k in range(desde, len(pal)):
        if pal[k]['texto'].strip('«»¡!¿?.,;:…').lower() == texto.strip('«»¡!¿?.,;:…').lower():
            return k
    sys.exit(f'No encuentro la palabra «{texto}»')


def transcribir(f, desde=None, hasta=None):
    args = ['ffmpeg', '-loglevel', 'error', '-i', f]
    if desde is not None:
        args += ['-ss', str(desde), '-to', str(hasta)]
    wav = subprocess.run(args + ['-ac', '1', '-ar', '16000', '-f', 'wav', '-'], capture_output=True).stdout
    req = urllib.request.Request(WEB + '/api/transcribir', data=wav, headers={'content-type': 'audio/wav'})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    return ' '.join(w['texto'] for w in d.get('palabras', []) if w['tipo'] == 'word') or str(d)


orden = sys.argv[1]
voz = opcion('--voz', VOZ)
if orden == 'generar':
    antes = opcion('--antes')
    texto = open(sys.argv[2]).read().strip()
    audio, al = api_voz(texto, voz, open(antes).read().strip() if antes else '')
    open('/tmp/_voz.mp3', 'wb').write(audio)
    y, pal = acortar_pausas(leer('/tmp/_voz.mp3'), palabras_de(al))
    guardar(sys.argv[3], y, pal)
elif orden == 'trozo':
    x = leer(sys.argv[2])
    pal = json.load(open(sys.argv[3]))['palabras']
    i0 = buscar(pal, sys.argv[4])
    i1 = buscar(pal, sys.argv[5], i0)
    a = (pal[i0 - 1]['fin'] + pal[i0]['inicio']) / 2 if i0 else 0
    b = (pal[i1]['fin'] + pal[i1 + 1]['inicio']) / 2 if i1 + 1 < len(pal) else len(x) / SR
    b = min(b, pal[i1]['fin'] + 0.6)
    trozo = [{**p, 'inicio': round(p['inicio'] - a, 3), 'fin': round(p['fin'] - a, 3)} for p in pal[i0:i1 + 1]]
    guardar(sys.argv[6], x[int(a * SR):int(b * SR)], trozo)
elif orden == 'rehacer':
    x = leer(sys.argv[2])
    P = json.load(open(sys.argv[3]))['palabras']
    guion = open(sys.argv[4]).read().strip()
    vieja, nueva = sys.argv[5], sys.argv[6]
    i = guion.find(vieja)
    antes, despues = (guion[:i].strip(), guion[i + len(vieja):].strip()) if i >= 0 else ('', '')
    audio, al = api_voz(nueva, voz, antes, despues)
    open('/tmp/_frase.mp3', 'wb').write(audio)
    F, fp = leer('/tmp/_frase.mp3'), palabras_de(al)
    pv = vieja.split()
    i0 = buscar(P, pv[0])
    while [w['texto'] for w in P[i0:i0 + len(pv)]] != pv:
        i0 = buscar(P, pv[0], i0 + 1)
    i1 = i0 + len(pv) - 1
    c0 = (P[i0 - 1]['fin'] + P[i0]['inicio']) / 2 if i0 else 0
    c1 = (P[i1]['fin'] + P[i1 + 1]['inicio']) / 2 if i1 + 1 < len(P) else len(x) / SR
    f0 = max(fp[0]['inicio'] - (P[i0]['inicio'] - c0), 0)
    f1 = fp[-1]['fin'] + (c1 - P[i1]['fin'])
    n = int(0.012 * SR)
    clip = F[int(f0 * SR):int(f1 * SR)].copy()
    clip[:n] *= np.linspace(0, 1, n)
    clip[-n:] *= np.linspace(1, 0, n)
    a = x[:int(c0 * SR)].copy()
    a[-n:] *= np.linspace(1, 0, n)
    b = x[int(c1 * SR):].copy()
    b[:n] *= np.linspace(0, 1, n)
    d = (f1 - f0) - (c1 - c0)
    nuevas = (P[:i0] + [{**p, 'inicio': round(c0 + p['inicio'] - f0, 3), 'fin': round(c0 + p['fin'] - f0, 3)} for p in fp]
              + [{**p, 'inicio': round(p['inicio'] + d, 3), 'fin': round(p['fin'] + d, 3)} for p in P[i1 + 1:]])
    guardar(sys.argv[7], np.concatenate([a, clip, b]), nuevas)
    print('comprobación:', transcribir(sys.argv[7] + '.mp3', max(c0 - 2, 0), c0 + (f1 - f0) + 2))
elif orden == 'comprobar':
    print(transcribir(sys.argv[2], *(float(v) for v in sys.argv[3:5])) if len(sys.argv) > 3 else transcribir(sys.argv[2]))
else:
    sys.exit(__doc__)
