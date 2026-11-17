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
- INVENTARIO (como el del Chico rosa): `inventario/cuerpos/` con 50 posturas más (p_ de pie, s_ sentada sin silla,
  t_ tumbada, y de nutricionista: manzana, ensalada, báscula, cinta, batido, aguacate, dónut, zanahoria, carrito),
  cada una con su `~b` (boca al revés) salvo las de boca tapada u ocupada. Medidas en `inventario/inventario.json`
  (cara, pies, tipo). Se hace con `herramientas/inventario_secundario.py` (fondo, huecos, recorte) y
  `herramientas/bocas_secundario.py` (bocas). Ids de Magnific en `inventario/ids.txt` e `ids_bocas.txt`.
- PRIMEROS PLANOS DE CARA (`caras/`): cabeza grande de frente `caras/base.webp` (Magnific `SymVwTfUb8`).
  - 20 COMPLEMENTOS sueltos en `caras/capas/` (sudor, rubor, vena, lágrimas, ¿?, ¡!, bombilla, corazones, zzz, mareo,
    nube negra, humo, brillos, rayitas de susto, aureola, cuernos, corona, gorro de chef, auriculares, euros), sacados
    por diferencia con la base (`herramientas/capas_nutri.py`). Posición y tamaño en `caras/capas.json`, en radios de
    cabeza desde el centro de la cara (`cabeza` = [x, y, r] en la base de 2048): sirven encima de cualquier dibujo suyo.
  - 16 CARAS EXAGERADAS en `caras/expresiones/` con su `~b` (corazones, susto, llora, carcajada, furiosa, asco,
    vergüenza, dinero, dormida, chula, súplica, mareada, ilusión, agotada, nerviosa, explota), sin fondo, misma
    cabeza y sitio que la base. Hechas con `herramientas/caras_nutri.py` (copia solo la boca de la ~b y quita fondo
    y huecos del pelo). Lista en `capas.json` → `primeros_planos`. Hojas: `repertorio_caras.jpg`, `repertorio_complementos.jpg`.
    Ids de Magnific en `caras/ids.txt`.
