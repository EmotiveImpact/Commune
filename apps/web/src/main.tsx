import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./state";
import { AppRecovery, RecoveryBoundary } from "./shell/Recovery";
import { watchErrors, watchSpeed } from "./live/reports";
// Before the app's own stylesheets, as its separate link was, so their rules still come after it.
import "./styles/calendar-date.css";
import "./styles/shared.css";
import "./styles/app.css";
import "./styles/auth.css";
import "./styles/legal.css";
import "./styles/overrides.css";
import "./styles/design-system.css";
import "./styles/fonts.css";

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
