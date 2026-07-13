import { Component, type ReactNode } from "react";

// ponytail: minimal error boundary. A thrown render (corrupt shared link,
// bad persisted JSON, a node type we forgot to register) used to white-screen
// the whole canvas with no recovery — and the model lived in localStorage, so
// refresh just re-crashed. Catch, show a one-button recovery that wipes the
// localStorage mirror (the user keeps whatever they can still share via URL),
// and reload. No new deps, no logging service.
interface State {
  error: Error | null;
}
interface Props {
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  // wipe the persisted model so a refresh doesn't re-crash on the same payload.
  // shared links (#m=…) are URL-borne and survive — that's the durable copy.
  recover = () => {
    try {
      localStorage.removeItem("mc.model.v1");
    } catch {
      /* private mode */
    }
    if (location.hash.includes("m=")) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center"
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
          }}
        >
          <div className="text-[18px] font-[650] text-slate-900">Something went wrong</div>
          <div className="text-[13px] text-slate-500 max-w-[420px] leading-[1.6]">
            The canvas hit an unexpected error. Your model autosaves to this browser, so a refresh
            should restore it — but if it keeps failing, clear the local copy and start fresh.
            Shared links (#m=…) are untouched.
          </div>
          <pre className="text-[11px] text-red-500 bg-slate-50 px-3 py-2 rounded-lg max-w-[520px] overflow-auto">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            onClick={this.recover}
            className="px-4 py-2 rounded-lg bg-[#1e88e5] text-white text-[13px] font-[600] hover:bg-[#1976d2] transition-colors"
          >
            Clear local copy & reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
