import { CheckCircle2, ClipboardList, Lightbulb, Target, X } from 'lucide-react';
import { contactMap } from '../lib/logic';
import { missionHint, nextLatentMissionHint, type MissionHint } from '../lib/missionHints';
import { useGameStore } from '../store/useGameStore';
import type { Mission } from '../types';
import { cn } from '../utils/cn';

function objectiveLabel(
  mission: Mission,
  trust: number,
  hasEvidence: boolean,
  hasSecret: boolean,
  unlocked: boolean,
  exposed: boolean
): string {
  const objective = mission.objective;

  switch (objective.kind) {
    case 'trust': {
      const name = contactMap[objective.contactId]?.name ?? objective.contactId;
      return `Confianza con ${name}: ${trust}/${objective.value}`;
    }
    case 'evidence':
      return hasEvidence ? 'Prueba conseguida' : 'Conseguir una prueba';
    case 'secret':
      return hasSecret ? 'Secreto revelado' : 'Revelar un secreto';
    case 'unlock':
      return unlocked ? 'Contacto desbloqueado' : 'Desbloquear contacto';
    case 'expose_claim': {
      const name = contactMap[objective.contactId]?.name ?? objective.contactId;
      return exposed ? `Mentira expuesta: ${name}` : `Descubrir una mentira de ${name}`;
    }
    case 'accusation_correct':
      return 'Presentar la acusación correcta';
    default:
      return 'Objetivo';
  }
}

function HintButton({ hint }: { hint: MissionHint | null }) {
  const applyMissionHint = useGameStore((s) => s.applyMissionHint);
  const sendEvidence = useGameStore((s) => s.sendEvidence);
  const setShowMissions = useGameStore((s) => s.setShowMissions);
  const setShowAccuse = useGameStore((s) => s.setShowAccuse);

  if (!hint) return null;

  const unlocked = useGameStore.getState().contacts[hint.contactId]?.unlocked ?? false;

  const label = hint.action === 'send_evidence' ? '💡 Pista: enviar la prueba' : '💡 Pista';

  const handleClick = () => {
    if (hint.action === 'accuse') {
      setShowMissions(false);
      setShowAccuse(true);
      return;
    }
    if (hint.action === 'send_evidence' && hint.evidenceId && unlocked) {
      setShowMissions(false);
      void sendEvidence(hint.contactId, hint.evidenceId);
      return;
    }
    applyMissionHint({ contactId: hint.contactId, text: hint.text });
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-400/10">
      <button
        onClick={handleClick}
        disabled={!unlocked && hint.action !== 'accuse'}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
          unlocked || hint.action === 'accuse'
            ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]'
            : 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500'
        )}
      >
        <Lightbulb className="h-4 w-4 shrink-0" />
        {unlocked || hint.action === 'accuse' ? label : '💡 Pista: contacto aún bloqueado'}
      </button>
      <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200/80">
        {hint.why}
      </p>
      {hint.text && hint.action !== 'accuse' && hint.action !== 'send_evidence' ? (
        <p className="mt-1.5 break-words rounded-lg bg-white/70 p-2 font-mono text-[11px] text-slate-700 dark:bg-black/20 dark:text-slate-200">
          «{hint.text}»
        </p>
      ) : null}
    </div>
  );
}

export function MissionPanel() {
  const show = useGameStore((s) => s.showMissions);
  const setShow = useGameStore((s) => s.setShowMissions);
  const missions = useGameStore((s) => s.missions);
  const contacts = useGameStore((s) => s.contacts);
  const evidenceOwned = useGameStore((s) => s.evidenceOwned);
  const revealedSecretIds = useGameStore((s) => s.revealedSecretIds);
  const claims = useGameStore((s) => s.claims);

  if (!show) return null;

  const active = missions.filter((m) => m.active && !m.completed);
  const completed = missions.filter((m) => m.completed);

  const hintParams = { contacts, revealedSecretIds, evidenceOwned, claims };
  const latent =
    active.length === 0 && completed.length < missions.length
      ? nextLatentMissionHint({ missions, ...hintParams })
      : null;

  return (
    <div className="absolute inset-0 z-45 flex items-end justify-center bg-black/45 backdrop-blur-sm">
      <button
        className="absolute inset-0 cursor-default"
        onClick={() => setShow(false)}
        aria-label="Cerrar"
      />

      <div className="relative z-10 w-full animate-sheet-up rounded-t-3xl border-t border-slate-200 bg-white p-4 shadow-premium dark:border-white/10 dark:bg-slate-900">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Misiones</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Objetivos del inspector García
              </p>
            </div>
          </div>

          <button
            onClick={() => setShow(false)}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto scrollbar-thin pr-1">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              En curso
            </h4>

            {active.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                {latent ? (
                  <>
                    <p>No hay misiones activas, pero el caso sigue abierto. Este es tu siguiente paso:</p>
                    <p className="mt-2 font-semibold text-slate-700 dark:text-slate-200">
                      {latent.mission.title}
                    </p>
                    <HintButton hint={latent.hint} />
                  </>
                ) : completed.length >= missions.length && missions.length > 0 ? (
                  'Has completado todas las misiones. Presenta tu acusación final.'
                ) : (
                  'No hay misiones activas. Sigue hablando con los contactos.'
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {active.map((mission) => {
                  const objective = mission.objective;
                  const trust =
                    objective.kind === 'trust' ? contacts[objective.contactId]?.trust ?? 0 : 0;

                  const hasEvidence =
                    objective.kind === 'evidence' && evidenceOwned.includes(objective.evidenceId);

                  const hasSecret =
                    objective.kind === 'secret' && revealedSecretIds.includes(objective.secretId);

                  const unlocked =
                    objective.kind === 'unlock' && Boolean(contacts[objective.contactId]?.unlocked);

                  const exposed =
                    objective.kind === 'expose_claim' &&
                    claims.some(
                      (c) =>
                        c.contactId === objective.contactId &&
                        c.topic === objective.topic &&
                        c.exposed
                    );

                  const label = objectiveLabel(
                    mission,
                    trust,
                    hasEvidence,
                    hasSecret,
                    unlocked,
                    exposed
                  );

                  return (
                    <div
                      key={mission.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                          <Target className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {mission.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {mission.description}
                          </p>
                          <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            {label}
                          </p>
                          <HintButton hint={missionHint({ mission, ...hintParams })} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {completed.length > 0 ? (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Completadas
              </h4>

              <div className="space-y-2">
                {completed.map((mission) => (
                  <div
                    key={mission.id}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3',
                      'dark:border-emerald-500/20 dark:bg-emerald-500/10'
                    )}
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                        {mission.title}
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-200/70">
                        {mission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
