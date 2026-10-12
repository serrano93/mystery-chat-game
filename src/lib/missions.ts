import { EVIDENCE } from '../data/case';
import type { Claim, ContactState, Message, Mission, MissionObjective } from '../types';
import { now, uid } from '../utils/id';
import { clampTrust, contactMap } from './logic';

export interface MissionProcessInput {
  missions: Mission[];
  messages: Record<string, Message[]>;
  contacts: Record<string, ContactState>;
  evidenceOwned: string[];
  unread: Record<string, number>;
  revealedSecretIds: string[];
  claims: Claim[];
  solved: boolean;
  activeContactId: string | null;
}

function activationMet(mission: Mission, state: MissionProcessInput): boolean {
  const { activation } = mission;

  switch (activation.kind) {
    case 'start':
      return true;
    case 'secret_revealed':
      return Boolean(activation.id && state.revealedSecretIds.includes(activation.id));
    case 'contact_unlocked':
      return Boolean(activation.id && state.contacts[activation.id]?.unlocked);
    case 'evidence_collected':
      return Boolean(activation.id && state.evidenceOwned.includes(activation.id));
    case 'claim_exposed': {
      if (!activation.id) return false;
      const [contactId, topic] = activation.id.split(':');
      return state.claims.some((c) => c.contactId === contactId && c.topic === topic && c.exposed);
    }
    default:
      return false;
  }
}

function objectiveComplete(objective: MissionObjective, state: MissionProcessInput): boolean {
  switch (objective.kind) {
    case 'trust':
      return (state.contacts[objective.contactId]?.trust ?? 0) >= objective.value;
    case 'evidence':
      return state.evidenceOwned.includes(objective.evidenceId);
    case 'secret':
      return state.revealedSecretIds.includes(objective.secretId);
    case 'unlock':
      return Boolean(state.contacts[objective.contactId]?.unlocked);
    case 'expose_claim':
      return state.claims.some(
        (c) => c.contactId === objective.contactId && c.topic === objective.topic && c.exposed
      );
    case 'accusation_correct':
      return state.solved;
    default:
      return false;
  }
}

export function processMissions(input: MissionProcessInput): MissionProcessInput {
  let missions = input.missions.map((m) => ({ ...m }));
  const messages = { ...input.messages };
  const contacts = { ...input.contacts };
  const evidenceOwned = [...input.evidenceOwned];
  const unread = { ...input.unread };
  const revealedSecretIds = [...input.revealedSecretIds];
  const claims = input.claims;
  const solved = input.solved;
  const activeContactId = input.activeContactId;

  const addInspectorMessage = (text: string) => {
    if (!text.trim()) return;

    messages.inspector = [
      ...(messages.inspector ?? []),
      {
        id: uid(),
        role: 'npc',
        content: text,
        timestamp: now(),
        status: 'read'
      }
    ];

    if (activeContactId !== 'inspector') {
      unread.inspector = (unread.inspector ?? 0) + 1;
    }
  };

  const ensureUnlocked = (contactId: string) => {
    if (contacts[contactId]?.unlocked) return;

    const definition = contactMap[contactId];
    if (!definition) return;

    contacts[contactId] = { unlocked: true, trust: 15 };

    messages[contactId] = [
      ...(messages[contactId] ?? []),
      {
        id: uid(),
        role: 'npc',
        content: definition.opening,
        timestamp: now(),
        status: 'read'
      }
    ];

    if (activeContactId !== contactId) {
      unread[contactId] = (unread[contactId] ?? 0) + 1;
    }
  };

  let changed = true;
  let iterations = 0;

  while (changed && iterations < 8) {
    changed = false;
    iterations += 1;

    missions = missions.map((mission) => {
      if (
        !mission.active &&
        activationMet(mission, { ...input, contacts, evidenceOwned, claims, solved })
      ) {
        changed = true;
        return { ...mission, active: true };
      }
      return mission;
    });

    missions = missions.map((mission) => {
      if (
        mission.active &&
        !mission.completed &&
        objectiveComplete(mission.objective, { ...input, contacts, evidenceOwned, claims, solved })
      ) {
        changed = true;

        if (mission.reward?.message) {
          addInspectorMessage(mission.reward.message);
        }

        if (mission.reward?.trust) {
          for (const [contactId, delta] of Object.entries(mission.reward.trust)) {
            const current = contacts[contactId];
            if (!current) continue;
            contacts[contactId] = {
              ...current,
              trust: clampTrust(current.trust + delta)
            };
          }
        }

        if (mission.reward?.evidenceId && EVIDENCE[mission.reward.evidenceId]) {
          if (!evidenceOwned.includes(mission.reward.evidenceId)) {
            evidenceOwned.push(mission.reward.evidenceId);
          }
        }

        if (mission.reward?.unlockContactId) {
          ensureUnlocked(mission.reward.unlockContactId);
        }

        return { ...mission, completed: true };
      }

      return mission;
    });
  }

  return {
    missions,
    messages,
    contacts,
    evidenceOwned,
    unread,
    revealedSecretIds,
    claims,
    solved,
    activeContactId
  };
}
