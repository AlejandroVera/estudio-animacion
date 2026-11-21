---
name: sketch-dialogo
description: Hacer sketches verticales (9:16) de DIÁLOGO entre dos personajes de Alejandro (p. ej. Chico rosa + el agente inmobiliario), al estilo del vídeo de referencia del pasillo-habitación: un plano fijo de los dos casi todo el rato, primeros planos de reacción y clips de gag animados. Úsala cuando Alejandro pida un vídeo con dos personajes hablando, un sketch o una conversación. Es un formato DISTINTO del narrador a cámara (video-inventario) y de los shorts derivados (shorts-verticales).
---

# Sketch de diálogo entre dos personajes

Formato pedido por Alejandro tras ver un sketch de referencia (agente inmobiliario enseñando un pasillo como
«habitación», 49 s). Ejemplo completo nuestro: `herramientas/video/buhardilla/` («La buhardilla», Chico rosa +
agente). Personajes con repertorio y voz: chico rosa (Aaron Abad), agente (`public/personajes/agente/`, Rafa),
nutri, Alejandro (Daniel - Podcast).

## Cómo está montada la referencia (copiar esto)
- **Empieza ya en el sitio**: primera frase «Pues esta es la habitación». Nada de entradas, puertas ni
  presentaciones que haya que entender (con «Pasa, pasa» + puerta + él a gatas no se entendía nada).
- **UN PLANO FIJO de los dos ~70 % del vídeo**: de cuerpo entero, mismo tamaño, **GIRADOS EL UNO HACIA EL OTRO**
  (tres cuartos, el que enseña dirigiéndose al otro; mirando al frente «no es natural, no se entiende»), en el decorado donde el chiste SE VE (la cama en mitad del pasillo; aquí: él doblado con la cabeza
  contra el techo). Dentro del plano solo cambian el gesto (brazo que señala, mano abierta…) y las bocas.
- **Primeros planos de reacción** del que se queja (cara de hartazgo), 2 veces en el vídeo, en la frase clave.
- **Clips de gag ANIMADOS**, 2-4 por vídeo, ~3 s, en la frase que los cuenta (Puerta del Sol con turistas y un
  sofá = «el salón es Madrid»; cocina llena de gente = «compartida entre nueve»). En la referencia son vídeo: aquí se
  recrean con 2-3 dibujos que se ALTERNAN (`alterna` cada 0,35-0,5 s: la gente se mueve, cae el agua, sale vapor).
- Subtítulos en MAYÚSCULAS, 2-3 palabras, arriba, un color por personaje (amarillo uno, el otro distinto).
- Ritmo: pocos cortes (unos 8 en 49 s). Un dibujo nuevo por frase NO se entiende (lección de la buhardilla v1).

## Pasos
1. **Guion**: líneas «QUIEN: texto», ~45-55 s, empezando ya en situación; cada pregunta del que se queja + respuesta
   absurda del otro; remate final con imagen (la escalera llena de interesados agachados). Visto bueno de Alejandro.
2. **Voz**: `herramientas/video/dialogo.py guion.txt voz/x` (voces en `VOCES`; cada frase con la anterior y la
   siguiente de contexto; `--rehacer N`). El json lleva `quien` por palabra.
3. **Dibujos (Magnific, 9:16)**: decorado vacío (`loc_*`) → PLANO FIJO de los dos sobre él (2 versiones) → cada gesto
   EDITANDO ese plano fijo («Keep EVERYTHING exactly the same… Change ONLY the agent's arms…») → primer plano del que
   reacciona (mismo decorado) → clips de gag (dibujo + 1-2 ediciones «a moment later…» para alternar) → bocas: una
   edición por personaje y dibujo («_rboca» rosa, «_aboca» el otro). Un gesto con la cabeza igual reutiliza la boca
   del plano fijo. ~25-30 imágenes (≈1.800 créditos) si el personaje ya existe.
4. **Preparar**: `preparar.py` (copia de buhardilla): mezcla solo lo que cambia en cada gesto y recorta las bocas.
5. **Plan** (`plan.py`): `"hablan": {"ROSA": {dibujo: [boca]}, "AGENTE": {...}}` (solo se abre la boca del que
   habla), `cambios` en la palabra del gesto, `alterna` en los gags, `subtitulos` con `colores`, `max` 3,
   `mayusculas`, `tam` ~90, `contorno` 14. Casi sin rótulos (tapan el subtítulo); como mucho la cifra del chiste.
6. **Montar** con `herramientas/shorts/montar_vertical.py`, efectos suaves (`efectos.py`; sin música), revisar con
   hoja de 2 fps ENTERA antes de entregar, y portada con carteles (`portada.py`).

## ANIMACIÓN LIMITADA en el plano fijo (imprescindible: con dibujos quietos «la animación es casi nula»)
En la referencia (vídeo generativo) se mueven todo el rato. Con dibujos fijos se consigue así
(`herramientas/video/buhardilla/capas.py` + `vivas` en `montar_vertical.py`):
- Del plano fijo se piden ~5 gestos por personaje SIN mover la cabeza («Keep … the agent's head and face in exactly
  the same place. Change ONLY the agent's free arm: …»): hablando (explica con la mano, dedo arriba, mano al pecho,
  señala al otro), escuchando (mira la carpeta), un parpadeo de cada uno, y los gestos de las palabras clave.
- `capas.py` convierte cada edición en una CAPA de un solo personaje (RGBA: solo lo que cambia, en su lado, sin su
  cabeza) → se pueden combinar libremente: el agente gesticula mientras el chico cruza los brazos.
- En el plan, `vivas` = {QUIEN: {habla: [capas], escucha: [capas o None], parpadeo, cada_habla ~0,8, cada_escucha
  ~2}} y `gestos` [{t0, t1, quien, img, boca}] para el gesto concreto en su palabra (con su propia boca si la cabeza
  cambia, p. ej. el chichón). La boca del que habla va encima de todo.
- Revisar cada capa pegada sobre el plano fijo (hoja de comprobación): si una mano queda cortada, ensanchar el lado
  de ese personaje; si la edición giró el cuerpo entero (el metro), descartarla.
- Coste: ~22 ediciones (≈1.400 créditos) para un plano fijo bien animado.

## Lecciones de la revisión de «La buhardilla» v4 → v5
- El que ESCUCHA casi quieto: solo parpadea y como mucho un cambio cada 4-5 s (`escucha` con muchos None,
  `cada_escucha` 4,5). Si cambia de brazos cada 2 s «gesticula demasiado mientras el otro habla».
- Ritmo de conversación: el agente hablaba lento → `dialogo.py --tempo AGENTE=1.15 --hueco 0.16` (acelera sin cambiar
  el tono; comprobar con `voz.py comprobar`). 54 s → 45,5 s.
- El plan saca TODOS los tiempos de la voz (`L[i]` = inicio de cada frase, `T(palabra, n)`) y escribe también
  `efectos.json`: si se rehace la voz, todo se recoloca solo.
- Subtítulo que se queda sobre el plano siguiente: `"cola": 0.2` (lo que dura tras su última palabra).
- La zona que protege la cabeza en las capas, un ÓVALO ajustado a la cara: un rectángulo le cortaba el hombro al
  levantar el brazo (muesca junto a la barba).
- Un gesto concreto no debe congelar al personaje más de ~2 s (la casita: solo en «mini loft»).

## Lecciones de la revisión v5 → v6 («el brazo se corta, gesticulan demasiado, movimientos sin sentido»)
- NADA de gestos al azar (`vivas` con listas `habla`/`escucha` vacías, solo `parpadeo`). Coreografía escrita a mano
  en `gestos`: UN gesto por frase elegido para lo que dice (pregunta = palmas arriba; «techos» = señala el techo;
  «el encanto» = mano al pecho; «650 al mes» = dedo arriba; «mini loft» = la casita…), mantenido toda la frase.
  El que escucha, quieto; como mucho una reacción con sentido (brazos cruzados tras «esto es un trastero»).
- Recortar las capas sin cortar brazos: la zona de cada personaje llega hasta donde empieza el otro (no un margen
  alrededor de su cabeza), y NO proteger la cabeza del chico (su brazo pegado a la cabeza quedaba cortado; si la
  edición no cambió la cabeza, no entra en la capa de todas formas). Al agente sí: óvalo de la cara.
- Revisar cada capa a tamaño real sobre el plano fijo antes de montar (hoja de recortes por personaje).
