import { CLAIM_LIBRARY, TOPIC_LABELS, type CanonicalClaim } from '../data/claims';
import type { Claim, ClaimTopic, Contact, ContactState } from '../types';
import { now, uid } from '../utils/id';
import { includesAny, normalize } from './text';

const CONTRADICTION_WORDS = [
  'mentiste',
  'mintio',
  'mentira',
  'no es verdad',
  'no cuadra',
  'contradic',
  'dijiste que',
  'antes dijiste',
  'cambiaste',
  'te pillé',
  'te pillo',
  'estabas mintiendo',
  'me engañaste',
  'me ocultaste'
];

const TAG_TOPIC_HINTS: Record<string, ClaimTopic[]> = {
  location: ['alibi'],
  time: ['alibi', 'tea', 'saw_victor'],
  weapon: ['statue', 'window', 'watch'],
  person: ['argument', 'victor_greenhouse', 'saw_victor', 'letter'],
  evidence: ['letter', 'watch', 'statue', 'victor_greenhouse']
};

export function getCanonicalClaim(contactId: string, topic: ClaimTopic): CanonicalClaim | null {
  return CLAIM_LIBRARY[contactId]?.find((c) => c.topic === topic) ?? null;
}

export function detectClaimTopic(
  text: string,
  tags: string[] = [],
  contactId: string
): ClaimTopic | null {
  const norm = normalize(text);
  const library = CLAIM_LIBRARY[contactId] ?? [];

  for (const claim of library) {
    if (claim.keywords.some((keyword) => norm.includes(normalize(keyword)))) {
      return claim.topic;
    }
  }

  for (const tag of tags) {
    const hintedTopics = TAG_TOPIC_HINTS[tag] ?? [];
    for (const topic of hintedTopics) {
      if (library.some((claim) => claim.topic === topic)) {
        return topic;
      }
    }
  }

  return null;
}

export function maybeRecordClaim(params: {
  contact: Contact;
  reply: string;
  tags: string[];
  trust: number;
  evidenceOwned: string[];
  claims: Claim[];
}): Claim | null {
  const { contact, reply, tags, trust, evidenceOwned, claims } = params;

  const topic = detectClaimTopic(reply, tags, contact.id);
  if (!topic) return null;

  if (claims.some((c) => c.contactId === contact.id && c.topic === topic)) {
    return null;
  }

  const canonical = getCanonicalClaim(contact.id, topic);
  if (!canonical) return null;

  const hasEvidence = Boolean(canonical.evidenceId && evidenceOwned.includes(canonical.evidenceId));
  const requiredTrust = canonical.requiredTrust ?? 70;
  const truth: Claim['truth'] = trust >= requiredTrust || hasEvidence ? 'truth' : 'lie';

  return {
    id: uid(),
    contactId: contact.id,
    topic,
    statement: reply.length > 220 ? `${reply.slice(0, 220)}…` : reply,
    truth,
    exposed: false,
    createdAt: now()
  };
}

export interface ConfrontationResult {
  claim: Claim;
  canonical: CanonicalClaim;
  success: boolean;
  evidenceUsed: boolean;
}

export function detectConfrontation(params: {
  text: string;
  contactId: string;
  claims: Claim[];
  evidenceOwned: string[];
  contacts: Record<string, ContactState>;
}): ConfrontationResult | null {
  const { text, contactId, claims, evidenceOwned, contacts } = params;
  const norm = normalize(text);

  if (!includesAny(norm, CONTRADICTION_WORDS)) return null;

  const candidates = claims.filter((c) => c.contactId === contactId && !c.exposed);
  if (!candidates.length) return null;

  const topic = detectClaimTopic(text, [], contactId);
  const claim = topic
    ? candidates.find((c) => c.topic === topic)
    : candidates[candidates.length - 1];

  if (!claim) return null;

  const canonical = getCanonicalClaim(contactId, claim.topic);
  if (!canonical) return null;

  if (claim.truth === 'truth') {
    return {
      claim,
      canonical,
      success: false,
      evidenceUsed: false
    };
  }

  const evidenceUsed = Boolean(canonical.evidenceId && evidenceOwned.includes(canonical.evidenceId));
  const trust = contacts[contactId]?.trust ?? 0;
  const success = evidenceUsed || trust >= 65;

  return {
    claim,
    canonical,
    success,
    evidenceUsed
  };
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const SUCCESS_PREFIXES: Record<Contact['temperament'], string[]> = {
  formal: [
    'Debo admitir que...',
    'Mi deber era proteger la casa, pero...',
    'Supongo que ya no tiene sentido callar...'
  ],
  nervous: ['¡No quise...!', 'Es que tenía miedo...', 'Perdóname, no sabía qué más hacer...'],
  warm: ['Perdóname...', 'No quería preocuparte, pero...', 'Tienes razón. Debió salir antes...'],
  hostile: ['Vale, sí.', 'Ya basta.', 'Me has acorralado.'],
  calculated: [
    'Interesante. Me has leído bien.',
    'Está bien. Jugué mal esa carta.',
    'No pensé que llegaras tan lejos.'
  ]
};

const FAILURE_PREFIXES: Record<Contact['temperament'], string[]> = {
  formal: [
    'No miento.',
    'Esa es mi versión de los hechos.',
    'Le sugiero que no saque conclusiones.'
  ],
  nervous: ['¡No es mentira!', 'Me estás asustando...', 'No recuerdo haber dicho eso...'],
  warm: [
    'No te estoy engañando.',
    'Intento protegernos a todos.',
    'Por favor, no me presiones así.'
  ],
  hostile: ['No tengo por qué demostrarte nada.', 'Sigue soñando.', 'Esa no es mi problema.'],
  calculated: [
    'Las apariencias engañan.',
    'Puedes creer lo que quieras.',
    'No tienes prueba suficiente.'
  ]
};

export function confrontationResponse(params: {
  contact: Contact;
  claim: Claim;
  canonical: CanonicalClaim;
  success: boolean;
  trust: number;
  evidenceUsed: boolean;
}): string {
  const { contact, claim, canonical, success, evidenceUsed } = params;

  if (success) {
    const prefix = pick(SUCCESS_PREFIXES[contact.temperament]);
    const evidencePhrase = evidenceUsed ? ' Tienes razón: esa prueba no miente.' : '';
    return `${prefix} ${canonical.truth}${evidencePhrase}`;
  }

  if (claim.truth === 'truth') {
    const prefix = pick(FAILURE_PREFIXES[contact.temperament]);
    return `${prefix} ${canonical.truth}`;
  }

  const prefix = pick(FAILURE_PREFIXES[contact.temperament]);
  return `${prefix} ${canonical.lie}`;
}

export function humanizeTopic(topic: ClaimTopic): string {
  return TOPIC_LABELS[topic] ?? topic.replace('_', ' ');
}
