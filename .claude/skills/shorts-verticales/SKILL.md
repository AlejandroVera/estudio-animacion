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
- Que se vea QUIÉN hace cada cosa: si la frase habla del abuelo, el plano es del abuelo (en el short 3 salía él con
  el encargado en «un no tiene final» y él con una señal de STOP en «el no te deja parar»: no se entendía). Nada de
  personajes sin presentar (él de niño junto al abuelo). Si el remate es «sin mirar el móvil», que se vea el móvil.
- Revisar CADA rótulo terminado de escribir (fotograma en t0 + letras·0,045 + 0,25 s) y ampliado: en los rótulos
  `D` la `y` es la parte de ARRIBA del texto, no su centro (el «4» del cartel quedaba en el borde de abajo); y que
  todo lo que lleva texto dentro del dibujo (las dos pancartas) quepa en el encuadre: bajar el `marco` o mover `cx`.
- Cada short tiene que entenderse SIN haber visto el largo: el guion del short 3 hablaba de «su banco» y «mis
  cursos» sin presentarlos y acababa en «entrenando algo que no sé hacer» (¿qué?). Se reescribió con un remate
  propio y concreto (él en el mismo banco, sin aguantar dos minutos sin el móvil). Antes de grabar, leer el guion
  como si fuera la primera vez.
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

## Vídeos verticales NUEVOS (no sacados de un largo): ejemplo `herramientas/video/qr_restaurante/`
- Se dibuja directamente en 9:16 (Magnific `aspectRatio: 9:16`), mismo método de escenas con gags del largo (voz,
  movimientos, dos bocas, efectos). Un solo sitio que se repite (el restaurante) con el mismo secundario (camarero)
  da continuidad. Montaje con `herramientas/shorts/montar_vertical.py` en modo recorte (`zoom` 1,2-1,45 para
  acercarse a él: la imagen de 2k tiene resolución de sobra; móviles con `zoom` 1,35 centrado en la pantalla).
  Textos dentro de pantallas con `D(...)` en unidades de 1920 de ancho (medir la pantalla en píxeles × 1920/ancho).
- Lecciones de la revisión (2026-11-17, «revisa el vídeo completo porque tiene fallos»):
  1. Mirar qué hay DETRÁS de su cabeza: una planta en la pared parecía que le salían hojas. Quitarla con una
     edición «REMOVE ONLY the plant…» de cada base; las variantes ya hechas se reaprovechan protegiendo la zona
     que cambió (si no, la vuelven a pintar) y, si un brazo cruzaba esa zona, rehacer esa variante desde la base limpia.
  2. La IA escribe palabras falsas (en inglés) en cartas, PDFs y pantallas aunque se pida «no text»: al acercarse se
     leen. Pasar las líneas de texto a rayas grises por código (`pdf_limpio.py`) y hacer los «zoom» como página
     limpia recortada (no con `zoom` 4 sobre el móvil: asomaban el borde y la mano).
  3. Ningún plano de más de ~3 s casi quieto: el formulario de 5,5 s se partió con un plano de él con la ceja
     levantada en «para una mejor experiencia». El final quieto se anima con un segundo dibujo (la nubecita sube).
- Segunda revisión (2026-11-17: «al principio no se entiende lo que dice; al señalar el QR el brazo se vuelve
  translúcido; al final el texto se corta; hay que poner subtítulos»):
  1. Escuchar (transcribir) el arranque: la voz metió un «allí» y se trababa. La primera frase no se puede rehacer
     con `voz.py rehacer` (no hay silencio delante): `empalme_inicio.py` la graba aparte con el resto como contexto
     y la empalma; luego `reajustar.py` lleva plan y efectos a la voz nueva.
  2. Una variante hecha sobre la base vieja deja «fantasmas» (brazo medio transparente) si la base cambia: rehacer la
     variante editando la base nueva.
  3. Ningún rótulo debe cortarse a medio escribir o recién escrito: `vel_letra` 0,03 en el plan, rótulos 0,1 s antes
     de su palabra y, si cae en el cambio de plano, repetirlo en el plano siguiente (con `t1`). Comprobar con un
     listado «tiempo que se ve completo» (≥ 0,9 s).
  4. SUBTÍTULOS siempre en los verticales: `"subtitulos": {"y": 230, "tam": 76}` en el plan (letra blanca gruesa con
     contorno negro, grupos de ≤5 palabras cortados en la puntuación). Se ocultan solos mientras hay un rótulo grande
     de pantalla (los de dentro del dibujo, `D`, no los ocultan). Si tapan algo del dibujo, `"sub_y"` en ese plano
     (p. ej. 1700 = abajo) o `"sin_subtitulos": true`.
- Tercera revisión (2026-11-17): 1) al final de la voz había un resoplido («pff») tras la última palabra: medir la
  energía del audio y cortar la voz justo después de la última palabra (`atrim` + fundido de 0,08 s). 2) Subtítulos y
  rótulos coincidían: ahora el subtítulo se oculta mientras hay CUALQUIER rótulo (también los de dentro del dibujo) y
  0,35 s antes de que aparezca uno grande, aunque sea del plano siguiente. Revisar con una hoja de la franja de arriba
  cada 0,2 s. 3) Lo que se escribe raro para que la voz lo pronuncie («zum») se corrige en los subtítulos con
  `"subtitulos": {"cambiar": {"zum": "zoom"}}`.
- Portadas (2026-11-19, «no se ve bien el texto» en la de la pasta de dientes): sobre un fondo cargado (estanterías,
  pasillos llenos de colores) el halo blanco no basta. Poner el título en CARTELES blancos con borde negro grueso,
  sombra y un poco girados (`herramientas/video/pasta_dientes/portada.py`), letra más grande y el remate en rojo.
- Narrador que CITA a otros (2026-11-24, «La báscula» de la nutri: «cuando dice "¿Y la báscula?" debería sonar la
  paciente» y «en varios momentos la nutri no está animada»): 1) cada frase citada de otro personaje (paciente, señora,
  abuela…) va con SU voz: `nutri_bascula/voces_citas.py` parte de la locución aprobada y sustituye solo esas frases
  (cada palabra lleva `quien`; los tiempos de después se recolocan solos con `Tt`), subtítulo de otro color por persona.
  2) La narradora mueve la boca en TODOS los planos donde se le ve la cara, no solo en los suyos de cerca, y el que
  habla en cada momento abre la suya: `esc(..., hablan={'ANA': {dibujo: capa}, 'PACIENTE': {...}})`. Un dibujo donde
  alguien tiene la boca ya abierta y no habla se cierra antes con una edición (`CERRADAS` en `preparar.py`).
  3) «Ruido de fondo cuando habla la paciente»: algunas voces de la biblioteca de ElevenLabs vienen grabadas bajas y
  con siseo; al igualar el volumen sube también el ruido. Medir el suelo de ruido de cada toma (percentil 10 por
  ventanas de 50 ms) antes de usarla y limpiar las citas con `highpass` + `afftdn` suave (el `agate` se comía el «¿Y…»).
  Después «ahora está súper baja»: la voz elegida (Carolina) era apagada, con la mitad de energía en 1-4 kHz que la
  narradora; a igual RMS se oía floja. Elegir voces con PRESENCIA parecida a la narradora (proporción 1-4 kHz ≈ 0,3),
  medir cada frase en LUFS en el vídeo final (`ebur128`), y quien reclama o se impacienta, 1-2 dB por encima.
  En «El Tetris» la primera paciente «sonaba muy mal»: era una voz de atención al cliente (Gloria), lenta y rígida, y
  además pasada por el filtro de ruido. Para personajes, voces de diálogo o de personajes (Sara Martín, Estela, Marco),
  probar 3-4 con la frase real y quedarse con la limpia; el `afftdn` SOLO si la toma tiene ruido (mínimo por ventanas
  > 20 dB): en una voz limpia la deja «a lata» (`voces_citas.py` ya lo decide solo).
- «El comienzo muy estático» (El Tetris): los primeros 5 s piden un cambio cada ~1,5 s ligado a la frase (Ana enseña el
  plan de dieta en «dietas», sube un bloque en «Tetris» y caen piezas sobre el planificador con su sonido; coge el
  móvil en «me escribe»). Objetos que caen: `"cae": s, "y0": -250` en `objetos` de `montar_vertical.py`.
- Lo que se ve DENTRO de un móvil (story, foto, videollamada) tiene que ser el MISMO sitio que la escena donde está
  esa persona («no coinciden la escena donde escribe y la story», «hay 2 sofás», «el sofá está girado respecto a la
  tele»): dibujar la foto con el dibujo de esa escena como referencia («same room: the same TV, cabinet…») y desde sus
  ojos (sus manos en primer plano), y luego meterla en la pantalla editando el dibujo del móvil («replace ONLY the
  picture inside the phone screen with the second reference»). Comprobar que el mueble principal mira a la tele.
- «Poca animación de los pacientes, parecen fotos fijas» (El Tetris): TODO personaje que sale más de ~1,5 s necesita un
  segundo dibujo (misma cabeza, cambia una mano/gesto o algo del decorado: pulgares tecleando, risa, plato que se aleja,
  bocado al cruasán, espiar entre los dedos, chorro de agua) alternado con `alterna` cada 0,25-0,7 s; con `hasta` se
  para antes de un `cambio`. Y el mismo personaje en dos escenas, con la MISMA ropa (editar con su dibujo como 2.ª
  referencia). Planos con marcos (videollamada) o personaje pequeño: zoom hasta que llenen el cuadro.
- Ritmo (El Tetris: «corta los espacios sin locución», «falta sonido, cuando quitas la música cae el ritmo», «el agua
  entra tarde»): 1) toda pausa entre palabras > 0,18 s se deja en 0,14 s aunque tenga respiración (al final de
  `voces_citas.py`; ritmo_voz solo corta silencio absoluto); 76 s → 71 s. 2) Base de 8 bits por código todo el vídeo
  (`efectos/fondo.mp3`) → DESCARTADO: «la música de fondo no me cuadra, es una locura». Sin base musical continua; el
  ritmo, con pausas cortas, efectos y la melodía solo donde se menciona.
  3) Golpe de aire en cada corte sin efecto y «pop» en cada rótulo (automático en el plan). 4) Un sonido de algo que
  se VE desde el primer fotograma (agua saliendo) empieza con el plano, no en la palabra que lo nombra.
  4) «No van bien los sonidos con lo que hace»: cada efecto tiene que tener su dibujo. Si suena el golpe de la báscula
  contra el suelo, en ese momento se tiene que VER en el suelo (un dibujo intermedio, `es_miercoles_s`).
  5) Los `Tt(palabra, desde)` anclados a otra palabra (`Tt('el', T('pesarse'))`), nunca a segundos fijos: al cambiar una
  voz los segundos se mueven y el plan se rompe.

## Sketch de DIÁLOGO entre dos personajes (ejemplo `herramientas/video/buhardilla/`, Chico rosa + agente)
- Personaje secundario completo antes (como el agente: `public/personajes/agente/`), y su referencia en cada escena.
- Voz: `herramientas/video/dialogo.py guion.txt voz/x` (líneas «QUIEN: texto», voces en `VOCES`; cada frase con la
  anterior y la siguiente como contexto; `--rehacer N` rehace solo una). El json lleva `quien` en cada palabra.
- Dibujos: decorados vacíos primero (`loc_*`) y cada escena editando su decorado con las DOS referencias (siempre
  el mismo piso). Bocas: una edición por personaje que habla en ese dibujo («_rboca» del rosa, «_aboca» del otro,
  «Change ONLY the mouth of the bearded man…»); `preparar.py` recorta cada una (rosa por la cabeza magenta, el otro
  por la mancha de cambio). Un movimiento con la cabeza en el mismo sitio reutiliza la boca de su base.
- Plan: `"hablan": {"ROSA": {dibujo: [boca]}, "AGENTE": {...}}` en cada plano: el montador abre solo la boca del
  que habla en ese instante. Subtítulos de un color por personaje: `"subtitulos": {"colores": {"ROSA": [255,120,210],
  "AGENTE": [255,222,90]}}` (se cortan al cambiar de personaje).
- Coste real: ~100 imágenes (≈6.500 créditos) para 66 s, sin contar el personaje nuevo.
- Para descargar de Magnific sin gastar contexto: `creations_get` con 40+ ids (rellenar con ids viejos) para que la
  respuesta vaya a fichero y leerla con `herramientas/dl_magnific.py`; con 28 aún salía en línea.
- REVISIÓN de «La buhardilla» («no se entiende bien, en el que te pasé había un plano más fijo»): un dibujo nuevo por
  frase, cada uno con otro encuadre (el agente diminuto en uno y gigante en el siguiente) y los dos mirando a cámara
  no se lee como conversación. Estructura que funciona: 1) PLANO FIJO de los dos mirándose, grandes (de rodillas
  arriba), que vuelve una y otra vez; los gestos son ediciones de ESE dibujo; 2) PRIMER PLANO de cada uno mirando
  fuera de cuadro hacia el otro, para las preguntas y las reacciones; 3) los gags, planos aparte y cortos.
  Subtítulos de 2-3 palabras (`"max": 3`), `tam` 96 y `contorno` 14; casi sin rótulos (los rótulos ocultan el
  subtítulo y en un diálogo lo que importa es saber qué dice cada uno). Si el subtítulo tapa una cabeza: `sub_y` 1700.
- RITMO (Ana Cardo, 2026-11-22: «siento que le falta algo de ritmo»): 1) voz más ágil sin rehacerla:
  `herramientas/video/ana_cardo/ritmo_voz.py entrada salida 1.1 0.22` (deja cada silencio en ≤ 0,22 s y acelera un
  10 % sin cambiar el tono; corrige el json): 80 s → 67 s. 2) GOLPES DE ZOOM en el remate de cada frase: copia del
  plano con `zoom` 1,3-1,45 centrado en la cara (sacada de su capa de boca) en la palabra del remate y vuelta al
  plano abierto en la frase siguiente (`GOLPES` en su plan.py) + un whoosh muy bajo (-14 dB) en cada golpe.
  Ningún plano de más de 3-4 s sin un corte o un cambio.
- 2026-11-22 (Ana Cardo, vídeo vertical de la nutri): «le falta el aguacate en el jersey en algunos planos; el súper con
  los alimentos a la altura de los ojos no es realista; siempre está de frente». 1) Revisar el VESTUARIO de cada dibujo
  (seña del personaje: aguacate en la sudadera) en una hoja de todos los `img/*.jpg`; si falta, edición «Change ONLY her
  sweatshirt: big avocado print… like the reference» con la referencia como segunda imagen, y que lo que sujeta no lo tape.
  2) Los gags del mundo real, como son de verdad (pasillo de cereales: los de mascotas a la altura de los ojos y de los
  niños, avena sencilla abajo; nada de verduras en bandejas por el suelo). 3) Variar el ÁNGULO: no todo de frente a
  cámara; de lado o de tres cuartos haciendo la acción (estudiando de perfil, recogiendo el título de una profesora, de
  perfil con la lupa, en la nevera leyendo la etiqueta), y a cámara solo cuando se dirige al público (presentación,
  remates, «sígueme»). Una boca de perfil que gira la cara entera no vale: ese plano va en voz en off.
- 2026-11-22 «el aguacate le palpita en el jersey»: la capa de boca de un dibujo se había sacado comparando con OTRA
  versión del dibujo (la base se cambió después por una con el aguacate) y la diferencia más grande era el aguacate:
  al hablar aparecía y desaparecía. La boca se compara siempre con el dibujo del que se editó (`ORIGEN` en
  `ana_cardo/preparar.py`). Comprobación automática: buscar fotogramas que cambian y vuelven al siguiente con más de
  ~200 px (a 180×320) fuera de los subtítulos; si caen en el cuerpo y no en la cara, es una capa mal recortada.
- 2026-11-22 (air fryer, «revisa el vídeo entero: cuando sale corriendo, el dedo raro al comprar»): antes de montar,
  hoja de TODOS los `img/*.jpg` a ~420 px de ancho y mirar la anatomía y la pose de cada uno: 1) un «corriendo» con dos
  dibujos de posturas distintas alternados parece que da saltitos: mejor UNA pose de carrera clara de lado con líneas de
  velocidad (y si se alterna, la variante tiene que ser la misma pose con solo las piernas cambiadas); 2) manos que
  aprietan teclas salen deformes: contar la acción con un plano de detalle limpio (el dedo pulsando el botón de la web)
  y su cara decidida aparte; 3) poses inclinadas raras (piernas atravesando el marco de la puerta) → redibujar de pie.
  También: cada imagen cuando se dice («todas las semanas entraba a mirarla» = él mirando el portátil; el hospital
  entra en «como quien va a ver…»; «ahí está mi air fryer» = la web) y ningún rótulo tapa una frase entera de la voz
  (darles `t1` para que el subtítulo vuelva).
- 2026-11-22 (nutri, «no está bien el clip de la madre»): al pedir un personaje ya visto usando como referencia una
  ESCENA anterior, la IA copió el decorado entero (el comedor familiar con la silla vacía de Ana y dos mesas con la
  misma olla, ella de pie detrás de una silla): no se entendía dónde estaba. Pedir «use the image ONLY for her
  appearance… a NEW simple clean scene: one single room, no other people» y describir el sitio que toca (de noche en
  su sillón con el teléfono). Revisar que cada escena tenga UNA composición clara, sin elementos duplicados.
- 2026-11-23 (app de ligar, «tiene fallos y el comienzo es algo estático»): 1) el ARRANQUE no puede ser un solo dibujo
  5-7 s: partir la primera frase en 2-3 planos (ella da golpecitos al reloj en «ya va siendo hora», la app instalándose,
  él sorbiendo espaguetis alternando en «mientras cenaba»). 2) Comprobar por código cada rótulo: tiempo que se ve
  ENTERO hasta su `t1` o el corte (≥ 0,9 s); un GOLPE de zoom copia el plano SIN rótulos, así que un rótulo que empieza
  después de un golpe no sale nunca («47 EN 2 SEGUNDOS» no se veía): no poner golpes antes de un rótulo del mismo plano.
  3) Los planos de pantalla de móvil de más de 4 s se parten (notificación en la pantalla bloqueada → la foto), y las
  acciones repetidas (deslizar) llevan dos dibujos alternando cada 0,15 s.
- 2026-11-23 (app de ligar v3, «tiene 3 brazos con los 47 corazones; la hermana estática es raro»): la IA dibuja TRES BRAZOS
  casi siempre que se pide «desliza con el dedo / sujeta el móvil con una mano y toca con la otra» (dos antebrazos
  saliendo del mismo lado); tres intentos fallaron aunque se pidiera «exactly two arms». Lo que funcionó: EDITAR un
  dibujo que ya tiene los brazos bien («keep BOTH ARMS AND HANDS EXACTLY AS THEY ARE… change ONLY the face, add hearts»).
  Revisar los brazos con recortes AMPLIADOS de la zona de las manos (en la hoja pequeña no se ve). Y un secundario que
  está en el plano no se queda congelado: dos dibujos suyos alternando (golpecitos al reloj ↔ señalarle, teclear) o
  un cambio en su palabra; si el segundo dibujo la mueve entera, mejor como cambio único que alternando (salta).
- 2026-11-23 (app de ligar, «la intro va atropellada»): la voz decía «…conozca a alguien, así que…» del tirón y
  `ritmo_voz.py` dejó «cenaba. Primero» casi pegado. Las primeras frases (el gancho) NO se aceleran ni se les recortan
  pausas: se rehacen solas con <break> de la propia voz y se empalman con el resto (`app_ligar/empalme_intro.py`);
  el plan y los efectos se recolocan solos porque salen de la voz. Escuchar (transcribir) el arranque siempre.
- 2026-11-27 («Nutricionista de Instagram», nutri + «gurú»: «no has animado nada, solo salen imágenes»): un dibujo por
  frase con UN cambio no basta. Cada plano lleva 2-3 dibujos de gesto del mismo personaje (ediciones del dibujo: otra mano,
  otra cara, sorbe, guiña, se rasca) alternando cada 0,35-0,6 s mientras dura (`alterna` con `hasta` hasta la palabra del
  cambio) y el gesto que cuenta la frase en SU palabra; si después del cambio también tiene que moverse, otro plano con
  `seguido` (sin golpe de aire) y su propia alternancia. A Ana se le cambian solo los brazos (misma cabeza = sirve la
  misma capa de boca). Un gesto hecho editando OTRO gesto se pega primero sobre ese gesto en bruto y se lleva a la escena
  con la MISMA afín del gesto madre (medirla otra vez fallaba y salía la imagen emborronada).
- 2026-11-27 («la boca permanece cerrada todo el rato»): la locución de `voz.py generar` NO lleva `quien` en las palabras
  y con `hablan` el montador solo abre la boca del que habla según ese campo: sin él, NADIE abre la boca. Poner
  `quien='ANA'` (o el narrador) en todas las palabras al preparar la voz. Antes de entregar, mirar SIEMPRE una tira de
  recortes AMPLIADOS de la boca a 8 fps en dos planos del narrador (la hoja de contactos pequeña no lo enseña).
- 2026-11-27 («¿no tienes las imágenes de la nutri?»): los planos de Ana se dibujaron con su referencia suelta y salió
  OTRA consulta y otra Ana. Los vídeos de un personaje que ya tiene vídeos se hacen EDITANDO sus escenas anteriores
  (Ana: `nutri_bascula/img/es_orgullosa.jpg`, `nutri_tetris/img/es_portatil.jpg` = su consulta de siempre con diploma,
  reloj, póster de verduras y mesa con fruta), no con la referencia de personaje sola.
