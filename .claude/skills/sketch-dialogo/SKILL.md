---
name: sketch-dialogo
description: Hacer sketches verticales (9:16) de DIÁLOGO entre dos personajes de Alejandro (p. ej. Chico rosa + el agente inmobiliario), al estilo del vídeo de referencia del pasillo-habitación: un plano fijo de los dos mirándose casi todo el rato, con animación limitada por capas, primeros planos de reacción y clips de gag animados. Úsala cuando Alejandro pida un vídeo con dos personajes hablando, un sketch o una conversación. Es un formato DISTINTO del narrador a cámara (video-inventario) y de los shorts derivados (shorts-verticales).
---

# Sketch de diálogo entre dos personajes

Formato pedido por Alejandro tras ver un sketch de referencia (un agente inmobiliario enseña un pasillo como
«habitación», 49 s, vídeo generativo). Ejemplo terminado y aprobado: `herramientas/video/buhardilla/` («La buhardilla»,
Chico rosa + agente, 47 s, versión 7; las versiones viejas del plan están como `plan_v2…v5.py`).
Personajes con repertorio y voz: chico rosa (Aaron Abad `t9LRTh3y1ioN00e9wsNh`), agente (`public/personajes/agente/`,
Rafa `Zb72NBThGN2Rv3y1RSTT`), nutri, Alejandro (Daniel - Podcast). Si falta el otro personaje, se crea completo antes
(como el agente: posturas, inventario, caras; ~210 imágenes).

## Lo que funciona (copiado de la referencia y de 7 revisiones de Alejandro)
1. **Empieza ya en el sitio**: «Pues este es el piso». Nada de entradas ni puertas que haya que entender («Pasa,
   pasa» + ruido de puerta + él a gatas «no pasa a ningún sitio, no se entiende»).
2. **UN PLANO FIJO de los dos ~70 % del vídeo**, del que solo se sale para la reacción y los gags. Un dibujo nuevo por
   frase NO se entiende (v1: 21 cortes en 66 s, el agente diminuto en un plano y gigante en el siguiente).
3. En ese plano, **los dos GIRADOS EL UNO HACIA EL OTRO** (tres cuartos, el que enseña dirigiéndose al otro), de
   cuerpo entero y del mismo tamaño, en el decorado donde el chiste SE VE (él doblado bajo el techo). Mirando al frente
   «no es natural, no se entiende».
4. **Animación limitada**: dibujos quietos = «animación casi nula». Cada personaje tiene capas de gesto que se pegan
   sobre el plano fijo por separado (ver abajo). Pero **un gesto por frase, con sentido**: gestos al azar «gesticulan
   demasiado, movimientos sin sentido». El que ESCUCHA, QUIETO (solo parpadea; como mucho una reacción con motivo,
   p. ej. brazos cruzados tras «esto es un trastero»).
5. **Primer plano de reacción** del que se queja (cara de hartazgo, mirando hacia el otro), 2 veces, en la frase clave.
6. **Clips de gag ANIMADOS**, 2-4 por vídeo, ~3 s, en la frase que los cuenta (ducha sentado, cocina de rodillas,
   amigos apiñados, escalera llena de interesados). Se recrean con 2 dibujos que se alternan cada ~0,4 s (`alterna`:
   cae el agua, sale vapor, la gente se mueve) y un cambio en el remate («spa» = toalla y pepinos).
7. **Voces con ritmo de conversación**: pausas cortas (`--hueco 0.16`); si uno habla lento, `--tempo QUIEN=1.15`
   (sin cambiar el tono). **Las preguntas tienen que sonar a pregunta**: `--preguntas 4` (ver Voz).
8. **Subtítulos** en MAYÚSCULAS, 2-3 palabras, arriba, un color por personaje (agente amarillo [255,226,40], chico
   rosa [255,100,205]), que se van al acabar la frase (`cola` 0,2). Sin rótulos (tapan el subtítulo).
9. Remate final con imagen y ~2,4 s de cola (la escalera con 20 interesados agachados y murmullo).

## Pasos
1. **Guion** `guion.txt`: líneas «QUIEN: texto», 45-50 s, en situación desde la primera frase; preguntas del que se
   queja + respuestas absurdas del otro; remate con imagen. Visto bueno de Alejandro antes de gastar.
2. **Voz**: `python3 herramientas/video/dialogo.py guion.txt voz/x --hueco 0.16 --tempo AGENTE=1.15 --preguntas 4`.
   Cada frase con la anterior y la siguiente de contexto; guarda cada frase en `voz/x_frases/NN` (`--rehacer N` para
   una). El json lleva `quien` por palabra y `frases` con su inicio. Comprobar con `voz.py comprobar voz/x.mp3`: debe
   decir el texto exacto y escribir «¿…?» en las preguntas (si sale «Porque tengo…» sin interrogación, no suena a
   pregunta: rehacerla). `tono.py <mp3>` da la subida final en semitonos (≤ 0 afirmación, ≥ +3 pregunta clara).
3. **Dibujos (Magnific Nano Banana 2.1, 9:16)**, con la referencia de cada personaje:
   - decorado vacío (`loc_*`, 2 versiones) → **plano fijo** de los dos mirándose sobre él (2 versiones, elegir);
   - **gestos editando el plano fijo, sin mover la cabeza**: «Keep EVERYTHING exactly the same (room, the boy…, the
     agent's head and face in exactly the same place). Change ONLY the estate agent's free arm: …». Uno por cada
     frase que lo pida (presenta el piso, señala el techo, mano al pecho, dedo arriba, «no, no, no», señala abajo,
     brazos abiertos, la casita, el reloj; el chico: palmas arriba, señala el techo, brazos cruzados) + un PARPADEO de
     cada uno («Change ONLY the eyes…: closed for a blink») + los gestos que cambian la cabeza (chichón) con su boca;
   - bocas del plano fijo: una edición por personaje («Change ONLY the mouth of the bearded man…: open, talking…»);
   - primer plano del que reacciona en el mismo decorado (+ su boca);
   - clips de gag: dibujo con los dos dentro + 1 edición «a moment later…» para alternar (+ boca si habla alguien).
   - Coste real de la buhardilla v7: ~45 imágenes (≈3.000 créditos) sin contar el personaje nuevo.
4. **Capas**: `capas.py` (copiar de buhardilla y ajustar `BASE`): cada edición `cv_*` → RGBA de un solo personaje
   con solo lo que cambia. Reglas que salieron de los fallos:
   - la zona de cada personaje llega hasta donde empieza el otro (un margen alrededor de su cabeza le cortaba la mano);
   - al agente se le protege la cara con un ÓVALO ajustado (un rectángulo le cortaba el hombro al levantar el brazo);
     al chico NO (su brazo pegado a la cabeza quedaba cortado; si la cabeza no cambió, no entra en la capa igualmente);
   - descartar ediciones que giran el cuerpo entero (el metro) y revisar TODAS las capas a tamaño real pegadas sobre
     el plano fijo (hoja de recortes por personaje) antes de montar.
   Los gags y primeros planos se preparan con `preparar.py` (variantes que solo copian lo que cambia + bocas).
5. **Plan** `plan.py` (copiar de buhardilla): TODOS los tiempos salen de la voz (`L[i]` inicio de la frase i,
   `T(palabra, n)`), también los efectos (`efectos.json`), así que si se rehace la voz todo se recoloca solo.
   - `charla(t0, gestos)`: el plano fijo con `vivas` (solo `parpadeo` de cada uno; listas `habla`/`escucha` VACÍAS),
     `hablan` (la boca del que habla va encima de todo) y `gestos` [G(t0, t1, QUIEN, capa, boca)] — UN gesto por
     frase, desde su inicio hasta la frase siguiente; un gesto concreto no congela más de ~2 s (la casita solo en
     «mini loft», luego otro).
   - `gag(base, t0, otro, hasta)` y `esc('es_pprosa', …)` para los cortes; cortes y gestos 0,08 s antes de su palabra.
   - `subtitulos`: `{'y': 250, 'tam': 92, 'max': 3, 'contorno': 14, 'mayusculas': True, 'cola': 0.2, 'colores': …}`.
6. **Montar**: `python3 herramientas/shorts/montar_vertical.py plan.json salida.mp4` (antes `--frames …` en momentos
   clave), efectos suaves sin música (`herramientas/video/efectos.py`: whoosh en los cortes a gag, golpe, ding, agua,
   sartén, tictac, murmullo). **Revisar el vídeo ENTERO** con hojas a 3-4 fps y recortes ampliados (brazos cortados,
   manchas junto a hombros, subtítulos que pisan el plano siguiente, quién gesticula mientras escucha) antes de entregar.
7. **Portada** con carteles (`portada.py`: plano fijo de los dos + carteles blancos con borde negro, sombra y un poco
   girados; título arriba, remate en rojo abajo).

## Herramientas de este formato
- `herramientas/video/dialogo.py` (voces de diálogo: `--hueco`, `--tempo`, `--preguntas`, `--rehacer`).
- `herramientas/video/tono.py` (subida de tono al final de una frase).
- `herramientas/shorts/montar_vertical.py`: `hablan` (boca solo del que habla), `vivas` y `gestos` (capas por
  personaje), `alterna`, subtítulos con `colores`/`max`/`mayusculas`/`contorno`/`cola`.
- Descargas de Magnific sin gastar contexto: `creations_get` con 40+ ids (rellenar con ids viejos) para que la
  respuesta vaya a fichero y leerla con `herramientas/dl_magnific.py` (con 28 aún salía en línea).
