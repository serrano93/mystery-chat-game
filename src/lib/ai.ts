import type { ReplyParams } from '../types';
import { fallbackReply } from './logic';

let engine: any = null;
let initPromise: Promise<any> | null = null;

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

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

export async function initWebLLM(
  onProgress: (progress: number, text: string) => void
): Promise<any> {
  if (engine) return engine;

  if (!initPromise) {
    initPromise = (async () => {
      const webllm = await import('@mlc-ai/web-llm');

      const created = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (payload: any) => {
          const progress = typeof payload?.progress === 'number' ? payload.progress : 0;
          const text = typeof payload?.text === 'string' ? payload.text : 'Preparando modelo...';
          onProgress(progress, text);
        },
        logLevel: 'WARN'
      });

      engine = created;
      return engine;
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

function buildMessages(params: ReplyParams) {
  const recent = params.history
    .filter((m) => m.role !== 'system')
    .slice(-8)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

  const system = `
Eres ${params.contact.name}, ${params.contact.role}.
Biografía: ${params.contact.bio}
Personalidad: ${params.contact.personality}
Alibi privado: ${params.contact.alibi}
Confianza actual del jugador: ${params.trust}/100.

Reglas obligatorias:
- Responde en español, como un chat móvil.
- Máximo 2 frases cortas.
- Sé coherente con tu carácter.
- Si la confianza es baja, sé evasivo. Si es media, cauteloso. Si es alta, más colaborador.
- NO reveles secretos del caso ni pruebas que el narrador no te haya asignado.
- Si el jugador pregunta por secretos, responde con evasivas naturales.
- No inventes personas, lugares ni armas nuevas.
- No uses markdown, comillas innecesarias ni prefijos con tu nombre.
`.trim();

  const userContent = params.attachmentTitle
    ? `${params.userMessage}\n[El jugador adjunta: ${params.attachmentTitle}]`
    : params.userMessage;

  return [
    { role: 'system', content: system },
    ...recent,
    { role: 'user', content: userContent }
  ];
}

function cleanReply(raw: string | undefined, contactName: string): string {
  if (!raw) return '';

  let text = raw.replace(/\r/g, '').trim();

  const nameRegex = new RegExp(`^${contactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i');
  text = text.replace(nameRegex, '');

  text = text.replace(/^["'“”]+|["'“”]+$/g, '');
  text = text.replace(/\*\*/g, '');
  text = text.replace(/\n{2,}/g, '\n');

  if (text.length > 260) {
    text = `${text.slice(0, 260).replace(/(\s\S*)?$/, '')}…`;
  }

  return text;
}

export async function generateReply(params: ReplyParams): Promise<string> {
  if (!engine) {
    return fallbackReply(params);
  }

  try {
    const response = await engine.chat.completions.create({
      messages: buildMessages(params),
      temperature: 0.75,
      max_tokens: 140,
      stream: false
    });

    const raw = response?.choices?.[0]?.message?.content;
    const cleaned = cleanReply(raw, params.contact.name);

    return cleaned || fallbackReply(params);
  } catch {
    return fallbackReply(params);
  }
}
