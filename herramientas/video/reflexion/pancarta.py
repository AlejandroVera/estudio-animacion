"""Escribe la pancarta del stand («CEROS Y UNOS · Partido Artificial») en los dibujos (la IA escribe mal: se pinta
por código con la letra de los rótulos). Se ejecuta después de capas.py y preparar.py.
  python3 pancarta.py"""
from PIL import Image, ImageDraw, ImageFont
F = '../../shorts/ComingSoon.ttf'
PAN = {'es_charla': (264, 1289, 410, 831), 'es_stand': (273, 1302, 297, 757)}
for n, (x0, x1, y0, y1) in PAN.items():
    im = Image.open(f'img/{n}.jpg').convert('RGB')
    d = ImageDraw.Draw(im)
    cx, h = (x0 + x1) / 2, y1 - y0
    for txt, tam, yy, col in [('CEROS Y UNOS', int(h * 0.30), y0 + h * 0.36, (24, 70, 150)),
                              ('Partido Artificial', int(h * 0.17), y0 + h * 0.70, (20, 120, 170))]:
        f = ImageFont.truetype(F, tam)
        w = d.textlength(txt, font=f)
        while w > (x1 - x0) * 0.86:
            tam -= 4; f = ImageFont.truetype(F, tam); w = d.textlength(txt, font=f)
        for dx, dy in [(0, 0), (2, 0), (0, 2), (2, 2)]:
            d.text((cx - w / 2 + dx, yy - tam * 0.6 + dy), txt, font=f, fill=col)
    im.save(f'img/{n}.jpg', quality=92)
    print(n, 'pancarta escrita')
