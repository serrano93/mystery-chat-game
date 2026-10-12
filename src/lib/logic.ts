import { CONTACTS, EVIDENCE } from '../data/case';
import type { Contact, ContactState, Message, SecretUpdate } from '../types';
import { now, uid } from '../utils/id';
import { includesAny, normalize } from './text';

export const contactMap: Record<string, Contact> = Object.fromEntries(
  CONTACTS.map((c) => [c.id, c])
);

export function clampTrust(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export interface MessageAnalysis {
  trustDelta: number;
  tags: string[];
}

export function analyzeMessage(text: string, contact: Contact, evidenceId?: string): MessageAnalysis {
  const norm = normalize(text);
  const tags: string[] = [];

  const empathyWords = [
    'entiendo',
    'comprendo',
    'creo',
    'confio',
    'tranquilo',
    'calma',
    'ayuda',
    'apoyo',
    'gracias',
    'favor',
    'siento',
    'amigo'
  ];

  const politeWords = ['por favor', 'gracias', 'buenas', 'disculpa', 'perdone'];

  const threatWords = [
    'amenaz',
    'arrest',
    'carcel',
    'presidio',
    'matar',
    'destrozar',
    'confesar',
    'denunciar',
    'policia'
  ];

  const accusationWords = [
    'mataste',
    'asesino',
    'culpable',
    'lo hiciste',
    'fuiste tu',
    'escondiste',
    'armaste'
  ];

  const evidenceWords = [
    'foto',
    'prueba',
    'carta',
    'recibo',
    'documento',
    'huella',
    'reloj',
    'estatua',
    'adjunto',
    'muestro'
  ];

  const questionWords = ['donde', 'cuando', 'que', 'quien', 'por que', 'como', 'sabes', 'viste'];

  const locationWords = ['estudio', 'biblioteca', 'cocina', 'invernadero', 'vestibulo', 'jardin'];

  const timeWords = ['anoche', 'ayer', 'hora', 'ocho', 'nueve', 'diez', '9', '10', '8'];

  const weaponWords = ['estatua', 'candelabro', 'cuerda', 'cuchillo', 'veneno', 'arma'];

  const personWords = ['victor', 'eduardo', 'sebastian', 'pedro', 'marta', 'clara'];

  if (includesAny(norm, empathyWords)) tags.push('empathy');
  if (includesAny(norm, politeWords)) tags.push('polite');
  if (norm.includes('?') || includesAny(norm, questionWords)) tags.push('question');
  if (includesAny(norm, threatWords)) tags.push('threat');
  if (includesAny(norm, accusationWords)) tags.push('accusation');
  if (includesAny(norm, evidenceWords)) tags.push('evidence');
  if (includesAny(norm, locationWords)) tags.push('location');
  if (includesAny(norm, timeWords)) tags.push('time');
  if (includesAny(norm, weaponWords)) tags.push('weapon');
  if (includesAny(norm, personWords)) tags.push('person');

  let delta = 0;

  if (tags.includes('empathy')) delta += 8;
  if (tags.includes('polite')) delta += 3;
  if (tags.includes('question')) delta += 2;
  if (tags.includes('location') || tags.includes('time') || tags.includes('weapon') || tags.includes('person')) {
    delta += 2;
  }
  if (tags.includes('evidence')) delta += 5;
  if (tags.includes('accusation')) delta += tags.includes('evidence') ? -4 : -9;
  if (tags.includes('threat')) delta -= 16;
  if (text.length > 120) delta += 1;

  switch (contact.temperament) {
    case 'formal':
      if (tags.includes('threat')) delta -= 4;
      if (tags.includes('empathy')) delta += 1;
      break;
    case 'nervous':
      if (tags.includes('accusation')) delta -= 4;
      if (tags.includes('empathy')) delta += 3;
      break;
    case 'warm':
      if (tags.includes('empathy')) delta += 4;
      if (tags.includes('threat')) delta -= 2;
      break;
    case 'hostile':
      if (tags.includes('empathy')) delta -= 2;
      if (tags.includes('accusation')) delta -= 3;
      break;
    case 'calculated':
      if (tags.includes('threat')) delta -= 5;
      if (tags.includes('evidence')) delta += 4;
      break;
  }

  if (evidenceId) {
    const effect = EVIDENCE[evidenceId]?.effects?.[contact.id] ?? 0;
    delta += effect;
  }

  delta = Math.max(-30, Math.min(30, delta));

  return { trustDelta: delta, tags };
}

export function collectSecretUpdates(
  contactId: string,
  trust: number,
  revealedIds: string[],
  ownedEvidence: string[],
  contacts: Record<string, ContactState>
): SecretUpdate {
  const contact = contactMap[contactId];
  const messages: Message[] = [];
  const evidenceIds: string[] = [];
  const unlockIds: string[] = [];
  const revealed = [...revealedIds];

  if (!contact) {
    return { messages, evidenceIds, unlockIds, revealedIds: revealed };
  }

  for (const secret of contact.secrets) {
    if (revealed.includes(secret.id) || trust < secret.minTrust) continue;

    messages.push({
      id: uid(),
      role: 'npc',
      content: secret.content,
      timestamp: now(),
      status: 'read'
    });

    revealed.push(secret.id);

    if (secret.evidenceId) {
      if (!ownedEvidence.includes(secret.evidenceId) && !evidenceIds.includes(secret.evidenceId)) {
        evidenceIds.push(secret.evidenceId);
      }
    }

    if (secret.unlocksContactId) {
      const target = contacts[secret.unlocksContactId];
      if (!target?.unlocked && !unlockIds.includes(secret.unlocksContactId)) {
        unlockIds.push(secret.unlocksContactId);
      }
    }
  }

  return { messages, evidenceIds, unlockIds, revealedIds: revealed };
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function trustBucket(trust: number): 'low' | 'medium' | 'high' {
  if (trust < 35) return 'low';
  if (trust < 70) return 'medium';
  return 'high';
}

/**
 * Parámetros aceptados por el motor narrativo local (fallback).
 * Admite también un `ReplyParams` completo, ya que `history` y `userMessage`
 * son opcionales y el motor determinista no los necesita.
 */
export interface FallbackParams {
  contact: Contact;
  trust: number;
  tags: string[];
  attachmentTitle?: string;
  history?: Message[];
  userMessage?: string;
}

export function fallbackReply({ contact, trust, tags, attachmentTitle }: FallbackParams): string {
  const bucket = trustBucket(trust);

  if (attachmentTitle) {
    if (bucket === 'low') {
      return pick([
        '¿Y eso qué prueba?',
        'No entiendo por qué me muestras eso.',
        'Guarda eso, no quiero problemas.'
      ]);
    }
    if (bucket === 'medium') {
      return pick([
        'Eso... ¿de dónde lo has sacado?',
        'No sabía que tuviera esa prueba.',
        'Puede ser importante, sí.'
      ]);
    }
    return pick([
      'Está bien, lo veo. Tienes razón en preguntar.',
      'Eso cambia las cosas. No pensé que llegaras tan lejos.',
      'Si me muestras eso, al menos escúchame con calma.'
    ]);
  }

  if (tags.includes('threat')) {
    if (bucket === 'low') {
      return pick([
        'No me hables así.',
        'Prefiero no contestar a eso.',
        'Estás cruzando una línea.'
      ]);
    }
    return pick([
      'No hace falta que amenaces.',
      'Tranquilo, puedo hablar sin gritos.',
      'Eso no me ayuda a confiar.'
    ]);
  }

  if (tags.includes('accusation')) {
    if (bucket === 'low') {
      return pick(['No tienes ninguna prueba.', 'Estás equivocado.', 'No voy a aceptar eso.']);
    }
    if (bucket === 'medium') {
      return pick(['¿Por qué sospechas de mí?', 'No fue como lo pintas.', 'Necesito que me escuches.']);
    }
    return pick([
      'Sé que parezco culpable, pero no fui yo.',
      'Si tanto sospechas, mira también a los demás.',
      'No lo planeé, pero estuve allí.'
    ]);
  }

  if (tags.includes('location')) {
    return pick([
      `Estaba ${contact.alibi.toLowerCase()}.`,
      `Yo estaba ${contact.alibi.toLowerCase()}, no me moví de ahí.`,
      `Puedo jurar que estaba ${contact.alibi.toLowerCase()}.`
    ]);
  }

  if (tags.includes('time')) {
    return pick([
      'No recuerdo la hora exacta.',
      'Sería tarde, pero no sabría decir.',
      'Las horas se me mezclaron anoche.'
    ]);
  }

  if (tags.includes('weapon')) {
    return pick(['No toqué ninguna arma.', 'No sé nada de eso.', 'No quiero ni oír hablar de armas.']);
  }

  if (tags.includes('evidence')) {
    return pick([
      'Si tienes pruebas, enséñalas.',
      'No me sorprende que hayas encontrado algo.',
      'Las apariencias engañan, detective.'
    ]);
  }

  if (tags.includes('empathy')) {
    if (bucket === 'low') {
      return pick([
        'Gracias, pero sigo sin fiarme.',
        'Aun así, no puedo hablar mucho.',
        'Lo agradezco, pero ten cuidado.'
      ]);
    }
    return pick(['Gracias por entenderlo.', 'Eso ayuda, de verdad.', 'No mucha gente me habla así.']);
  }

  const byTemperament: Record<typeof contact.temperament, Record<typeof bucket, string[]>> = {
    formal: {
      low: ['Mis deberes me ocupaban.', 'No tengo más que añadir.', 'Comprendo su interés.'],
      medium: ['Haré lo posible por ayudar.', 'La casa tiene sus reglas.', 'Pregunte con calma.'],
      high: ['Le trataré con franqueza.', 'Confío en su criterio.', 'Haré lo que pueda.']
    },
    nervous: {
      low: ['No me presione, por favor.', 'Estoy asustado.', 'No quiero problemas.'],
      medium: ['Creo que vi algo, pero no estoy seguro.', 'Todo fue muy rápido.', 'Perdone si tartamudeo.'],
      high: ['Le contaré lo que sé.', 'Usted me da tranquilidad.', 'Sí, creo que puedo ayudar.']
    },
    warm: {
      low: ['Entiendo su preocupación.', 'No fue una noche fácil.', 'Pobre don Eduardo.'],
      medium: ['Le cuento lo que recuerdo.', 'Había tensión en la casa.', 'Ojalá pudiera ayudar más.'],
      high: ['Confío en usted.', 'Le diré lo que vi.', 'Esto no puede quedar así.']
    },
    hostile: {
      low: ['No tengo por qué darle explicaciones.', 'Váyase.', 'Estoy harto.'],
      medium: ['No me mire así.', 'Hable rápido.', 'No me gusta este interrogatorio.'],
      high: ['Está bien, pregunte.', 'No soy tonto, pero escucho.', 'Si insiste, hablemos.']
    },
    calculated: {
      low: ['Las apariencias engañan.', 'No diga nada que no pueda sostener.', 'Interesante.'],
      medium: ['Todo encaja, pero no del todo.', 'Piense antes de acusar.', 'Sigo escuchando.'],
      high: ['Usted es más listo de lo que pensaba.', 'Le daré una pista.', 'Vamos por buen camino.']
    }
  };

  return pick(byTemperament[contact.temperament][bucket]);
}
