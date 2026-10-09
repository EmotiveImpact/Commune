import { Component, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { reportError } from "../live/reports";
import { keepSearch } from "../nav";
import { useApp } from "../state";
import "./connection-recovery.css";

type BoundaryProps = {
  children: ReactNode;
  /** Shown in place of what failed to draw. Try again draws it again. */
  fallback: (retry: () => void) => ReactNode;
  /** Moving to another page or window starts afresh. */
  resetKey?: string;
};
type BoundaryState = { failed: boolean; resetKey?: string };

// React removes everything below a drawing error that nothing catches,
// which left a blank page. A boundary keeps the error to its own part of the
// page, shows a way on, and reports it.
export class RecoveryBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown) {
    reportError(error);
  }

  retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}

// The whole app failed to draw, so its state may be the fault: Home is a
// fresh page load.
export function AppRecovery({ retry }: { retry: () => void }) {
  return <main className="a-body c-connection-recovery">
    <span className="a-wordmark">commune.</span>
    <section className="c-connection-card" role="alert" aria-labelledby="recovery-title">
      <CircleAlert className="c-connection-icon" size={24} strokeWidth={1.5} aria-hidden="true" />
      <h1 id="recovery-title">Something went wrong</h1>
      <p>Commune couldn’t show this page. Try again, or go to Home.</p>
      <div className="c-connection-actions">
        <button className="a-btn" type="button" onClick={retry}>Try again</button>
        <button className="a-btn ghost" type="button" onClick={() => window.location.assign(keepSearch("/"))}>Go to Home</button>
      </div>
    </section>
  </main>;
}

/** One screen failed to draw: the navigation around it still works. */
export function ScreenRecovery({ retry }: { retry: () => void }) {
  const { go } = useApp();
  return <div className="a-empty" role="alert">
    <h2>This page couldn’t be shown.</h2>
    <p>Something went wrong while showing it. Try again, or go to Home.</p>
    <div className="c-connection-actions">
      <button className="a-btn" type="button" onClick={retry}>Try again</button>
      <button className="a-btn ghost" type="button" onClick={() => go("home")}>Go to Home</button>
    </div>
  </div>;
}

/** One window failed to draw: the screen behind it is untouched. */
export function WindowRecovery({ retry }: { retry: () => void }) {
  const { go } = useApp();
  return <div role="alert">
    <p>Something went wrong while showing this. Try again, or go to Home.</p>
    <div className="c-connection-actions">
      <button className="a-btn" type="button" onClick={retry}>Try again</button>
      <button className="a-btn ghost" type="button" onClick={() => go("home")}>Go to Home</button>
    </div>
  </div>;
}
