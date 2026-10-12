# 🕵️ Misterio en WhatsApp

Juego de deducción narrativa estilo *Cluedo*, single-player, donde toda la investigación ocurre
dentro de una interfaz de mensajería instantánea. Los sospechosos no tienen diálogos pregrabados:
están impulsados por un **modelo de lenguaje pequeño (SLM) ejecutado íntegramente en el navegador**
con [WebLLM](https://github.com/mlc-ai/web-llm) sobre WebGPU.

- **Sin backend de inferencia.** El servidor solo sirve archivos estáticos.
- **Privacidad total.** Ninguna conversación sale del dispositivo.
- **Coste de infraestructura ≈ 0.** Escala a cualquier número de jugadores sin coste por token.
- **Siempre jugable.** Si el dispositivo no soporta WebGPU, entra un motor narrativo local
  determinista (fallback) con el mismo sistema de confianza, secretos y pruebas.

🔗 **Demo:** <https://mystery-chat-game-ashen.vercel.app>

---

## 🚀 Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
```

Otros scripts:

```bash
npm run build      # tsc -b && vite build  ->  /dist
npm run preview    # sirve /dist en local
npm run typecheck  # solo comprobación de tipos
```

---

## 🧱 Stack

| Capa | Tecnología |
| :--- | :--- |
| Framework | React 18 + TypeScript + Vite 6 |
| Estilos | Tailwind CSS 3 (dark mode por clase) |
| IA local | `@mlc-ai/web-llm` (WebGPU) |
| Estado global | Zustand + `persist` (localStorage) |
| Iconos | lucide-react |
| Deploy | Vercel (sitio estático) |

---

## 🗂️ Estructura

```txt
src/
├── App.tsx                 # enrutado de vistas + arranque de la IA
├── types.ts                # contratos de datos del juego
├── data/case.ts            # el caso: contactos, secretos, pruebas, solución
├── lib/
│   ├── ai.ts               # wrapper de WebLLM + prompt + limpieza de salida
│   └── logic.ts            # confianza, análisis de mensajes, fallback, desbloqueos
├── store/useGameStore.ts   # estado global, persistencia y efectos del juego
├── utils/                  # cn, ids, formateo de fechas
└── components/             # UI estilo WhatsApp
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
5. **Acusa.** Asesino + arma + habitación. Tres intentos; al tercer fallo se cierra el caso.

La solución vive en `src/data/case.ts` (`SOLUTION`). Es client-side y por tanto inspeccionable:
es una decisión consciente de diseño para mantener el proyecto 100 % estático.

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

- El prompt de sistema fija identidad, biografía, personalidad, coartada y nivel de confianza.
- Se le prohíbe inventar personas, lugares o armas nuevas.
- Solo se envían los **últimos 8 mensajes** como contexto, para acotar tokens y RAM.
- La salida pasa por `cleanReply()`: elimina prefijos con el nombre del personaje, comillas,
  markdown y recorta a ~260 caracteres.
- Si la generación falla o vuelve vacía, se usa el motor narrativo local: el jugador nunca se queda
  sin respuesta.

---

## ⚡ Rendimiento

El build separa el bundle de WebLLM en un chunk lazy, así que la carga inicial no lo paga:

| Recurso | Tamaño | gzip |
| :--- | ---: | ---: |
| App (JS) | 0.19 MB | ~64 KB |
| CSS | 0.02 MB | ~6 KB |
| WebLLM (lazy, solo con WebGPU) | 5.87 MB | ~2.1 MB |

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

El progreso se guarda en `localStorage` bajo la clave `mystery-whatsapp-v1`. Para reiniciar a mano:

```js
localStorage.removeItem('mystery-whatsapp-v1');
location.reload();
```

---

## 🗺️ Roadmap

- [ ] Streaming de respuestas token a token.
- [ ] Memoria narrativa larga (resumen automático de conversaciones antiguas).
- [ ] Misiones del inspector con objetivos concretos.
- [ ] Sistema de mentira/inconsistencia: registrar afirmaciones y detectar contradicciones.
- [ ] Multifinal (confesión, huida o transferencia de culpa).
- [ ] PWA instalable (manifest + service worker).
- [ ] Avatares ilustrados y pruebas como imágenes.
