import { CONTACTS, EVIDENCE } from '../data/case';
import type { Contact } from '../types';
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

/**
 * Movimiento de confianza asociado a un mensaje del jugador. La voz del NPC
 * vive en lib/context.ts y lib/fallback.ts; aquí solo se decide el estado.
 */
export function analyzeMessage(
  text: string,
  contact: Contact,
  evidenceId?: string
): MessageAnalysis {
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
  if (
    tags.includes('location') ||
    tags.includes('time') ||
    tags.includes('weapon') ||
    tags.includes('person')
  ) {
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
