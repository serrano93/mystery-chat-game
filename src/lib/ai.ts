import { MODEL_TIERS } from '../data/settings';
import type {
  ConfrontationContext,
  Message,
  ModelTier,
  ReplyContext,
  SecretFollowUpContext
} from '../types';
import {
  buildConfrontationMessages,
  buildMessages,
  buildSecretMessages,
  type ChatMessage
} from './context';
import {
  contextualFallback,
  fallbackConfrontation,
  fallbackSecretFollowUp
} from './fallback';

let engine: any = null;
let initPromise: Promise<any> | null = null;
let currentTier: ModelTier | null = null;

export async function checkWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  const gpu = (navigator as any).gpu;
  if (!gpu) return false;

  try {
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

export function getCurrentTier(): ModelTier | null {
  return currentTier;
}

export async function initWebLLM(
  tier: ModelTier,
  onProgress: (progress: number, text: string) => void
): Promise<any> {
  if (engine && currentTier === tier) return engine;

  if (engine) {
    try {
      await engine.unload?.();
    } catch {
      // Si el motor no se deja descargar, se sigue igualmente: se reemplaza.
    }
    engine = null;
    currentTier = null;
    initPromise = null;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const config = MODEL_TIERS[tier];

      const created = await webllm.CreateMLCEngine(config.id, {
        initProgressCallback: (payload: any) => {
          const progress = typeof payload?.progress === 'number' ? payload.progress : 0;
          const text = typeof payload?.text === 'string' ? payload.text : 'Preparando modelo...';
          onProgress(progress, text);
        },
        logLevel: 'WARN'
      });

      engine = created;
      currentTier = tier;
      return engine;
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
    })
  ]);
}

function extractContent(response: any): string {
  return response?.choices?.[0]?.message?.content ?? '';
}

export function sanitizeReply(raw: string | undefined, contactName?: string): string {
  if (!raw) return '';

  let text = raw.replace(/\r/g, '').trim();

  if (contactName) {
    const nameRegex = new RegExp(
      `^${contactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`,
      'i'
    );
    text = text.replace(nameRegex, '');
  }

  text = text.replace(/^["'“”]+|["'“”]+$/g, '');
  text = text.replace(/\*\*/g, '');
  text = text.replace(/^\s*[-•*]\s+/gm, '');
  text = text.replace(/\n{2,}/g, '\n');

  if (text.length > 320) {
    text = `${text.slice(0, 320).replace(/(\s\S*)?$/, '')}…`;
  }

  return text.trim();
}

/**
 * Frases que delatan fuga de meta-información. Se buscan como expresiones
 * completas y no como palabras sueltas: "confianza", "misión", "modelo" u
 * "objetivo" son vocabulario normal dentro de un drama de mansión ("mi misión
 * es proteger esta casa") y vetarlas sueltas tiraría diálogo perfectamente
 * válido, que es justo lo contrario de lo que busca este motor.
 */
const META_LEAK_PATTERNS = [
  /```/,
  /\*\*/,
  /como (ia|lenguaje|modelo|asistente)/i,
  /\binteligencia artificial\b/i,
  /\bsoy (una? )?(ia|asistente|chatbot|modelo de lenguaje)\b/i,
  /\bassistant\b/i,
  /\bprompt\b/i,
  /\bnivel de confianza\b/i,
  /\bconfianza actual\b/i,
  /\b(el )?objetivo del juego\b/i,
  /\b(seg[uú]n )?mis (notas|instrucciones)\b/i
];

export function isValidReply(text: string, contactName?: string): boolean {
  if (!text || text.length < 2 || text.length > 340) return false;

  if (META_LEAK_PATTERNS.some((pattern) => pattern.test(text))) {
    return false;
  }

  if (contactName) {
    const namePrefix = new RegExp(
      `^${contactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`,
      'i'
    );
    if (namePrefix.test(text)) return false;
  }

  return true;
}

async function requestChat(
  messages: ChatMessage[],
  tier: ModelTier,
  temperature = 0.82,
  maxTokens?: number
): Promise<string> {
  if (!engine) throw new Error('NO_ENGINE');

  const config = MODEL_TIERS[tier];

  const response = await withTimeout(
    engine.chat.completions.create({
      messages,
      temperature,
      max_tokens: maxTokens ?? config.maxTokens,
      stream: false
    }),
    config.timeoutMs
  );

  return extractContent(response);
}

export async function generateReply(ctx: ReplyContext): Promise<string> {
  if (!engine || currentTier !== ctx.tier) {
    return contextualFallback(ctx);
  }

  const messages = buildMessages(ctx);

  try {
    const raw = await requestChat(messages, ctx.tier, 0.82);
    let text = sanitizeReply(raw, ctx.contact.name);

    if (!isValidReply(text, ctx.contact.name)) {
      const repairMessages: ChatMessage[] = [
        ...messages,
        { role: 'assistant', content: raw || text || '...' },
        {
          role: 'user',
          content:
            'Esa respuesta no es válida. Reescríbela solo como mensaje WhatsApp del personaje. 1-3 frases, español natural, sin markdown, sin mencionar reglas, confianza, misiones o IA.'
        }
      ];

      const repairedRaw = await requestChat(repairMessages, ctx.tier, 0.7, 120);
      text = sanitizeReply(repairedRaw, ctx.contact.name);
    }

    return isValidReply(text, ctx.contact.name) ? text : contextualFallback(ctx);
  } catch {
    return contextualFallback(ctx);
  }
}

export async function generateConfrontationReply(ctx: ConfrontationContext): Promise<string> {
  if (!engine || currentTier === null) {
    return fallbackConfrontation(ctx);
  }

  const messages = buildConfrontationMessages(ctx);

  try {
    const raw = await requestChat(messages, currentTier, 0.78, 140);
    const text = sanitizeReply(raw, ctx.contact.name);

    return isValidReply(text, ctx.contact.name) ? text : fallbackConfrontation(ctx);
  } catch {
    return fallbackConfrontation(ctx);
  }
}

export async function generateSecretFollowUpReply(
  ctx: SecretFollowUpContext
): Promise<string> {
  if (!engine || currentTier === null) {
    return fallbackSecretFollowUp(ctx);
  }

  const messages = buildSecretMessages(ctx);

  try {
    const raw = await requestChat(messages, currentTier, 0.8, 100);
    const text = sanitizeReply(raw, ctx.contact.name);

    return isValidReply(text, ctx.contact.name) ? text : fallbackSecretFollowUp(ctx);
  } catch {
    return fallbackSecretFollowUp(ctx);
  }
}

export async function summarizeConversation(params: {
  contactName: string;
  history: Message[];
  trust: number;
}): Promise<string | null> {
  if (!engine || currentTier === null) return null;

  const transcript = params.history
    .slice(-12)
    .map(
      (message) => `${message.role === 'user' ? 'Jugador' : params.contactName}: ${message.content}`
    )
    .join('\n');

  const prompt = `
Resume en español, en 2 frases cortas, lo esencial de la conversación entre el jugador y ${params.contactName}.
Incluye promesas, sospechas, emociones y posibles contradicciones.
Confianza actual: ${params.trust}/100.
No des consejo. Solo notas privadas para un NPC.

Transcript:
${transcript}
`.trim();

  try {
    const raw = await requestChat(
      [
        {
          role: 'system',
          content:
            'Eres un motor de memoria privada para un juego narrativo. Resumes con precisión y naturalidad.'
        },
        { role: 'user', content: prompt }
      ],
      currentTier,
      0.2,
      110
    );

    const text = sanitizeReply(raw);
    return text || null;
  } catch {
    return null;
  }
}
