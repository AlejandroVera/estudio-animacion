# El bot del Partido Artificial («CEROS Y UNOS»)

- Robot candidato del sketch «Jornada de reflexión»: cabeza de monitor con la cara en la pantalla (ojos y boca azul
  claro), antena, cuello blanco, corbata de píxeles azul, escarapela y tableta. Mismo trazo que el Chico rosa.
  Referencia: `referencia.jpg` (Higgsfield `20cb561b-9162-4909-b028-38f1bfe811f6`, propuesta 1 de `propuestas/`).
- **Voz:** Gabriel Blanco II (ElevenLabs `Xdk5eWaS3lO6Yz2HBOBv`) con un eco muy corto que le da timbre metálico
  (`aecho=0.8:0.6:9:0.32,highpass=f=120,treble=g=2`, ver `herramientas/video/reflexion/nivelar.py`).

## Repertorio (todo hecho en Higgsfield, Nano Banana 2, 2 créditos por imagen)
- `expresivo/`: 13 posturas + `~b` (reposo, habla, señala, presenta, pulgar, tablet, cruzado, niega, piensa,
  sorpresa, risa, saluda, mano_pecho) y `manifest.json` (tamaño, caja de la pantalla-cara, pies, voz).
- `inventario/cuerpos/`: 50 cuerpos + `~b` (`p_*` de pie, `s_*` sentado, `t_*` tumbado; cosas de candidato:
  megáfono, atril, papeleta, gráfica, vota en la urna, cartel en blanco, bebé, rechaza billetes, términos y
  condiciones, enchufado cargando, sin batería, baile de robot, glitch, aceite de motor…) e `inventario.json`.
  Sin `~b` (no se le ve la boca o no sale bien): p_aceite, p_bebe, p_susurra, p_telefono, p_andando, p_corre,
  p_glitch, p_tapa_cara, t_sin_bateria.
- `caras/`: `base.webp` (+`~b`), 16 caras de pantalla en `expresiones/` (corazones, euros, cargando, error,
  pantallazo azul, guiño, enfado, triste, risa, sorpresa, dormido, estrellas, mareado, sospecha, estática,
  vergüenza; con `~b` las que tienen boca) y 18 complementos en `capas/` (corona, gafas pixeladas, aureola,
  cuernos, humo, chispas, bombilla, birrete, ¿?, ¡!, nube, auriculares, sudor de aceite, gorra, bigote de píxeles,
  corazón, wifi, tirita) con `capas.json` (posición en píxeles de `base.webp` y caja de la pantalla).
- Hojas: `expresivo/repertorio_expresivo.jpg`, `inventario/repertorio_inventario.jpg`, `caras/repertorio_caras.jpg`.

## Cómo se hizo (para repetirlo con otro personaje de pantalla)
- Cuerpos: «The SAME robot character as the reference… plain pure white background. POSE: …» (`jobs.json` guarda el
  id de cada imagen para volver a descargarla; los PNG en bruto no se suben).
- **Bocas abiertas por código** (`bocas_bot.py`): la boca es un trazo luminoso en la pantalla; se borra con el color
  de la pantalla y se pinta una boca abierta brillante del mismo color. Idénticas en todos los dibujos, sin coste y
  sin el desplazamiento del 1,1 % que meten las ediciones de Higgsfield.
- `procesar.py` quita el fondo (relleno desde los bordes) y recorta; `caras.py` alinea cada complemento con la base
  (afín por parches) y guarda solo lo que añade.
- Coste: ~100 imágenes (~200 créditos de Higgsfield).
