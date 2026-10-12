import type { Contact, Secret, TurnAnalysis } from '../types';
import { normalize } from './text';

const STOPWORDS = new Set([
  'este',
  'esta',
  'estos',
  'estas',
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'que',
  'de',
  'del',
  'al',
  'en',
  'y',
  'o',
  'pero',
  'por',
  'para',
  'con',
  'sobre',
  'entre',
  'tras',
  'sin',
  'no',
  'me',
  'te',
  'se',
  'le',
  'les',
  'nos',
  'os',
  'mi',
  'tu',
  'su',
  'nuestro',
  'vuestro',
  'yo',
  'el',
  'ella',
  'ellos',
  'ellas',
  'usted',
  'ustedes',
  'hay',
  'fue',
  'era',
  'ser',
  'estar',
  'estaba',
  'estuve',
  'vi',
  'vio',
  'como',
  'mas',
  'muy',
  'solo',
  'tambien',
  'aun',
  'ya',
  'ahi',
  'aqui',
  'alli',
  'entonces',
  'despues',
  'antes',
  'durante',
  'hasta',
  'desde',
  'donde',
  'cuando',
  'porque'
]);

export function extractKeywords(secret: Secret): string[] {
  if (secret.keywords?.length) {
    return secret.keywords.map((keyword) => normalize(keyword)).filter(Boolean);
  }

  const words = normalize(secret.content)
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ''))
    .filter((word) => word.length >= 5 && !STOPWORDS.has(word));

  return Array.from(new Set(words)).slice(0, 10);
}

export function getAvailableSecrets(
  contact: Contact,
  trust: number,
  revealedIds: string[]
): Secret[] {
  return contact.secrets.filter(
    (secret) => !revealedIds.includes(secret.id) && trust >= secret.minTrust
  );
}

export function pickSecretToReveal(params: {
  contact: Contact;
  trust: number;
  revealedIds: string[];
  analysis: TurnAnalysis;
  userMessage: string;
  /**
   * Número de mensajes escritos por el jugador. Se usa para dar un empujón
   * periódico a la revelación. Antes se pasaba la longitud total de la
   * historia, que en este juego crece de dos en dos desde 1 y por tanto nunca
   * cumple un módulo par.
   */
  userTurns: number;
}): Secret | null {
  const { contact, trust, revealedIds, analysis, userMessage, userTurns } = params;

  const candidates = getAvailableSecrets(contact, trust, revealedIds);
  if (!candidates.length) return null;

  const norm = normalize(userMessage);

  let best: { secret: Secret; score: number } | null = null;

  for (const secret of candidates) {
    let score = 0;

    const keywords = extractKeywords(secret);

    for (const keyword of keywords) {
      if (norm.includes(keyword)) {
        score += 100;
      }
    }

    const mentioned = [
      ...analysis.mentioned.people,
      ...analysis.mentioned.places,
      ...analysis.mentioned.times,
      ...analysis.mentioned.weapons,
      ...analysis.mentioned.evidence
    ];

    for (const item of mentioned) {
      if (keywords.some((keyword) => keyword.includes(item) || item.includes(keyword))) {
        score += 30;
      }
    }

    if (analysis.tags.includes('question')) score += 10;
    if (analysis.tags.includes('evidence')) score += 15;
    if (analysis.tags.includes('location')) score += 10;
    if (analysis.tags.includes('time')) score += 10;
    if (analysis.tags.includes('person')) score += 10;

    if (userTurns > 0 && userTurns % 3 === 0) {
      score += 35;
    }

    const trustSurplus = trust - secret.minTrust;
    if (trustSurplus >= 10) score += 10;
    if (trustSurplus >= 25) score += 15;

    if (secret.evidenceId) score += 10;
    if (secret.unlocksContactId) score += 12;

    if (!best || score > best.score) {
      best = { secret, score };
    }
  }

  if (best && best.score >= 75) {
    return best.secret;
  }

  return null;
}
