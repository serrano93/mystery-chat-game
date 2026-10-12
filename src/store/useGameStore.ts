import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CONTACTS, EVIDENCE, SOLUTION } from '../data/case';
import { checkWebGPU, generateReply, initWebLLM } from '../lib/ai';
import {
  analyzeMessage,
  clampTrust,
  collectSecretUpdates,
  contactMap,
  fallbackReply
} from '../lib/logic';
import type {
  AIStatus,
  Accusation,
  Attachment,
  ContactState,
  Message,
  SecretUpdate
} from '../types';
import { now, uid } from '../utils/id';

interface GameStore {
  contacts: Record<string, ContactState>;
  messages: Record<string, Message[]>;
  unread: Record<string, number>;
  revealedSecretIds: string[];
  evidenceOwned: string[];

  activeContactId: string | null;
  typingContactId: string | null;

  aiStatus: AIStatus;
  aiProgress: number;
  aiStatusText: string;
  useFallback: boolean;

  theme: 'dark' | 'light';

  showAccuse: boolean;
  accusation: Accusation | null;
  solved: boolean;
  gameOver: boolean;
  failedAttempts: number;

  initAI: (force?: boolean) => Promise<void>;
  skipAI: () => void;
  retryAI: () => void;

  openContact: (contactId: string) => void;
  backToList: () => void;

  sendMessage: (contactId: string, text: string) => Promise<void>;
  sendEvidence: (contactId: string, evidenceId: string) => Promise<void>;

  toggleTheme: () => void;
  setShowAccuse: (show: boolean) => void;
  accuse: (accusation: Accusation) => void;
  resetGame: () => void;
}

function createInitialState() {
  const contacts: Record<string, ContactState> = {};
  const messages: Record<string, Message[]> = {};
  const unread: Record<string, number> = {};

  CONTACTS.forEach((contact) => {
    const unlocked = Boolean(contact.initiallyUnlocked);
    contacts[contact.id] = {
      unlocked,
      trust: unlocked ? 18 : 0
    };

    if (unlocked) {
      messages[contact.id] = [
        {
          id: uid(),
          role: 'npc',
          content: contact.opening,
          timestamp: now() - 60_000,
          status: 'read'
        }
      ];
      unread[contact.id] = 1;
    } else {
      messages[contact.id] = [];
      unread[contact.id] = 0;
    }
  });

  return {
    contacts,
    messages,
    unread,
    revealedSecretIds: [] as string[],
    evidenceOwned: [] as string[],
    activeContactId: null as string | null,
    typingContactId: null as string | null,
    aiStatus: 'idle' as AIStatus,
    aiProgress: 0,
    aiStatusText: '',
    useFallback: false,
    theme: 'dark' as const,
    showAccuse: false,
    accusation: null as Accusation | null,
    solved: false,
    gameOver: false,
    failedAttempts: 0
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const applySecretUpdates = (contactId: string, updates: SecretUpdate) => {
        set((state) => {
          const messages = { ...state.messages };
          const contacts = { ...state.contacts };
          const unread = { ...state.unread };

          messages[contactId] = [...(messages[contactId] ?? []), ...updates.messages];

          updates.unlockIds.forEach((id) => {
            if (contacts[id]?.unlocked) return;

            const definition = contactMap[id];
            if (!definition) return;

            contacts[id] = { unlocked: true, trust: 15 };

            messages[id] = [
              ...(messages[id] ?? []),
              {
                id: uid(),
                role: 'npc',
                content: definition.opening,
                timestamp: now(),
                status: 'read'
              }
            ];

            unread[id] = (unread[id] ?? 0) + 1;

            messages[contactId] = [
              ...(messages[contactId] ?? []),
              {
                id: uid(),
                role: 'system',
                content: `Nuevo contacto desbloqueado: ${definition.name}.`,
                timestamp: now()
              }
            ];
          });

          const evidenceOwned = [...state.evidenceOwned];
          updates.evidenceIds.forEach((evidenceId) => {
            if (!evidenceOwned.includes(evidenceId)) {
              evidenceOwned.push(evidenceId);
            }
          });

          return {
            messages,
            contacts,
            unread,
            evidenceOwned,
            revealedSecretIds: updates.revealedIds
          };
        });
      };

      const handlePlayerMessage = async (
        contactId: string,
        content: string,
        attachment?: Attachment,
        evidenceId?: string
      ) => {
        const state = get();
        const contact = contactMap[contactId];
        const contactState = state.contacts[contactId];

        if (!contact || !contactState?.unlocked || state.typingContactId || state.gameOver) {
          return;
        }

        const analysis = analyzeMessage(content, contact, evidenceId);
        const newTrust = clampTrust(contactState.trust + analysis.trustDelta);

        const userMessage: Message = {
          id: uid(),
          role: 'user',
          content,
          timestamp: now(),
          status: 'sent',
          attachment
        };

        set((prev) => ({
          messages: {
            ...prev.messages,
            [contactId]: [...(prev.messages[contactId] ?? []), userMessage]
          },
          contacts: {
            ...prev.contacts,
            [contactId]: { ...contactState, trust: newTrust }
          },
          typingContactId: contactId,
          unread: {
            ...prev.unread,
            [contactId]: 0
          }
        }));

        let reply = '';

        try {
          const history = get().messages[contactId] ?? [];

          if (get().aiStatus === 'ready' && !get().useFallback) {
            reply = await generateReply({
              contact,
              trust: newTrust,
              history,
              userMessage: content,
              tags: analysis.tags,
              attachmentTitle: attachment?.title
            });
          } else {
            reply = fallbackReply({
              contact,
              trust: newTrust,
              history,
              userMessage: content,
              tags: analysis.tags,
              attachmentTitle: attachment?.title
            });
          }
        } catch {
          reply = fallbackReply({
            contact,
            trust: newTrust,
            history: get().messages[contactId] ?? [],
            userMessage: content,
            tags: analysis.tags,
            attachmentTitle: attachment?.title
          });
        }

        if (!reply) {
          reply = fallbackReply({
            contact,
            trust: newTrust,
            history: get().messages[contactId] ?? [],
            userMessage: content,
            tags: analysis.tags,
            attachmentTitle: attachment?.title
          });
        }

        const npcMessage: Message = {
          id: uid(),
          role: 'npc',
          content: reply,
          timestamp: now(),
          status: 'read'
        };

        set((prev) => {
          const existing = prev.messages[contactId] ?? [];
          const updated = existing.map((m) =>
            m.role === 'user' ? { ...m, status: 'read' as const } : m
          );

          return {
            messages: {
              ...prev.messages,
              [contactId]: [...updated, npcMessage]
            },
            typingContactId: null
          };
        });

        const updates = collectSecretUpdates(
          contactId,
          newTrust,
          get().revealedSecretIds,
          get().evidenceOwned,
          get().contacts
        );

        if (updates.messages.length || updates.evidenceIds.length || updates.unlockIds.length) {
          applySecretUpdates(contactId, updates);
        }
      };

      return {
        ...createInitialState(),

        initAI: async (force = false) => {
          if (force) {
            set({ useFallback: false });
          }

          if (get().useFallback) {
            set({
              aiStatus: 'fallback',
              aiStatusText: 'Modo narrativo local activo'
            });
            return;
          }

          set({
            aiStatus: 'loading',
            aiProgress: 0,
            aiStatusText: 'Comprobando compatibilidad...'
          });

          try {
            const supported = await checkWebGPU();

            if (!supported) {
              set({
                useFallback: true,
                aiStatus: 'unsupported',
                aiStatusText: 'WebGPU no disponible. Usando motor narrativo local.'
              });
              return;
            }

            set({ aiStatusText: 'Descargando modelo local...' });

            await initWebLLM((progress, text) => {
              set({ aiProgress: progress, aiStatusText: text });
            });

            set({
              aiStatus: 'ready',
              aiProgress: 1,
              aiStatusText: 'IA local lista'
            });
          } catch {
            set({
              useFallback: true,
              aiStatus: 'error',
              aiStatusText: 'No se pudo cargar la IA local. Usando modo local.'
            });
          }
        },

        skipAI: () => {
          set({
            useFallback: true,
            aiStatus: 'fallback',
            aiStatusText: 'Modo narrativo local activo'
          });
        },

        retryAI: () => {
          set({ useFallback: false });
          void get().initAI(true);
        },

        openContact: (contactId) => {
          set((state) => {
            const contactState = state.contacts[contactId];
            if (!contactState?.unlocked) return {};

            const messages = {
              ...state.messages,
              [contactId]: (state.messages[contactId] ?? []).map((m) =>
                m.role === 'user' ? { ...m, status: 'read' as const } : m
              )
            };

            return {
              activeContactId: contactId,
              unread: {
                ...state.unread,
                [contactId]: 0
              },
              messages
            };
          });
        },

        backToList: () => {
          set({ activeContactId: null });
        },

        sendMessage: async (contactId, text) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          await handlePlayerMessage(contactId, trimmed);
        },

        sendEvidence: async (contactId, evidenceId) => {
          const evidence = EVIDENCE[evidenceId];
          if (!evidence) return;

          const content = `Te muestro una prueba: ${evidence.title}.`;
          const attachment: Attachment = {
            kind: 'evidence',
            evidenceId,
            title: evidence.title,
            description: evidence.description,
            icon: evidence.icon
          };

          await handlePlayerMessage(contactId, content, attachment, evidenceId);
        },

        toggleTheme: () => {
          set((state) => ({
            theme: state.theme === 'dark' ? 'light' : 'dark'
          }));
        },

        setShowAccuse: (show) => {
          set({ showAccuse: show });
        },

        accuse: (accusation) => {
          const correct =
            accusation.suspectId === SOLUTION.suspectId &&
            accusation.weaponId === SOLUTION.weaponId &&
            accusation.roomId === SOLUTION.roomId;

          set((state) => ({
            accusation,
            showAccuse: false,
            solved: correct,
            gameOver: !correct && state.failedAttempts + 1 >= 3,
            failedAttempts: correct ? state.failedAttempts : state.failedAttempts + 1
          }));
        },

        resetGame: () => {
          set((state) => ({
            ...createInitialState(),
            theme: state.theme,
            useFallback: state.useFallback,
            aiStatus: state.aiStatus,
            aiProgress: state.aiProgress,
            aiStatusText: state.aiStatusText
          }));
        }
      };
    },
    {
      name: 'mystery-whatsapp-v1',
      version: 1,
      partialize: (state) => ({
        contacts: state.contacts,
        messages: state.messages,
        unread: state.unread,
        revealedSecretIds: state.revealedSecretIds,
        evidenceOwned: state.evidenceOwned,
        activeContactId: state.activeContactId,
        theme: state.theme,
        useFallback: state.useFallback,
        solved: state.solved,
        gameOver: state.gameOver,
        failedAttempts: state.failedAttempts,
        accusation: state.accusation
      })
    }
  )
);
