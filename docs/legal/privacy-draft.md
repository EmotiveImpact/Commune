# Commune privacy notice — working draft, not for publication

This is a product-and-code-informed draft, **not legal advice or a final policy**. Do not link it from the live app until the bracketed decisions are resolved, the statements are checked against the deployed services, and the person responsible for Commune approves it. In particular, do not invent a company name or a contact address.

## Decisions needed before publication

1. **Who runs Commune?** [Legal name and postal address of the data controller; if no company is incorporated, identify the responsible individual/trading name.] **Privacy contact:** [working email address monitored for privacy requests]. `infra-accounts@ourcommune.io` is an infrastructure mailbox, not automatically the right public privacy contact.
2. **Where will this notice live?** Decided 9 October 2026: the app serves `/privacy` and `/terms` on `app.ourcommune.io`, signed in or out. Sign-up, the sign-in pages, Settings and the website link there. Until this notice is approved they carry a short factual summary of what the app does today; publishing this notice means replacing that summary in `apps/web/src/legal/LegalPages.tsx`.
3. **Lawful bases and retention:** Confirm each purpose/basis and set actual retention or deletion rules for accounts, shared ledger records, invites, notices, email logs and backups. No account deletion/export workflow or retention schedule has been verified in this release.
4. **Processors and transfers:** Verify the contracting entities, processing locations, subprocessors and transfer mechanism for Neon, Vercel and Resend. Do not state that data remains exclusively in the UK or EEA without evidence.
5. **Marketing/cookies/age:** Confirm whether analytics, marketing email, non-essential cookies, or under-18 accounts will be supported. None should be asserted as active merely because they may be planned. Describe any external image requests from the current UI after a browser check.
6. **Product behavior:** Verify the final signed-in production build and notification emails with test users. The repo says photos, avatars and payment-method hints are saved in browser session storage; this should be checked before publication. Commune currently records payment confirmations, but does not move money or store card details.

## Suggested plain-language notice

**Last updated:** [date approved]

Commune helps people in a shared household, workspace or trip keep track of expenses, balances, shared funds, notes and tasks. This notice explains what information we use when you visit or use the Commune app at `app.ourcommune.io`.

**Who is responsible and how to contact us.** Commune is operated by [legal controller name and address]. For questions or to exercise your privacy rights, email [privacy contact].

**Information we use.** When you create an account, we process your name, email address, sign-in credentials and verification status. When you use a commune, we process the details you and other members enter: commune names and locations, membership and invitations, expense and share records, fund pledges and contribution confirmations, notes, tasks, due dates, and reminder/notification history. Other members of a commune can see the information shared with that commune according to their role. We also process the technical information needed to run, secure and troubleshoot the service, such as authentication/session data and service logs. [Confirm log fields and retention.] If you choose a photo or avatar, the current app stores it in your browser session rather than uploading it for other members; [verify this in production].

**Why we use it.** We use account information to create and secure your account, verify your email and let you sign in. We use the information entered into communes to provide the shared-expense and coordination features you request, calculate balances, show activity, and send invitations and account messages. If an eligible member sends a Nudge or Chase, we create an in-app notice and, unless the recipient has opted out of reminder emails, attempt to send a transactional email. We use limited technical records to keep the service safe and diagnose failures. [For each purpose, confirm the lawful basis before publication: contract, legitimate interests, legal obligation or consent as appropriate. Do not treat this list as a determination.]

**Who receives it.** Other members of your commune may see shared records. We use Neon for database and account authentication, Vercel to host the web app, and Resend for account and reminder email delivery. These providers process information on our behalf under their own terms and data-processing arrangements. [Verify the exact service configuration, recipients, regions, and any international-transfer information.] We do not use the current app to take payments or store payment card details; members arrange transfers outside Commune, and a payer/admin can record that money was received.

**How long we keep it.** [Insert an actual schedule for active accounts, deleted accounts, shared records after a member leaves, invitations, reminders, email delivery records, logs, and backups, plus any legal/accounting exceptions. Implement the promised deletion workflow before claiming it.] Browser-session photos and display preferences are stored on the device [confirm clearing behavior].

**Your choices and rights.** You can change whether reminder emails are sent to you [verify the production control and distinguish it from the in-app Notices toggle]. Depending on the circumstances, you may ask to access, correct, erase, restrict or receive your personal information, or object to certain uses. Contact [privacy contact] to make a request. You may complain to the UK Information Commissioner's Office at `ico.org.uk`. [Confirm whether UK law is the governing privacy regime and add other relevant supervisory authorities if necessary.]

**Changes.** We may update this notice as the product and services change. We will show the date of the latest version here and give additional notice when required.

## Review basis

- Current app/backend behavior: `apps/web/src/state.tsx`, `apps/web/src/screens/Settings.tsx`, `apps/web/src/windows/Windows.tsx`, `infra/neon/migrations/0001_commune_core.sql`–`0010_reminder_usage.sql`, `infra/neon/README.md` (checked 2026-09-24). These are implementation evidence, not a substitute for checking live provider configuration.
- UK ICO guidance: [What privacy information should we provide?](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/), [How to write a privacy notice](https://ico.org.uk/for-organisations/advice-for-small-organisations/privacy-notices-and-cookies/how-to-write-a-privacy-notice-and-what-goes-in-it/), [Drafting privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/how-should-we-draft-our-privacy-information/). ICO guidance notes it is under review; obtain a current legal review before launch.
