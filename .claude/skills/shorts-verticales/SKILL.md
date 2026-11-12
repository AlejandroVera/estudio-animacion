---
name: shorts-verticales
description: Hacer Reels/Shorts verticales (9:16) de Alejandro a partir de un vídeo largo ya hecho con el método inventario (Chico rosa, estilo «Estoy Tiesa»): guion reescrito en piezas cortas, voz nueva, reutilizar los dibujos del largo, encuadre vertical, rótulos y efectos. Úsala cuando pida shorts, reels o vídeos verticales sacados de un vídeo largo. NO cambia nada de la skill video-inventario.
---

# Shorts verticales derivados de un vídeo largo

Separada a propósito de `video-inventario` (Alejandro pidió no tocar la de los largos). Herramientas propias en
`herramientas/shorts/` (copias: `montar_vertical.py`, `voz.py`, `efectos.py`, `variante.py`, `preparar_escena.py`).
Ejemplo completo: `herramientas/shorts/domingo/` (3 shorts del vídeo «domingo»).

## Flujo
1. **Guion**: NO son cortes del largo. Se reescriben 2-3 piezas de 30-40 s, cada una con una idea completa:
   gancho en la primera frase (pregunta o frase chocante), un desarrollo con 3-4 imágenes literales y un remate
   (callback al gag visual). Se le enseñan a Alejandro y se espera su visto bueno. Sin CTA salvo que la pida.
   Nombres raros escritos como suenan para la voz («Biung Chul Jan»).
2. **Voz**: `voz.py` (misma voz que el largo) → `voz/shortN.mp3` + `.json` (palabras con `inicio`).
3. **Plan** (`shortN_plan.py` → `shortN.json`, helpers en `comun.py`): un plano por frase o golpe, reutilizando
   los dibujos de `herramientas/video/<proyecto>/img/` con sus mismos cambios, alternas y bocas (mirar en los
   `trozo*.json` del largo cómo se usó cada dibujo: `cambios`, `alterna`, `boca_en`, `bocas`). Cada cambio y
   rótulo en el `inicio` de SU palabra. Solo se dibuja nuevo en Magnific si falta algo imprescindible.
4. **Montar**: `python3 ../montar_vertical.py shortN.json salida.mp4 [--frames t1,t2…]`; revisar con `--frames`
   y con una hoja de contactos a 1 fps del vídeo final antes de entregar.
5. **Sonido**: sin música. `efectos.py video efectos/shortN.json final.mp4` (mismos mp3 del largo; pop en cada
   rótulo-golpe, whoosh 0,18 s antes de los cortes grandes, sonidos literales: sirena, alarma, libros…).
6. Entregar los MP4 a Alejandro (no se suben al repositorio: `.gitignore`).

## Encuadre vertical (1080×1920) desde dibujos 16:9
- **TODO A PANTALLA COMPLETA** (lo pidió Alejandro: nada de franjas difuminadas). Cada dibujo ancho se AMPLÍA por
  arriba y abajo con Magnific `images_expand` (130 créditos): subir el dibujo base (`creations_request_upload` +
  PUT + `creations_finalize_upload`), `customWidth` 1920, `customHeight` ≥ 1920/marco·16/9 (2400 vale para
  marco ≥ 1.35; más alto para marcos menores), `imageX` 0, `imageY` = (alto−1072)/2 y un `prompt` del tipo
  «continue the same flat cartoon drawing seamlessly: <techo/pared/cielo> above, <suelo> below, no new
  characters, no text». Se guarda en `lleno/<familia>.jpg` y se apunta en `lleno/hechos.txt` («nombre id alto»);
  `lleno(P)` de `comun.py` lo pone solo en cada plano con `marco`. Solo se amplía el dibujo BASE: el montador pega
  encima el dibujo real del instante (cambios, alternas, bocas) en su sitio, así las variantes encajan.
- Revisar cada ampliación: a veces REPITE la escena en viñetas o la fila de figuras (evolución). Fondo liso →
  rellenar por código con su color; dibujo con marco blanco propio → recortarlo, ampliar el recorte y pegar
  solo esas filas (`pegar_y`). A veces prolonga el cuerpo de él (piernas): subir el marco y `ly` negativo
  (desplaza el encuadre hacia arriba, en fracciones del alto del dibujo) para que no se vea.
- `marco` 1.35-1.8 = escala sobre el ancho; `cx` = qué parte queda centrada. Los rótulos de pantalla van sobre
  el techo/cielo (y≈230-370) o el suelo (y≈1650-1720).
- **recorte** (sin `marco`): altura completa; `cx`/`cy` 'auto' centran la cabeza magenta (cabeza al 33 %).
  Solo cuando el personaje es lo único importante; si lo que cambia (portátil, tele, zorro…) queda fuera del
  recorte, usar marco.
- Si la cabeza se sale por el borde con marco grande, bajar la escala o mover `cx`.
- Rótulo `R(...)` = coordenadas de pantalla; `D(...)` = coordenadas del dibujo 1920×1080 (pantallas, carteles,
  pancartas del dibujo), se convierten solas con el encuadre.
- Un plano sin `_bocao.png` necesita `boca_o` apuntando a la `_boca.png` (si no, falla al renderizar entero
  aunque `--frames` funcione).

## Lecciones
- Revisar la ANATOMÍA de cada dibujo reutilizado (brazos y manos): `es_bano_pancarta_b` tiene TRES brazos y se
  coló; en el short 1 se quitó ese cambio. Si hace falta el gesto, redibujarlo pidiendo «exactly two arms».
- Al ampliar en vertical, si el dibujo corta al personaje, la IA le inventa la parte de abajo (pantalón corto,
  piernas o pies descalzos magenta). En el `prompt` describir su ropa: «his LONG grey sweatpants continue down to
  his ankles and he wears white sneakers… no shorts, no bare legs».
- Cada plano tiene que ILUSTRAR lo que se dice en ese momento, no reutilizar un dibujo «porque sale el personaje»:
  el short 1 empezaba en la cama con «el jefe más tóxico… soy yo» y no tenía sentido (ahora: él de jefe en la
  oficina y, en «soy yo», se ve que el empleado también es él). Mirar qué cuenta cada dibujo en el largo.
- Nada se nombra con «el/la» sin haberlo presentado antes en ESE short (en el largo sí estaba; en el short no):
  «Prometeo con la pulsera» sin haber salido la pulsera. Se arregla en el guion (`voz.py rehacer` de la frase:
  «me cuenta los pasos con la pulsera» → se ve la pulsera contando pasos; luego «con MI pulsera»).
- En recorte, un rótulo arriba le tapa la cabeza: pasar ese plano a marco o poner el rótulo abajo.
- Los rótulos se escriben letra a letra: en un fotograma suelto parecen cortados; comprobar el ancho con el
  rótulo terminado.
- Rótulos cortos y gordos (1-2 palabras, tam 110-190); repetir el mismo rótulo como estribillo funciona
  («MÓVIL» tres veces). Nada de «¡ !» (la fuente los hace parecer «I»); «i» minúscula en mayúsculas (SiN, OPTiMiZAMOS).
- El remate final se sostiene ~2 s después de la última palabra (`duracion` = voz + 1,6-2 s).
