# Alejandro (personaje basado en su foto)

- Estilo Chico rosa (propuesta 3): cabeza grande y redonda, ojos de bola, pelo rizado con los lados rapados, barba,
  aro en la oreja izquierda, camiseta negra, vaqueros y zapatillas blancas. Referencia: `referencia.jpg`
  (Magnific `jUo6IA6LD0`). La foto original está solo en Magnific (`gOmZhb4SXO`), no en el repositorio.
  Propuestas descartadas en `propuestas/`.
- Voz: pendiente de elegir.
- POSTURAS (13, cada una con su `~b` = boca al revés): reposo, habla, senala, presenta, pulgar, cruzado, jarras,
  niega, piensa, sorpresa, enfado, risa, agotada. Originales en `posturas/`, listas para animar en `expresivo/`
  con `manifest.json`. Huecos con `herramientas/huecos_bajo_cabeza.py` (sus ojos son tan grandes que
  `huecos_secundario.py` los borraba).
- INVENTARIO: `inventario/cuerpos/` con 50 cuerpos más (p_ de pie, s_ sentado sin silla, t_ tumbado; con objetos:
  móvil, taza, portátil, micrófono, selfie, pesa, compra, maleta, paraguas, regalo, mando, pizza…) y su `~b` salvo
  boca tapada (p_tapa_boca, s_come, t_duerme). `inventario/inventario.json`. Se procesa con
  `herramientas/inventario_secundario.py inventario --cabezon` (a la altura de la cabeza solo conserva los blancos
  redondos o dentro del ancho de la cara: ojos y dientes) y `herramientas/bocas_secundario.py`.
- CARAS (`caras/`): cabeza grande de frente `caras/base.webp` (Magnific `O6EWppVynm`).
  - 20 complementos en `caras/capas/` (sudor, rubor, vena, lágrimas, ¿?, ¡!, bombilla, corazones, zzz, mareo, nube,
    humo, brillos, susto, aureola, cuernos, corona, gorro de chef, auriculares, euros) con posición en
    `caras/capas.json` (radios de cabeza desde el centro de la cara): `herramientas/capas_nutri.py public/personajes/alejandro 1085 1030 560`.
  - 16 caras exageradas con su `~b` en `caras/expresiones/`:
    `herramientas/caras_nutri.py public/personajes/alejandro 760 1420 1230 1700 1085 1030 590 560`.
- Hojas: `posturas/repertorio.jpg`, `inventario/repertorio_inventario.jpg`, `caras/repertorio_caras.jpg`,
  `caras/repertorio_complementos.jpg`. Ids de Magnific en los `ids*.txt` de cada carpeta.
