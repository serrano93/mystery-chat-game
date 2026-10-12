# 🕵️ Misterio en WhatsApp

Juego de deducción narrativa estilo *Cluedo*, single-player, donde toda la investigación ocurre
dentro de una interfaz de mensajería instantánea. Los sospechosos no tienen diálogos pregrabados:
están impulsados por un **modelo de lenguaje pequeño (SLM) ejecutado íntegramente en el navegador**
con [WebLLM](https://github.com/mlc-ai/web-llm) sobre WebGPU.

> **Filosofía de diseño (v2.1):** la lógica del juego controla el **estado** (confianza, pruebas,
> desbloqueos, mentiras, misiones, final). La IA controla la **voz** (cómo suena, cuándo insinúa,
> cuándo se calla, cuándo se quiebra).

- **Sin backend de inferencia.** El servidor solo sirve archivos estáticos.
- **Privacidad total.** Ninguna conversación sale del dispositivo.
- **Coste de infraestructura ≈ 0.** Escala a cualquier número de jugadores sin coste por token.
- **Siempre jugable.** Si el dispositivo no soporta WebGPU, entra un motor narrativo local
  contextual con el mismo sistema de confianza, secretos, pruebas y mentiras.
- **PWA instalable.** Manifest + service worker con caché del app shell.

🔗 **Demo:** <https://mystery-chat-game-ashen.vercel.app>

---

## 🚀 Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
```

Otros scripts:

```bash
npm run build       # tsc -b && vite build  ->  /dist
npm run preview     # sirve /dist en local
npm run typecheck   # solo comprobación de tipos
npm run test:logic  # 50 comprobaciones de la lógica de juego (sin navegador)
```

---

## 🧱 Stack

| Capa | Tecnología |
| :--- | :--- |
| Framework | React 18 + TypeScript + Vite 6 |
| Estilos | Tailwind CSS 3 (dark mode por clase) |
| IA local | `@mlc-ai/web-llm` (WebGPU) |
| Estado global | Zustand + `persist` (localStorage) |
| PWA | `vite-plugin-pwa` (Workbox, `generateSW`) |
| Iconos | lucide-react |
| Deploy | Vercel (sitio estático) |

---

## 🗂️ Estructura

```txt
src/
├── App.tsx                 # enrutado de vistas + arranque de la IA
├── types.ts                # contratos de datos del juego
├── data/
│   ├── case.ts             # contactos, secretos, pruebas, solución, resumen del caso
│   ├── claims.ts           # biblioteca de mentiras/verdades canónicas
│   ├── missions.ts         # objetivos del inspector
│   ├── endings.ts          # los 7 finales
│   └── settings.ts         # tiers de modelo y detección de dispositivo
├── lib/
│   ├── ai.ts               # WebLLM: tiers, timeout, validación + reintento
│   ├── context.ts          # construcción del brief narrativo (system prompt)
│   ├── fallback.ts         # motor local contextual (sin IA)
│   ├── intents.ts          # intención, tono emocional y temas mencionados
│   ├── secrets.ts          # cuándo el NPC suelta un recuerdo
│   ├── claims.ts           # registro de afirmaciones y confrontación
│   ├── memory.ts           # memoria narrativa por contacto
│   ├── missions.ts         # motor de activación/completado de misiones
│   ├── endings.ts          # evaluación del final
│   ├── logic.ts            # confianza y análisis de mensajes
│   └── text.ts             # normalización de texto
├── store/useGameStore.ts   # estado global, persistencia y orquestación
├── utils/                  # cn, ids, fechas y nombre del jugador (player.ts)
└── components/             # UI estilo WhatsApp (incluye WelcomeScreen)
scripts/
├── simulate.ts             # simulación de la lógica (npm run test:logic)
└── generate_pwa_icons.py   # regenera los iconos PNG desde el diseño del SVG
```

---

## 🎮 Cómo se juega

1. **Habla con los contactos.** Cada mensaje se analiza en dos capas: una decide el **estado**
   (movimiento de confianza según empatía, cortesía, preguntas, acusaciones, amenazas y pruebas) y
   otra detecta la **intención** (coartada, hora, lugar, persona, arma, prueba, broma, empatía,
   amenaza, acusación, confrontación) junto al tono emocional. Cada temperamento reacciona distinto:
   un NPC `hostile` pierde confianza con la empatía, uno `warm` la gana.
2. **Sube la confianza para sonsacar.** Los secretos tienen un umbral (`minTrust`).
3. **Los secretos se sueltan, no se pegan.** Cuando el jugador toca el tema (o tras varios turnos
   de conversación) el NPC decide soltar el recuerdo como un seguimiento natural de chat —"Mira, una
   cosa...", "He estado dándole vueltas..."— en lugar de insertar la frase exacta de golpe. La
   lógica marca el secreto como revelado y entrega prueba o desbloquea contacto.
4. **Consigue y envía pruebas.** Las pruebas desbloqueadas se pueden adjuntar a cualquier chat. El
   efecto sobre la confianza depende del NPC (`effects` en cada evidencia).
5. **Pilla las mentiras.** Los NPC registran afirmaciones (`claims`). Si el jugador las confronta
   con lenguaje de contradicción, el NPC cede **solo** con la prueba correcta o con confianza ≥65.
   Si no, se cierra y pierde confianza. La respuesta también pasa por la IA cuando está disponible.
6. **Sigue las misiones.** El inspector García activa objetivos según lo que ocurre (secretos
   revelados, contactos desbloqueados, pruebas conseguidas, mentiras expuestas) y escribe en el chat.
7. **Acusa.** Asesino + arma + habitación. Tres intentos, y el final depende de **cómo** jugaste.

### Multifinales

| Final | Rango | Condición |
| :--- | :--- | :--- |
| La verdad destapada | S | Confesión + ≥2 mentiras de Víctor expuestas + ≥3 pruebas |
| Confesión en el sofá | A | Confesión de Víctor |
| Caso cerrado con pruebas | A- | ≥3 pruebas, sin confesión |
| Justicia fría | B | Acierto con lo mínimo |
| Acusación equivocada | C | Fallo acusando a alguien en quien confiabas (≥60) |
| Te llevaron al jardín equivocado | C- | Fallo con ≥2 mentiras expuestas y ≥2 pruebas |
| Caso frío | D | Fallo sin nada sólido |

La solución vive en `src/data/case.ts` (`SOLUTION`). Es client-side y por tanto inspeccionable:
es una decisión consciente de diseño para mantener el proyecto 100 % estático.

---

## 🎭 Voz de los personajes y el nombre del jugador

Antes de abrir el expediente, una pantalla de inicio pide el **nombre del detective**. Se limpia
(solo letras, números, espacios, apóstrofos y guiones; máximo 24 caracteres), se guarda en el
guardado local y **nunca sale del dispositivo**.

Ese nombre se usa en todas partes:

- **Apertura del inspector**, que además justifica por qué se investiga por WhatsApp: *"Sé que te
  estás tomando un descanso, {nombre}, pero voy hasta arriba y necesito tu ayuda. No hace falta que
  vengas a comisaría; puedes adelantar las entrevistas por WhatsApp."*
- **Aperturas de los contactos** que se van desbloqueando, personalizadas al momento.
- **Prompt narrativo**: el modelo recibe un bloque `EL JUGADOR` con el nombre y el rol, y la
  instrucción de usarlo *cuando sea natural, sin repetirlo en cada frase*.
- **Motor local, confrontaciones y seguimientos de secretos**, que también se dirigen al jugador por
  su nombre.

Cada contacto declara `humor` (0-10), `speechStyle` y `examples`. El inspector García arranca con
humor 7 y, si hay confianza, suelta ironía seca; el mayordomo tiene humor 2 y jamás bromea. Los
ejemplos se inyectan en el prompt **como muestra de voz, nunca para copiarlos** (las plantillas
`{playerName}` se sustituyen antes de enviarlos).

El brief narrativo que recibe el modelo incluye: resumen del caso, personalidad, estilo, humor,
coartada privada, confianza y estado relacional, memoria privada, afirmaciones previas, la misión
activa, si hay recuerdos sin soltar, y el análisis del turno (intención, tono, temas mencionados).

---

## 🤖 Modelos: rápido, equilibrado y premium

Se elige en la pantalla de preparación y se guarda en `localStorage`. Si no hay elección, se detecta
por dispositivo (`hardwareConcurrency`, `deviceMemory`, móvil o no):

| Tier | Modelo | Contexto | Timeout | Descarga aprox. |
| :--- | :--- | ---: | ---: | ---: |
| **Rápido** | Llama-3.2-1B-Instruct q4f16 | 6 msgs | 14 s | ~0,8 GB |
| **Equilibrado** (recomendado) | Phi-3-mini-4k-instruct q4f16 | 10 msgs | 20 s | ~2 GB |
| **Premium** | Llama-3.2-3B-Instruct q4f16 | 14 msgs | 30 s | ~2 GB |

Un PC de escritorio moderno detecta **premium** automáticamente, así que la primera carga de IA es
una descarga de verdad. Si quieres empezar ligero, elige **Rápido** en la pantalla de preparación.

### Robustez del motor de IA

- **Timeout por tier** para que una generación no deje el chat colgado.
- **Validación + un reintento**: si la respuesta filtra meta-información (markdown, "como IA",
  "nivel de confianza", habla de prompts o del objetivo del juego, o empieza con el nombre del
  personaje), se pide una reescritura y, si vuelve a fallar, se usa el motor local. Las palabras
  sueltas *confianza*, *misión*, *objetivo* o *modelo* **no** se vetarían: son vocabulario normal en
  un drama de mansión.
- **Sin streaming visible**: la respuesta se genera de golpe y se muestra un "escribiendo..." con un
  retardo proporcional a su longitud (máx. 2,4 s).
- **Memoria larga**: resumen heurístico tras cada intercambio y, con IA activa, un resumen por modelo
  cada 8 mensajes nuevos que sustituye al heurístico.

---

## ⚡ Rendimiento

WebLLM vive en un chunk lazy con nombre estable (`webllm-*.js`), así que la carga inicial no lo paga
y además queda **fuera** del precache del service worker:

| Recurso | Tamaño | gzip |
| :--- | ---: | ---: |
| App (JS) | 0,24 MB | ~77 KB |
| CSS | 0,03 MB | ~6 KB |
| WebLLM (lazy, solo con WebGPU) | 5,87 MB | ~2,1 MB |

Precache del service worker: **12 entradas ≈ 0,31 MB** (solo el app shell, iconos y manifest). El
motor de IA se descarga on-demand la primera vez que se usa y a partir de ahí lo sirve la caché HTTP
(`immutable`, un año, porque lleva hash).

> Ojo: si añades al precache un asset de más de 2 MiB, `vite-plugin-pwa` **no avisa, falla el
> build**. Por eso el chunk de WebLLM se excluye por nombre con `globIgnores` y `manualChunks`.

---

## ☁️ Deploy en Vercel

El proyecto ya está desplegado y **conectado al repositorio**: cada push a `main` publica en
producción automáticamente.

- Producción: <https://mystery-chat-game-ashen.vercel.app>
- Panel: <https://vercel.com/javier-serr-projects/mystery-chat-game>
- Ajustes del proyecto: preset **Vite**, build `npm run build`, output `dist`, install `npm install`.
  Lo mismo queda declarado en [`vercel.json`](vercel.json), que además fija caché de un año para
  `/assets/*` (tienen hash) y `must-revalidate` para `index.html`.

Para recrearlo desde cero en otra cuenta: importa el repo en Vercel, preset **Vite**, build command
`npm run build`, output directory `dist`. No hace falta ninguna variable de entorno ni función
serverless.

---

## 🔒 Persistencia

El progreso (incluido el nombre) se guarda en `localStorage` bajo la clave `mystery-whatsapp-v3`,
con `version: 4`. El cambio de esquema de la v2.1.1 es aditivo, así que hay una **migración** que
añade `playerName` en lugar de tirar la partida. Para reiniciar a mano:

```js
localStorage.removeItem('mystery-whatsapp-v3');
location.reload();
```

Para forzar un corte limpio de esquema en el futuro, cambia `name` por una clave nueva
(`mystery-whatsapp-v4`) en [`src/store/useGameStore.ts`](src/store/useGameStore.ts): eso descarta
las partidas anteriores sin migración.

El tier de modelo se guarda aparte, en `mystery-model-tier`.

---

## 🗺️ Roadmap

- [x] Memoria narrativa larga.
- [x] Misiones del inspector con objetivos concretos.
- [x] Sistema de mentira/inconsistencia con confrontación.
- [x] Multifinales.
- [x] PWA instalable (manifest + service worker).
- [x] Tiers de modelo y prompt narrativo con intención y tono.
- [x] Secretos revelados como seguimiento natural en vez de frase pegada.
- [x] Nombre del detective en pantalla de inicio, guardado y prompt.
- [ ] Streaming de respuestas token a token.
- [ ] Avatares ilustrados y pruebas como imágenes.
- [ ] Memoria episódica por NPC ("me prometió discreción", "le mentí y aún me mira raro").
- [ ] Reacciones diferidas: que un NPC escriba por su cuenta tras pensar un rato.
