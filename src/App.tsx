import { useEffect } from 'react';
import { AccuseModal } from './components/AccuseModal';
import { ChatView } from './components/ChatView';
import { ContactList } from './components/ContactList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { MissionPanel } from './components/MissionPanel';
import { ResultOverlay } from './components/ResultOverlay';
import { useGameStore } from './store/useGameStore';
import { cn } from './utils/cn';

export default function App() {
  const theme = useGameStore((s) => s.theme);
  const aiStatus = useGameStore((s) => s.aiStatus);
  const useFallback = useGameStore((s) => s.useFallback);
  const activeContactId = useGameStore((s) => s.activeContactId);
  const syncMissions = useGameStore((s) => s.syncMissions);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const state = useGameStore.getState();

    if (state.useFallback) {
      useGameStore.setState({
        aiStatus: 'fallback',
        aiStatusText: 'Modo narrativo local activo'
      });
    } else if (state.aiStatus === 'idle') {
      void state.initAI();
    }

    state.syncMissions();
  }, [syncMissions]);

  // Mientras no haya una decisión del jugador (IA lista o modo local elegido),
  // la pantalla de preparación sigue visible. Antes 'unsupported' y 'error'
  // caían directamente al juego y dejaban inalcanzables el selector de modelo
  // y los botones de reintento.
  const showLoader =
    aiStatus === 'idle' ||
    aiStatus === 'loading' ||
    aiStatus === 'unsupported' ||
    aiStatus === 'error';

  return (
    <ErrorBoundary>
      <div
        className={cn(
          'min-h-dvh w-full bg-slate-100 text-slate-900',
          'dark:bg-slate-950 dark:text-slate-100'
        )}
      >
        <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden border-x border-slate-200/70 bg-white/85 shadow-premium glass dark:border-white/10 dark:bg-slate-950/85">
          <div className="noise" />

          {showLoader ? (
            <LoadingScreen />
          ) : activeContactId ? (
            <ChatView />
          ) : (
            <ContactList />
          )}

          <MissionPanel />
          <AccuseModal />
          <ResultOverlay />
        </div>
      </div>
    </ErrorBoundary>
  );
}
