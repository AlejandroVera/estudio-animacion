"""Descarga resultados de Higgsfield: líneas «carpeta/nombre url» por la entrada estándar -> <carpeta>/<nombre>.png
y una hoja de contacto en el scratchpad."""
import io, os, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('../../../herramientas/shorts/ComingSoon.ttf', 24)
ns = []
for l in sys.stdin:
    if not l.strip():
        continue
    n, u = l.split()
    os.makedirs(os.path.dirname(n) or '.', exist_ok=True)
    Image.open(io.BytesIO(urllib.request.urlopen(u).read())).convert('RGB').save(n + '.png')
    ns.append(n)
W, H = 200, 356
hoja = Image.new('RGB', (W * min(8, len(ns)), (H + 30) * ((len(ns) + 7) // 8)), 'white')
d = ImageDraw.Draw(hoja)
for i, n in enumerate(ns):
    x, y = (i % 8) * W, (i // 8) * (H + 30)
    im = Image.open(n + '.png'); im.thumbnail((W, H))
    hoja.paste(im, (x, y + 30)); d.text((x + 4, y + 2), os.path.basename(n), font=F, fill='black')
hoja.save('/tmp/claude-0/-home-user-estudio-animacion/f37787d9-675c-5b49-acc7-71cab63b990b/scratchpad/hoja_bot.jpg', quality=85)
print(len(ns), 'descargados')
