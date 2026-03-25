import { ExpenseCategory } from '@commune/types';

export interface SpacePreset {
  title: string;
  summary: string;
  suggestedCategories: ExpenseCategory[];
  firstExpenseIdeas: string[];
  essentialSeeds: Record<string, string>;
}

const DEFAULT_PRESET: SpacePreset = {
  title: 'Shared space starter pack',
  summary: 'Capture the practical basics, log the first real spend, and give the group one clear operating rhythm.',
  suggestedCategories: [
    ExpenseCategory.MISCELLANEOUS,
    ExpenseCategory.UTILITIES,
    ExpenseCategory.WORK_TOOLS,
    ExpenseCategory.GROCERIES,
  ],
  firstExpenseIdeas: [
    'Log the first recurring cost the group will definitely see again.',
    'Write down the practical rules people ask for more than once.',
  ],
  essentialSeeds: {
    instructions: 'Access notes, key contacts, and recurring setup steps everyone needs.',
    rules: 'Shared expectations, boundaries, and who owns which recurring jobs.',
  },
};

const PRESETS_BY_TYPE: Record<string, SpacePreset> = {
  home: {
    title: 'Household starter pack',
    summary: 'Make recurring bills, cleaning expectations, and practical house notes obvious from day one.',
    suggestedCategories: [
      ExpenseCategory.RENT,
      ExpenseCategory.UTILITIES,
      ExpenseCategory.GROCERIES,
      ExpenseCategory.CLEANING,
    ],
    firstExpenseIdeas: [
      'Create the rent or utilities expense first so the dashboard starts with a real obligation.',
      'Capture cleaning or bins expectations before the first missed rotation.',
    ],
    essentialSeeds: {
      bins: 'Collection day, where bins live, and who pulls them out.',
      rules: 'Quiet hours, kitchen reset expectations, guest policy, and shared-space etiquette.',
    },
  },
  couple: {
    title: 'Couple starter pack',
    summary: 'Clarify what is shared, when you settle up, and the routines you do not want to renegotiate.',
    suggestedCategories: [
      ExpenseCategory.GROCERIES,
      ExpenseCategory.UTILITIES,
      ExpenseCategory.RENT,
      ExpenseCategory.ENTERTAINMENT,
    ],
    firstExpenseIdeas: [
      'Log the first genuinely shared household expense.',
      'Write down the spending rules or routines that keep the balance calm.',
    ],
    essentialSeeds: {
      calendar: 'Monthly money check-in, bill review rhythm, and who watches due dates.',
      rules: 'What counts as shared, personal, flexible, and worth discussing first.',
    },
  },
  workspace: {
    title: 'Workspace starter pack',
    summary: 'Make access, supplies, recurring space costs, and shared tool ownership visible before they become admin debt.',
    suggestedCategories: [
      ExpenseCategory.WORK_TOOLS,
      ExpenseCategory.INTERNET,
      ExpenseCategory.UTILITIES,
      ExpenseCategory.CLEANING,
    ],
    firstExpenseIdeas: [
      'Log rent, internet, or software spend so the workspace has a real financial baseline.',
      'Capture access and restocking notes before the first after-hours problem.',
    ],
    essentialSeeds: {
      access: 'Front-door access, guest rules, alarm steps, and after-hours contact.',
      supplies: 'What gets restocked, where it lives, and who notices when it is low.',
      subscriptions: 'Shared tools, software renewals, billing owner, renewal date, and cancellation notes.',
      vendors: 'Preferred suppliers, account owners, invoice routing, and who escalates billing issues.',
      rules: 'Guest policy, meeting-room reset rules, shared quiet norms, and shutdown expectations.',
    },
  },
  project: {
    title: 'Project starter pack',
    summary: 'Lock down the venue, budget-sensitive costs, and the handover context that keeps the work moving.',
    suggestedCategories: [
      ExpenseCategory.WORK_TOOLS,
      ExpenseCategory.TRANSPORT,
      ExpenseCategory.MISCELLANEOUS,
      ExpenseCategory.RENT,
    ],
    firstExpenseIdeas: [
      'Log the first production or project cost that needs visibility.',
      'Write the handover context the next person will need without asking around.',
    ],
    essentialSeeds: {
      handover: 'What changed, what is blocked, who owns the next step, and what must not be dropped.',
      equipment: 'Where gear lives, who can use it, and what needs to be returned or reset.',
      rules: 'Approval boundaries, communication rhythm, and production-specific safety or working rules.',
    },
  },
  trip: {
    title: 'Trip starter pack',
    summary: 'Keep the trip legible by making logistics, shared pot rules, and departure expectations visible early.',
    suggestedCategories: [
      ExpenseCategory.TRANSPORT,
      ExpenseCategory.GROCERIES,
      ExpenseCategory.ENTERTAINMENT,
      ExpenseCategory.MISCELLANEOUS,
    ],
    firstExpenseIdeas: [
      'Log the first transport or accommodation spend so the trip has a real cost baseline.',
      'Capture meetup and checkout expectations before the group splits up.',
    ],
    essentialSeeds: {
      stay: 'Address, room details, check-in process, and anything late arrivals need.',
      transport: 'Tickets, pickup plans, and fallback options if timings change.',
      checkout: 'Departure time, cleanup checklist, key return, and final shared spend check.',
    },
  },
  other: DEFAULT_PRESET,
};

const SUBTYPE_PRESETS: Record<string, Record<string, Partial<SpacePreset>>> = {
  home: {
    coliving: {
      title: 'Co-living starter pack',
      summary: 'Set expectations for communal life, shared meals, resident turnover, and shared notices without making the space feel bureaucratic.',
      suggestedCategories: [
        ExpenseCategory.GROCERIES,
        ExpenseCategory.HOUSEHOLD_SUPPLIES,
        ExpenseCategory.CLEANING,
        ExpenseCategory.UTILITIES,
        ExpenseCategory.RENT,
      ],
      firstExpenseIdeas: [
        'Log the first communal meal shop or shared groceries run.',
        'Capture the communal supplies budget — cleaning products, toiletries, shared pantry staples.',
        'Record the recurring bill that every resident depends on (internet, utilities, cleaner).',
      ],
      essentialSeeds: {
        rules: 'Welcome norms, cleaning cadence, guest expectations, and how communal decisions get surfaced.',
        meals: 'Communal meal schedule, dietary notes, shopping rota, and shared-kitchen expectations.',
        supplies: 'What gets restocked communally, where it lives, and who notices when it runs low.',
        onboarding: 'Move-in checklist, welcome tour notes, key contacts, and first-week orientation.',
      },
    },
    high_turnover: {
      title: 'High-turnover house share starter pack',
      summary: 'Optimize for joins, leaves, handovers, and not losing money or context between residents.',
      suggestedCategories: [
        ExpenseCategory.RENT,
        ExpenseCategory.UTILITIES,
        ExpenseCategory.CLEANING,
        ExpenseCategory.HOUSEHOLD_SUPPLIES,
      ],
      firstExpenseIdeas: [
        'Log the deposit or first rent payment so the financial baseline is clear from day one.',
        'Record the move-in cleaning fee or key deposit before it gets lost in chat.',
        'Capture the prorated utilities amount for the first partial month.',
      ],
      essentialSeeds: {
        rules: 'Move-in checklist, deposit expectations, cleaning standard, and key handover process.',
        handover: 'Key return process, forwarding address, meter readings, and room condition sign-off.',
        deposits: 'Deposit amount per room, who holds it, deduction rules, and return timeline.',
        inventory: 'Furnished items per room, condition notes, and what must be returned on move-out.',
      },
    },
  },
  workspace: {
    coworking: {
      title: 'Coworking starter pack',
      summary: 'Make guest access, desk booking, member etiquette, and shared-area resets obvious before the first busy week.',
      suggestedCategories: [
        ExpenseCategory.INTERNET,
        ExpenseCategory.WORK_TOOLS,
        ExpenseCategory.CLEANING,
        ExpenseCategory.HOUSEHOLD_SUPPLIES,
      ],
      firstExpenseIdeas: [
        'Log the internet or coffee/supplies subscription that keeps the space running.',
        'Record the cleaning or consumables restock cost so the baseline is visible.',
        'Capture any desk or meeting-room booking tool subscription.',
      ],
      essentialSeeds: {
        access: 'Front-door code, guest access rules, quiet-zone policy, and after-hours issue contact.',
        hours: 'Core access hours, staffed hours, after-hours policy, and holiday closures.',
        booking: 'Desk booking process, meeting-room rules, no-show policy, and how to reserve for guests.',
        subscriptions: 'Internet, coffee, cleaning, and software subscriptions with owner and renewal notes.',
        rules: 'Guest etiquette, meeting-room resets, call norms, and how shared areas should look at close.',
      },
    },
    shared_office: {
      title: 'Shared office starter pack',
      summary: 'Clarify office admin ownership, shared vendors, and who keeps the recurring bills from drifting.',
      firstExpenseIdeas: [
        'Log rent, internet, or the first shared software/tool renewal before it gets lost in someone else’s card.',
        'Capture lock-up, supply restock, and vendor contact notes before the office starts running on memory.',
      ],
      essentialSeeds: {
        access: 'Keys, opening hours, lock-up steps, and who can authorize extra access.',
        vendors: 'Landlord, internet provider, cleaners, and any approved suppliers with escalation contacts.',
        subscriptions: 'Shared software, telecoms, and office services with billing owners and renewal dates.',
        rules: 'Desk-sharing rules, equipment handling, and office close-down expectations.',
      },
    },
    team: {
      title: 'Team workspace starter pack',
      summary: 'Keep approvals, invoice routing, and recurring tools visible so the team does not depend on one person remembering everything.',
      suggestedCategories: [
        ExpenseCategory.WORK_TOOLS,
        ExpenseCategory.INTERNET,
        ExpenseCategory.UTILITIES,
        ExpenseCategory.MISCELLANEOUS,
      ],
      firstExpenseIdeas: [
        'Log the first shared software, contractor, or invoice-backed operating cost the team will need to review next month.',
        'Document who approves spend, where invoices land, and what gets escalated.',
      ],
      essentialSeeds: {
        approvals: 'Who can approve spend, what needs review first, and where exceptions are escalated.',
        billing: 'Invoice inbox, cost-centre notes, billing owner, and month-end closeout rhythm.',
        subscriptions: 'Shared tools, licenses, and renewals with owner, billing account, and cancellation notes.',
        vendors: 'Key suppliers, invoicing contacts, and the fallback person if a bill is wrong or late.',
      },
    },
    freelancers: {
      title: 'Freelancer collective starter pack',
      summary: 'Make pooled subscriptions, shared gear, and booking rules easy to see without turning the collective into office bureaucracy.',
      suggestedCategories: [
        ExpenseCategory.WORK_TOOLS,
        ExpenseCategory.INTERNET,
        ExpenseCategory.HOUSEHOLD_SUPPLIES,
        ExpenseCategory.CLEANING,
      ],
      firstExpenseIdeas: [
        'Log the first pooled software, internet, or studio supply cost so everyone sees the real baseline.',
        'Capture how shared gear is booked, borrowed, and returned before the first dispute.',
      ],
      essentialSeeds: {
        subscriptions: 'Shared software, mailing tools, booking platforms, and who owns each renewal.',
        equipment: 'Shared gear, storage rules, borrowing sign-off, and what must be returned after use.',
        booking: 'Desk or studio booking rules, access windows, no-show handling, and quiet-time expectations.',
        costs: 'Who fronts pooled software or supplies, when reimbursements happen, and what needs sign-off.',
        rules: 'Guest etiquette, quiet hours, space reset expectations, and how shared purchases get agreed.',
      },
    },
  },
  project: {
    production: {
      title: 'Production starter pack',
      summary: 'Bias setup toward budget visibility, gear accountability, and clear run-to-run handover notes so nothing falls through between shoots or sessions.',
      suggestedCategories: [
        ExpenseCategory.WORK_TOOLS,
        ExpenseCategory.TRANSPORT,
        ExpenseCategory.RENT,
        ExpenseCategory.MISCELLANEOUS,
      ],
      firstExpenseIdeas: [
        'Log the first venue hire, equipment rental, or transport cost the production will need to track.',
        'Record catering or per-diem spend so the daily run rate is visible immediately.',
        'Capture any gear rental or insurance deposit before it disappears into personal cards.',
      ],
      essentialSeeds: {
        handover: 'What the next run needs, what changed today, what is approved, and what is still at risk.',
        budget: 'Total budget, spend-to-date, approval thresholds, and who signs off on overages.',
        equipment: 'Gear list, storage location, checkout process, return condition expectations, and insurance notes.',
        callsheet: 'Daily schedule, crew contacts, location addresses, and contingency plan if timing shifts.',
      },
    },
    pop_up: {
      title: 'Pop-up starter pack',
      essentialSeeds: {
        location: 'Venue access, opening window, load-in path, and on-site contact.',
        rules: 'Setup sequence, customer-facing expectations, and full shutdown / pack-out ownership.',
      },
    },
  },
  trip: {
    festival: {
      title: 'Festival trip starter pack',
      summary: 'Keep the group connected, the shared pot visible, and the logistics clear even when signal drops and plans change fast.',
      suggestedCategories: [
        ExpenseCategory.TRANSPORT,
        ExpenseCategory.ENTERTAINMENT,
        ExpenseCategory.GROCERIES,
        ExpenseCategory.MISCELLANEOUS,
      ],
      firstExpenseIdeas: [
        'Log the ticket cost so the biggest shared expense is captured upfront.',
        'Record the group transport booking — van hire, fuel split, or train tickets.',
        'Capture the campsite or accommodation fee before it gets buried in one person\'s account.',
      ],
      essentialSeeds: {
        meetup: 'Primary meetup point, fallback meetup point, and how to reconnect if phones die.',
        tickets: 'Ticket type per person, booking reference, collection method, and any transfer rules.',
        campsite: 'Pitch or accommodation location, check-in process, site rules, and nearest facilities.',
        safety: 'Emergency contact, first-aid location, phone charging plan, and lost-person protocol.',
        rules: 'Shared spend expectations, safety boundaries, and the check-in rhythm for the group.',
      },
    },
    business_trip: {
      title: 'Business trip starter pack',
      suggestedCategories: [
        ExpenseCategory.TRANSPORT,
        ExpenseCategory.RENT,
        ExpenseCategory.WORK_TOOLS,
        ExpenseCategory.MISCELLANEOUS,
      ],
      essentialSeeds: {
        transport: 'Flight or train details, local transfer plan, and who owns rebooking if plans shift.',
        rules: 'What is reimbursable, what is shared, and what should be logged immediately.',
      },
    },
  },
};

function uniqueCategories(items: ExpenseCategory[]) {
  return [...new Set(items)];
}

export function getSpacePreset(
  groupType?: string | null,
  subtype?: string | null,
): SpacePreset {
  const base = PRESETS_BY_TYPE[groupType ?? 'other'] ?? DEFAULT_PRESET;
  const override: Partial<SpacePreset> =
    groupType && subtype ? SUBTYPE_PRESETS[groupType]?.[subtype] ?? {} : {};

  return {
    title: override.title ?? base.title,
    summary: override.summary ?? base.summary,
    suggestedCategories: uniqueCategories([
      ...(override.suggestedCategories ?? []),
      ...base.suggestedCategories,
    ]),
    firstExpenseIdeas: [
      ...(override.firstExpenseIdeas ?? []),
      ...base.firstExpenseIdeas,
    ],
    essentialSeeds: {
      ...base.essentialSeeds,
      ...(override.essentialSeeds ?? {}),
    },
  };
}

/**
 * Returns a refined subtype preset if one exists for the given groupType/subtype
 * combination. Returns `null` when no subtype-specific preset is defined, so
 * callers can decide whether to fall back to the base group-type preset.
 */
export function getSubtypePreset(
  groupType: string,
  subtype: string,
): SpacePreset | null {
  const subtypeOverride = SUBTYPE_PRESETS[groupType]?.[subtype];
  if (!subtypeOverride) return null;

  const base = PRESETS_BY_TYPE[groupType] ?? DEFAULT_PRESET;

  return {
    title: subtypeOverride.title ?? base.title,
    summary: subtypeOverride.summary ?? base.summary,
    suggestedCategories: uniqueCategories([
      ...(subtypeOverride.suggestedCategories ?? []),
      ...base.suggestedCategories,
    ]),
    firstExpenseIdeas: [
      ...(subtypeOverride.firstExpenseIdeas ?? []),
      ...base.firstExpenseIdeas,
    ],
    essentialSeeds: {
      ...base.essentialSeeds,
      ...(subtypeOverride.essentialSeeds ?? {}),
    },
  };
}
