import { EVIDENCE } from '../data/case';
import { TOPIC_LABELS } from '../data/claims';
import type { Claim, Contact, Mission } from '../types';
import { getCanonicalClaim } from './claims';
import { getAvailableSecrets } from './secrets';
import { normalize } from './text';

export interface SaySuggestion {
  kind: 'say';
  id: string;
  /** Texto corto del botón. */
  label: string;
  /** Lo que se escribe en el compositor, para que el jugador lo revise. */
  text: string;
  hint: string;
}

export interface EvidenceSuggestion {
  kind: 'send_evidence';
  id: string;
  label: string;
  evidenceId: string;
  hint: string;
}

export type Suggestion = SaySuggestion | EvidenceSuggestion;

/**
 * Frases para subir confianza, ajustadas al temperamento. Cada una contiene
 * vocabulario que `analyzeMessage` puntúa en positivo para ese temperamento
 * (la empatía resta en los hostiles), y hay una prueba que lo comprueba.
 */
const TRUST_BUILDERS: Record<Contact['temperament'], string[]> = {
  formal: [
    'Comprendo que esto sea incómodo. ¿Podría contarme qué vio, por favor?',
    'No pretendo molestarle. ¿Me cuenta qué pasó, por favor?'
  ],
  nervous: [
    'Tranquilo, no está en problemas. Solo quiero ayudarle.',
    'Entiendo que tenga miedo. Cuénteme con calma, por favor.'
  ],
  warm: [
    'Gracias por hablar conmigo. Entiendo que no es fácil.',
    'Sé que esto es duro. Gracias por contármelo, te escucho con calma.'
  ],
  hostile: [
    'No vengo a acusarte de nada. ¿Puedes contarme qué pasó anoche, por favor?',
    'Hablemos claro, por favor. Solo quiero saber qué viste.'
  ],
  calculated: [
    'Sé que vas hasta arriba. Gracias por atenderme.',
    'Gracias por el tiempo. Solo quiero entender el caso.'
  ]
};

const OPENERS = [
  '¿Puedes contarme otra vez dónde estabas anoche?',
  '¿Cómo te llevabas con Eduardo?',
  '¿Notaste algo raro esa noche?'
];

function trimStatement(text: string): string {
  return text.replace(/[\s.…]+$/, '').trim();
}

export function buildSuggestions(params: {
  contact: Contact;
  trust: number;
  revealedSecretIds: string[];
  claims: Claim[];
  evidenceOwned: string[];
  /** Pruebas ya enviadas a este contacto (se deducen de los adjuntos). */
  sentEvidenceIds: string[];
  activeMission?: Mission;
  /** Entero estable para variar la redacción sin parpadear en cada render. */
  seed?: number;
  limit?: number;
}): Suggestion[] {
  const {
    contact,
    trust,
    revealedSecretIds,
    claims,
    evidenceOwned,
    sentEvidenceIds,
    activeMission,
    seed = 0,
    limit = 3
  } = params;

  const missionLine = activeMission ? ` Misión en curso: ${activeMission.title}.` : '';
  const out: Suggestion[] = [];
  const add = (suggestion: Suggestion | null) => {
    if (suggestion && out.length < limit) out.push(suggestion);
  };

  // 1. Pregunta que hace saltar el siguiente recuerdo ya desbloqueado por
  //    confianza. La frase contiene palabras clave del secreto, así que
  //    garantiza la revelación.
  const probes = getAvailableSecrets(contact, trust, revealedSecretIds).filter(
    (secret) => secret.revealHint
  );

  add(
    probes.length
      ? {
          kind: 'say',
          id: `probe:${probes[seed % probes.length].id}`,
          label: probes[seed % probes.length].revealHint as string,
          text: probes[seed % probes.length].revealHint as string,
          hint: `${contact.name} ya confía lo bastante para soltarlo si tocas el tema.${missionLine}`
        }
      : null
  );

  // 2. Prueba en el bolsillo que a este personaje le pesa.
  const pendingEvidence = evidenceOwned.filter(
    (id) => !sentEvidenceIds.includes(id) && (EVIDENCE[id]?.effects?.[contact.id] ?? 0) > 0
  );

  add(
    pendingEvidence.length
      ? {
          kind: 'send_evidence',
          id: `evidence:${pendingEvidence[0]}`,
          label: `Enviar: ${EVIDENCE[pendingEvidence[0]].title}`,
          evidenceId: pendingEvidence[0],
          hint: `Adjuntar esta prueba mueve la confianza de ${contact.name}.${missionLine}`
        }
      : null
  );

  // 3. Mentira que se puede tumbar ahora mismo (con prueba o con confianza).
  const exposed = claims.find((claim) => {
    if (claim.exposed) return false;

    const canonical = getCanonicalClaim(contact.id, claim.topic);
    if (!canonical) return false;

    const statement = normalize(claim.statement);
    const hitsTopic = canonical.keywords.some((keyword) =>
      statement.includes(normalize(keyword))
    );
    if (!hitsTopic) return false;

    const hasProof = Boolean(canonical.evidenceId && evidenceOwned.includes(canonical.evidenceId));
    return hasProof || trust >= 65;
  });

  if (exposed) {
    const statement = trimStatement(exposed.statement);
    add({
      kind: 'say',
      id: `confront:${exposed.id}`,
      label: `Confrontar: ${TOPIC_LABELS[exposed.topic] ?? exposed.topic}`,
      text: `Antes dijiste: "${statement}". Me estás mintiendo.`,
      hint: hasProofHint(exposed, evidenceOwned, trust)
    });
  }

  // 4. Subir confianza cuando aún hay un recuerdo por debajo del umbral.
  const locked = contact.secrets.filter(
    (secret) => !revealedSecretIds.includes(secret.id) && trust < secret.minTrust
  );

  if (locked.length) {
    const next = locked.reduce((a, b) => (a.minTrust <= b.minTrust ? a : b));
    const builders = TRUST_BUILDERS[contact.temperament];
    const text = builders[seed % builders.length];
    add({
      kind: 'say',
      id: `trust:${next.id}`,
      label: text,
      text,
      hint: `${contact.name} aún no se abre del todo (confianza ${Math.round(trust)}/${next.minTrust}).${missionLine}`
    });
  }

  // 5. Pregunta segura para no quedarse sin hilo.
  const opener = OPENERS[seed % OPENERS.length];
  add({
    kind: 'say',
    id: `opener:${seed % OPENERS.length}`,
    label: opener,
    text: opener,
    hint: 'Pregunta de andar por casa para seguir tirando del hilo.'
  });

  return out;
}

function hasProofHint(claim: Claim, evidenceOwned: string[], trust: number): string {
  const canonical = getCanonicalClaim(claim.contactId, claim.topic);
  const hasProof = Boolean(canonical?.evidenceId && evidenceOwned.includes(canonical.evidenceId));

  if (hasProof) return 'Tienes la prueba que respalda la contradicción.';
  return `Se ha ganado suficiente confianza (${Math.round(trust)}) para que ceda.`;
}
