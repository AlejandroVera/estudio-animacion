"""Pone las frases de los otros personajes (paciente, señora, abuela) con su propia voz sobre la locución de Ana.
Parte de voz/nt_v1 (solo Ana) y escribe voz/nt.mp3/json con «quien» en cada palabra. Tomas en voz/citas/."""
import json, os, sys
import numpy as np
sys.path.insert(0, '..')
exec(open('../voz.py').read().split('\norden = sys.argv[1]')[0])
VOZ = {'P9': 'Wi5NZQRxyOb3Jx4r0hrI',      # Gala (la de las nueve, mensaje; toma sin contexto ni aceleración)
       'P12': 'QdeV7TsH9psct2D4UdTk',     # Marco (el de las doce, desde el coche)
       'HUECOS': 'iuYybvSfclFoJ9ab2Im6'}  # Estela (la de los huecos)
TEMPO = 1.06
TEMPO_Q = {'P9': 1.0}  # la de las nueve a su velocidad natural (acelerada sonaba rara)
GANANCIA = {}
# (quien, texto, primera palabra, última palabra, buscar desde el segundo)
CITAS = [('P9', 'Hola, no puedo ir, me ha surgido algo.', 'hola', 'algo', 0),
         ('P12', '¿La podemos hacer online?', '¿la', 'online', 'doce'),
         ('HUECOS', '¿Tienes algo por la tarde? Pero no muy tarde. O por la mañana, pero no muy pronto. Y que no sea martes.', '¿tienes', 'martes', 'huecos'),
         ('HUECOS', 'Uy, a las dos como yo.', 'uy', 'yo', 'comer')]
rehacer = {int(x) for x in (opcion('--rehacer') or '').split(',') if x}
os.makedirs('voz/citas', exist_ok=True)
x = leer('voz/nt_v1.mp3')
pal = [dict(p, quien='ANA') for p in json.load(open('voz/nt_v1.json'))['palabras'] if p['tipo'] == 'word']
lim = lambda s: s.strip('«»¡!¿?.,;:…"').lower()
trozos = []
for i, (quien, texto, w0, w1, desde) in enumerate(CITAS):
    if isinstance(desde, str):  # anclado a una palabra (los segundos cambian al ajustar el ritmo)
        desde = next(p['inicio'] for p in pal if lim(p['texto']) == desde)
    a = next(k for k, p in enumerate(pal) if lim(p['texto']) == lim(w0) and p['inicio'] >= desde)
    b = next(k for k in range(a, len(pal)) if lim(pal[k]['texto']) == lim(w1))
    f = f'voz/citas/{i:02d}'
    if i in rehacer or not os.path.exists(f + '.json'):
        antes = ' '.join(p['texto'] for p in pal[max(0, a - 12):a])
        mp3, al = api_voz(texto, VOZ[quien], antes, ' '.join(p['texto'] for p in pal[b + 1:b + 8]))
        open(f + '_crudo.mp3', 'wb').write(mp3)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f + '_crudo.mp3', '-af', f'atempo={TEMPO_Q.get(quien, TEMPO)}', f + '.mp3'], check=True)
        ws = palabras_de(al)
        for w in ws:
            w['inicio'], w['fin'] = w['inicio'] / TEMPO_Q.get(quien, TEMPO), w['fin'] / TEMPO_Q.get(quien, TEMPO)
        json.dump({'palabras': ws}, open(f + '.json', 'w'), ensure_ascii=False)
        print('generada', i, quien, texto)
    if not os.path.exists(f + '_limpio.mp3') or i in rehacer:  # quita el siseo de fondo de la toma
        # el filtro de ruido solo si la toma tiene ruido de fondo (en una voz limpia la estropea: suena a lata)
        yy = leer(f + '.mp3'); fr = [20 * np.log10(np.sqrt((yy[k:k + 2205] ** 2).mean()) + 1) for k in range(0, len(yy) - 2205, 2205)]
        filtro = 'highpass=f=80' + (',afftdn=nf=-35:nr=10' if min(fr) > 20 else '')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f + '.mp3', '-af', filtro, f + '_limpio.mp3'], check=True)
        print('toma', i, 'suelo', round(float(min(fr)), 1), filtro)
    trozos.append((a, b, quien, f))
partes, nuevas, prev_t, prev_k = [], [], 0.0, 0
for a, b, quien, f in trozos:
    ini = (pal[a - 1]['fin'] + pal[a]['inicio']) / 2
    fin = (pal[b]['fin'] + pal[b + 1]['inicio']) / 2 if b + 1 < len(pal) else pal[b]['fin'] + 0.3
    ga, gb = min(max(pal[a]['inicio'] - ini, 0.07), 0.14), min(max(fin - pal[b]['fin'], 0.07), 0.14)
    y = leer(f + '_limpio.mp3'); ws = json.load(open(f + '.json'))['palabras']
    s0, s1 = max(ws[0]['inicio'] - 0.03, 0), min(ws[-1]['fin'] + 0.08, len(y) / SR)
    clip = y[int(s0 * SR):int(s1 * SR)]
    F = int(0.01 * SR); clip = clip.copy(); clip[:F] *= np.linspace(0, 1, F); clip[-F:] *= np.linspace(1, 0, F)
    seg = x[int(prev_t * SR):int(ini * SR)].copy()
    if len(seg) > 2 * F:
        seg[:F] *= np.linspace(0, 1, F) if prev_t else 1; seg[-F:] *= np.linspace(1, 0, F)
    clip = clip * (np.sqrt((x ** 2).mean()) / max(np.sqrt((clip ** 2).mean()), 1)) * 1.05 * GANANCIA.get(quien, 1)  # mismo volumen que Ana
    t_out = sum(len(p) for p in partes) / SR
    partes.append(seg)
    off = (t_out + ini - prev_t) - prev_t
    nuevas += [dict(p, inicio=round(p['inicio'] + (t_out - prev_t), 3), fin=round(p['fin'] + (t_out - prev_t), 3)) for p in pal[prev_k:a]]
    t0 = t_out + (ini - prev_t) + ga
    partes += [np.zeros(int(ga * SR)), clip, np.zeros(int(gb * SR))]
    nuevas += [dict(w, quien=quien, inicio=round(t0 + w['inicio'] - s0, 3), fin=round(t0 + w['fin'] - s0, 3)) for w in ws]
    prev_t, prev_k = fin, b + 1
t_out = sum(len(p) for p in partes) / SR
fin_ = x[int(prev_t * SR):].copy(); F = int(0.01 * SR); fin_[:F] *= np.linspace(0, 1, F)[:len(fin_[:F])]; partes.append(fin_)
nuevas += [dict(p, inicio=round(p['inicio'] + (t_out - prev_t), 3), fin=round(p['fin'] + (t_out - prev_t), 3)) for p in pal[prev_k:]]
y = np.concatenate(partes)
# ritmo: toda pausa entre palabras de más de MAXP se deja en DEJA (con respiración o sin ella), con fundidos
MAXP, DEJA = 0.18, 0.14
F = int(0.012 * SR)
cortes = []
for p, q in zip(nuevas, nuevas[1:]):
    if q['inicio'] - p['fin'] > MAXP:
        a0 = p['fin'] + DEJA / 2
        cortes.append((a0, q['inicio'] - DEJA / 2))
trozos, prev = [], 0.0
for a0, a1 in cortes:
    t = y[int(prev * SR):int(a0 * SR)].copy(); t[-F:] *= np.linspace(1, 0, F); trozos.append(t); prev = a1
t = y[int(prev * SR):].copy(); trozos.append(t)
for t in trozos[1:]:
    t[:F] *= np.linspace(0, 1, F)
y = np.concatenate(trozos)
mover = lambda t: t - sum(min(max(t - a0, 0), a1 - a0) for a0, a1 in cortes)
for w in nuevas:
    w['inicio'], w['fin'] = round(mover(w['inicio']), 3), round(mover(w['fin']), 3)
escribir('voz/nt.mp3', y)
json.dump({'palabras': nuevas}, open('voz/nt.json', 'w'), ensure_ascii=False)
print('dura', round(len(y) / SR, 2))
for w in nuevas:
    if w['quien'] != 'ANA':
        print(w['quien'], w['texto'], w['inicio'])
