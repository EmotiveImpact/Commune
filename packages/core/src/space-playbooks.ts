import type { GroupType, SetupChecklistProgress } from '@commune/types';

export interface GroupSubtypeOption {
  value: string;
  label: string;
}

export interface AdminChecklistItem {
  id: string;
  label: string;
}

const HOME_SUBTYPES: GroupSubtypeOption[] = [
  { value: 'shared_house', label: 'Shared house (friends)' },
  { value: 'student_house', label: 'Student house' },
  { value: 'family_home', label: 'Family home' },
  { value: 'coliving', label: 'Co-living / intentional community' },
  { value: 'high_turnover', label: 'High-turnover house share' },
  { value: 'other_home', label: 'Other household' },
];

const COUPLE_SUBTYPES: GroupSubtypeOption[] = [
  { value: 'living_together', label: 'Living together' },
  { value: 'not_living_together', label: 'Not living together' },
  { value: 'engaged', label: 'Engaged / planning wedding' },
  { value: 'married', label: 'Married' },
];

const WORKSPACE_SUBTYPES: GroupSubtypeOption[] = [
  { value: 'coworking', label: 'Coworking space' },
  { value: 'shared_office', label: 'Shared office' },
  { value: 'team', label: 'Team / department' },
  { value: 'freelancers', label: 'Freelancer collective' },
];

const PROJECT_SUBTYPES: GroupSubtypeOption[] = [
  { value: 'production', label: 'Production / crew' },
  { value: 'creative_collective', label: 'Creative collective' },
  { value: 'community_project', label: 'Community project' },
  { value: 'pop_up', label: 'Pop-up / temporary space' },
];

const TRIP_SUBTYPES: GroupSubtypeOption[] = [
  { value: 'holiday', label: 'Holiday / vacation' },
  { value: 'weekend_trip', label: 'Weekend trip' },
  { value: 'festival', label: 'Festival / event' },
  { value: 'business_trip', label: 'Business trip' },
  { value: 'backpacking', label: 'Backpacking / long-term travel' },
];

const SUBTYPES_BY_TYPE: Record<string, GroupSubtypeOption[]> = {
  home: HOME_SUBTYPES,
  couple: COUPLE_SUBTYPES,
  workspace: WORKSPACE_SUBTYPES,
  project: PROJECT_SUBTYPES,
  trip: TRIP_SUBTYPES,
};

function item(id: string, label: string): AdminChecklistItem {
  return { id, label };
}

const BASE_ADMIN_CHECKLISTS: Record<string, AdminChecklistItem[]> = {
  home: [
    item('billing-cycle-owner', 'Confirm the billing cycle day and who owns the recurring bills.'),
    item('share-essentials', 'Share the practical essentials everyone needs on day one.'),
    item('balance-review-owner', 'Assign one person to review unresolved balances each cycle.'),
  ],
  couple: [
    item('shared-vs-personal-rules', 'Agree what counts as shared versus personal spending.'),
    item('recurring-check-in', 'Set a recurring check-in for balances, bills, or goals.'),
    item('shared-rules-captured', 'Capture the shared rules or routines you do not want to renegotiate.'),
  ],
  workspace: [
    item('vendor-admin-owner', 'Assign the person responsible for vendor, rent, and internet admin.'),
    item('document-access-hours-supplies', 'Document access, opening hours, and supply restocking rules.'),
    item('weekly-ops-review', 'Set one weekly operations review so the space does not drift.'),
  ],
  project: [
    item('approval-and-budget-lead', 'Assign one lead for approvals, spend visibility, and budget decisions.'),
    item('capture-venue-access-handover', 'Capture the venue, access, and handover context before work starts.'),
    item('temporary-contributor-flow', 'Decide how temporary contributors join, leave, and hand off work.'),
  ],
  trip: [
    item('confirm-core-logistics', 'Confirm transport, accommodation, and emergency details for everyone.'),
    item('shared-pot-owner', 'Choose who watches the shared pot and daily spend visibility.'),
    item('checkout-owner', 'Set a checkout owner so the end of the trip is not chaotic.'),
  ],
  other: [
    item('define-first-rules', 'Define the first shared rules and responsibilities.'),
    item('capture-access-and-contact', 'Capture the access and contact information everyone will need.'),
    item('first-month-owner', 'Pick one admin owner for the first month of operations.'),
  ],
};

const SUBTYPE_CHECKLIST_EXTRAS: Record<string, Record<string, AdminChecklistItem[]>> = {
  home: {
    coliving: [
      item('welcome-and-move-in-checklist', 'Set a welcome and move-in checklist for new residents.'),
      item('communal-notices-owner', 'Decide who owns shared purchasing and communal notices.'),
    ],
    high_turnover: [
      item('document-proration-and-deposits', 'Document proration, room handover, and deposit expectations.'),
      item('move-out-checklist', 'Set a move-out checklist that covers keys, cleaning, and balances.'),
    ],
  },
  workspace: {
    coworking: [
      item('guest-access-and-hosting-rules', 'Define guest access, hosting etiquette, and shared-area reset rules.'),
    ],
    shared_office: [
      item('open-close-owner', 'Assign who opens, closes, and escalates building issues.'),
    ],
    team: [
      item('approval-chain-owner', 'Document who approves spend, who logs invoices, and who escalates unusual costs.'),
      item('shared-tools-renewals', 'Capture the shared tools and subscriptions that need renewal visibility.'),
      item('monthly-closeout-owner', 'Set a monthly closeout for invoices, renewals, and budget overages.'),
    ],
    freelancers: [
      item('pooled-cost-owner', 'Decide who fronts pooled software, space, or supply costs and how they are reviewed.'),
      item('shared-equipment-rules', 'Capture the rules for borrowing shared gear, studio access, and space reset expectations.'),
      item('booking-and-usage-rhythm', 'Agree how desk or studio bookings work, how no-shows are handled, and when the space resets.'),
    ],
  },
  project: {
    production: [
      item('run-handover-checklist', 'Create a pre-run and post-run handover checklist for the crew.'),
    ],
    pop_up: [
      item('setup-shutdown-inventory-owner', 'Document setup, shutdown, and inventory return ownership.'),
    ],
  },
  trip: {
    festival: [
      item('festival-meetup-fallback', 'Set meetup fallback plans in case the group gets split up.'),
    ],
    business_trip: [
      item('business-trip-receipts-rules', 'Clarify receipts, reimbursements, and company-paid versus shared spend.'),
    ],
  },
};

export function getGroupSubtypeOptions(
  groupType?: GroupType | string | null,
): GroupSubtypeOption[] {
  if (!groupType) return [];
  return SUBTYPES_BY_TYPE[groupType] ?? [];
}

export function getAdminOnboardingChecklist(
  groupType?: GroupType | string | null,
  subtype?: string | null,
): string[] {
  return getAdminOnboardingChecklistItems(groupType, subtype).map((entry) => entry.label);
}

export function getAdminOnboardingChecklistItems(
  groupType?: GroupType | string | null,
  subtype?: string | null,
): AdminChecklistItem[] {
  const base = BASE_ADMIN_CHECKLISTS[groupType ?? 'other'] ?? BASE_ADMIN_CHECKLISTS.other!;
  const extras =
    groupType && subtype ? SUBTYPE_CHECKLIST_EXTRAS[groupType]?.[subtype] ?? [] : [];
  return [...base, ...extras];
}

export function createSetupChecklistProgress(
  groupType?: GroupType | string | null,
  subtype?: string | null,
  existing?: SetupChecklistProgress | null,
): SetupChecklistProgress {
  const items = getAdminOnboardingChecklistItems(groupType, subtype);

  return Object.fromEntries(
    items.map((entry) => {
      const current = existing?.[entry.id];
      return [
        entry.id,
        {
          label: entry.label,
          completed: current?.completed ?? false,
          completed_at: current?.completed ? current.completed_at ?? null : null,
        },
      ];
    }),
  );
}

export function countCompletedSetupChecklistItems(
  progress?: SetupChecklistProgress | null,
): number {
  return Object.values(progress ?? {}).filter((entry) => entry.completed).length;
}

export function getIncompleteSetupChecklistItems(
  progress?: SetupChecklistProgress | null,
): Array<{ id: string; label: string }> {
  return Object.entries(progress ?? {})
    .filter(([, entry]) => !entry.completed)
    .map(([id, entry]) => ({ id, label: entry.label }));
}
