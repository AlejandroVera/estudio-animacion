"""Descarga lo que falte: python3 dl_ids.py <salida_creations_get.txt> [prefijo_hoja nombres...]
Lee ids.txt («nombre id»), busca la url de cada id en el texto de creations_get y la guarda en crudo/<nombre>.png.
Hace una hoja de contactos con los nombres descargados ahora (o con los que se pasen)."""
import io, re, sys, os, urllib.request
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/home/user/estudio-animacion/herramientas/shorts/ComingSoon.ttf', 26)
ids = {}
for l in open('ids.txt'):
    p = l.split()
    if len(p) == 2 and not l.startswith('#'):
        ids[p[1]] = p[0]
txt = open(sys.argv[1]).read()
cur = st = None; nuevos = []
for line in txt.splitlines():
    m = re.match(r'\s*-? ?"?identifier"?: ?"?(\w+)', line)
    if m: cur, st = m.group(1), None; continue
    m = re.match(r'\s*status: (\S+)', line)
    if m: st = m.group(1)
    m = re.match(r'\s*url: "(.+)"', line)
    if m and cur in ids and st == 'completed':
        n = ids[cur]; out = f'crudo/{n}.png'
        if not os.path.exists(out):
            Image.open(io.BytesIO(urllib.request.urlopen(m.group(1)).read())).convert('RGB').save(out); nuevos.append(n)
        cur = None
nombres = sys.argv[2:] or nuevos
print('nuevos', nuevos, 'faltan', [n for n in ids.values() if not os.path.exists(f'crudo/{n}.png') and not n.startswith('elegidos')])
if nombres:
    W, H = 270, 480
    hoja = Image.new('RGB', (W * min(6, len(nombres)), (H + 34) * ((len(nombres) + 5) // 6)), 'white')
    d = ImageDraw.Draw(hoja)
    for i, n in enumerate(nombres):
        x, y = (i % 6) * W, (i // 6) * (H + 34)
        hoja.paste(Image.open(f'crudo/{n}.png').resize((W, H)), (x, y + 34))
        d.text((x + 6, y + 4), n, font=F, fill='black')
    hoja.save('/tmp/claude-0/-home-user-estudio-animacion/f37787d9-675c-5b49-acc7-71cab63b990b/scratchpad/hoja_pasta.jpg', quality=85)
