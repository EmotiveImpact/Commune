# Commune — Competitive Research & Market Analysis

**Date:** March 2026
**Purpose:** Deep competitive review to inform product strategy and identify market gaps

---

## Market Size

| Market | Size (2025) | Projected | Growth |
|--------|------------|-----------|--------|
| Bill Splitting Apps | $612M | $658M (2026) | 7.3% CAGR |
| Expense Management Software | $7.7B | $13.8B (2031) | 10.1% CAGR |
| Co-Living Market | $7.7-8.3B | $16B+ (2030) | 13.5% CAGR |
| Embedded Finance | — | $570.9B (2030) | Explosive |

**Key stat:** 85+ million U.S. adults used a bill splitting app at least once in 2024.

---

## Competitor Analysis

### 1. Splitwise (Market Leader)

**What it does:** Tracks shared expenses among groups. Users log expenses, choose split methods, and the app calculates who owes whom. "Simplify debts" feature minimizes transactions.

**Ratings:**
- Google Play: 4.22/5 (190K+ ratings)
- App Store: 4.8/5
- Trustpilot: **1.8/5** (65% are 1-star)

**Revenue:** ~$6.6M annual on ~31M downloads ($0.21 per download — deep monetization problems)

**Pricing:** Free (crippled) / Pro ~$4.99/mo or ~$50/yr

**Strengths:**
- Largest user base (network effect)
- Flexible split options (equal, percentage, shares, exact)
- Multi-currency support
- Receipt scanning (Pro)

**Critical weaknesses (from Trustpilot, Reddit, G2):**
1. Daily expense cap (3-5/day on free tier) — #1 complaint everywhere
2. 10-second countdown timer before each free expense
3. Aggressive upselling modals and ad bombardment
4. No communication about changes — users blindsided
5. Multi-currency paywalled
6. No draft saving — switching apps loses input
7. Deletion affects everyone — one member deleting removes for all
8. No item-level splitting
9. Payment processing issues
10. Confusing dashboard after recent updates

**User sentiment:** "One of the most blatant examples of a cash grab ever"

---

### 2. Tricount

**What it does:** Group expense sharing focused on simplicity. Recently acquired by bunq (European neobank).

**Ratings:**
- Google Play: 4.84/5 (160K+ ratings)
- App Store: 4.9/5
- Trustpilot: 3.5/5

**Pricing:** Now 100% free (post-bunq acquisition)

**Strengths:**
- Completely free, no ads, no daily limits
- No account required to participate
- Clean, intuitive UX
- Splitwise data import
- 21 million users (strong in Europe)

**Critical weaknesses:**
- Post-bunq acquisition causing data loss during updates
- Web version removed
- CSV export removed
- Sync bugs — expenses disappear and reappear
- No receipt scanning
- No item-level splitting
- Customer support shifted to AI chatbots
- Safety score: 59.2/100

---

### 3. Settle Up

**What it does:** Cross-platform group expense tracker with advanced splitting features.

**Pricing:** Free (unlimited, ad-supported) / Premium ~$0.99/mo or ~$11/yr

**Strengths:**
- Unlimited free transactions (no daily caps)
- Weighted contributions (couples count as 2, singles as 1)
- Multiple payers per expense
- Works on all platforms (iOS, Android, Windows, web)
- Offline mode with sync

**Weaknesses:**
- Sync is terrible — "out of 50 sync attempts, only 1 works"
- Users see different balances despite showing as synced
- Ads described as "way too invasive"
- UI requires multiple clicks, lacks intuitiveness
- Missing features in newer versions

---

### 4. Splid

**Pricing:** Free / one-time $4.99 upgrade

**Strengths:** No account creation, works offline, 150+ currencies free, no ads, clean UI

**Weaknesses:** Extremely basic. No receipt scanning, no payment integrations, not designed for ongoing use.

---

### 5. Cospend / IHateMoney (Open Source)

**What they do:** Self-hosted expense sharing tools (IHateMoney is Python/Flask, Cospend is a Nextcloud app).

**Pricing:** Free, open source

**Strengths:** Full data ownership, no ads, no tracking, self-hostable

**Weaknesses:** Requires technical knowledge, no mobile apps, minimal UI/UX, no real-time sync, only practical for the self-hosting niche.

---

### 6. Billr / Tab (Restaurant-Only)

Narrow-scope tools for splitting restaurant bills by item. Not group expense managers. Different niche entirely.

---

## What People On Social Media Are Asking For

### Top Feature Requests (ranked by frequency across Reddit, Trustpilot, G2)

1. **Item-level receipt splitting** — No major app lets you scan a receipt and assign items to people
2. **Integrated payments** — Most apps are ledgers only; actual payment requires leaving for Venmo/PayPal
3. **Recurring expense automation** — Roommate apps lack auto-entry for fixed monthly bills
4. **Smart settlement optimization** — Most create chains instead of minimizing transactions
5. **Export / reporting** — Users want CSV, PDF, year-over-year comparisons
6. **No-download group joining** — Web-based access via shared link
7. **Bank account integration** — Auto-detect shared expenses from bank feeds
8. **Per-trip pricing** — 7-10 day pricing for travel, not monthly subscriptions
9. **All-in-one household management** — Expenses + chores + groceries + communication in one app
10. **Couples account** — 501-vote Splitwise request, never implemented since 2016

### What Users Love (across all apps)

1. Speed of adding an expense (low friction)
2. Clear "who owes whom" summary
3. Not needing everyone to download the app
4. Offline capability
5. Multi-currency that just works
6. Free and no ads

### What Users Hate (across all apps)

1. Paywalling basic features (Splitwise worst offender)
2. Requiring all group members to download and sign up
3. Lack of receipt scanning / OCR
4. No item-level splitting
5. Poor multi-currency handling
6. Buggy sync / data loss
7. No draft saving
8. Invasive ads on free tiers

---

## Pricing Psychology

- Users expect core expense splitting to be free
- They'll pay a one-time fee ($5-10) more readily than a subscription
- $3-5/month for expense splitting seen as excessive
- Market moving toward fully free (Tricount) or one-time purchase (Splid $4.99)
- Per-user freemium in a network-effect product is destructive (Splitwise proved this)
- Per-group pricing better aligns with value creation

---

## The Gap Nobody Has Filled

### The "Resident Gap"
Co-living management software exists (ColivHQ, Bidrento, Livinsoft) but all serve **landlords/operators**, not residents. There is no purpose-built tool for people who live together to manage their shared finances, responsibilities, and coordination.

### The "All-in-One Gap"
Reddit users cobble together 3-4 separate apps:
- Splitwise for expenses
- OurHome/Tody for chores
- Shared shopping lists (Apple Notes, AnyList)
- WhatsApp for communication

No app handles all of these well in one place.

### The "Trust Crisis"
Splitwise's monetization pivot has created fear: users worry any paid app could eventually bait-and-switch. This drives interest in transparent pricing, open source, and one-time purchases.

---

## The Friendship-Destroying Stat

> **50% of Gen Z and millennial travelers** have experienced money-related disagreements on trips.
> **20% reported a friendship ended** due to a money issue on a group trip.

The problem Commune solves is relational, not just administrative.

---

## Emerging Trends

| Trend | Maturity | Relevance |
|-------|----------|-----------|
| AI auto-categorization | Mainstream in enterprise | High |
| Open banking / Plaid | Growing rapidly | High |
| Embedded finance APIs | Mature infrastructure | High |
| Smart contracts / crypto | Very early, niche | Low |
| Voice/NLP interfaces | Emerging | Medium |
| PWA / offline-first | Growing | Medium |
| Challenger bank features | Nibbling | Medium |

### Challenger Banks
- Monzo launched "Monzo Split" for ongoing household expenses
- Revolut added group expense tracking with instant splitting
- But these are features-inside-a-banking-app, not dedicated solutions

---

## Where Commune Fits

**The timing is rare.** The dominant player (Splitwise) is actively burning trust. The main alternative (Tricount) is destabilized by an acquisition. The co-living market is growing at 13.5% CAGR. And nobody has built the obvious product.

**Commune's positioning:** Not a bill splitter. A shared space operating system. The hub model (identity + finances + responsibilities + coordination) is fundamentally different from everything on the market.

**What we built that nobody else has:**
- Hub system with group identity (cover photos, avatars, pinned messages)
- Member profiles with settlement status and quick pay
- Cross-hub command centre with smart nudges
- Expense approval flows
- Chore/task management with rotation
- House essentials (Wi-Fi, bins, landlord, emergency)
- Couple mode (linked financial unit)
- Member proration for mid-cycle joins/leaves
- Group funds / shared pots
- Monthly cycle close
- 6 group types with sub-types and contextual UI
- Smart settlement with cross-group debt netting

---

## Sources

- [Splitwise on Trustpilot](https://www.trustpilot.com/review/splitwise.com)
- [Tricount on Trustpilot](https://www.trustpilot.com/review/tricount.com)
- [Splitwise on Google Play](https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile)
- [Tricount on Google Play](https://play.google.com/store/apps/details?id=com.tribab.tricount.android)
- [Splitwise on ComplaintsBoard](https://www.complaintsboard.com/splitwise-b149630)
- [Splitwise Feedback Portal](https://feedback.splitwise.com/forums/162446-general/)
- [Kimola Feedback Report — Splitwise](https://kimola.com/reports/splitwise-app-feedback-report-uncover-user-insights-google-play-en-144452)
- [Reddit — Beyond Splitwise](https://www.oreateai.com/blog/beyond-splitwise-navigating-the-reddit-landscape-for-group-expense-solutions/)
- [TechnoFino — Splitwise is Useless Without Pro](https://technofino.in/community/threads/splitwise-is-useless-without-pro-now.19199/)
- [Spliit Blog — Open Source Alternative](https://spliit.app/blog/we-need-an-open-source-alternative-to-splitwise)
- [SplitPro Blog](https://splitpro.app/blog/need-for-splitwise-alternative)
- [Rick Steves Forum — Expense Sharing Apps](https://community.ricksteves.com/travel-forum/tech-tips/recommendations-for-expense-sharing-apps-but-there-s-a-catch)
- [G2 Expense Management Category](https://www.g2.com/categories/expense-management)
- [Mordor Intelligence — Expense Management Market](https://www.mordorintelligence.com/industry-reports/expense-management-software-market)
- [Grand View Research — Co-Living Market](https://www.grandviewresearch.com/industry-analysis/co-living-market-report)
- [PR Newswire — Bill Splitting Apps Market](https://www.prnewswire.com/news-releases/bill-splitting-apps-market-size-to-grow-by-usd-349-68-million)
