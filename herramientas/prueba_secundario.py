"""Prueba rápida de un secundario hablando: alterna postura y su «~b» según la energía de la voz y cambia de
postura en los tiempos dados. Vertical 1080x1920, fondo liso.

  python3 herramientas/prueba_secundario.py <carpeta_expresivo> <voz.mp3> <salida.mp4> postura:segundo ...
"""
import subprocess, sys
import numpy as np
from PIL import Image

carp, voz, out = sys.argv[1:4]
plan = [(p.split(':')[0], float(p.split(':')[1])) for p in sys.argv[4:]]
W, H, FPS = 1080, 1920, 25
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voz],
                           capture_output=True, text=True).stdout)
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', voz, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(float)
paso = 16000 // FPS
rms = np.array([np.sqrt((x[i:i + paso] ** 2).mean() + 1e-9) for i in range(0, len(x), paso)])
umbral = np.percentile(rms, 55)
cache = {}


def img(n):
    if n not in cache:
        im = Image.open(f'{carp}/{n}.webp').convert('RGBA')
        k = 1650 / im.height
        cache[n] = im.resize((round(im.width * k), 1650), Image.LANCZOS)
    return cache[n]


ab = {'habla', 'pulgar', 'sorpresa', 'enfado', 'risa'}  # posturas que ya tienen la boca abierta
fondo = Image.new('RGBA', (W, H), (250, 244, 226, 255))
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-i', voz, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-af', 'apad', '-c:a', 'aac', '-shortest', out], stdin=subprocess.PIPE)
n = int((dur + 0.6) * FPS)
for f in range(n):
    t = f / FPS
    pose = [q for q, s in plan if s <= t][-1] if any(s <= t for _, s in plan) else plan[0][0]
    abierta = f < len(rms) and rms[f] > umbral and (f % 3 != 2)  # cada 3 fotogramas cierra un momento
    nombre = pose if (abierta == (pose in ab)) else pose + '~b'
    im = img(nombre)
    fr = fondo.copy()
    fr.alpha_composite(im, ((W - im.width) // 2, H - im.height - 60))
    p.stdin.write(fr.convert('RGB').tobytes())
p.stdin.close(); p.wait()
print('listo', out)
