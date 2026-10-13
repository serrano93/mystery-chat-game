import { SOLUTION } from '../data/case';
import { ENDINGS } from '../data/endings';
import type { Accusation, Claim, ContactState, Ending } from '../types';

export interface EndingInput {
  revealedSecretIds: string[];
  evidenceOwned: string[];
  claims: Claim[];
  contacts: Record<string, ContactState>;
}

export function evaluateEnding(
  accusation: Accusation,
  state: EndingInput,
  correct: boolean
): Ending {
  if (correct) {
    const hasConfession = state.revealedSecretIds.includes('victor_confession');
    const victorLiesExposed = state.claims.filter(
      (c) => c.contactId === 'victor' && c.exposed
    ).length;
    const evidenceCount = state.evidenceOwned.length;

    if (hasConfession && victorLiesExposed >= 2 && evidenceCount >= 3) {
      return ENDINGS.truth_uncovered;
    }

    if (hasConfession) {
      return ENDINGS.confession;
    }

    if (evidenceCount >= 3) {
      return ENDINGS.iron_case;
    }

    return ENDINGS.justice;
  }

  const accusedTrust = state.contacts[accusation.suspectId]?.trust ?? 0;
  const exposedLies = state.claims.filter((c) => c.exposed).length;
  const evidenceCount = state.evidenceOwned.length;

  if (accusedTrust >= 60) {
    return ENDINGS.wrongful;
  }

  if (exposedLies >= 2 && evidenceCount >= 2) {
    return ENDINGS.misdirection;
  }

  return ENDINGS.cold_case;
}

export function isCorrectAccusation(accusation: Accusation): boolean {
  return (
    accusation.suspectId === SOLUTION.suspectId &&
    accusation.weaponId === SOLUTION.weaponId &&
    accusation.roomId === SOLUTION.roomId
  );
}
