"""La intro iba atropellada (v3): «…conozca a alguien. Así que…» seguido, y «cenaba. Primero» casi pegado. Rehace solo
las cuatro primeras frases con pausas de la propia voz (<break>) y SIN acelerar, y las empalma con el resto de la voz
(desde «Yo en el móvil…»). Escribe voz/al.mp3/.json (la anterior queda en voz/al_v1)."""
import json, sys, importlib.util
import numpy as np
spec = importlib.util.spec_from_file_location('voz', '../voz.py')
sys.argv = ['voz.py', 'nada']
V = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(V)
except SystemExit:
    pass
intro = ('Mi hermana dice que ya va siendo hora de que conozca a alguien. <break time="0.55s" /> '
         'Así que me ha instalado una aplicación de ligar. <break time="0.35s" /> Mientras yo cenaba. '
         '<break time="0.7s" /> Primero, seis fotos.')
despues = 'Yo en el móvil tengo tres del DNI y una del ticket del parking. Así que me hace una en el pasillo.'
viejo = json.load(open('voz/al_v1.json'))['palabras']
w = [p for p in viejo if p['tipo'] == 'word']
iyo = next(i for i, p in enumerate(w) if p['texto'] == 'Yo')
corte = w[iyo]['inicio'] - 0.12
y_old = V.leer('voz/al_v1.mp3')
import os
if os.path.exists('voz/_intro_pal.json'):
    al = None; PAL0 = json.load(open('voz/_intro_pal.json'))
else:
    audio, al = V.api_voz(intro, V.VOZ, despues=despues)
    open('voz/_intro.mp3', 'wb').write(audio); PAL0 = V.palabras_de(al); json.dump(PAL0, open('voz/_intro_pal.json', 'w'))
y = V.leer('voz/_intro.mp3')
# mismo ritmo que el resto (ritmo_voz.py lo aceleró un 8 %), sin tocar sus pausas
import subprocess
TP = 1.08
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 's16le', '-ar', str(V.SR), '-ac', '1', '-i', '-', '-af', f'atempo={TP}',
                      '-f', 's16le', '-'], input=y.astype(np.int16).tobytes(), capture_output=True).stdout
y = np.frombuffer(raw, np.int16).astype(np.float32)
todas = [{**p, 'inicio': round(p['inicio'] / TP, 3), 'fin': round(p['fin'] / TP, 3)} for p in PAL0]
pal = [p for p in todas if p['tipo'] == 'word']
fin = pal[-1]['fin']
n0 = int((fin + 0.08) * V.SR)
seg = y[:n0].copy(); F = int(0.012 * V.SR); seg[-F:] *= np.linspace(1, 0, F)
hueco = np.zeros(int(0.3 * V.SR), np.float32)
resto = y_old[int(corte * V.SR):].copy(); resto[:F] *= np.linspace(0, 1, F)
Y = np.concatenate([seg, hueco, resto])
off = len(seg) / V.SR + len(hueco) / V.SR - corte
nuevas = todas + [{**p, 'inicio': round(p['inicio'] + off, 3), 'fin': round(p['fin'] + off, 3)}
                                              for p in viejo if p['inicio'] >= corte]
V.escribir('voz/al.mp3', Y)
json.dump({'palabras': nuevas}, open('voz/al.json', 'w'), ensure_ascii=False, indent=0)
print('dura', round(len(Y) / V.SR, 2), 'desplazamiento del resto', round(off, 2))
