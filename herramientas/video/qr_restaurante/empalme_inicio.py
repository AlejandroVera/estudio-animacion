"""Rehace la PRIMERA frase de la voz (no tiene silencio delante, `voz.py rehacer` no sirve) y la empalma con el resto."""
import json, sys, importlib.util
import numpy as np
spec = importlib.util.spec_from_file_location('voz', '../voz.py')
sys.argv = ['voz.py', 'nada']
V = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(V)
except SystemExit:
    pass
frase = 'El domingo fui a comer a un restaurante y la carta era un código QR.'
resto = open('guion.txt').read().split(frase, 1)[1].strip()
viejo = json.load(open('voz/qr_v1.json'))['palabras']
corte = [w for w in viejo if w['tipo'] == 'word'][15]  # «Pegado»
assert corte['texto'].startswith('Pegado'), corte
y_old = V.leer('voz/qr_v1.mp3')
mejor = None
for intento in range(3):
    audio, al = V.api_voz(frase, V.VOZ, despues=resto[:300])
    open('voz/_ini.mp3', 'wb').write(audio)
    y = V.leer('voz/_ini.mp3')
    pal = V.palabras_de(al)
    fin = pal[-1]['fin']
    print(intento, len(pal), 'palabras, dura', round(fin, 2))
    if len(pal) == 15:
        mejor = (y, pal, fin)
        break
y, pal, fin = mejor
hueco = 0.55
n0 = int((fin + 0.05) * V.SR)
a = y[:n0]
b = y_old[int((corte['inicio'] - 0.08) * V.SR):]
sil = np.zeros(int(hueco * V.SR), np.float32)
out = np.concatenate([a, sil, b])
V.escribir('voz/qr.mp3', out)
desp = (n0 + len(sil)) / V.SR - (corte['inicio'] - 0.08)
nuevas = [dict(w, tipo='word') for w in pal] + [dict(w, inicio=w['inicio'] + desp, fin=w['fin'] + desp) for w in viejo if w['inicio'] >= corte['inicio'] - 0.01]
json.dump({'palabras': nuevas}, open('voz/qr.json', 'w'), ensure_ascii=False, indent=1)
print('desplazamiento del resto', round(desp, 3), 'palabras', len(nuevas))
