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
- **marco** (lo normal en escenas anchas): `marco` 1.3-1.6 = escala sobre el ancho, `cx` = qué parte del dibujo
  queda centrada; detrás el mismo dibujo difuminado y oscurecido. Arriba y abajo queda una franja limpia: ahí
  van los rótulos de pantalla (y≈230-370 arriba, y≈1650-1720 abajo).
- **recorte** (sin `marco`): altura completa; `cx`/`cy` 'auto' centran la cabeza magenta (cabeza al 33 %).
  Solo cuando el personaje es lo único importante; si lo que cambia (portátil, tele, zorro…) queda fuera del
  recorte, usar marco.
- Si la cabeza se sale por el borde con marco grande, bajar la escala (incluso 1.0 para una tira ancha).
- Rótulo `R(...)` = coordenadas de pantalla; `D(...)` = coordenadas del dibujo 1920×1080 (pantallas, carteles,
  pancartas del dibujo), se convierten solas con el encuadre.
- Un plano sin `_bocao.png` necesita `boca_o` apuntando a la `_boca.png` (si no, falla al renderizar entero
  aunque `--frames` funcione).

## Lecciones
- En recorte, un rótulo arriba le tapa la cabeza: pasar ese plano a marco o poner el rótulo abajo.
- Los rótulos se escriben letra a letra: en un fotograma suelto parecen cortados; comprobar el ancho con el
  rótulo terminado.
- Rótulos cortos y gordos (1-2 palabras, tam 110-190); repetir el mismo rótulo como estribillo funciona
  («MÓVIL» tres veces). Nada de «¡ !» (la fuente los hace parecer «I»); «i» minúscula en mayúsculas (SiN, OPTiMiZAMOS).
- El remate final se sostiene ~2 s después de la última palabra (`duracion` = voz + 1,6-2 s).
