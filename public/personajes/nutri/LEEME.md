# La nutri (personaje secundario/protagonista nuevo)

- Persona normal, trazo tosco como el Chico rosa: moño alto, gafas redondas, sudadera verde con un aguacate grande
  en el centro, vaqueros y zapatillas blancas. Dibujo de referencia: `referencia.jpg` (Magnific: `EbnxlnSuuO`).
- **Voz: Lulú – Voz española cálida y natural** (ElevenLabs `OvG3ld31AQ6IRXW4ojTa`, multilingual v2), elegida por
  Alejandro. Está también en `expresivo/manifest.json` (`voz`).
- Posturas (13, cada una con su `~b` = boca al revés): reposo, habla, senala, presenta, pulgar, cruzado, jarras,
  niega, piensa, sorpresa, enfado, risa, agotada. Originales en `posturas/`, listas para animar (sin fondo,
  alineadas por la cabeza) en `expresivo/` con `manifest.json`.
- Cómo se hicieron: Magnific Nano Banana 2.1 editando la referencia («Same character exactly… Change ONLY the
  pose and expression…»), bocas con `herramientas/bocas_secundario.py`, fondo y alineación con
  `herramientas/preparar_secundario.py`, huecos con `herramientas/huecos_secundario.py`. Prueba rápida hablando:
  `herramientas/prueba_secundario.py`.
- PENDIENTE (pedido por Alejandro): un repertorio tan amplio como el del Chico rosa (inventario de cuerpos y caras).
