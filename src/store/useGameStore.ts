import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CONTACTS, EVIDENCE } from '../data/case';
import { INITIAL_MISSIONS } from '../data/missions';
import {
  checkWebGPU,
  generateReply,
  initWebLLM,
  summarizeConversation
} from '../lib/ai';
import { confrontationResponse, detectConfrontation, maybeRecordClaim } from '../lib/claims';
import { evaluateEnding, isCorrectAccusation } from '../lib/endings';
import {
  analyzeMessage,
  clampTrust,
  collectSecretUpdates,
  contactMap,
  fallbackReply
} from '../lib/logic';
import { createHeuristicMemory } from '../lib/memory';
import { processMissions } from '../lib/missions';
import type {
  AIStatus,
  Accusation,
  Attachment,
  Claim,
  ContactState,
  MemoryNote,
  Message,
  Mission,
  SecretUpdate
} from '../types';
import { now, uid } from '../utils/id';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GameStore {
  contacts: Record<string, ContactState>;
  messages: Record<string, Message[]>;
  unread: Record<string, number>;
  revealedSecretIds: string[];
  evidenceOwned: string[];

  missions: Mission[];
  claims: Claim[];
  memories: Record<string, MemoryNote>;

  activeContactId: string | null;
  typingContactId: string | null;

  aiStatus: AIStatus;
  aiProgress: number;
  aiStatusText: string;
  useFallback: boolean;

  theme: 'dark' | 'light';

  showAccuse: boolean;
  showMissions: boolean;
  accusation: Accusation | null;
  solved: boolean;
  gameOver: boolean;
  failedAttempts: number;
  endingId: string | null;

  initAI: (force?: boolean) => Promise<void>;
  skipAI: () => void;
  retryAI: () => void;

  openContact: (contactId: string) => void;
  backToList: () => void;

  sendMessage: (contactId: string, text: string) => Promise<void>;
  sendEvidence: (contactId: string, evidenceId: string) => Promise<void>;

  toggleTheme: () => void;
  setShowAccuse: (show: boolean) => void;
  setShowMissions: (show: boolean) => void;
  accuse: (accusation: Accusation) => void;
  syncMissions: () => void;
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

    missions: INITIAL_MISSIONS.map((mission) => ({
      ...mission,
      active: mission.activation.kind === 'start',
      completed: false
    })),
    claims: [] as Claim[],
    memories: {} as Record<string, MemoryNote>,

    activeContactId: null as string | null,
    typingContactId: null as string | null,

    aiStatus: 'idle' as AIStatus,
    aiProgress: 0,
    aiStatusText: '',
    useFallback: false,

    theme: 'dark' as const,

    showAccuse: false,
    showMissions: false,
    accusation: null as Accusation | null,
    solved: false,
    gameOver: false,
    failedAttempts: 0,
    endingId: null as string | null
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

            if (state.activeContactId !== id) {
              unread[id] = (unread[id] ?? 0) + 1;
            }

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

      const refreshMemory = async (contactId: string) => {
        try {
          const state = get();
          const contact = contactMap[contactId];
          if (!contact) return;

          const history = state.messages[contactId] ?? [];
          const trust = state.contacts[contactId]?.trust ?? 0;
          const claims = state.claims.filter((c) => c.contactId === contactId);
          const previous = state.memories[contactId];

          // La historia arranca con el mensaje de apertura (1) y crece de dos en dos,
          // así que la paridad nunca llega a 0. Se cuenta cuántos mensajes nuevos hay
          // desde la última nota de memoria en lugar de mirar el total.
          const previousCount = previous?.messageCount ?? 0;
          const shouldUseLLM =
            state.aiStatus === 'ready' &&
            !state.useFallback &&
            history.length >= 8 &&
            history.length - previousCount >= 8;

          let summaryOverride: string | null = null;

          if (shouldUseLLM) {
            summaryOverride = await summarizeConversation({
              contactName: contact.name,
              history,
              trust
            });
          }

          const note = createHeuristicMemory({
            contact,
            history,
            trust,
            claims,
            previous,
            summaryOverride
          });

          set((prev) => ({
            memories: {
              ...prev.memories,
              [contactId]: note
            }
          }));
        } catch (error) {
          console.warn('Memory refresh failed:', error);
        }
      };

      const handleConfrontation = async (
        contactId: string,
        content: string,
        confrontation: NonNullable<ReturnType<typeof detectConfrontation>>
      ) => {
        const state = get();
        const contact = contactMap[contactId];
        const contactState = state.contacts[contactId];

        if (!contact || !contactState?.unlocked || state.typingContactId || state.gameOver) {
          return;
        }

        const { claim, canonical, success, evidenceUsed } = confrontation;
        const currentTrust = contactState.trust;

        const delta = success ? (evidenceUsed ? 9 : 5) : claim.truth === 'truth' ? -9 : -15;

        const newTrust = clampTrust(currentTrust + delta);

        const userMessage: Message = {
          id: uid(),
          role: 'user',
          content,
          timestamp: now(),
          status: 'sent'
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

        const startedAt = Date.now();

        const reply = confrontationResponse({
          contact,
          claim,
          canonical,
          success,
          trust: newTrust,
          evidenceUsed
        });

        const minDelay = Math.min(2400, 700 + reply.length * 14);
        const elapsed = Date.now() - startedAt;
        if (elapsed < minDelay) {
          await sleep(minDelay - elapsed);
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

          const claims = success
            ? prev.claims.map((c) => (c.id === claim.id ? { ...c, exposed: true } : c))
            : prev.claims;

          return {
            messages: {
              ...prev.messages,
              [contactId]: [...updated, npcMessage]
            },
            claims,
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

        void refreshMemory(contactId);
        get().syncMissions();
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

        const confrontation = detectConfrontation({
          text: content,
          contactId,
          claims: state.claims,
          evidenceOwned: state.evidenceOwned,
          contacts: state.contacts
        });

        if (confrontation && !attachment) {
          await handleConfrontation(contactId, content, confrontation);
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

        const startedAt = Date.now();
        let reply = '';

        try {
          const history = get().messages[contactId] ?? [];
          const memory = get().memories[contactId];
          const claims = get().claims.filter((c) => c.contactId === contactId);

          if (get().aiStatus === 'ready' && !get().useFallback) {
            reply = await generateReply({
              contact,
              trust: newTrust,
              history,
              userMessage: content,
              tags: analysis.tags,
              attachmentTitle: attachment?.title,
              memory,
              claims
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

        const minDelay = Math.min(2400, 650 + reply.length * 14);
        const elapsed = Date.now() - startedAt;
        if (elapsed < minDelay) {
          await sleep(minDelay - elapsed);
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

        const claim = maybeRecordClaim({
          contact,
          reply,
          tags: analysis.tags,
          trust: newTrust,
          evidenceOwned: get().evidenceOwned,
          claims: get().claims
        });

        if (claim) {
          set((prev) => ({
            claims: [...prev.claims, claim]
          }));
        }

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

        void refreshMemory(contactId);
        get().syncMissions();
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

        setShowMissions: (show) => {
          set({ showMissions: show });
        },

        accuse: (accusation) => {
          const state = get();
          const correct = isCorrectAccusation(accusation);

          if (correct) {
            const ending = evaluateEnding(accusation, state, true);
            set({
              accusation,
              showAccuse: false,
              solved: true,
              gameOver: true,
              endingId: ending.id
            });
          } else {
            const failedAttempts = state.failedAttempts + 1;

            if (failedAttempts >= 3) {
              const ending = evaluateEnding(accusation, state, false);
              set({
                accusation,
                showAccuse: false,
                failedAttempts,
                gameOver: true,
                endingId: ending.id
              });
            } else {
              const attemptsLeft = 3 - failedAttempts;
              const message = `Esa acusación no se sostiene. Te quedan ${attemptsLeft} intento${attemptsLeft === 1 ? '' : 's'}.`;

              set((prev) => ({
                accusation,
                showAccuse: false,
                failedAttempts,
                messages: {
                  ...prev.messages,
                  inspector: [
                    ...(prev.messages.inspector ?? []),
                    {
                      id: uid(),
                      role: 'system',
                      content: message,
                      timestamp: now()
                    }
                  ]
                },
                unread: {
                  ...prev.unread,
                  inspector: (prev.unread.inspector ?? 0) + 1
                }
              }));
            }
          }

          get().syncMissions();
        },

        syncMissions: () => {
          try {
            set((state) =>
              processMissions({
                missions: state.missions,
                messages: state.messages,
                contacts: state.contacts,
                evidenceOwned: state.evidenceOwned,
                unread: state.unread,
                revealedSecretIds: state.revealedSecretIds,
                claims: state.claims,
                solved: state.solved,
                activeContactId: state.activeContactId
              })
            );
          } catch (error) {
            console.error('Mission sync failed:', error);
          }
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

          get().syncMissions();
        }
      };
    },
    {
      name: 'mystery-whatsapp-v2',
      version: 2,
      partialize: (state) => ({
        contacts: state.contacts,
        messages: state.messages,
        unread: state.unread,
        revealedSecretIds: state.revealedSecretIds,
        evidenceOwned: state.evidenceOwned,
        missions: state.missions,
        claims: state.claims,
        memories: state.memories,
        activeContactId: state.activeContactId,
        theme: state.theme,
        useFallback: state.useFallback,
        solved: state.solved,
        gameOver: state.gameOver,
        failedAttempts: state.failedAttempts,
        accusation: state.accusation,
        endingId: state.endingId
      })
    }
  )
);
