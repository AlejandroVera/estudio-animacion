"""Pone efectos de sonido puntuales (sin saturar) sobre un vídeo ya montado y deja el audio al volumen de YouTube.

  python3 herramientas/video/efectos.py video.mp4 efectos.json salida.mp4

efectos.json: {"nivel": -27, "efectos": [[segundo, "nombre", ganancia_dB_opcional], ...]}
- `nombre` es un mp3 en la misma carpeta que efectos.json (hechos con api/voz {efecto, duracion}: ElevenLabs Sound Effects).
- Cada efecto se normaliza a `nivel` LUFS (bajo, por debajo de la voz) y se coloca en su segundo; el resultado final
  se normaliza a -15 LUFS. El vídeo no se recodifica.
"""
import json, os, subprocess, sys

video, cfg_f, salida = sys.argv[1:4]
cfg = json.load(open(cfg_f))
base = os.path.dirname(os.path.abspath(cfg_f))
nivel = cfg.get('nivel', -27)

ins, fil, labs = ['-i', video], [], []
for k, e in enumerate(cfg['efectos']):
    t, nombre = e[0], e[1]
    gan = e[2] if len(e) > 2 else 0
    ins += ['-i', os.path.join(base, nombre + '.mp3')]
    ms = int(t * 1000)
    fil.append(f"[{k + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=pad_dur=0.6,loudnorm=I={nivel}:TP=-6:LRA=11,"
               f"volume={gan}dB,afade=t=out:st=0:d=0.01:curve=nofade,adelay={ms}|{ms}[e{k}]")
    labs.append(f'[e{k}]')
fil.append("[0:a]aformat=sample_rates=44100:channel_layouts=stereo[voz]")
fil.append('[voz]' + ''.join(labs) + f"amix=inputs={len(labs) + 1}:normalize=0:duration=first,loudnorm=I=-15:TP=-1.5:LRA=11[a]")
cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + ins + ['-filter_complex', ';'.join(fil), '-map', '0:v', '-map', '[a]',
                                                       '-c:v', 'copy', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k',
                                                       '-movflags', '+faststart', salida]
subprocess.run(cmd, check=True)
print('listo', salida)
