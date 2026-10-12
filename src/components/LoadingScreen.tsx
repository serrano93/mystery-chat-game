import { BrainCircuit, RefreshCw, ShieldAlert } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export function LoadingScreen() {
  const aiProgress = useGameStore((s) => s.aiProgress);
  const aiStatusText = useGameStore((s) => s.aiStatusText);
  const initAI = useGameStore((s) => s.initAI);
  const skipAI = useGameStore((s) => s.skipAI);
  const retryAI = useGameStore((s) => s.retryAI);
  const aiStatus = useGameStore((s) => s.aiStatus);

  const percent = Math.round(Math.max(0, Math.min(1, aiProgress)) * 100);

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.18),_transparent_45%)]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 shadow-premium glass">
          <BrainCircuit className="h-10 w-10 text-emerald-300" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Misterio en WhatsApp</h1>
        <p className="mt-2 text-sm text-slate-300">
          Preparando una experiencia narrativa con IA local. La primera carga puede tardar unos
          minutos.
        </p>

        <div className="mt-8 w-full rounded-full bg-white/10 p-1">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="mt-3 text-xs text-slate-400">{aiStatusText || 'Iniciando...'}</p>

        {aiStatus === 'error' || aiStatus === 'unsupported' ? (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-left text-sm text-amber-100">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Modo compatible
            </div>
            <p>
              Tu navegador o dispositivo no permite ejecutar la IA local con WebGPU. Puedes jugar con
              el motor narrativo local, menos libre pero estable.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => void initAI()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar IA local
          </button>

          <button
            onClick={skipAI}
            className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-400"
          >
            Jugar sin IA local
          </button>
        </div>

        <button
          onClick={retryAI}
          className="mt-4 text-xs font-medium text-slate-400 underline decoration-dotted underline-offset-4 transition hover:text-slate-200"
        >
          Forzar recarga del modelo
        </button>
      </div>
    </div>
  );
}
