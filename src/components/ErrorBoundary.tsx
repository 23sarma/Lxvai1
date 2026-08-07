import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Aegis App:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('aegis_ai_chat_history_v3');
      localStorage.removeItem('aegis_ai_memory_bank_v3');
      localStorage.removeItem('aegis_ai_sub_agents_v3');
      localStorage.removeItem('aegis_ai_bg_learning_logs_v3');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-cyan-500 selection:text-slate-950">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center relative overflow-hidden">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-mono shadow-lg shadow-rose-500/10">
              🛡️
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">AEGIS RECOVERY ENGINE</h2>
              <p className="text-xs text-slate-400 font-mono">
                Intercepted a render state exception. System recovered safely.
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left font-mono text-[11px] text-rose-300 overflow-x-auto max-h-36">
              <p className="font-bold text-rose-400 mb-1">Diagnostic Log:</p>
              <p>{this.state.error?.message || String(this.state.error)}</p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs rounded-xl shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>🔄 Reset State & Relaunch Aegis AI</span>
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
