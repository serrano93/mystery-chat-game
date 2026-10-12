export type MessageRole = 'user' | 'npc' | 'system';

export type AttachmentIcon = 'footprints' | 'watch' | 'mail' | 'sparkles' | 'file';

export interface Attachment {
  kind: 'evidence';
  evidenceId: string;
  title: string;
  description: string;
  icon: AttachmentIcon;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachment?: Attachment;
  status?: 'sent' | 'read';
  meta?: {
    kind?: 'memory' | 'claim' | 'mission';
  };
}

export interface Evidence {
  id: string;
  title: string;
  description: string;
  hint: string;
  icon: AttachmentIcon;
  effects: Record<string, number>;
}

export interface Secret {
  id: string;
  minTrust: number;
  content: string;
  evidenceId?: string;
  unlocksContactId?: string;
  claimTopic?: ClaimTopic;
  keywords?: string[];
  revealHint?: string;
}

export type Temperament = 'formal' | 'nervous' | 'warm' | 'hostile' | 'calculated';

export interface Contact {
  id: string;
  name: string;
  role: string;
  bio: string;
  personality: string;
  alibi: string;
  temperament: Temperament;
  opening: string;
  color: string;
  avatarUrl?: string;
  initiallyUnlocked?: boolean;
  secrets: Secret[];

  /** 0-10. Cuánta manga ancha tiene el personaje para la ironía. */
  humor?: number;
  speechStyle?: string;
  examples?: string[];
}

export interface ContactState {
  unlocked: boolean;
  trust: number;
}

export interface Option {
  id: string;
  label: string;
}

export interface Solution {
  suspectId: string;
  weaponId: string;
  roomId: string;
}

export interface Accusation {
  suspectId: string;
  weaponId: string;
  roomId: string;
}

export type AIStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'unsupported' | 'error';

export type ModelTier = 'fast' | 'balanced' | 'premium';

export type Intent =
  | 'smalltalk'
  | 'comfort'
  | 'joke'
  | 'ask_alibi'
  | 'ask_time'
  | 'ask_location'
  | 'ask_person'
  | 'ask_weapon'
  | 'ask_evidence'
  | 'request_help'
  | 'accuse'
  | 'threaten'
  | 'confront'
  | 'unknown';

export type EmotionalTone = 'neutral' | 'warm' | 'tense' | 'aggressive' | 'playful';

export interface TurnAnalysis {
  intent: Intent;
  intents: Intent[];
  tags: string[];
  emotionalTone: EmotionalTone;
  hasQuestion: boolean;
  mentioned: {
    people: string[];
    places: string[];
    times: string[];
    weapons: string[];
    evidence: string[];
  };
}

export interface ReplyContext {
  contact: Contact;
  playerName: string;
  trust: number;
  history: Message[];
  userMessage: string;
  analysis: TurnAnalysis;
  memory?: MemoryNote;
  claims?: Claim[];
  availableSecrets?: Secret[];
  activeMission?: Mission;
  evidenceOwned: string[];
  tier: ModelTier;
  attachmentTitle?: string;
}

export interface ConfrontationContext {
  contact: Contact;
  playerName: string;
  trust: number;
  claim: Claim;
  canonical: {
    topic: ClaimTopic;
    truth: string;
    lie: string;
    evidenceId?: string;
  };
  success: boolean;
  evidenceUsed: boolean;
  memory?: MemoryNote;
  history: Message[];
}

export interface SecretFollowUpContext {
  contact: Contact;
  playerName: string;
  secret: Secret;
  trust: number;
  memory?: MemoryNote;
}

export type ClaimTopic =
  | 'alibi'
  | 'argument'
  | 'victor_greenhouse'
  | 'tea'
  | 'watch'
  | 'saw_victor'
  | 'letter'
  | 'statue'
  | 'window';

export interface Claim {
  id: string;
  contactId: string;
  topic: ClaimTopic;
  statement: string;
  truth: 'truth' | 'lie' | 'partial';
  exposed: boolean;
  createdAt: number;
}

export interface MemoryNote {
  contactId: string;
  summary: string;
  facts: string[];
  tone: 'neutral' | 'tense' | 'trusting' | 'hostile';
  updatedAt: number;
  messageCount: number;
}

export type MissionObjective =
  | { kind: 'trust'; contactId: string; value: number }
  | { kind: 'evidence'; evidenceId: string }
  | { kind: 'secret'; secretId: string }
  | { kind: 'unlock'; contactId: string }
  | { kind: 'expose_claim'; contactId: string; topic: ClaimTopic }
  | { kind: 'accusation_correct' };

export interface MissionActivation {
  kind: 'start' | 'secret_revealed' | 'contact_unlocked' | 'evidence_collected' | 'claim_exposed';
  id?: string;
}

export interface MissionReward {
  trust?: Record<string, number>;
  evidenceId?: string;
  unlockContactId?: string;
  message?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  objective: MissionObjective;
  activation: MissionActivation;
  active: boolean;
  completed: boolean;
  reward?: MissionReward;
}

export interface Ending {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  grade: string;
  correct: boolean;
}
