import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-slate-100">
          <h1 className="text-2xl font-bold">Algo se rompió en la mansión</h1>
          <p className="max-w-sm text-sm text-slate-400">
            La interfaz encontró un error inesperado. Puedes recargar la página o reiniciar el caso.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-emerald-500 px-5 py-2 font-semibold text-white transition hover:bg-emerald-400"
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
