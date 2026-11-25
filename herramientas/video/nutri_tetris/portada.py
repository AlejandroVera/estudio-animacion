"""Portada de Instagram del vídeo de el Tetris de la agenda (1080x1920; texto dentro de la franja 3:4 central).
El fondo (cocina) es muy cargado: el texto va sobre carteles blancos con borde para que se lea."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'shorts', 'portadas'))
import portadas as P
from PIL import Image, ImageDraw, ImageFilter
im = Image.open('img/es_juego.jpg').convert('RGB')
im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
y0 = (im.height - 1920) // 2
im = im.crop((0, y0, 1080, y0 + 1920)).convert('RGBA')

def cartel(caja, ang):
    x0, y0, x1, y1 = caja
    c = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((x0 + 12, y0 + 14, x1 + 12, y1 + 14), radius=34, fill=(0, 0, 0, 110))  # sombra
    d.rounded_rectangle(caja, radius=34, fill=(255, 255, 255, 255), outline=(25, 25, 25, 255), width=8)
    c = c.rotate(ang, center=((x0 + x1) / 2, (y0 + y1) / 2), resample=Image.BICUBIC)
    im.alpha_composite(c)

cartel((60, 1330, 1020, 1560), -1.5)
cartel((40, 1590, 1040, 1870), 1.5)
P.linea(im, 'MI TRABAJO NO ES', 1355, 95, 'negro', 3)
P.linea(im, 'HACER DiETAS', 1455, 85, 'negro', 5)
P.linea(im, 'ES JUGAR', 1610, 110, 'rojo', 7)
P.linea(im, 'AL TETRiS', 1735, 110, 'rojo', 9)
P.letras(im)
im.convert('RGB').save('entrega/Portada-Tetris.jpg', quality=92)
