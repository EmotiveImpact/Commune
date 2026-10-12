import type { ReactNode } from "react";
import { Link } from "wouter";

// These pages work signed in and signed out: sign-up, Settings and the
// website link here. They describe what the app does today. The fuller
// notice in docs/legal/privacy-draft.md replaces them once its owner
// decisions (who runs Commune, retention, lawful bases) are made.
const CONTACT = "support@ourcommune.io";

function LegalPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="commune-legal">
      <header className="commune-legal-bar">
        <Link href="/" className="commune-legal-brand">
          <img src="/logo.png" alt="" width={32} height={32} />
          <span>Commune</span>
        </Link>
      </header>
      <main className="commune-legal-main">
        <article className="commune-legal-panel">
          <h1>{title}</h1>
          <p className="commune-legal-lede">{lede}</p>
          {children}
        </article>
        <nav className="commune-legal-foot" aria-label="Commune information">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms of use</Link>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          <Link href="/">Open Commune</Link>
        </nav>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const contact = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      lede="How Commune handles your information today. A fuller privacy notice is being prepared and will replace this page."
    >
      <Section title="What Commune keeps">
        <p>Your name, email address and sign-in details, and what you and the other members of your communes add: the commune itself, who is in it, invitations, expenses and repayments, funds and pledges, recurring bills, notes, tasks, and the notices and reminders members send each other.</p>
        <p>Everyone in a commune can see what is shared in it. Admins can also see invitations and manage who is a member.</p>
      </Section>
      <Section title="What stays in your browser">
        <p>Photos you add, the payment details you keep for Pay me, and the commune you last opened are kept in this browser for your account until you sign out here. Display settings (theme, sidebar and notices) are kept in this browser for whoever uses it. None of this is sent to Commune’s database or shown to other members.</p>
      </Section>
      <Section title="Who helps run Commune">
        <p>Neon stores Commune’s data and runs sign-in. Vercel hosts the app. Resend delivers invitation and reminder emails. If you choose Google sign-in, Google handles it. Unsplash supplies the default cover photos. When your browser loads a cover photo, Unsplash receives your IP address, as with any website.</p>
      </Section>
      <Section title="Error reports">
        <p>If something goes wrong while you’re signed in, your browser sends Commune a short report: the kind of page (never which record), the error message and technical details, with record ids and email addresses removed and web addresses cut down to the page, the version of Commune and your browser’s family. On about one visit in ten it also sends three measures of how quickly the page loaded and responded.</p>
        <p>Reports are linked to your account only to limit how many can be sent. They are stored in Commune’s database at Neon, are not shown to other members, and are deleted after 30 days. Commune uses no third-party analytics.</p>
      </Section>
      <Section title="Money">
        <p>Commune records what people pay each other outside the app. It does not take payments, hold money or store card details.</p>
      </Section>
      <Section title="Emails">
        <p>Commune emails you to confirm your address, when someone invites you to a commune, and when a member sends you a reminder. You can turn reminder emails off in Settings.</p>
      </Section>
      <Section title="Questions and requests">
        <p>To ask what information Commune holds about you, or to have it corrected, sent to you or deleted, email {contact}.</p>
        <p>If you are unhappy with how your information is handled, you can complain to the Information Commissioner’s Office at <a href="https://ico.org.uk" rel="noreferrer">ico.org.uk</a>.</p>
      </Section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      lede="Commune’s full terms are being prepared and will replace this page. Until then, these are the basics of using Commune."
    >
      <Section title="What Commune does">
        <p>Commune helps people who share a home, a workspace or a trip keep track of shared costs, funds, notes and tasks. Balances are worked out from what members record.</p>
      </Section>
      <Section title="Money">
        <p>Commune does not move money. Members pay each other outside the app and record the payment in Commune. Check an amount with the person concerned before you pay it.</p>
      </Section>
      <Section title="Your account">
        <p>Use your own name and an email address you can read, and keep your password to yourself. If you think someone else has used your account, email {contact}.</p>
      </Section>
      <Section title="Sharing with other members">
        <p>What you add to a commune can be seen by its members, so only add what you are happy for them to see, and treat their information with the same care. Admins can invite and remove members.</p>
      </Section>
      <Section title="Fair use">
        <p>Use Commune lawfully and considerately. Do not use it to harass anyone, to chase money that is not owed, or to get round its limits or security.</p>
      </Section>
      <Section title="Questions">
        <p>Email {contact}.</p>
      </Section>
    </LegalPage>
  );
}
