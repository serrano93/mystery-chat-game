import { Paperclip, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { contactMap } from '../lib/logic';
import { buildSuggestions } from '../lib/suggestions';
import { useGameStore } from '../store/useGameStore';
import { EvidenceSheet } from './EvidenceSheet';

interface ComposerProps {
  contactId: string;
}

export function Composer({ contactId }: ComposerProps) {
  const [text, setText] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const sendMessage = useGameStore((s) => s.sendMessage);
  const sendEvidence = useGameStore((s) => s.sendEvidence);
  const typing = useGameStore((s) => s.typingContactId);
  const gameOver = useGameStore((s) => s.gameOver);
  const solved = useGameStore((s) => s.solved);

  const messages = useGameStore((s) => s.messages);
  const contacts = useGameStore((s) => s.contacts);
  const revealedSecretIds = useGameStore((s) => s.revealedSecretIds);
  const claims = useGameStore((s) => s.claims);
  const evidenceOwned = useGameStore((s) => s.evidenceOwned);
  const missions = useGameStore((s) => s.missions);

  const disabled = Boolean(typing) || gameOver || solved;
  const contact = contactMap[contactId];
  const contactMessages = messages[contactId] ?? [];

  const suggestions = useMemo(() => {
    if (!contact || disabled) return [];

    return buildSuggestions({
      contact,
      trust: contacts[contactId]?.trust ?? 0,
      revealedSecretIds,
      claims: claims.filter((claim) => claim.contactId === contactId),
      evidenceOwned,
      sentEvidenceIds: contactMessages
        .filter((message) => message.attachment)
        .map((message) => message.attachment!.evidenceId),
      activeMission: missions.find((mission) => mission.active && !mission.completed),
      seed: contactMessages.length
    });
  }, [
    contact,
    contactId,
    contactMessages,
    contacts,
    claims,
    evidenceOwned,
    revealedSecretIds,
    missions,
    disabled
  ]);

  const submit = async () => {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    await sendMessage(contactId, value);
  };

  const runSuggestion = async (suggestion: (typeof suggestions)[number]) => {
    if (suggestion.kind === 'send_evidence') {
      setSheetOpen(false);
      await sendEvidence(contactId, suggestion.evidenceId);
      return;
    }

    setText(suggestion.text);
  };

  return (
    <>
      <div className="border-t border-slate-200 bg-white/90 p-3 glass dark:border-white/10 dark:bg-slate-900/90">
        {suggestions.length > 0 ? (
          <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                disabled={disabled}
                title={suggestion.hint}
                onClick={() => {
                  void runSuggestion(suggestion);
                }}
                className={
                  suggestion.kind === 'send_evidence'
                    ? 'shrink-0 rounded-full border border-emerald-300/60 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20'
                    : 'shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200'
                }
              >
                {suggestion.kind === 'send_evidence' ? `📎 ${suggestion.label}` : suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            disabled={disabled || evidenceOwned.length === 0}
            onClick={() => setSheetOpen(true)}
            className="rounded-full p-3 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10"
            title="Enviar prueba"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={disabled}
            placeholder="Escribe un mensaje..."
            className="min-h-[48px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-slate-500"
          />

          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="rounded-full bg-emerald-500 p-3 text-white shadow-lg transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      <EvidenceSheet open={sheetOpen} onClose={() => setSheetOpen(false)} contactId={contactId} />
    </>
  );
}
