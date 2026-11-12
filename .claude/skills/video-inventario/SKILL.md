---
name: video-inventario
description: Producir los vídeos de Alejandro al estilo «Estoy Tiesa» con su personaje magenta (Chico rosa) por el MÉTODO INVENTARIO — guion por trozos, voz de Aaron Abad en ElevenLabs, fondos y escenas dibujados con Magnific, el personaje pegado desde el inventario (postura, ojos, boca, complementos), secundarios animados a golpes, rótulos a mano y montaje por código. Úsala siempre que Alejandro pase un guion o un trozo de guion para hacer vídeo, pida corregir un trozo, o pregunte cómo se hacen los vídeos.
---

# Vídeos por el método inventario

Alejandro no es programador: háblale en español llano, enséñale el resultado (vídeo con SendUserFile) y
pregunta qué cambiaría. **Cada corrección suya es una lección: apúntala al final de este archivo
(«Lecciones aprendidas») y súbela al repositorio en el mismo turno.** Así no se repite el fallo.

## Reglas que no se discuten
- **Nada de vídeo generativo.** Solo imágenes fijas hechas con IA y animación por código / dibujos alternos.
- **No gastar en fal sin preguntar** (le salió carísimo: «me vas a arruinar»). Este método usa los créditos de
  **Magnific** (plan Pro, cientos de miles de créditos; ~50-65 por imagen) vía el conector MCP, y los caracteres
  de su plan de **ElevenLabs**. Dile siempre lo gastado al entregar.
- Solo el protagonista tiene cabeza magenta; los demás son **personas normales** con el mismo trazo.
- No automatizar las webs de ChatGPT/Magnific con el navegador (términos de uso): usar el MCP.
- Fotos reales (p. ej. de una persona citada): solo con **licencia libre** (Wikimedia Commons, CC BY / BY-SA),
  con crédito pequeño en pantalla y pedirle que lo ponga en la descripción del vídeo.

## Piezas (todo en el repositorio)
- `public/personajes/chico-magenta/inventario/` + `inventario.json`: 62 cuerpos (`p_*` de pie, `s_*` sentado sin
  silla, `t_*` tumbado) y capas de cabeza: ojos `o_*` (también emoji), bocas `b_*` (`b_habla_a`, `b_habla_e`,
  `b_o` son las de hablar), complementos `a_*` (gorra, cuernos, aureola, orejas de burro, ¿?, ¡!, zzz…).
  Cada entrada tiene `desc`. `sinCara`: mano en la cara o tumbado (no lleva capas de ojos; la boca sí, en su sitio).
  `herramientas/procesar_inventario.py` lo regenera desde los crudos (ver CLAUDE.md). Ids de Magnific de cada
  pieza en `herramientas/inventario_magnific.txt`.
- `herramientas/video/montar.py`: el montador (fondo + personaje + capas + boca por la voz + parpadeo +
  rótulos + objetos + dibujos alternos). `--frames t1,t2` saca fotogramas sueltos para revisar.
- `herramientas/video/voz.py`: generar la voz, cortar trozos, rehacer UNA frase, comprobar con transcripción.
- `herramientas/video/variante.py`: dibujo alterno estable (solo copia lo que cambia) para animar secundarios.
- `herramientas/video/reajustar.py`: mueve los tiempos del plan si cambia la voz.
- `herramientas/video/ejemplo_domingo/`: el primer vídeo completo (guiones, voces, planes `trozoN.json`,
  imágenes). **Úsalo como modelo** de plan y de tono.

## Flujo para cada trozo de guion
Trabaja en una carpeta de proyecto en el scratchpad (`<proyecto>/img`, `<proyecto>/voz`, `plan.json`).

1. **Texto.** Respeta el guion. Corrige solo erratas que la voz leería mal (tildes de más: «peór», «Porqué»).
   Nombres extranjeros: en el texto de la VOZ escríbelos como se pronuncian («Biung Chul Jan» por Byung-Chul
   Han) y en los rótulos bien escritos. Si Alejandro dice que una frase suena mal, prueba primero cambiar la
   frase (él propuso «donde no he ido» en vez de «donde no he estado»).
2. **Voz.** `python3 herramientas/video/voz.py generar texto.txt voz/todo [--antes trozo_anterior.txt]`:
   el trozo ENTERO de una vez (entonación seguida); `--antes` da continuidad con el trozo anterior. Voz por
   defecto: Aaron Abad - Storyteller en Castellano. Pausas que pida él → `<break time="0.8s" />` en el texto
   (la hace la voz); **NUNCA insertar silencios a mano** (se entrecorta). Comprueba con `voz.py comprobar`.
3. **Plan.** Lee los tiempos de cada palabra (`voz/todo.json`) y decide los planos como un capítulo de
   dibujos:
   - Un plano nuevo cada 2-5 s, cortes SECOS en el inicio de la frase o de la palabra fuerte.
   - Cada cosa se ve cuando se dice (nada adelantado ni atrasado): gesto/cara en SU palabra, rótulo 0,1 s
     antes de su palabra, el corte al sofá en «mantita», no en «sofá».
   - Mezcla: él en su sitio (salón, sofá, oficina…), planos de detalle (móvil, pulsera, portátil, taza) y
     escenas de lo que cuenta con otra gente (el abuelo en la fábrica, su madre castigándole).
   - Después de un chiste, deja aire: el plano del chiste no se corta enseguida (lo de «ventilación»).
   - Postura + ojos + boca + complemento que digan lo mismo que la frase (susto en «domingo», facepalm en
     «suspendido», orejas de burro en «el burro eres tú», ojos en espiral con las frases motivadoras).
   - Rótulos cortos (1-3 palabras, cifras, nombres) en letra a mano; listas que se escriben en pantallas.
   - Ropa según el guion: `"pantalon": "gris"` convierte los vaqueros en chándal gris.
4. **Dibujos con Magnific** (`mcp__Magnific__images_generate`, mode `imagen-nano-banana-2-1`, carpeta del
   estudio `ad16df76-18aa-40ce-bd49-452936778cf6`; referencia del personaje: creación `cpsx8zt0eP`).
   Lanza varias en paralelo y espera con `creations_wait`. Descarga con la `url` del resultado.
   - Fondo de un sitio SIN él (2k, 16:9): «Use the reference image ONLY for the drawing style (simple hand-drawn
     black wobbly outlines, flat colours). Draw an EMPTY <sitio>, wide horizontal view from the front at eye level,
     NO people… The RIGHT half is open floor so a person can stand there. No text.» Un fondo por sitio; los planos
     cercanos son el mismo fondo con zoom.
   - Plano de detalle: si sale su mano, «bright magenta skin»; pantallas VACÍAS («no text») y el texto lo pone
     el montador; varias pantallas del mismo móvil = editar la primera («Keep EVERYTHING exactly the same…
     Change ONLY what the phone screen shows»).
   - Escena con otra gente: personas normales, misma referencia de estilo; las siguientes escenas con la misma
     persona se hacen EDITANDO la primera (misma cara). Él de niño: «the character from the reference as a small
     child».
   - Objetos sueltos (libro, bocadillo): sobre blanco puro, luego se recorta el fondo; el texto (título) se
     escribe por código encima.
   - Pieza nueva del inventario: editar `cabeza_base` (creación `VXSsKw7MMU`) o `cabeza_peq` (`KLVcTd1kqp`, para
     lo que flota encima) con «Keep EVERYTHING exactly the same… ADD ONLY: …», guardarla en los crudos y
     reprocesar el inventario. Postura nueva: desde la referencia, «full body, front view, plain pure white
     background, exactly two arms».
   - Revisa cada dibujo (hoja de contactos) antes de montar; repite solo el que falle.
5. **Animar a los secundarios** (si no, «queda muy plano»): por cada escena con gente, una edición «pixel for
   pixel… change ONLY <manos / boca / dedo / patas / luz>» y `variante.py base.png edicion.png base_b.png`
   (`--zona` y `--min 50` para cambios pequeños como un parpadeo). En el plan: `"alterna": {"imgs": [a, b],
   "cada": 0.28}` (gritar ~0,28 s, trabajar ~0,55 s, andar ~0,3 s), `"parpadeo": "x_b.png"` (cada 3-4 s) o
   `"cambios": [{"t": .., "fondo": ..}]` (un cambio de gesto).
6. **Montar y revisar.** `montar.py plan.json salida.mp4 --frames ...` con fotogramas de cada plano y de cada
   rótulo; mira la hoja; corrige; luego el vídeo entero. Comprueba: nada tapa la cabeza, nada flota, no se corta
   la cabeza en planos cercanos, la boca no deja la raya debajo, el texto se lee.
7. **Entregar**: SendUserFile con el vídeo, qué hay en él en 3-6 líneas y lo gastado (créditos de Magnific y
   caracteres de ElevenLabs). Copia el proyecto final (plan, voz, imágenes en JPG ≤1920) a
   `herramientas/video/<nombre_del_video>/` y súbelo.

## Formato del plan (`plan.json`)
```json
{"alineacion": "voz/trozo.json", "audio": "voz/trozo.mp3", "pantalon": "gris", "duracion": 99.9,
 "planos": [
  {"t0": 0, "fondo": "img/salon.jpg", "zoom": 1.13, "cx": 0.5, "cy": 0.6,
   "x": 0.68, "pie": 1000, "alto": 720,
   "eventos": [{"t": 0, "cuerpo": "p_bolsillos"}, {"t": 1.1, "cuerpo": "p_idea", "ojos": "o_frente",
               "boca": "b_sonrisa", "extras": ["a_aureola"]}],
   "rotulos": [{"t0": 3.9, "texto": "DOMiNGO", "x": 960, "y": 120, "color": "rojo", "tam": 110, "centro": true}],
   "objetos": [{"t0": 7.05, "t1": 9, "img": "img/tibet_rec.png", "x": 1480, "y": 300, "w": 520}]},
  {"t0": 11.8, "fondo": "img/sofa.jpg", "x": 0.5, "pie": 965, "asiento": 650, "largo": 1050,
   "eventos": [{"t": 11.8, "cuerpo": "s_mantita"}, {"t": 38.8, "cuerpo": "t_duerme"}]},
  {"t0": 20.8, "fondo": "img/movil_hora.jpg", "habla": false,
   "alterna": {"imgs": ["img/a.jpg", "img/a_b.jpg"], "cada": 0.3}, "parpadeo": "img/a_b.jpg"}
 ]}
```
- Coordenadas (`x` en fracción del ancho, `pie`, `alto`, `asiento`) en el fondo SIN zoom a 1920×1080; el
  zoom/encuadre (`zoom`, `cx`, `cy`) se aplica solo. Rótulos y objetos: coordenadas de PANTALLA.
- Sentado (`s_*`) con `asiento`: la cadera va al cojín y los pies a `pie`; el tamaño sale solo. Tumbado (`t_*`)
  con `asiento` y `largo`: el cuerpo (no la mano que cuelga) se apoya en el cojín.
- Medidas que funcionan: salón `pie 1000, alto 720, x 0.68`, plano medio `zoom 1.75, cx 0.68, cy 0.5`;
  sofá `pie 965, asiento 650, x 0.5`, cercano `zoom 1.35, cy 0.5`; oficina `x 0.72-0.8, pie 1000, alto 720`.
- Rótulos: se colocan solos al lado del personaje y sin pisarse entre ellos; `"fijo": true` para ponerlos en
  un sitio exacto (dentro de una pantalla, en una pizarra). Colores: negro, rojo, azul, verde, blanco. La fuente
  no tiene «¡»: no la uses. `"habla": false` en planos donde no sale él (no mueve boca).
- Las capas de inventario en objetos: `"img": "inv:capas/a_zzz.webp"`.

## Lecciones aprendidas (añadir aquí cada corrección de Alejandro, con fecha)
- 2026-11: cada vídeo no puede costar 30 € → método inventario + Magnific; nada de fal sin preguntar.
- Huecos blancos entre brazo y cuerpo/objeto en las posturas: el procesador los borra (excepto papel/periódico).
- Sentado: no «a ojo»; cadera en el cojín y pies en el suelo. Tumbado: apoyar el cuerpo, no la mano que cuelga.
- Ropa: el guion manda (chándal gris → `"pantalon": "gris"`).
- Complementos flotantes: sin el blanco de dentro (aureola).
- Rótulos nunca encima de la cabeza ni encima de otro rótulo; dentro de pantallas con `fijo`.
- Al hablar se borra la raya de la boca antes de pegar la boca que habla (si no, asomaba).
- Voz: Aaron Abad - Storyteller en Castellano. Pausas con `<break>`, nunca silencios a mano (se entrecortaba).
  Frase que «dice mal»: rehacerla con contexto; si sigue mal, cambiar la frase (él decide el texto). Yo no
  puedo oír: comprobar con transcripción y, si dudo, mandarle 2-3 tomas numeradas para que elija.
- Después de un chiste, aire (pausa y plano que dura); el corte entra en la palabra que lo nombra.
- Secundarios estáticos «quedan planos» → dibujos alternos a golpes (animación limitada).
- Para un autor citado, foto real con licencia libre y crédito (Byung-Chul Han: ActuaLitté, CC BY-SA 2.0).
- 2026-11-12: el abuelo «guiñaba un ojo» al alternar dibujos: la edición de las manos le cambió también un ojo.
  En `variante.py` usa SIEMPRE `--zona` con solo la parte que debe moverse (manos y brazos: desde debajo de la
  barbilla) y revisa la cara de la base y la variante lado a lado antes de montar.
- 2026-11-12: «¿por qué estoy peor que él?» no sonaba a pregunta. Rehacer la frase con contexto, varias tomas, y
  medir el tono (F0 por autocorrelación) de la última palabra frente a las anteriores: quedarse con la que más
  sube al final; mandarle además las tomas numeradas por si prefiere otra.
- 2026-11-12: «siempre en el mismo plano, en el cuarto, se hace repetitivo». Reparte cada trozo en VARIOS
  escenarios ligados a lo que cuenta (sofá, biblioteca al citar un libro, calle, cocina, gimnasio cuando habla
  de rendir…): como mucho 2-3 planos seguidos en el mismo sitio. Medidas: calle `x 0.72, pie 1010, alto 680`;
  cocina `x 0.72, pie 1000, alto 640`; gimnasio `x 0.74, pie 1000, alto 700`; biblioteca `zoom 1.08, x 0.74,
  pie 960, alto 700` (el dibujo trae marco blanco). Rótulos que contrasten con la pared (blanco sobre oscuro).
- 2026-11-12: «no tiene que estar siempre él hablando»: mete PLANOS DE RECURSO (B-roll) con él HACIENDO lo que
  cuenta, sin hablar (`"habla": false`): leyendo el libro en la biblioteca, con la taza en la cocina, intentando
  levantar una pesa, corriendo en la cinta sin poder parar. Se dibujan EDITANDO el fondo vacío de ese sitio (primera
  referencia) con el personaje como segunda referencia («ADD ONLY: the character from the second reference…»), así
  es el mismo lugar; acércate con `zoom` a donde está él. Si hace una acción repetida (correr, andar), segunda pose
  con `variante.py --zona` (la zona en fracciones de la imagen: mide dónde está él antes) y `"alterna"` cada
  ~0,16 s. Uno de cada 4-5 planos, en los verbos de acción.
- 2026-11-12 (IMPORTANTE, cambia el método): «el personaje es muy repetitivo, siempre señalando al frente, las mismas
  caras, no se integra; aunque cambie el escenario hace siempre lo mismo y pierde el sentido». Desde ahora la
  BASE de cada plano con él es un DIBUJO DE ESCENA NUEVO (`img/es_*.jpg`) donde ACTÚA la frase dentro del sitio:
  ángulo de tres cuartos o plano medio, interactuando con cosas y gente (mirando una foto del abuelo, subido a una
  escalera cogiendo el libro, dormido con el libro en la cara, cambiando pósits de la nevera, una ratonera gigante
  en «la trampa», un guardia que le para en «un no tiene a alguien delante», su reflejo regañándole, el botón de
  STOP tapado por un pósit, él mismo de burro con la zanahoria). Gags VISUALES literales de la frase. El inventario
  queda solo de apoyo (planos rápidos de reacción). Gasta más créditos (~1 dibujo por plano) y Alejandro lo aprueba.
  Cómo: «Use the first image as the location (same …) but a closer camera from a three-quarter angle. The character
  from the second reference … small closed mouth. … exactly two arms and two hands …» con el fondo vacío del sitio
  como primera referencia y `cpsx8zt0eP` como segunda.
  La boca habla sola en esas escenas (`montar.py` busca su cabeza magenta y la raya de la boca y pega las bocas del
  inventario): revisa con una hoja (cara sin y con boca); si la pone mal (cara pequeña, de lado, ojos raros) pon
  `"habla": false` en ese plano. El pantalón vaquero de las escenas se pasa a gris solo (`es_*`/`br_*`, debajo de
  su cabeza). Si sale pequeño en el dibujo, `zoom` hacia él.
- 2026-11-12: «la boca está mal animada varias veces, hay planos estáticos de él y eso no puede ser; los B-roll deben
  estar animados y él no salir». Reglas:
  1. NUNCA un plano de él quieto: cada escena con él tiene al menos 2 dibujos (edición «pixel for pixel… change ONLY
     his legs / arm / the sticky note…; the head and face stay identical») alternando (`alterna`: andar 0,32 s,
     piernas nerviosas 0,22, temblar 0,12, saltar 0,28) o cambiando en su palabra (`cambios`).
  2. La BOCA en las escenas: NO pegar las bocas del inventario sobre caras dibujadas (quedaba mal). Para cada escena
     donde habla, una edición «Change ONLY the mouth: open, talking, like saying "a"» → `preparar_escena.py` saca la
     capa de la boca abierta → `"boca": "img/X_boca.png"`; el montador la pone mientras suena una vocal (vale también
     para sus dibujos alternos porque la cabeza no cambia). Revisar la hoja de caras (sin/con boca); si sale cortada
     o cambia un ojo, recortarla a mano con una elipse. Sin boca dibujada → `"habla": false` (cara de lado, tapada,
     muy pequeña).
  3. B-ROLL = planos SIN él (la taza, pantallas, el sitio), y también animados (vapor de la taza alternando 0,45 s).
  4. Los movimientos de cuerpo entero (saltar) se copian enteros, sin proteger la cabeza (si no salen dos cabezas).
- 2026-11-12: REVISIÓN OBLIGATORIA antes de entregar (fallos que se escaparon): sacar un fotograma cada 0,75 s
  (`ffmpeg -vf fps=4/3,scale=480:270`) en hojas de 30 con el tiempo y mirarlas TODAS buscando: franjas blancas del
  marco del dibujo en los bordes (al hacer zoom; la biblioteca trae marco), planos de más de ~2 s sin nada que se
  mueva, un `cambio` que cae después del final de su plano (nunca se ve), ojos o caras que cambian al alternar
  dibujos (`variante.py --zona` solo sobre lo que se mueve) y rótulos que no se leen sobre fondos cargados
  (`"caja": true` = cartelito blanco detrás).
- 2026-11-12: «desde el salto se vuelve menos creativo, habla peor y tiene menos sentido». Causas: tramo largo
  donde él NO hablaba a cámara (secundarios, recursos y escenas sin boca seguidas) y dibujos que no contaban la
  frase (guardia lejano, botón de stop). Reglas: él habla a cámara (con boca dibujada) en la mayoría de planos;
  como mucho 2 planos seguidos sin que hable; cada frase con una imagen que la cuente LITERAL o con un gag
  claro (barrera de FIN + guardia en «un no tiene final y tiene a alguien delante»; barra altísima con «TÚ
  PUEDES» en «si puedes y no llegas»; él con una señal de STOP en «el no te para»; él con orejas de burro y la
  zanahoria hablándote en «el burro eres tú»); callbacks a personajes ya vistos. DOS bocas por escena donde
  habla: `"boca"` (a/e/i) y `"boca_o"` (o/u, edición «small round open O»). Si un dibujo alterno mueve la
  cabeza (un salto), `"boca_en": [solo el dibujo base]` para que la boca no se pegue fuera de sitio.
- 2026-11-12: «no se sincroniza del todo la voz y la boca». La boca se abría por un reparto uniforme de las vocales
  dentro de cada palabra (se adelantaba o retrasaba). Ahora `montar.py` mide la ENERGÍA REAL del audio por
  fotograma y abre la boca solo en el núcleo de cada sílaba (cerca del máximo local, dentro de las palabras,
  nunca más de 5 fotogramas seguida); la alineación solo decide la FORMA (a/e/i o «o/u»). Para comprobar las
  apariciones: listar cada rótulo/objeto/cambio con la palabra que suena en ese instante (deben caer en su
  palabra ±0,1 s) y cada plano con la frase que se oye mientras se ve.

- 2026-11-12 «el texto no está bien en la pantalla del ordenador; la pulsera no se anima; los textos no entran en
  sus espacios»: el montador APARTA los rótulos para no tapar al personaje y a otros rótulos, y eso sacaba de la
  pantalla los textos que van DENTRO de algo (email del portátil, lista del Excel, pantalla de la pulsera).
  Todo texto dentro de una pantalla/cartel lleva `"fijo": true`, coordenadas medidas en el dibujo (sin `centro`
  si es un párrafo alineado a la izquierda) y tamaño que quepa en el hueco (en pantallas estrechas, una palabra
  por línea). Los primeros planos de un objeto (b-roll) también se animan: la pulsera tiene una versión quieta
  (sin rayas de vibración) y otra vibrando con la pantalla encendida, alternadas cada 0,09 s desde «vibra» y un
  zumbido corto cuando aparece la cifra. «¡» y «!» en Coming Soon engrosada parecen una «I»: no usarlos en
  rótulos. Tras `variante.py` mirar con zoom: pueden quedar restos fantasma de lo borrado.
