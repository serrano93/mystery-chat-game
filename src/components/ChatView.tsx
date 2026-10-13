import { ArrowLeft, ClipboardList, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { contactMap } from '../lib/logic';
import { useGameStore } from '../store/useGameStore';
import { cn } from '../utils/cn';
import { formatDaySeparator, isSameDay } from '../utils/date';
import { Avatar } from './Avatar';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export function ChatView() {
  const activeContactId = useGameStore((s) => s.activeContactId);
  const backToList = useGameStore((s) => s.backToList);
  const messages = useGameStore((s) => s.messages);
  const typingContactId = useGameStore((s) => s.typingContactId);
  const aiStatus = useGameStore((s) => s.aiStatus);
  const setShowAccuse = useGameStore((s) => s.setShowAccuse);
  const setShowMissions = useGameStore((s) => s.setShowMissions);

  const scrollRef = useRef<HTMLDivElement>(null);

  const contact = activeContactId ? contactMap[activeContactId] : null;
  const contactMessages = useMemo(
    () => (activeContactId ? messages[activeContactId] ?? [] : []),
    [activeContactId, messages]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [contactMessages.length, typingContactId]);

  if (!activeContactId || !contact) return null;

  const isTyping = typingContactId === activeContactId;

  const statusText = isTyping
    ? 'escribiendo...'
    : aiStatus === 'ready'
      ? 'en línea'
      : aiStatus === 'loading'
        ? 'conectando...'
        : 'modo local';

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 px-3 py-3 text-white shadow-lg">
        <button onClick={backToList} className="rounded-full p-2 transition hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <Avatar name={contact.name} color={contact.color} size="md" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{contact.name}</p>
          <p className={cn('truncate text-xs', isTyping ? 'text-emerald-300' : 'text-slate-300')}>
            {statusText}
          </p>
        </div>

        <button
          onClick={() => setShowMissions(true)}
          className="rounded-full p-2 transition hover:bg-white/10"
          title="Misiones"
        >
          <ClipboardList className="h-5 w-5" />
        </button>

        <button
          onClick={() => setShowAccuse(true)}
          className="rounded-full p-2 transition hover:bg-white/10"
          title="Acusar"
        >
          <ShieldAlert className="h-5 w-5" />
        </button>
      </header>

      <main
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto scrollbar-thin bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),_transparent_45%)] px-3 py-4 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.10),_transparent_40%)]"
      >
        {contactMessages.map((message, index) => {
          const prev = contactMessages[index - 1];
          const showDate = !prev || !isSameDay(prev.timestamp, message.timestamp);

          return (
            <div key={message.id} className="space-y-3">
              {showDate ? (
                <div className="flex justify-center py-2">
                  <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-300">
                    {formatDaySeparator(message.timestamp)}
                  </span>
                </div>
              ) : null}

              <MessageBubble message={message} isUser={message.role === 'user'} />
            </div>
          );
        })}

        {isTyping ? <TypingIndicator /> : null}
      </main>

      <Composer contactId={activeContactId} />
    </div>
  );
}
