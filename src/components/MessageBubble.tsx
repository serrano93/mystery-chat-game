import { Check, CheckCheck, FileText, Footprints, Mail, Sparkles, Watch } from 'lucide-react';
import type { AttachmentIcon, Message } from '../types';
import { cn } from '../utils/cn';
import { formatTime } from '../utils/date';

const iconMap: Record<AttachmentIcon, any> = {
  footprints: Footprints,
  watch: Watch,
  mail: Mail,
  sparkles: Sparkles,
  file: FileText
};

interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
}

export function MessageBubble({ message, isUser }: MessageBubbleProps) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center animate-fade-in-up">
        <div className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-300">
          {message.content}
        </div>
      </div>
    );
  }

  const Icon = message.attachment ? iconMap[message.attachment.icon] ?? FileText : null;

  return (
    <div className={cn('flex animate-fade-in-up', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-bubble',
          isUser
            ? 'rounded-tr-md bg-emerald-500 text-white dark:bg-emerald-600'
            : 'rounded-tl-md bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'
        )}
      >
        {message.attachment && Icon ? (
          <div
            className={cn(
              'mb-2 rounded-xl p-3',
              isUser ? 'bg-black/10' : 'bg-slate-100 dark:bg-white/10'
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  isUser ? 'bg-white/20' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{message.attachment.title}</p>
                <p
                  className={cn(
                    'mt-0.5 line-clamp-2 text-xs',
                    isUser ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {message.attachment.description}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>

        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-[10px]',
            isUser ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {isUser ? (
            message.status === 'read' ? (
              <CheckCheck className="h-3.5 w-3.5 text-sky-200" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
