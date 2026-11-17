"""Capas de complementos de la nutri: diferencia de cada edición con caras/crudo/base1.png.
Uso: python3 herramientas/capas_nutri.py  (desde la raíz del repo)"""
from PIL import Image, ImageFilter
import numpy as np, glob, json, os
from scipy import ndimage as nd
D='public/personajes/nutri/caras'
b=np.asarray(Image.open(f'{D}/crudo/base1.png').convert('RGB')).astype(int)
CX,CY,R=1030,1130,354   # centro de la cara y medio ancho (piel)
# complementos macizos: lo blanco encerrado por su trazo es parte del dibujo
MACIZOS={'a_gorro_chef','a_nube','a_sudor','a_lagrimas','a_euros','a_corazones','a_bombilla',
         'a_exclamacion','a_humo','a_corona','a_cuernos','a_auriculares','a_vena'}
DESC={'a_sudor':'gotas de sudor a los lados','a_rubor':'mejillas sonrojadas','a_vena':'vena de enfado',
 'a_lagrimas':'lágrimas cayendo','a_interrogacion':'interrogación (duda)','a_exclamacion':'exclamación (idea, alerta)',
 'a_bombilla':'bombilla encendida (idea)','a_corazones':'corazones alrededor (amor)','a_zzz':'zzz (sueño, aburrimiento)',
 'a_mareo':'estrellas y pajaritos girando (mareo, golpe)','a_nube':'nube negra con lluvia (mal día)',
 'a_humo':'humo por las orejas (enfado)','a_brillos':'brillos (orgullo, limpio, perfecto)',
 'a_susto':'rayitas de susto alrededor','a_aureola':'aureola de santa (inocente)','a_cuernos':'cuernos de diablilla',
 'a_corona':'corona (reina)','a_gorro_chef':'gorro de cocinera','a_auriculares':'auriculares con notas',
 'a_euros':'billetes y monedas de euro (dinero)'}
out={'cabeza':[CX,CY,R],'nota':'x,y,w,h en radios de cabeza desde el centro de la cara; base 2048 = caras/crudo/base1.png','capas':{}}
os.makedirs(f'{D}/capas',exist_ok=True)
for f in sorted(glob.glob(f'{D}/crudo/a_*.png')):
    n=os.path.basename(f)[:-4]
    A=np.asarray(Image.open(f).convert('RGB')); a=A.astype(int)
    d=np.abs(a-b).max(2)>(22 if n=='a_rubor' else 40)
    d=nd.binary_opening(d,iterations=2)
    lab,k=nd.label(nd.binary_dilation(d,iterations=6))
    sz=nd.sum(d,lab,range(1,k+1))
    m=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>150])
    m=nd.binary_closing(m,iterations=3)
    bg=(a.min(2)>235)&(b.min(2)>235)
    if n in MACIZOS:
        m=nd.binary_fill_holes(m); trazo=m
    else:
        trazo=m&~bg
        holes=nd.binary_fill_holes(trazo)&~trazo
        hl,hk=nd.label(holes); hs=nd.sum(holes,hl,range(1,hk+1))
        trazo|=np.isin(hl,[i+1 for i,s in enumerate(hs) if s<3000])
    al=Image.fromarray(trazo.astype(np.uint8)*255).filter(ImageFilter.GaussianBlur(1.2))
    im=Image.fromarray(A).convert('RGBA'); im.putalpha(al)
    bb=al.getbbox(); x0,y0,x1,y1=bb
    im.crop(bb).save(f'{D}/capas/{n}.webp',quality=92)
    out['capas'][n]={'tipo':'extra','x':round((x0-CX)/R,3),'y':round((y0-CY)/R,3),
                     'w':round((x1-x0)/R,3),'h':round((y1-y0)/R,3),'desc':DESC.get(n,'')}
json.dump(out,open(f'{D}/capas.json','w'),indent=1,ensure_ascii=False)
print(len(out['capas']),'capas')
