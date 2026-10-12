import { RotateCcw, Trophy } from 'lucide-react';
import { ROOMS, SOLUTION, SUSPECTS, WEAPONS } from '../data/case';
import { useGameStore } from '../store/useGameStore';

export function ResultOverlay() {
  const solved = useGameStore((s) => s.solved);
  const gameOver = useGameStore((s) => s.gameOver);
  const resetGame = useGameStore((s) => s.resetGame);

  if (!solved && !gameOver) return null;

  const suspectLabel = SUSPECTS.find((s) => s.id === SOLUTION.suspectId)?.label ?? '???';
  const weaponLabel = WEAPONS.find((w) => w.id === SOLUTION.weaponId)?.label ?? '???';
  const roomLabel = ROOMS.find((r) => r.id === SOLUTION.roomId)?.label ?? '???';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm animate-fade-in-up rounded-3xl border border-white/10 bg-slate-900 p-6 text-center text-white shadow-premium">
        <div
          className={
            solved
              ? 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300'
              : 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 text-rose-300'
          }
        >
          {solved ? <Trophy className="h-8 w-8" /> : <RotateCcw className="h-8 w-8" />}
        </div>

        <h2 className="text-2xl font-bold">{solved ? 'Caso resuelto' : 'El caso se cierra'}</h2>

        <p className="mt-2 text-sm text-slate-300">
          {solved
            ? 'Has demostrado quién mató a Eduardo Vidal, con qué arma y dónde ocurrió todo.'
            : 'Has agotado los intentos. La verdad estaba más cerca de lo que parecías creer.'}
        </p>

        <div className="mt-5 rounded-2xl bg-white/5 p-4 text-left text-sm">
          <p className="text-slate-400">Solución</p>
          <p className="mt-1 font-semibold">
            {suspectLabel} · {weaponLabel} · {roomLabel}
          </p>
        </div>

        <button
          onClick={resetGame}
          className="mt-6 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-400"
        >
          Jugar otra vez
        </button>
      </div>
    </div>
  );
}
