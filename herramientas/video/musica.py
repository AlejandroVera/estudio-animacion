"""Pone música de fondo por tramos debajo de la voz de un vídeo ya montado (antihabituación: cambia con cada parte).

  python3 herramientas/video/musica.py video.mp4 tramos.json salida.mp4

tramos.json: {"nivel": -27, "tramos": [{"desde": 0, "hasta": 37.4, "pista": "m1.mp3", "offset": 0}, ...]}
- Cada pista se normaliza a `nivel` LUFS (de fondo), se salta su silencio inicial, se recorta a su tramo y entra y
  sale con un fundido corto (0,4 s) justo en el corte; la última se apaga en 2 s.
- La música se agacha sola cuando habla (sidechain con la voz) y vuelve en las pausas.
- El vídeo no se recodifica (solo el audio).
"""
import json, os, subprocess, sys
import numpy as np

video, tramos_f, salida = sys.argv[1:4]
cfg = json.load(open(tramos_f))
base = os.path.dirname(os.path.abspath(tramos_f))
nivel = cfg.get('nivel', -27)
FUN = 0.4


def inicio_sonido(f):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-t', '10', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
                         capture_output=True).stdout
    x = np.abs(np.frombuffer(raw, np.int16).astype(float))
    if not len(x):
        return 0
    v = np.convolve(x, np.ones(400) / 400, 'same')
    idx = np.nonzero(v > 0.02 * v.max())[0]
    return round(idx[0] / 8000, 2) if len(idx) else 0


ins, fil, etiquetas = ['-i', video], [], []
for k, t in enumerate(cfg['tramos']):
    f = os.path.join(base, t['pista'])
    ins += ['-i', f]
    ini = t.get('offset', 0) + inicio_sonido(f)
    dur = t['hasta'] - t['desde'] + (FUN if k else 0)
    ultimo = k == len(cfg['tramos']) - 1
    fuera = 2.0 if ultimo else FUN
    empieza = max(t['desde'] - (FUN if k else 0), 0)
    fil.append(f"[{k + 1}:a]atrim={ini}:{ini + dur + FUN},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,"
               f"loudnorm=I={nivel}:TP=-3:LRA=11,afade=t=in:d={FUN if k else 0.8},"
               f"afade=t=out:st={dur + FUN - fuera}:d={fuera},adelay={int(empieza * 1000)}|{int(empieza * 1000)}[m{k}]")
    etiquetas.append(f'[m{k}]')
fil.append(''.join(etiquetas) + f"amix=inputs={len(etiquetas)}:normalize=0[mus]")
fil.append("[0:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[voz][llave]")
fil.append("[mus][llave]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450[musd]")
fil.append("[voz][musd]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]")
cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + ins + ['-filter_complex', ';'.join(fil), '-map', '0:v', '-map', '[a]',
                                                       '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', salida]
subprocess.run(cmd, check=True)
print('listo', salida)
