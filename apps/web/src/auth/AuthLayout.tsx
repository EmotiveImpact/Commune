import type { ReactNode } from "react";
import { Link } from "wouter";
import type { Story } from "@commune/core/stories";
import { AuthStory, InviteScene } from "../stories/StoryParts";

/**
 * `story`: the opening story to show beside the form (sign-in, sign-up).
 * `invite`: the invitation page's panel instead, which never shows the cast.
 */
export function AuthLayout({ children, story, invite }: { children: ReactNode; story?: Story; invite?: { communeName?: string; role?: string } }) {
  const year = new Date().getFullYear();
  return (
    <div className="commune-auth-shell">
      <header className="commune-auth-brand">
        <div className="commune-auth-brand-top">
          <img src="/logo.png" alt="Commune" width={44} height={44} />
          <span className="commune-auth-word">Commune</span>
          <span className="commune-auth-tag">for people who do life, together.</span>
        </div>
        <div className="commune-auth-hero">
          <h1>Effortlessly manage your shared expenses.</h1>
          <p>Track group spending, settle balances, and keep shared money clear.</p>
        </div>
        {invite ? <InviteScene {...invite} /> : story ? <AuthStory story={story} /> : null}
        <p className="commune-auth-copy">© {year} Commune</p>
      </header>

      <div className="commune-auth-form-side">
        {/* Phones hide the brand panel, so its heading is repeated here for
            screen readers: every page keeps one h1. */}
        <header className="commune-auth-mobile-header">
          <img src="/logo.png" alt="" width={32} height={32} />
          <span>Commune</span>
          <em>for people who do life, together.</em>
          <h1 className="sr-only">Effortlessly manage your shared expenses.</h1>
        </header>
        <main className="commune-auth-form-wrap">
          {invite ? <div className="c-story-stack"><InviteScene {...invite} compact />{children}</div>
            : story ? <div className="c-story-stack"><AuthStory story={story} compact />{children}</div> : children}
        </main>
        <footer className="commune-auth-desktop-footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
        <footer className="commune-auth-mobile-footer">
          <span>© {year} Commune</span>
          <span className="commune-auth-legal-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}

export { Link };
