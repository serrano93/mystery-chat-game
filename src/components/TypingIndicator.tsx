export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-bubble dark:bg-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-300" />
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-300" />
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-300" />
        </div>
      </div>
    </div>
  );
}
