# 🕵️ Misterio en WhatsApp

Juego de deducción narrativa estilo *Cluedo*, single-player, donde toda la investigación ocurre
dentro de una interfaz de mensajería instantánea. Los sospechosos no tienen diálogos pregrabados:
están impulsados por un **modelo de lenguaje pequeño (SLM) ejecutado íntegramente en el navegador**
con [WebLLM](https://github.com/mlc-ai/web-llm) sobre WebGPU.

- **Sin backend de inferencia.** El servidor solo sirve archivos estáticos.
- **Privacidad total.** Ninguna conversación sale del dispositivo.
- **Coste de infraestructura ≈ 0.** Escala a cualquier número de jugadores sin coste por token.
- **Siempre jugable.** Si el dispositivo no soporta WebGPU, entra un motor narrativo local
  determinista (fallback) con el mismo sistema de confianza, secretos, pruebas y mentiras.
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
npm run test:logic  # simulación de misiones, mentiras, finales y memoria
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
│   ├── case.ts             # contactos, secretos, pruebas, solución
│   ├── claims.ts           # biblioteca de mentiras/verdades canónicas
│   ├── missions.ts         # objetivos del inspector
│   └── endings.ts          # los 7 finales
├── lib/
│   ├── ai.ts               # WebLLM, prompt con memoria, resumen de conversación
│   ├── logic.ts            # confianza, análisis de mensajes, fallback, desbloqueos
│   ├── claims.ts           # registro de afirmaciones y confrontación de mentiras
│   ├── memory.ts           # memoria narrativa por contacto
│   ├── missions.ts         # motor de activación/completado de misiones
│   ├── endings.ts          # evaluación del final según la partida
│   └── text.ts             # normalización e inclusión de texto
├── store/useGameStore.ts   # estado global, persistencia y orquestación
├── utils/                  # cn, ids, formateo de fechas
└── components/             # UI estilo WhatsApp
scripts/
├── simulate.ts             # simulación de la lógica (npm run test:logic)
└── generate_pwa_icons.py   # regenera los iconos PNG desde el diseño del SVG
```

---

## 🎮 Cómo se juega

1. **Habla con los contactos.** Cada mensaje se analiza con heurísticas de lenguaje natural
   (empatía, cortesía, preguntas, acusaciones, amenazas, pruebas) y mueve la **confianza** del NPC
   entre 0 y 100. Cada temperamento reacciona distinto: un NPC `hostile` pierde confianza con la
   empatía, uno `warm` la gana.
2. **Sube la confianza para sonsacar.** Los secretos tienen un umbral (`minTrust`). Al superarlo, el
   NPC revela la pista automáticamente en el chat.
3. **Desbloquea contactos.** Algunos secretos entregan el contacto de otro sospechoso, con
   notificación de sistema en la conversación.
4. **Consigue y envía pruebas.** Las pruebas desbloqueadas se pueden adjuntar a cualquier chat. El
   efecto sobre la confianza depende del NPC (`effects` en cada evidencia).
5. **Pilla las mentiras.** Los NPC registran afirmaciones (`claims`). Si el jugador las confronta
   con lenguaje de contradicción ("antes dijiste", "me estás mintiendo"), el NPC cede **solo** si
   tiene la prueba correcta o la confianza ya es alta (≥65). Si no, se cierra y pierde confianza.
6. **Sigue las misiones.** El inspector García activa objetivos según lo que va ocurriendo
   (secretos revelados, contactos desbloqueados, pruebas conseguidas, mentiras expuestas) y manda
   mensajes en el chat.
7. **Acusa.** Asesino + arma + habitación. Tres intentos, y el final que obtienes depende de **cómo**
   jugaste, no solo de acertar.

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

## 🧠 Memoria narrativa

Cada contacto tiene una `MemoryNote` (resumen, hechos, tono emocional) que se recalcula tras cada
intercambio. La nota entra en el prompt como bloque privado, con la instrucción de recordar de forma
humana ("Ahora que lo recuerdo...", "No olvido que me dijiste...") y **nunca** citar notas.

El resumen se construye de forma heurística siempre. Además, cuando hay IA local activa, cada 8
mensajes nuevos se pide un resumen al modelo (`summarizeConversation`) que sustituye al heurístico.

---

## 🤖 Modelo de IA

Configurado en `src/lib/ai.ts`:

```ts
const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
```

Es ligero (~1B parámetros) y la primera vez descarga los pesos desde Hugging Face, cacheándolos en
IndexedDB. Para más calidad en escritorio:

```ts
const MODEL_ID = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
```

a cambio de bastante más memoria y tiempo de carga inicial.

### Estrategia anti-alucinación

- El prompt de sistema fija identidad, biografía, personalidad, coartada, confianza y memoria.
- Se le prohíbe inventar personas, lugares o armas nuevas.
- Solo se envían los **últimos 8 mensajes** como contexto, para acotar tokens y RAM.
- La salida pasa por `cleanReply()`: elimina prefijos con el nombre del personaje, comillas,
  markdown y recorta a ~280 caracteres.
- Si la generación falla o vuelve vacía, se usa el motor narrativo local: el jugador nunca se queda
  sin respuesta.
- Sin streaming visible: la respuesta se genera de golpe y se muestra un "escribiendo..." con un
  retardo proporcional a su longitud (máx. 2,4 s), para que el chat se sienta humano.

---

## ⚡ Rendimiento

WebLLM vive en un chunk lazy, así que la carga inicial no lo paga:

| Recurso | Tamaño | gzip |
| :--- | ---: | ---: |
| App (JS) | 0.23 MB | ~71 KB |
| CSS | 0.03 MB | ~6 KB |
| WebLLM (lazy, solo con WebGPU) | 5.87 MB | ~2.1 MB |

Al instalar el service worker se precachean **14 entradas ≈ 6,2 MB**, porque
`maximumFileSizeToCacheInBytes` está en 10 MB y eso incluye el chunk de WebLLM. El resultado es una
PWA totalmente offline (incluida la IA si ya cargaste el modelo), a cambio de esa descarga en la
primera visita. Si prefieres un primer arranque ligero, baja `maximumFileSizeToCacheInBytes` en
[`vite.config.ts`](vite.config.ts) al valor por defecto (2 MiB): el precache se queda en el app shell
y el chunk de WebLLM se sigue descargando on-demand (y cacheado por HTTP un año, porque lleva hash).

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

El progreso se guarda en `localStorage` bajo la clave `mystery-whatsapp-v2`. Para reiniciar a mano:

```js
localStorage.removeItem('mystery-whatsapp-v2');
location.reload();
```

---

## 🗺️ Roadmap

- [x] Memoria narrativa larga.
- [x] Misiones del inspector con objetivos concretos.
- [x] Sistema de mentira/inconsistencia con confrontación.
- [x] Multifinales.
- [x] PWA instalable (manifest + service worker).
- [ ] Streaming de respuestas token a token.
- [ ] Avatares ilustrados y pruebas como imágenes.
- [ ] Guardar afirmaciones entre partidas para rankings/casos diarios (requiere backend opcional).
