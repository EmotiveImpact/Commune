import type { GroupType } from '@commune/types';

export type OperationCategory =
  | 'cleaning'
  | 'supplies'
  | 'admin'
  | 'setup'
  | 'shutdown'
  | 'maintenance'
  | 'other';

export type OperationTaskType = 'recurring' | 'one_off' | 'checklist';

export interface OperationTemplate {
  title: string;
  description?: string;
  category: OperationCategory;
  task_type: OperationTaskType;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
  checklist_items?: string[];
  escalation_days?: number | null;
}

const HOME_TEMPLATES: OperationTemplate[] = [
  {
    title: 'Kitchen reset',
    description: 'Wipe surfaces, empty sink, and reset shared items.',
    category: 'cleaning',
    task_type: 'checklist',
    frequency: 'weekly',
    checklist_items: ['Clear counters', 'Wipe surfaces', 'Empty sink'],
    escalation_days: 1,
  },
  {
    title: 'Bins out',
    description: 'Put bins out and bring them back in after collection.',
    category: 'supplies',
    task_type: 'one_off',
    frequency: 'weekly',
    escalation_days: 0,
  },
  {
    title: 'House admin check',
    description: 'Check shared bills, notices, and anything that needs a reply.',
    category: 'admin',
    task_type: 'recurring',
    frequency: 'weekly',
    escalation_days: 2,
  },
];

const WORKSPACE_TEMPLATES: OperationTemplate[] = [
  {
    title: 'Open the space',
    description: 'Unlock, check common areas, and make the space ready.',
    category: 'setup',
    task_type: 'checklist',
    frequency: 'daily',
    checklist_items: ['Unlock', 'Check supplies', 'Turn on shared equipment'],
    escalation_days: 0,
  },
  {
    title: 'Restock supplies',
    description: 'Check coffee, paper, toiletries, and shared consumables.',
    category: 'supplies',
    task_type: 'checklist',
    frequency: 'weekly',
    checklist_items: ['Coffee / tea', 'Paper', 'Toiletries'],
    escalation_days: 2,
  },
  {
    title: 'Workspace admin review',
    description: 'Review invoices, subscriptions, and access issues.',
    category: 'admin',
    task_type: 'recurring',
    frequency: 'weekly',
    escalation_days: 2,
  },
];

const PROJECT_TEMPLATES: OperationTemplate[] = [
  {
    title: 'Run setup check',
    description: 'Confirm the team has what it needs before the next session.',
    category: 'setup',
    task_type: 'checklist',
    frequency: 'weekly',
    checklist_items: ['Venue ready', 'Gear ready', 'Schedule confirmed'],
    escalation_days: 1,
  },
  {
    title: 'Budget admin sweep',
    description: 'Update costs and flag anything that needs approval.',
    category: 'admin',
    task_type: 'recurring',
    frequency: 'weekly',
    escalation_days: 2,
  },
];

const TRIP_TEMPLATES: OperationTemplate[] = [
  {
    title: 'Arrival check-in',
    description: 'Make sure everyone knows the plan and any arrival changes.',
    category: 'setup',
    task_type: 'checklist',
    frequency: 'once',
    checklist_items: ['Transport confirmed', 'Accommodation confirmed', 'Emergency contact shared'],
    escalation_days: 0,
  },
  {
    title: 'Shared pot review',
    description: 'Check pooled spend and top up if needed.',
    category: 'admin',
    task_type: 'recurring',
    frequency: 'daily',
    escalation_days: 0,
  },
  {
    title: 'Departure reset',
    description: 'Make sure the space is clean and keys or gear are returned.',
    category: 'shutdown',
    task_type: 'checklist',
    frequency: 'once',
    checklist_items: ['Clean common area', 'Return keys', 'Check final bills'],
    escalation_days: 0,
  },
];

const DEFAULT_TEMPLATES: OperationTemplate[] = [
  {
    title: 'Weekly operations review',
    description: 'Review the recurring tasks that keep the group running.',
    category: 'admin',
    task_type: 'recurring',
    frequency: 'weekly',
    escalation_days: 2,
  },
];

const SUBTYPE_TEMPLATE_EXTRAS: Record<string, Record<string, OperationTemplate[]>> = {
  home: {
    coliving: [
      {
        title: 'Community welcome check',
        description: 'Review move-ins, shared notices, and common-space expectations.',
        category: 'admin',
        task_type: 'recurring',
        frequency: 'weekly',
        escalation_days: 2,
      },
    ],
    high_turnover: [
      {
        title: 'Room handover reset',
        description: 'Check keys, room condition, and move-out actions.',
        category: 'shutdown',
        task_type: 'checklist',
        frequency: 'once',
        checklist_items: ['Keys returned', 'Room checked', 'Outstanding bills reviewed'],
        escalation_days: 0,
      },
    ],
  },
  workspace: {
    coworking: [
      {
        title: 'Guest access sweep',
        description: 'Make sure guest access, meeting rooms, and shared areas are in order.',
        category: 'admin',
        task_type: 'recurring',
        frequency: 'weekly',
        escalation_days: 1,
      },
    ],
    shared_office: [
      {
        title: 'Close the office',
        description: 'Lock up, power down shared kit, and reset the space for tomorrow.',
        category: 'shutdown',
        task_type: 'checklist',
        frequency: 'daily',
        checklist_items: ['Lock doors', 'Power down shared equipment', 'Clear common surfaces'],
        escalation_days: 0,
      },
    ],
  },
  project: {
    production: [
      {
        title: 'Run wrap checklist',
        description: 'Confirm the team has wrapped and handed over critical context.',
        category: 'shutdown',
        task_type: 'checklist',
        frequency: 'weekly',
        checklist_items: ['Expenses logged', 'Gear accounted for', 'Handover notes shared'],
        escalation_days: 1,
      },
    ],
  },
  trip: {
    festival: [
      {
        title: 'Festival meetup sync',
        description: 'Confirm the next meetup point and emergency fallback plan.',
        category: 'setup',
        task_type: 'recurring',
        frequency: 'daily',
        escalation_days: 0,
      },
    ],
    business_trip: [
      {
        title: 'Receipt and claim check',
        description: 'Make sure reimbursable spend and shared costs are captured correctly.',
        category: 'admin',
        task_type: 'recurring',
        frequency: 'daily',
        escalation_days: 0,
      },
    ],
  },
};

const TEMPLATES_BY_TYPE: Record<string, OperationTemplate[]> = {
  home: HOME_TEMPLATES,
  workspace: WORKSPACE_TEMPLATES,
  project: PROJECT_TEMPLATES,
  trip: TRIP_TEMPLATES,
  couple: HOME_TEMPLATES,
  other: DEFAULT_TEMPLATES,
};

export function getOperationTemplates(
  groupType?: GroupType | string | null,
  subtype?: string | null,
): OperationTemplate[] {
  const baseTemplates: OperationTemplate[] =
    (groupType ? TEMPLATES_BY_TYPE[groupType] : undefined) ?? DEFAULT_TEMPLATES;
  const subtypeExtras: OperationTemplate[] =
    groupType && subtype
      ? SUBTYPE_TEMPLATE_EXTRAS[groupType]?.[subtype] ?? []
      : [];

  return [...baseTemplates, ...subtypeExtras];
}
