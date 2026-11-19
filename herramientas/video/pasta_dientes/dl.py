"""Descarga dibujos de Magnific: líneas «nombre url» por la entrada estándar -> crudo/<nombre>.png (y hoja.jpg)."""
import io, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('../../shorts/ComingSoon.ttf', 26)
nombres = []
for l in sys.stdin:
    if not l.strip():
        continue
    n, u = l.split()
    Image.open(io.BytesIO(urllib.request.urlopen(u).read())).convert('RGB').save(f'crudo/{n}.png')
    nombres.append(n)
W, H = 270, 480
hoja = Image.new('RGB', (W * min(6, len(nombres)), (H + 34) * ((len(nombres) + 5) // 6)), 'white')
d = ImageDraw.Draw(hoja)
for i, n in enumerate(nombres):
    x, y = (i % 6) * W, (i // 6) * (H + 34)
    hoja.paste(Image.open(f'crudo/{n}.png').resize((W, H)), (x, y + 34))
    d.text((x + 6, y + 4), n, font=F, fill='black')
hoja.save('/tmp/claude-0/-home-user-estudio-animacion/f37787d9-675c-5b49-acc7-71cab63b990b/scratchpad/hoja_pasta.jpg', quality=85)
print(len(nombres), 'descargados')
