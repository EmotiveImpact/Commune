// First, so the cascade layers' order is declared before any stylesheet that
// a component imports uses one (see styles/index.css).
import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./state";
import { AppRecovery, RecoveryBoundary } from "./shell/Recovery";
import { watchErrors, watchSpeed } from "./live/reports";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <RecoveryBoundary fallback={(retry) => <AppRecovery retry={retry} />}>
      <AppProvider>
        <App />
      </AppProvider>
    </RecoveryBoundary>
  </StrictMode>,
);
watchErrors();
watchSpeed();
