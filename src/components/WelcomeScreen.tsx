import { ArrowRight, BadgeCheck, Lock } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useGameStore } from '../store/useGameStore';
import { cn } from '../utils/cn';
import { cleanPlayerName, sanitizePlayerName } from '../utils/player';

export function WelcomeScreen() {
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Se valida sobre el nombre ya limpiado: si alguien escribe solo símbolos,
  // cleanPlayerName devuelve cadena vacía y el botón sigue desactivado en vez
  // de dejarle jugar como "Detective" sin haberlo pedido.
  const cleaned = cleanPlayerName(name);
  const valid = cleaned.length >= 2;
  const preview = cleaned ? sanitizePlayerName(cleaned) : '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setPlayerName(cleaned);
  };

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.18),_transparent_45%)]" />
      <div className="noise" />

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 shadow-premium glass">
          <BadgeCheck className="h-10 w-10 text-emerald-300" />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
          Caso Vidal
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">Misterio en WhatsApp</h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Antes de abrir el expediente, necesito saber con quién hablo. ¿Cuál es tu nombre,
          detective?
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4 text-left">
          <div>
            <label
              htmlFor="player-name"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Nombre del detective
            </label>

            <input
              id="player-name"
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              placeholder="Escribe tu nombre..."
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-base text-white outline-none transition',
                'placeholder:text-slate-500',
                'focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20'
              )}
            />

            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <p className="text-slate-500">Mínimo 2 caracteres. Máximo 24.</p>

              {preview ? (
                <p className="truncate font-semibold text-emerald-300">Detective {preview}</p>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            disabled={!valid}
            className={cn(
              'group flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-semibold transition',
              valid
                ? 'bg-emerald-500 text-white shadow-lg hover:bg-emerald-400'
                : 'cursor-not-allowed bg-white/10 text-slate-500'
            )}
          >
            Abrir expediente
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" />
          <span>Tu nombre se guarda solo en este dispositivo.</span>
        </div>
      </div>
    </div>
  );
}
