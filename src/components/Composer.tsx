import { Paperclip, Send } from 'lucide-react';
import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { EvidenceSheet } from './EvidenceSheet';

interface ComposerProps {
  contactId: string;
}

const quickPrompts = ['¿Dónde estabas anoche?', 'Confío en ti.', 'Cuéntame lo que viste.'];

export function Composer({ contactId }: ComposerProps) {
  const [text, setText] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const sendMessage = useGameStore((s) => s.sendMessage);
  const typing = useGameStore((s) => s.typingContactId);
  const evidenceCount = useGameStore((s) => s.evidenceOwned.length);
  const gameOver = useGameStore((s) => s.gameOver);
  const solved = useGameStore((s) => s.solved);

  const disabled = Boolean(typing) || gameOver || solved;

  const submit = async () => {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    await sendMessage(contactId, value);
  };

  return (
    <>
      <div className="border-t border-slate-200 bg-white/90 p-3 glass dark:border-white/10 dark:bg-slate-900/90">
        <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              disabled={disabled}
              onClick={() => setText(prompt)}
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            disabled={disabled || evidenceCount === 0}
            onClick={() => setSheetOpen(true)}
            className="rounded-full p-3 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10"
            title="Enviar prueba"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
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
