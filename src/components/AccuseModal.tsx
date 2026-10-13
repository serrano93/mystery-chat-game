import { X } from 'lucide-react';
import { useState } from 'react';
import { ROOMS, SUSPECTS, WEAPONS } from '../data/case';
import { useGameStore } from '../store/useGameStore';

export function AccuseModal() {
  const show = useGameStore((s) => s.showAccuse);
  const setShow = useGameStore((s) => s.setShowAccuse);
  const accuse = useGameStore((s) => s.accuse);
  const failedAttempts = useGameStore((s) => s.failedAttempts);

  const [suspectId, setSuspectId] = useState(SUSPECTS[0]?.id ?? '');
  const [weaponId, setWeaponId] = useState(WEAPONS[0]?.id ?? '');
  const [roomId, setRoomId] = useState(ROOMS[0]?.id ?? '');

  if (!show) return null;

  const attemptsLeft = Math.max(0, 3 - failedAttempts);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-fade-in-up rounded-3xl border border-slate-200 bg-white p-5 shadow-premium dark:border-white/10 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Acusación final</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tienes {attemptsLeft} intento{attemptsLeft === 1 ? '' : 's'} restante
              {attemptsLeft === 1 ? '' : 's'}.
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Asesino
            </label>
            <select
              value={suspectId}
              onChange={(e) => setSuspectId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-white/10 dark:bg-white/5"
            >
              {SUSPECTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Arma
            </label>
            <select
              value={weaponId}
              onChange={(e) => setWeaponId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-white/10 dark:bg-white/5"
            >
              {WEAPONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Habitación
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-white/10 dark:bg-white/5"
            >
              {ROOMS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => accuse({ suspectId, weaponId, roomId })}
          className="mt-6 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-400"
        >
          Presentar acusación
        </button>
      </div>
    </div>
  );
}
