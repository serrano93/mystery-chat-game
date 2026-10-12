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
  initiallyUnlocked?: boolean;
  secrets: Secret[];
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

export interface ReplyParams {
  contact: Contact;
  trust: number;
  history: Message[];
  userMessage: string;
  tags: string[];
  attachmentTitle?: string;
}

export interface SecretUpdate {
  messages: Message[];
  evidenceIds: string[];
  unlockIds: string[];
  revealedIds: string[];
}
