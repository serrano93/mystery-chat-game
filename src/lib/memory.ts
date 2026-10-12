import { TOPIC_LABELS } from '../data/claims';
import type { Claim, Contact, MemoryNote, Message } from '../types';
import { now } from '../utils/id';

export function buildMemoryPrompt(memory?: MemoryNote, claims: Claim[] = []): string {
  const lines: string[] = [];

  if (memory) {
    lines.push(`Resumen privado: ${memory.summary}`);

    if (memory.facts.length) {
      lines.push(`Hechos recordados: ${memory.facts.slice(-6).join(' | ')}`);
    }

    lines.push(`Tono emocional actual: ${memory.tone}`);
  }

  if (claims.length) {
    const claimLines = claims.slice(-6).map((claim) => {
      const label = TOPIC_LABELS[claim.topic] ?? claim.topic;
      const status = claim.exposed
        ? 'descubierta'
        : claim.truth === 'lie'
          ? 'mentira mantenida'
          : 'verdad dicha';
      return `[${label}] (${status}): "${claim.statement}"`;
    });

    lines.push(`Afirmaciones previas: ${claimLines.join(' ; ')}`);
  }

  return lines.join('\n');
}

function trustPhrase(trust: number): string {
  if (trust >= 80) return 'confía bastante en ti';
  if (trust >= 60) return 'está empezando a abrirse';
  if (trust >= 35) return 'se muestra cauteloso';
  if (trust >= 20) return 'está tenso';
  return 'desconfía de ti';
}

function toneFromTrust(trust: number): MemoryNote['tone'] {
  if (trust >= 70) return 'trusting';
  if (trust >= 40) return 'neutral';
  if (trust >= 20) return 'tense';
  return 'hostile';
}

export function createHeuristicMemory(params: {
  contact: Contact;
  history: Message[];
  trust: number;
  claims: Claim[];
  previous?: MemoryNote;
  summaryOverride?: string | null;
}): MemoryNote {
  const { contact, history, trust, claims, previous, summaryOverride } = params;

  const lastUserMessages = history
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => m.content);

  const topics = Array.from(new Set(claims.map((c) => c.topic))).slice(0, 5);
  const exposedClaims = claims.filter((c) => c.exposed);

  const facts = [
    ...(previous?.facts ?? []),
    ...exposedClaims.map(
      (c) => `${contact.name} fue descubierto respecto a ${TOPIC_LABELS[c.topic] ?? c.topic}.`
    ),
    ...topics.map((t) => `Tema tratado: ${TOPIC_LABELS[t] ?? t}.`)
  ]
    .filter(Boolean)
    .slice(-8);

  const topicSentence = topics.length
    ? `Habéis hablado de ${topics.map((t) => TOPIC_LABELS[t] ?? t).join(', ')}.`
    : 'Aún no hay temas claros entre vosotros.';

  const lastSentence = lastUserMessages.length
    ? `El jugador ha insistido en: "${lastUserMessages[lastUserMessages.length - 1].slice(0, 90)}".`
    : '';

  const summary =
    summaryOverride?.trim() ||
    `${contact.name} ${trustPhrase(trust)}. ${topicSentence} ${lastSentence}`.trim();

  return {
    contactId: contact.id,
    summary,
    facts,
    tone: toneFromTrust(trust),
    updatedAt: now(),
    messageCount: history.length
  };
}
