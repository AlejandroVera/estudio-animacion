# El agente inmobiliario (personaje secundario)

- Persona normal, mismo trazo que la nutri: tupé castaño, barba recortada, sonrisa de vendedor, traje gris con el
  pantalón remangado, camisa rosa fucsia, acreditación colgada, zapatillas blancas y carpeta. Referencia:
  `referencia.jpg` (Magnific `WDgOrxKcXe`, propuesta 4 de `propuestas/`).
- **Voz: Rafa N – Confident Sales Agent** (ElevenLabs `Zb72NBThGN2Rv3y1RSTT`), elegida por Alejandro. Pruebas en `voz_pruebas/`.

## Repertorio completo (como la nutri y Alejandro)
- `expresivo/`: 13 posturas + `~b` (reposo, habla, señala, presenta, pulgar, carpeta, cruzado, niega, piensa,
  sorpresa, agachado, risa, móvil) con `manifest.json` (incluye `voz`). Ids en `posturas/ids.txt`.
- `inventario/cuerpos/`: 50 cuerpos + `~b` (`p_*` de pie, `s_*` sentado, `t_*` tumbado; con cosas de agente:
  llaves, contrato, cartel, metro, maqueta, billetes, carpeta, portátil, firmar, y `p_agacha_viga` para la
  buhardilla). `inventario.json` (cabeza, tipo, voz). Procesado con `inventario_secundario.py . --cabezon`
  (sin `--cabezon` le borraba el blanco de los ojos y los dientes) y zapatillas rellenadas de blanco.
- `caras/`: `base.webp` (cabeza grande), 20 complementos en `capas/` (incluye casco de obra y gafas de sol) y
  16 caras exageradas + `~b` en `expresiones/`; `capas.json` con `cabeza` [1042, 960, 350] y `primeros_planos`.
  Medidas usadas: `capas_nutri.py public/personajes/agente 1042 960 350` y
  `caras_nutri.py public/personajes/agente 800 1290 1140 1480 1042 1050 400 520`.
- Coste: ~210 imágenes de Magnific (≈13.600 créditos).
