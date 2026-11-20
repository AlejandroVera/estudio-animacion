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
- **UN PLANO FIJO de los dos ~70 % del vídeo**: de cuerpo entero, de pie uno al lado del otro, mismo tamaño, de
  cara a cámara, en el decorado donde el chiste SE VE (la cama en mitad del pasillo; aquí: él doblado con la cabeza
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
