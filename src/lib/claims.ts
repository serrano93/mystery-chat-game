import { CLAIM_LIBRARY, type CanonicalClaim } from '../data/claims';
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
  'te pille',
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

  const canonical = getCanonicalClaim(contact.id, topic);
  if (!canonical) return null;

  const hasEvidence = Boolean(canonical.evidenceId && evidenceOwned.includes(canonical.evidenceId));
  const requiredTrust = canonical.requiredTrust ?? 70;
  const truth: Claim['truth'] = trust >= requiredTrust || hasEvidence ? 'truth' : 'lie';

  const existing = claims.find((c) => c.contactId === contact.id && c.topic === topic);

  // Red de seguridad del modo local: si el personaje ya había soltado la
  // verdad (p. ej. por un secreto revelado) y ahora, con menos confianza o
  // en guardia, repite su versión protegida, se corrige el registro para que
  // las misiones de confrontación nunca queden imposibles.
  if (existing && !existing.exposed && existing.truth === 'truth' && truth === 'lie') {
    return { ...existing, statement: shortenStatement(reply), truth: 'lie' };
  }

  if (existing) return null;

  return {
    id: uid(),
    contactId: contact.id,
    topic,
    statement: shortenStatement(reply),
    truth,
    exposed: false,
    createdAt: now()
  };
}

function shortenStatement(reply: string): string {
  return reply.length > 220 ? `${reply.slice(0, 220)}…` : reply;
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
