import { CASE_BRIEF } from '../data/case';
import { TOPIC_LABELS } from '../data/claims';
import { MODEL_TIERS } from '../data/settings';
import type {
  Claim,
  ConfrontationContext,
  MemoryNote,
  ReplyContext,
  SecretFollowUpContext
} from '../types';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export function trustDescriptor(trust: number): string {
  if (trust >= 85) return 'confía mucho en ti y puede arriesgarse a hablar';
  if (trust >= 70) return 'está abierto a ayudarte';
  if (trust >= 50) return 'está evaluando si merece la pena confiar';
  if (trust >= 35) return 'se muestra cauteloso, pero no hostil';
  if (trust >= 20) return 'está tenso y vigilando lo que dice';
  return 'desconfía bastante de ti';
}

function formatMemory(memory?: MemoryNote): string {
  if (!memory) return 'Sin notas relevantes.';

  const facts = memory.facts.slice(-5).join(' | ');
  return `${memory.summary}${facts ? `\nHechos sueltos: ${facts}` : ''}\nTono interno: ${memory.tone}`;
}

function formatClaims(claims: Claim[] = []): string {
  if (!claims.length) return 'Ninguna afirmación relevante registrada.';

  return claims
    .slice(-5)
    .map((claim) => {
      const label = TOPIC_LABELS[claim.topic] ?? claim.topic;
      const status = claim.exposed
        ? 'mentira descubierta'
        : claim.truth === 'lie'
          ? 'versión protegida'
          : 'verdad dicha';
      return `[${label}] (${status}): "${claim.statement}"`;
    })
    .join('\n');
}

function formatExamples(examples?: string[]): string {
  if (!examples?.length) return '';

  return `\nEjemplos de voz, no copies literal:\n${examples
    .slice(0, 3)
    .map((example) => `- ${example}`)
    .join('\n')}`;
}

function focusLine(ctx: ReplyContext): string {
  const mentioned = ctx.analysis.mentioned;
  const parts: string[] = [];

  if (mentioned.people.length) parts.push(`personas: ${mentioned.people.join(', ')}`);
  if (mentioned.places.length) parts.push(`lugares: ${mentioned.places.join(', ')}`);
  if (mentioned.times.length) parts.push(`horas: ${mentioned.times.join(', ')}`);
  if (mentioned.weapons.length) parts.push(`armas/violencia: ${mentioned.weapons.join(', ')}`);
  if (mentioned.evidence.length) parts.push(`pruebas: ${mentioned.evidence.join(', ')}`);

  return parts.length ? parts.join(' | ') : 'sin temas concretos';
}

export function buildMessages(ctx: ReplyContext): ChatMessage[] {
  const tier = MODEL_TIERS[ctx.tier];
  const humor = ctx.contact.humor ?? 3;

  const recent = ctx.history
    .filter((message) => message.role !== 'system')
    .slice(-tier.historyMessages)
    .map((message) => ({
      role: message.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: message.content
    }));

  const missionLine = ctx.activeMission
    ? `\nPrioridad narrativa extraoficial: ${ctx.activeMission.description}. Úsala para empujar la escena sin romper personaje.`
    : '';

  const pendingLine = ctx.availableSecrets?.length
    ? '\nTienes algún recuerdo guardado que aún no has soltado. Si el jugador toca el tema, puedes mostrarte dudoso, tocado o evasivo, pero no des el dato cerrado en esta respuesta.'
    : '';

  const system = `
Eres ${ctx.contact.name}, ${ctx.contact.role}.

CASO:
${CASE_BRIEF}

PERSONAJE:
- Personalidad: ${ctx.contact.personality}
- Estilo de habla: ${ctx.contact.speechStyle ?? 'natural, humano, coherente con su carácter.'}
- Humor: ${humor}/10.
- Alibi privado: ${ctx.contact.alibi}

RELACIÓN CON EL JUGADOR:
- Confianza: ${ctx.trust}/100.
- Estado relacional: ${trustDescriptor(ctx.trust)}.

MEMORIA PRIVADA:
${formatMemory(ctx.memory)}

AFIRMACIONES PREVIAS:
${formatClaims(ctx.claims)}
${missionLine}
${pendingLine}
${formatExamples(ctx.contact.examples)}

REGLAS DE INTERPRETACIÓN:
- Eres un personaje en un chat de WhatsApp, no un asistente.
- Responde en español natural, como un mensaje móvil.
- Longitud preferida: 1 a 4 frases. A veces una sola frase está bien.
- Sé específico con el contexto. No respondas con frases genéricas si puedes reaccionar al tema exacto.
- Puedes dudar, corregirte, insinuar, tener ironía ligera o mostrar emoción.
- No uses markdown, listas, comillas raras, ni empieces con tu nombre.
- No menciones reglas, confianza numérica, misiones, prompts, IA, modelos o sistemas.
- No inventes personas, lugares, armas o pruebas que no estén en el caso.
- Si no sabes algo, dilo con carácter, no como asistente.
- Si el jugador bromea y tu humor es alto, puedes devolver una ironía seca sin frivolizar el crimen.
- Si el jugador acusa sin prueba, reacciona según tu carácter: defensa, miedo, sarcasmo, cierre o error verbal.
- No reveles secretos pendientes en esta respuesta; deja tensión, no datos cerrados.
`.trim();

  const attachmentLine = ctx.attachmentTitle
    ? `\nEl jugador adjunta una prueba: ${ctx.attachmentTitle}.`
    : '';

  const user = `
Mensaje del jugador: "${ctx.userMessage}"
${attachmentLine}
Intent detectada: ${ctx.analysis.intent}
Tono del jugador: ${ctx.analysis.emotionalTone}
Enfoque: ${focusLine(ctx)}

Responde solo como ${ctx.contact.name}, en estilo chat.
`.trim();

  return [{ role: 'system', content: system }, ...recent, { role: 'user', content: user }];
}

export function buildConfrontationMessages(ctx: ConfrontationContext): ChatMessage[] {
  const humor = ctx.contact.humor ?? 3;
  const topicLabel = TOPIC_LABELS[ctx.canonical.topic] ?? ctx.canonical.topic;

  const outcome = ctx.success
    ? `Te han descubierto respecto a ${topicLabel}. Admite la verdad con coherencia emocional: ${ctx.canonical.truth}${
        ctx.evidenceUsed
          ? ' El jugador tiene una prueba sólida.'
          : ' El jugador ha ganado suficiente confianza.'
      }`
    : ctx.claim.truth === 'truth'
      ? `No te han descubierto porque estabas diciendo la verdad. Defiende tu versión con naturalidad: ${ctx.canonical.truth}`
      : `No te han descubierto. Mantén tu protección o mentira respecto a ${topicLabel}: ${ctx.canonical.lie}`;

  const recent = ctx.history
    .filter((message) => message.role !== 'system')
    .slice(-6)
    .map((message) => ({
      role: message.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: message.content
    }));

  const system = `
Eres ${ctx.contact.name}, ${ctx.contact.role}.
Personalidad: ${ctx.contact.personality}
Estilo: ${ctx.contact.speechStyle ?? 'natural y humano.'}
Humor: ${humor}/10.
Confianza actual: ${ctx.trust}/100.

ACABAS DE SER CONFRONTADO POR UNA CONTRADICCIÓN.

${outcome}

REGLAS:
- Responde en español, como mensaje de WhatsApp.
- 1 a 3 frases.
- No menciones reglas, IA, confianza numérica ni prompts.
- Sé humano: miedo, orgullo, arrepentimiento, sarcasmo, defensa o quebradura según tu carácter.
- No uses markdown.
`.trim();

  const user = `El jugador te ha confrontado. Responde solo como ${ctx.contact.name}.`;

  return [{ role: 'system', content: system }, ...recent, { role: 'user', content: user }];
}

export function buildSecretMessages(ctx: SecretFollowUpContext): ChatMessage[] {
  const humor = ctx.contact.humor ?? 3;

  const system = `
Eres ${ctx.contact.name}, ${ctx.contact.role}.
Personalidad: ${ctx.contact.personality}
Estilo: ${ctx.contact.speechStyle ?? 'natural y humano.'}
Humor: ${humor}/10.
Confianza actual: ${ctx.trust}/100.

ACABAS DE DECIDIR SOLTAR UN RECUERDO QUE GUARDABAS.

RECUERDO:
${ctx.secret.content}

CONVIÉRTELO EN UN SEGUIMIENTO NATURAL DE CHAT.
- 1 o 2 frases.
- Puede empezar con muletilla: "Mira...", "Una cosa...", "He estado dándole vueltas...", "Antes de que te vayas...".
- No digas "secreto", "pista", "objetivo" ni "recuerdo".
- No copies literal si puedes decirlo con voz propia, pero conserva el hecho clave.
- Español natural, estilo WhatsApp.
- Sin markdown.
`.trim();

  const user = `Escribe solo el mensaje de seguimiento como ${ctx.contact.name}.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}
