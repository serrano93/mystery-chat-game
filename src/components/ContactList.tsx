import { ChevronRight, ClipboardList, Lock, Moon, RotateCcw, ShieldAlert, Sun } from 'lucide-react';
import { CONTACTS } from '../data/case';
import { useGameStore } from '../store/useGameStore';
import type { Message } from '../types';
import { cn } from '../utils/cn';
import { formatTime } from '../utils/date';
import { Avatar } from './Avatar';

function previewMessage(message?: Message) {
  if (!message) return 'Sin mensajes';
  if (message.attachment) return `📎 ${message.attachment.title}`;
  return message.content;
}

export function ContactList() {
  const contacts = useGameStore((s) => s.contacts);
  const messages = useGameStore((s) => s.messages);
  const unread = useGameStore((s) => s.unread);
  const openContact = useGameStore((s) => s.openContact);
  const toggleTheme = useGameStore((s) => s.toggleTheme);
  const resetGame = useGameStore((s) => s.resetGame);
  const setShowAccuse = useGameStore((s) => s.setShowAccuse);
  const setShowMissions = useGameStore((s) => s.setShowMissions);
  const theme = useGameStore((s) => s.theme);
  const aiStatus = useGameStore((s) => s.aiStatus);
  const aiStatusText = useGameStore((s) => s.aiStatusText);
  const retryAI = useGameStore((s) => s.retryAI);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 px-4 pb-4 pt-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              Caso Vidal
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">Misterio en WhatsApp</h1>
            <p className="mt-1 text-sm text-slate-300">Resuelve el crimen desde el sofá.</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMissions(true)}
              className="rounded-full p-2 text-slate-200 transition hover:bg-white/10"
              title="Misiones"
            >
              <ClipboardList className="h-5 w-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-full p-2 text-slate-200 transition hover:bg-white/10"
              title="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setShowAccuse(true)}
              className="rounded-full p-2 text-slate-200 transition hover:bg-white/10"
              title="Acusar"
            >
              <ShieldAlert className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                if (confirm('¿Reiniciar el caso? Se perderá el progreso.')) resetGame();
              }}
              className="rounded-full p-2 text-slate-200 transition hover:bg-white/10"
              title="Reiniciar"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-thin bg-slate-50 dark:bg-slate-950/40">
        <div className="p-3">
          <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Contactos del caso
          </div>

          <div className="space-y-2">
            {CONTACTS.map((contact) => {
              const state = contacts[contact.id];
              const contactMessages = messages[contact.id] ?? [];
              const last = contactMessages[contactMessages.length - 1];
              const unreadCount = unread[contact.id] ?? 0;
              const locked = !state?.unlocked;

              if (locked) {
                return (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-3 opacity-70 dark:border-white/10 dark:bg-white/5"
                  >
                    <Avatar name="???" color="from-slate-500 to-slate-700" locked size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="blur-[3px] select-none font-semibold text-slate-700 dark:text-slate-200">
                        {contact.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        Contacto sellado
                      </p>
                    </div>
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                );
              }

              return (
                <button
                  key={contact.id}
                  onClick={() => openContact(contact.id)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/60 dark:bg-slate-900/70 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10"
                >
                  <Avatar name={contact.name} color={contact.color} size="md" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        {contact.name}
                      </p>
                      {last ? (
                        <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                          {formatTime(last.timestamp)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {previewMessage(last)}
                      </p>
                      {unreadCount > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                          {unreadCount}
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 dark:text-slate-600" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-3 text-xs glass dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={retryAI}
            className="min-w-0 rounded-xl px-1 py-1 text-left transition hover:bg-slate-100 dark:hover:bg-white/10"
            title="Elegir modelo o reintentar la IA local"
          >
            <p className="font-semibold text-slate-700 dark:text-slate-200">Motor narrativo</p>
            <p className="truncate text-slate-500 dark:text-slate-400">
              {aiStatusText || 'Preparando...'}
            </p>
          </button>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
              aiStatus === 'ready' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
              aiStatus === 'loading' && 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
              (aiStatus === 'fallback' || aiStatus === 'unsupported' || aiStatus === 'error') &&
                'bg-slate-500/15 text-slate-600 dark:text-slate-300'
            )}
          >
            {aiStatus === 'ready' ? 'IA local' : aiStatus === 'loading' ? 'Cargando' : 'Local'}
          </span>
        </div>
      </footer>
    </div>
  );
}
