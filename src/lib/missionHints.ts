import { CONTACTS, EVIDENCE } from '../data/case';
import type { Claim, Contact, ContactState, Mission, MissionObjective, Secret } from '../types';
import { getCanonicalClaim } from './claims';
import { analyzeMessage, contactMap } from './logic';
import { getAvailableSecrets } from './secrets';

export interface MissionHint {
  /** A quién hay que escribirle para avanzar la misión. */
  contactId: string;
  contactName: string;
  /** Qué hacer: subir confianza, provocar un recuerdo, enviar una prueba… */
  action: 'build_trust' | 'probe_secret' | 'send_evidence' | 'record_lie' | 'confront' | 'accuse';
  /**
   * Frase exacta para el compositor del chat. Con `send_evidence` no se
   * envía como mensaje: `evidenceId` indica qué prueba adjuntar.
   */
  text: string;
  evidenceId?: string;
  /** Explicación corta de por qué este es el siguiente paso. */
  why: string;
}

/**
 * Frases empáticas por temperamento (mismo vocabulario que premia
 * `analyzeMessage`). Se filtran en tiempo de generación: solo se ofrece la
 * primera que realmente suma confianza en ese personaje.
 */
const BUILDERS: Record<string, string[]> = {
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

export function pickTrustBuilder(contactId: string): string {
  const contact = contactMap[contactId];
  const builders = contact ? BUILDERS[contact.temperament] : undefined;

  if (!builders || !builders.length) {
    return 'Cuénteme qué pasó anoche, por favor. Le escucho.';
  }
  if (!contact) return builders[0];

  const positive = builders.find((candidate) => analyzeMessage(candidate, contact).trustDelta > 0);
  return positive ?? builders[0];
}

interface SecretLocation {
  contact: Contact;
  secret: Secret;
}

const SECRET_INDEX: Record<string, SecretLocation> = {};
for (const c of CONTACTS) {
  for (const s of c.secrets) SECRET_INDEX[s.id] = { contact: c, secret: s };
}

function findSecretById(secretId: string): SecretLocation | null {
  return SECRET_INDEX[secretId] ?? null;
}

/** Pregunta que garantiza la revelación: `revealHint` o palabra clave. */
function probeTextFor(secretId: string): { contactId: string; text: string } | null {
  const found = findSecretById(secretId);
  if (!found) return null;

  const { contact, secret } = found;
  if (secret.revealHint) return { contactId: contact.id, text: secret.revealHint };

  const keyword =
    secret.keywords?.map((word) => word.trim()).find(Boolean) ??
    extractDistinctiveWord(secret) ??
    'el asunto';

  return { contactId: contact.id, text: `Cuéntame qué sabes sobre ${keyword}.` };
}

/** Palabra de 4+ letras del contenido del secreto, sin stop words obvias. */
function extractDistinctiveWord(secret: Secret): string | undefined {
  const generic = new Set([
    'esta',
    'este',
    'esos',
    'esas',
    'como',
    'cuando',
    'donde',
    'porque',
    'tambien',
    'estaba',
    'estaban',
    'habia',
    'mientras',
    'despues',
    'entonces'
  ]);

  const words = secret.content
    .toLowerCase()
    .split(/[^a-z0-9áéíóúüñ]+/g)
    .map((word) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .filter((word) => word.length >= 5 && !generic.has(word));

  return words[0];
}

function describeEvidence(evidenceId: string): string {
  return EVIDENCE[evidenceId]?.title ?? evidenceId;
}

/** Prueba → contacto/secreto que la entrega. */
function evidenceSource(evidenceId: string): SecretLocation | null {
  for (const c of CONTACTS) {
    for (const s of c.secrets) {
      if (s.evidenceId === evidenceId) return { contact: c, secret: s };
    }
  }
  return null;
}

function trustProbe(contactId: string, name: string, current: number, required: number, reason: string): MissionHint {
  return {
    contactId,
    contactName: name,
    action: 'build_trust',
    text: pickTrustBuilder(contactId),
    why: `${reason} (confianza ${current}/${required}). Envíale esta frase empática primero.`
  };
}

function secretProbe(
  source: SecretLocation,
  contacts: Record<string, ContactState>,
  revealedSecretIds: string[],
  goalLabel: string
): MissionHint | null {
  const target = probeTextFor(source.secret.id);
  if (!target) return null;

  const name = source.contact.name;
  const current = Math.round(contacts[source.contact.id]?.trust ?? 0);
  const required = source.secret.minTrust;

  if (current < required) {
    return trustProbe(
      source.contact.id,
      name,
      current,
      required,
      `Para ${goalLabel}, ${name} debe abrirse`
    );
  }

  // El motor solo revela un recuerdo si hay otro disponible al alcanzar su
  // umbral. Si el objetivo sigue bloqueado pero este personaje ya tiene otro
  // recuerdo listo, conviene provocar primero ese para desbloquear la cadena.
  const available = getAvailableSecrets(source.contact, current, revealedSecretIds);
  const blocker = available.find((secret) => secret.id !== source.secret.id) ?? null;

  if (blocker && blocker.revealHint) {
    return {
      contactId: source.contact.id,
      contactName: name,
      action: 'probe_secret',
      text: blocker.revealHint,
      why: `Primero saca otro recuerdo de ${name} con esta pregunta; eso empujará la conversación hacia ${goalLabel}.`
    };
  }

  return {
    contactId: target.contactId,
    contactName: name,
    action: 'probe_secret',
    text: target.text,
    why: `${name} ya confía lo suficiente (${current}/${required}). Pregúntale exactamente esto: ${goalLabel}.`
  };
}

/**
 * Pista para `expose_claim`. Orden obligatorio del motor: primero que el NPC
 * registre su mentira (respondiendo al tema con su versión protegida), luego
 * tener la prueba o confianza ≥ 65, y solo entonces confrontar.
 */
function exposeClaimHint(
  objective: Extract<MissionObjective, { kind: 'expose_claim' }>,
  contacts: Record<string, ContactState>,
  claims: Claim[],
  evidenceOwned: string[]
): MissionHint | null {
  const { contactId, topic } = objective;
  const canonical = getCanonicalClaim(contactId, topic);
  const name = contactMap[contactId]?.name ?? contactId;
  if (!canonical) return null;

  const trust = Math.round(contacts[contactId]?.trust ?? 0);
  const hasProof = Boolean(canonical.evidenceId && evidenceOwned.includes(canonical.evidenceId));
  const label = topic.replace(/_/g, ' ');

  const recorded = claims.find((claim) => claim.contactId === contactId && claim.topic === topic);

  if (!recorded || recorded.truth !== 'lie') {
    // Antes de poder confrontar, el personaje debe registrar su versión
    // protegida. Si ya la dijo antes (y no la expusiste), tienes vía libre:
    // enviarle una prueba hace que reaccione y la repita ante ti.
    const canonicalEvidence = canonical.evidenceId;
    const hasCanonicalEvidence = Boolean(canonicalEvidence && evidenceOwned.includes(canonicalEvidence));

    if (canonicalEvidence && hasCanonicalEvidence) {
      return {
        contactId,
        contactName: name,
        action: 'send_evidence',
        text: `Te muestro una prueba: ${describeEvidence(canonicalEvidence)}.`,
        evidenceId: canonicalEvidence,
        why: `${name} necesita ver «${describeEvidence(canonicalEvidence)}» para reaccionar a tu pregunta sobre ${label}.`
      };
    }

    // Sin prueba, pídele directamente por el tema para provocar su mentira.
    const askKeyword = canonical.keywords[0] ?? label;
    return {
      contactId,
      contactName: name,
      action: 'record_lie',
      text: `Quiero repasar contigo lo de ${askKeyword}. ¿Qué me cuentas?`,
      why:
        recorded && recorded.truth === 'truth'
          ? `${name} te contó la verdad sobre ${label}, así que no hay mentira que exponer todavía. Sube más su confianza o consíguete una prueba y vuelve a preguntarle por ${askKeyword}: en guardia repetirá su versión protegida.`
          : `Primero consigue que ${name} repita su versión sobre ${label}. Pregúntale esto y espera su respuesta.`
    };
  }

  if (!hasProof && trust < 65) {
    const missing = canonical.evidenceId ? `necesitas «${describeEvidence(canonical.evidenceId)}»` : 'necesitas más confianza';
    return {
      contactId,
      contactName: name,
      action: 'build_trust',
      text: pickTrustBuilder(contactId),
      why: `${name} mintió sobre ${label}, pero sin prueba una confrontación falla: ${missing} o confianza ≥ 65 (ahora ${trust}).`
    };
  }

  const statement = recorded.statement.replace(/[\s.…]+$/, '').trim();
  return {
    contactId,
    contactName: name,
    action: 'confront',
    text: `Antes dijiste: "${statement}". Me estás mintiendo.`,
    why: hasProof
      ? `Tienes la prueba que contradice a ${name}. Confróntale con esta frase exacta.`
      : `${name} ha cedido suficiente contigo (${trust}). Confróntale con esta frase exacta.`
  };
}

/**
 * Traduce el objetivo de una misión al siguiente paso concreto: a quién
 * escribir y qué frase usar. Es la columna vertebral del botón "Pista".
 */
export function missionHint(params: {
  mission: Mission;
  contacts: Record<string, ContactState>;
  revealedSecretIds: string[];
  evidenceOwned: string[];
  claims: Claim[];
}): MissionHint | null {
  const { mission, contacts, evidenceOwned, claims } = params;
  const objective = mission.objective;

  switch (objective.kind) {
    case 'trust': {
      const contactId = objective.contactId;
      const name = contactMap[contactId]?.name ?? contactId;
      const current = Math.round(contacts[contactId]?.trust ?? 0);

      return {
        contactId,
        contactName: name,
        action: 'build_trust',
        text: pickTrustBuilder(contactId),
        why: `${name} necesita confiar en ti (${current}/${objective.value}). Envíale esta frase empática.`
      };
    }

    case 'secret': {
      const source = findSecretById(objective.secretId);
      if (!source) return null;
      return secretProbe(source, contacts, params.revealedSecretIds, 'sacar el recuerdo decisivo');
    }

    case 'evidence': {
      const source = evidenceSource(objective.evidenceId);
      if (!source) {
        return {
          contactId: 'inspector',
          contactName: contactMap.inspector?.name ?? 'García',
          action: 'probe_secret',
          text: '¿Por dónde empiezo, inspector?',
          why: `El inspector puede orientarte sobre «${describeEvidence(objective.evidenceId)}».`
        };
      }
      return secretProbe(
        source,
        contacts,
        params.revealedSecretIds,
        `conseguir «${describeEvidence(objective.evidenceId)}»`
      );
    }

    case 'unlock': {
      return {
        contactId: 'inspector',
        contactName: contactMap.inspector?.name ?? 'García',
        action: 'probe_secret',
        text: '¿Por dónde empiezo, inspector?',
        why: 'García abre puertas si le sigues el hilo: pídele por dónde empezar.'
      };
    }

    case 'expose_claim': {
      return exposeClaimHint(objective, contacts, claims, evidenceOwned);
    }

    case 'accusation_correct': {
      return {
        contactId: 'victor',
        contactName: contactMap.victor?.name ?? 'Víctor',
        action: 'accuse',
        text: '',
        why: 'Presenta cargos con el escudo: Víctor — estatua de bronce — estudio.'
      };
    }

    default:
      return null;
  }
}

/**
 * Red de anti-estancamiento: cuando no queda ninguna misión activa (cadena
 * rota o desvío del orden), devuelve la primera misión latente alcanzable con
 * su pista, para que el panel nunca quede vacío sin rumbo.
 */
export function nextLatentMissionHint(params: {
  missions: Mission[];
  contacts: Record<string, ContactState>;
  revealedSecretIds: string[];
  evidenceOwned: string[];
  claims: Claim[];
}): { mission: Mission; hint: MissionHint } | null {
  const { missions, contacts, revealedSecretIds, evidenceOwned, claims } = params;

  const shared = { contacts, revealedSecretIds, evidenceOwned, claims };

  for (const mission of missions) {
    if (mission.active || mission.completed) continue;
    if (!activationReachable(mission, contacts)) continue;

    const hint = missionHint({ mission, ...shared });
    if (hint) return { mission, hint };
  }

  // Cadena completamente rota (umbral bajado tras revelar): reorienta con la
  // primera misión no completada aunque su activación aún no se cumpla.
  for (const mission of missions) {
    if (mission.active || mission.completed) continue;

    const hint = missionHint({ mission, ...shared });
    if (hint) return { mission, hint };
  }

  return null;
}

function activationReachable(mission: Mission, contacts: Record<string, ContactState>): boolean {
  const { activation } = mission;

  switch (activation.kind) {
    case 'start':
      return true;
    case 'contact_unlocked':
      return Boolean(activation.id && contacts[activation.id]?.unlocked);
    case 'secret_revealed':
    case 'evidence_collected':
    case 'claim_exposed':
      return true;
    default:
      return false;
  }
}
