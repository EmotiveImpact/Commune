import type { ReactNode } from "react";
import { Link } from "wouter";

export function AuthLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="commune-auth-shell">
      <div className="commune-auth-brand">
        <div className="commune-auth-brand-top">
          <img src="/logo.png" alt="Commune" width={44} height={44} />
          <span className="commune-auth-word">Commune</span>
          <span className="commune-auth-tag">— for people who do life, together.</span>
        </div>
        <div className="commune-auth-hero">
          <h1>Effortlessly manage your shared expenses.</h1>
          <p>Log in to track group spending, settle balances, and keep shared money clear.</p>
        </div>
        <p className="commune-auth-copy">© {year} Commune</p>
      </div>

      <div className="commune-auth-form-side">
        <div className="commune-auth-mobile-header">
          <img src="/logo.png" alt="" width={32} height={32} />
          <span>Commune</span>
          <em>— for people who do life, together.</em>
        </div>
        <div className="commune-auth-form-wrap">{children}</div>
        <div className="commune-auth-desktop-footer">
          <a href="https://ourcommune.io/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
        </div>
        <div className="commune-auth-mobile-footer">
          <span>© {year} Commune</span>
          <a href="https://ourcommune.io/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}

export { Link };
