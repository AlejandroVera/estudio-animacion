"""PDF de la carta sin letras (la IA escribió palabras en inglés): cada línea de texto pasa a raya gris; y dos
zooms como página limpia (postres y aviso legal) para los planos de «hago zum»."""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

im = Image.open('crudo/br_pdf.png').convert('RGB')
a = np.asarray(im).astype(int)
X0, Y0, X1, Y1 = 454, 495, 1077, 1598          # pantalla
sub = a[Y0:Y1, X0:X1]
sat = sub.max(2) - sub.min(2)
texto = (sub.max(2) < 170) & (sat < 110)
# los dibujos (croquetas, tarta) tienen color: se respeta su caja entera (con margen)
color = np.zeros(sat.shape, bool)
lc, nc = ndi.label(sat > 60)
for sl, t in zip(ndi.find_objects(lc), ndi.sum(sat > 60, lc, range(1, nc + 1))):
    if t > 1500:
        color[max(0, sl[0].start - 25):sl[0].stop + 25, max(0, sl[1].start - 40):sl[1].stop + 40] = True
texto &= ~color
lin = ndi.binary_dilation(texto, structure=np.ones((3, 25)))
lab, n = ndi.label(lin)
out = im.copy()
d = ImageDraw.Draw(out)
for sl in ndi.find_objects(lab):
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    if y1 - y0 > 40:
        continue
    d.rectangle((X0 + x0, Y0 + y0, X0 + x1, Y0 + y1), fill=(255, 255, 255))
    cy = Y0 + (y0 + y1) / 2
    hh = max(3, (y1 - y0) * 0.28)
    d.rounded_rectangle((X0 + x0 + 4, cy - hh, X0 + x1 - 4, cy + hh), radius=hh, fill=(185, 185, 185))
out.save('img/br_pdf.jpg', quality=92)


def zoom(y0, y1, nombre, x0=X0 + 6, x1=X1 - 6):
    trozo = out.crop((x0, y0, x1, y1))
    k = 1080 / trozo.width
    t = trozo.resize((1080, round(trozo.height * k)), Image.LANCZOS)
    lienzo = Image.new('RGB', (1080, 1920), (255, 255, 255))
    lienzo.paste(t, (0, (1920 - t.height) // 2 + 120))
    lienzo.save(f'img/{nombre}.jpg', quality=92)


zoom(1215, 1420, 'br_pdf_postres', 560, 990)
zoom(1470, 1560, 'br_pdf_legal', 470, 820)
