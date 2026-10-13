import { FileText, Footprints, Mail, Sparkles, Watch, X } from 'lucide-react';
import { EVIDENCE } from '../data/case';
import { useGameStore } from '../store/useGameStore';
import type { AttachmentIcon } from '../types';
import { cn } from '../utils/cn';

const iconMap: Record<AttachmentIcon, any> = {
  footprints: Footprints,
  watch: Watch,
  mail: Mail,
  sparkles: Sparkles,
  file: FileText
};

interface EvidenceSheetProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
}

export function EvidenceSheet({ open, onClose, contactId }: EvidenceSheetProps) {
  const evidenceOwned = useGameStore((s) => s.evidenceOwned);
  const sendEvidence = useGameStore((s) => s.sendEvidence);
  const typing = useGameStore((s) => s.typingContactId);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/45 backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar" />
      <div className="relative z-10 w-full animate-sheet-up rounded-t-3xl border-t border-slate-200 bg-white p-4 shadow-premium dark:border-white/10 dark:bg-slate-900">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pruebas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Envía una pista para presionar o ganarte la confianza.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[45vh] space-y-3 overflow-y-auto scrollbar-thin pr-1">
          {evidenceOwned.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
              Aún no tienes pruebas. Habla con los sospechosos para conseguirlas.
            </div>
          ) : (
            evidenceOwned.map((id) => {
              const evidence = EVIDENCE[id];
              if (!evidence) return null;
              const Icon = iconMap[evidence.icon] ?? FileText;

              return (
                <button
                  key={id}
                  disabled={Boolean(typing)}
                  onClick={async () => {
                    onClose();
                    await sendEvidence(contactId, id);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition',
                    'hover:border-emerald-300 hover:bg-emerald-50',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    'dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10'
                  )}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{evidence.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {evidence.description}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
