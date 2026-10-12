import type { EmotionalTone, Intent, TurnAnalysis } from '../types';
import { includesAny, normalize } from './text';

const EMPATHY_WORDS = [
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
  'amigo',
  'compañero',
  'cuidate',
  'respira'
];

const POLITE_WORDS = ['por favor', 'gracias', 'buenas', 'disculpa', 'perdone', 'usted'];

const THREAT_WORDS = [
  'amenaz',
  'arrest',
  'carcel',
  'presidio',
  'matar',
  'destrozar',
  'confesar',
  'denunciar',
  'policia',
  'te voy a'
];

const ACCUSATION_WORDS = [
  'mataste',
  'asesino',
  'culpable',
  'lo hiciste',
  'fuiste tu',
  'escondiste',
  'armaste',
  'tu mataste'
];

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

const EVIDENCE_WORDS = [
  'foto',
  'prueba',
  'carta',
  'recibo',
  'documento',
  'huella',
  'reloj',
  'estatua',
  'adjunto',
  'muestro',
  'enseño',
  'enseno'
];

const QUESTION_WORDS = [
  'donde',
  'cuando',
  'quien',
  'por que',
  'como',
  'sabes',
  'viste',
  'recuerdas',
  'estabas',
  'hiciste',
  'paso'
];

const JOKE_WORDS = [
  'broma',
  'gracioso',
  'risa',
  'jaja',
  'jeje',
  'crack',
  'genio',
  'cafetero',
  'cafe',
  'sarcasmo',
  'divertido',
  'tio',
  'anda ya',
  'venga ya'
];

const PEOPLE = [
  'victor',
  'eduardo',
  'sebastian',
  'pedro',
  'marta',
  'clara',
  'mayordomo',
  'jardinero',
  'cocinera',
  'sobrina',
  'socio',
  'inspector',
  'garcia'
];

const PLACES = [
  'estudio',
  'biblioteca',
  'cocina',
  'invernadero',
  'vestibulo',
  'jardin',
  'mansion',
  'casa',
  'puerta',
  'ventana',
  'ventanal',
  'sofa'
];

const TIMES = [
  'anoche',
  'ayer',
  'hora',
  'ocho',
  'nueve',
  'diez',
  '9',
  '10',
  '8',
  '20',
  '21',
  '22',
  'manana',
  'noche',
  'tarde'
];

const WEAPONS = [
  'estatua',
  'candelabro',
  'cuerda',
  'cuchillo',
  'veneno',
  'arma',
  'golpe',
  'sangre',
  'muerto',
  'cadaver'
];

const EVIDENCE_TERMS = [
  'huella',
  'cadena',
  'reloj',
  'carta',
  'estatua',
  'cera',
  'barro',
  'botas',
  'tila',
  'infusion'
];

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function matchList(norm: string, list: string[]): string[] {
  return list.filter((item) => norm.includes(item));
}

export function analyzeTurn(text: string, evidenceId?: string): TurnAnalysis {
  // Nota: "que" no está en QUESTION_WORDS a propósito. Es una de las palabras
  // más frecuentes del español en frases enunciativas ("sé que...", "creo
  // que..."), y marcarla como pregunta desviaba la intención a ask_person en
  // cuanto aparecía un nombre propio. Las preguntas reales en español llevan
  // signo de interrogación.
  const norm = normalize(text);
  const tags: string[] = [];
  const intents: Intent[] = [];

  const hasQuestion = norm.includes('?') || includesAny(norm, QUESTION_WORDS);

  const mentionedPeople = matchList(norm, PEOPLE);
  const mentionedPlaces = matchList(norm, PLACES);
  const mentionedTimes = matchList(norm, TIMES);
  const mentionedWeapons = matchList(norm, WEAPONS);
  const mentionedEvidence = matchList(norm, EVIDENCE_TERMS);

  if (includesAny(norm, EMPATHY_WORDS)) tags.push('empathy');
  if (includesAny(norm, POLITE_WORDS)) tags.push('polite');
  if (hasQuestion) tags.push('question');
  if (includesAny(norm, THREAT_WORDS)) tags.push('threat');
  if (includesAny(norm, ACCUSATION_WORDS)) tags.push('accusation');
  if (includesAny(norm, CONTRADICTION_WORDS)) tags.push('confrontation');
  if (includesAny(norm, EVIDENCE_WORDS) || evidenceId) tags.push('evidence');
  if (mentionedPlaces.length) tags.push('location');
  if (mentionedTimes.length) tags.push('time');
  if (mentionedWeapons.length) tags.push('weapon');
  if (mentionedPeople.length) tags.push('person');
  if (includesAny(norm, JOKE_WORDS)) tags.push('joke');

  if (includesAny(norm, CONTRADICTION_WORDS)) intents.push('confront');
  if (includesAny(norm, THREAT_WORDS)) intents.push('threaten');
  if (includesAny(norm, ACCUSATION_WORDS)) intents.push('accuse');
  if (includesAny(norm, EVIDENCE_WORDS) || evidenceId) intents.push('ask_evidence');
  if (includesAny(norm, EMPATHY_WORDS)) intents.push('comfort');
  if (includesAny(norm, JOKE_WORDS)) intents.push('joke');

  if (
    norm.includes('donde estabas') ||
    norm.includes('coartada') ||
    norm.includes('que hacias') ||
    norm.includes('estabas')
  ) {
    intents.push('ask_alibi');
  }

  if (mentionedTimes.length && hasQuestion) intents.push('ask_time');
  if (mentionedPlaces.length && hasQuestion) intents.push('ask_location');
  if (mentionedPeople.length && hasQuestion) intents.push('ask_person');
  if (mentionedWeapons.length && hasQuestion) intents.push('ask_weapon');

  if (norm.includes('necesito') || norm.includes('ayuda') || norm.includes('confio')) {
    intents.push('request_help');
  }

  let intent: Intent = 'smalltalk';

  if (intents.includes('confront')) intent = 'confront';
  else if (intents.includes('threaten')) intent = 'threaten';
  else if (intents.includes('accuse')) intent = 'accuse';
  else if (intents.includes('ask_evidence')) intent = 'ask_evidence';
  else if (intents.includes('ask_alibi')) intent = 'ask_alibi';
  else if (intents.includes('ask_time')) intent = 'ask_time';
  else if (intents.includes('ask_location')) intent = 'ask_location';
  else if (intents.includes('ask_person')) intent = 'ask_person';
  else if (intents.includes('ask_weapon')) intent = 'ask_weapon';
  else if (intents.includes('comfort')) intent = 'comfort';
  else if (intents.includes('joke')) intent = 'joke';
  else if (intents.includes('request_help')) intent = 'request_help';
  else if (hasQuestion) intent = 'unknown';
  else intent = 'smalltalk';

  let emotionalTone: EmotionalTone = 'neutral';

  if (intents.includes('threaten') || intents.includes('accuse') || intents.includes('confront')) {
    emotionalTone = 'aggressive';
  } else if (intents.includes('joke')) {
    emotionalTone = 'playful';
  } else if (intents.includes('comfort') || tags.includes('empathy')) {
    emotionalTone = 'warm';
  } else if (
    mentionedWeapons.includes('muerto') ||
    mentionedWeapons.includes('cadaver') ||
    mentionedWeapons.includes('sangre') ||
    mentionedWeapons.includes('golpe')
  ) {
    emotionalTone = 'tense';
  }

  return {
    intent,
    intents: unique(intents),
    tags: unique(tags),
    emotionalTone,
    hasQuestion,
    mentioned: {
      people: mentionedPeople,
      places: mentionedPlaces,
      times: mentionedTimes,
      weapons: mentionedWeapons,
      evidence: mentionedEvidence
    }
  };
}
