import { useState } from "react";
import { seenStory } from "../stories/choose";
import { LoadingLines } from "../stories/StoryParts";

/**
 * Public layout only: never render account data before session verification.
 * Under the placeholders, the lines of the opening story this browser saw.
 */
export function PendingShell() {
  const [story] = useState(() => seenStory());
  return (
    <div className="a-body nav-basic a-pending" aria-busy="true" aria-label="Loading account">
      <div className="a-app" aria-hidden="true">
        <aside className="a-side">
          <div className="a-brand">
            <span className="a-wordmark">commune.</span>
          </div>
          <div className="a-pending-nav">
            {Array.from({ length: 8 }, (_, index) => <div className="a-pending-line" key={index} />)}
          </div>
        </aside>
        <main className="a-main">
          <div className="a-header"><div className="a-pending-line" /></div>
          <div className="a-content">
            <div className="a-pending-cards">
              {[0, 1].map((index) => <div className="a-pending-card" key={index}><div className="a-pending-line" /><div className="a-pending-line" /></div>)}
            </div>
            <LoadingLines story={story} />
          </div>
        </main>
      </div>
    </div>
  );
}
