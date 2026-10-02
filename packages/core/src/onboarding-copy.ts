/**
 * Onboarding contextual-sell copy. Keyed on `${type}-${subtype}` for type+subtype
 * specificity, with a generic fallback per type and a final fallback for unknown
 * combinations. Used by mobile and web onboarding screen 8 ("Here's how Commune
 * works for you").
 */

import { GroupType } from '@commune/types';

export interface ContextualSellCopy {
  /** Tag shown above the headline, e.g. "For flatmates · in a flat" */
  tag: string;
  /** Three numbered selling points, each title + caption */
  points: Array<{ title: string; caption: string }>;
  /** Optional reassurance line under the points */
  reassurance?: string;
}

export interface SubtypeOption {
  value: string;
  label: string;
  caption: string;
}

/**
 * Subtype options shown on screen 7. Empty array means the type has no subtypes
 * and screen 7 should be skipped automatically.
 */
export const SUBTYPE_OPTIONS_BY_TYPE: Record<string, SubtypeOption[]> = {
  [GroupType.HOME]: [
    { value: 'flat', label: 'Flat or apartment', caption: 'Rent + utilities split monthly' },
    { value: 'house', label: 'House', caption: 'Council tax, garden, repairs — bigger ticket items' },
    { value: 'student', label: 'Student halls', caption: 'Term-based rent, group orders, settle on the 30th' },
    { value: 'other', label: 'Other living arrangement', caption: "We'll keep things general" },
  ],
  [GroupType.COUPLE]: [
    { value: 'cohabiting', label: 'Married or cohabiting', caption: 'Share day-to-day finances' },
    { value: 'long_distance', label: 'Long-distance', caption: 'Multi-currency, settle when you visit' },
    { value: 'other', label: 'Other', caption: "We'll keep things flexible" },
  ],
  [GroupType.TRIP]: [
    { value: 'holiday', label: 'Holiday', caption: 'A getaway with friends or family' },
    { value: 'business', label: 'Business trip', caption: 'Reimbursable expenses, per-diem tracking' },
    { value: 'roadtrip', label: 'Roadtrip', caption: 'Petrol pot, per-driver split' },
    { value: 'other', label: 'Other trip', caption: 'Pick this if none fit' },
  ],
  [GroupType.PROJECT]: [
    { value: 'vendors', label: 'Vendors', caption: 'Track invoices and approval thresholds' },
    { value: 'project_team', label: 'Project team', caption: 'A delivery with a defined end date' },
    { value: 'agency', label: 'Agency', caption: 'Per-client groups, pass-through expenses' },
    { value: 'other', label: 'Other workspace', caption: "We'll keep things flexible" },
  ],
  [GroupType.OTHER]: [],
};

/**
 * Contextual sell copy. Use the type+subtype key when both are known; the bare
 * type key as fallback.
 */
const COPY: Record<string, ContextualSellCopy> = {
  // Flatmates
  [`${GroupType.HOME}-flat`]: {
    tag: 'For flatmates · in a flat',
    points: [
      { title: 'Rent posts itself every month', caption: 'Add it once as a recurring expense. Auto-splits between everyone, on rent day.' },
      { title: 'Bills + groceries on the go', caption: "Snap a receipt or just type the amount. Pick who paid and who's in." },
      { title: 'Settle up monthly — one tap each', caption: 'Smart-suggest reduces 6 messy payments to 2 clean ones. Pay through Revolut, Monzo, PayPal directly.' },
    ],
    reassurance: 'Average flat saves ~3 hours/month of "who paid what" admin.',
  },
  [`${GroupType.HOME}-house`]: {
    tag: 'For housemates',
    points: [
      { title: 'Council tax + utilities split', caption: 'Set them up once as recurring. Bigger bills handled the same way as rent.' },
      { title: 'Repairs, garden, one-offs', caption: 'Add ad-hoc costs in seconds. Split equally or by who used what.' },
      { title: 'Settle on bill cycle', caption: 'Smart-suggest minimises the number of payments. Free P2P on most rails.' },
    ],
  },
  [`${GroupType.HOME}-student`]: {
    tag: 'For student halls',
    points: [
      { title: 'Term-based rent + bills', caption: 'Set the cycle to match your term. Auto-splits between everyone every period.' },
      { title: 'Group orders + supplies', caption: 'Tesco runs, ramen night, that one big shop — log them in 10 seconds.' },
      { title: 'Settle term-end with one tap', caption: 'Smart-suggest reduces N payments to ~2 each. No spreadsheets.' },
    ],
  },
  [`${GroupType.HOME}-other`]: {
    tag: 'For your shared home',
    points: [
      { title: 'Recurring bills auto-split', caption: 'Set them up once and Commune handles the rest.' },
      { title: 'Bills + groceries on the go', caption: 'Add anything in seconds. Snap a receipt or type the amount.' },
      { title: 'Settle up cleanly', caption: 'Smart-suggest minimises payments. Pay through your wallet of choice.' },
    ],
  },

  // Couple
  [`${GroupType.COUPLE}-cohabiting`]: {
    tag: 'For couples · living together',
    points: [
      { title: 'Joint bills auto-split', caption: 'Rent, utilities, groceries — set them up once and forget.' },
      { title: 'Personal vs shared', caption: 'Separate what you split from what each of you pays alone.' },
      { title: 'See your monthly balance', caption: 'Who paid more this month? Who owes whom? One number to check.' },
    ],
  },
  [`${GroupType.COUPLE}-long_distance`]: {
    tag: 'For long-distance partners',
    points: [
      { title: 'Multi-currency awareness', caption: 'Add expenses in your local currency. Commune handles the conversion at log time.' },
      { title: 'Asynchronous logging', caption: 'Add what you spent when you can. Your partner sees it on their next open.' },
      { title: 'Settle when you visit', caption: 'Smart-suggest gives you one clean transaction next time you see each other.' },
    ],
  },
  [`${GroupType.COUPLE}-other`]: {
    tag: 'For your shared finances',
    points: [
      { title: 'Joint bills auto-split', caption: 'Set up recurring expenses once. Commune does the rest.' },
      { title: 'Personal vs shared', caption: 'Separate joint costs from individual ones cleanly.' },
      { title: 'Settle up easily', caption: 'Pay through your wallet of choice. Free P2P on most rails.' },
    ],
  },

  // Travel
  [`${GroupType.TRIP}-holiday`]: {
    tag: 'For your holiday',
    points: [
      { title: 'Quick add on the go', caption: 'Type the amount, pick who paid, done. Commune fills in the rest.' },
      { title: 'Currency awareness', caption: 'Add expenses in any currency. Auto-converts at log time.' },
      { title: 'Auto-settle on return', caption: 'Smart-suggest minimises payments. Close the trip and archive.' },
    ],
  },
  [`${GroupType.TRIP}-business`]: {
    tag: 'For your business trip',
    points: [
      { title: 'Receipt capture', caption: 'Snap every receipt — they stay attached to the expense for reimbursement.' },
      { title: 'Per-diem tracking', caption: 'Set a daily allowance, see how the trip is tracking.' },
      { title: 'Reimbursement export', caption: 'Export a clean spreadsheet at the end. Email or save.' },
    ],
  },
  [`${GroupType.TRIP}-roadtrip`]: {
    tag: 'For your roadtrip',
    points: [
      { title: 'Petrol pot', caption: 'Track who filled up where. Equal split or by-driver, your call.' },
      { title: 'Per-person spend', caption: 'See how much each person has shouldered without doing maths.' },
      { title: 'Settle at the end', caption: 'One clean transaction each. Free P2P on most rails.' },
    ],
  },
  [`${GroupType.TRIP}-other`]: {
    tag: 'For your trip',
    points: [
      { title: 'Add expenses fast', caption: 'Receipts, transport, food — type the amount, pick who paid.' },
      { title: 'Auto currency conversion', caption: 'Log in any currency. Commune handles the rest.' },
      { title: 'Settle when you get back', caption: 'Smart-suggest minimises payments. Archive the trip when done.' },
    ],
  },

  // Workspace / Project
  [`${GroupType.PROJECT}-vendors`]: {
    tag: 'For vendor management',
    points: [
      { title: 'Vendor + invoice fields', caption: 'Every expense captures vendor, invoice number, invoice date, payment due.' },
      { title: 'Approval thresholds', caption: 'Set a threshold above which expenses need explicit approval before settle.' },
      { title: 'Audit trail', caption: 'Every change logged. Export at any time for accounting.' },
    ],
  },
  [`${GroupType.PROJECT}-project_team`]: {
    tag: 'For project teams',
    points: [
      { title: 'Per-project ledger', caption: 'Keep delivery costs separate from your other groups.' },
      { title: 'Time-bounded', caption: 'Set a project end date. Auto-archive on close.' },
      { title: 'Close + report on delivery', caption: 'Export a clean expense report when the project wraps.' },
    ],
  },
  [`${GroupType.PROJECT}-agency`]: {
    tag: 'For agencies',
    points: [
      { title: 'Per-client groups', caption: 'Each client is its own group. Keep ledgers clean.' },
      { title: 'Pass-through expenses', caption: 'Track what you spent on the client vs what you billed back.' },
      { title: 'Markup tracking', caption: 'See your margin per client. Export for invoicing.' },
    ],
  },
  [`${GroupType.PROJECT}-other`]: {
    tag: 'For your workspace',
    points: [
      { title: 'Vendor + invoice fields', caption: 'Capture vendor, invoice number, dates on every expense.' },
      { title: 'Approval thresholds', caption: 'Big-ticket items need approval before settle.' },
      { title: 'Audit trail', caption: 'Every change logged. Export at any time.' },
    ],
  },

  // Other
  [`${GroupType.OTHER}-`]: {
    tag: 'For your group',
    points: [
      { title: 'Split anything fairly', caption: 'Equal, percentages, fixed amounts, or one person paid. Commune does the maths.' },
      { title: 'Add receipts on the go', caption: 'Snap or type. Pick who paid and who shares.' },
      { title: 'Settle in one tap', caption: 'Pay through Revolut, Monzo, PayPal directly. Free P2P on most rails.' },
    ],
  },
};

/**
 * Generic per-type fallback used when the subtype copy isn't found.
 */
const FALLBACK_BY_TYPE: Record<string, ContextualSellCopy> = {
  [GroupType.HOME]: COPY[`${GroupType.HOME}-other`]!,
  [GroupType.COUPLE]: COPY[`${GroupType.COUPLE}-other`]!,
  [GroupType.TRIP]: COPY[`${GroupType.TRIP}-other`]!,
  [GroupType.PROJECT]: COPY[`${GroupType.PROJECT}-other`]!,
  [GroupType.OTHER]: COPY[`${GroupType.OTHER}-`]!,
};

/**
 * Resolve contextual-sell copy for a given type + subtype combination.
 * Falls back to a generic per-type message if the subtype isn't recognised,
 * or to the OTHER copy if the type itself isn't one of the known group types.
 */
export function getContextualSellCopy(
  type: string | null | undefined,
  subtype: string | null | undefined,
): ContextualSellCopy {
  const t = (type ?? GroupType.OTHER) as string;
  if (subtype) {
    const exact = COPY[`${t}-${subtype}`];
    if (exact) return exact;
  }
  return FALLBACK_BY_TYPE[t] ?? COPY[`${GroupType.OTHER}-`]!;
}

/**
 * Acquisition source values stored on `profiles.acquisition_source`.
 * Frontend constrains to this list; the column is free-text for forward compat.
 */
export const ACQUISITION_SOURCES = [
  'tiktok',
  'instagram',
  'search',
  'reddit',
  'friend',
  'app_store',
  'youtube',
  'other',
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export interface AcquisitionSourceOption {
  value: AcquisitionSource;
  label: string;
}

export const ACQUISITION_SOURCE_OPTIONS: AcquisitionSourceOption[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'search', label: 'Search (Google)' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'friend', label: 'Friend or family' },
  { value: 'app_store', label: 'App Store / Play Store' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'other', label: 'Other' },
];
