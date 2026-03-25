import { ExpenseCategory } from '@commune/types';

const ALL_CATEGORIES = Object.values(ExpenseCategory) as ExpenseCategory[];

const CATEGORY_ORDER: Record<string, ExpenseCategory[]> = {
  home: ['rent', 'utilities', 'internet', 'groceries', 'cleaning', 'household_supplies', 'transport', 'entertainment', 'work_tools', 'miscellaneous'] as ExpenseCategory[],
  trip: ['transport', 'groceries', 'entertainment', 'miscellaneous', 'utilities', 'rent', 'cleaning', 'household_supplies', 'internet', 'work_tools'] as ExpenseCategory[],
  couple: ['groceries', 'entertainment', 'utilities', 'rent', 'internet', 'transport', 'household_supplies', 'cleaning', 'work_tools', 'miscellaneous'] as ExpenseCategory[],
  workspace: ['work_tools', 'utilities', 'internet', 'cleaning', 'rent', 'transport', 'household_supplies', 'miscellaneous', 'groceries', 'entertainment'] as ExpenseCategory[],
  project: ['work_tools', 'transport', 'miscellaneous', 'utilities', 'internet', 'rent', 'cleaning', 'groceries', 'household_supplies', 'entertainment'] as ExpenseCategory[],
};

const SUBTYPE_CATEGORY_BOOSTS: Record<string, Record<string, ExpenseCategory[]>> = {
  home: {
    coliving: ['rent', 'utilities', 'groceries', 'cleaning', 'household_supplies'] as ExpenseCategory[],
    high_turnover: ['rent', 'utilities', 'cleaning', 'household_supplies', 'internet'] as ExpenseCategory[],
  },
  workspace: {
    coworking: ['internet', 'work_tools', 'cleaning', 'household_supplies', 'utilities'] as ExpenseCategory[],
    shared_office: ['rent', 'utilities', 'internet', 'work_tools', 'cleaning'] as ExpenseCategory[],
  },
  project: {
    production: ['work_tools', 'transport', 'rent', 'miscellaneous', 'utilities'] as ExpenseCategory[],
    pop_up: ['rent', 'transport', 'work_tools', 'miscellaneous', 'utilities'] as ExpenseCategory[],
  },
  trip: {
    festival: ['transport', 'entertainment', 'groceries', 'miscellaneous'] as ExpenseCategory[],
    business_trip: ['transport', 'rent', 'work_tools', 'miscellaneous'] as ExpenseCategory[],
  },
};

export function getCategoriesByGroupType(groupType?: string, subtype?: string | null): ExpenseCategory[] {
  if (!groupType || !CATEGORY_ORDER[groupType]) return ALL_CATEGORIES;
  const subtypeBoosts = subtype ? SUBTYPE_CATEGORY_BOOSTS[groupType]?.[subtype] ?? [] : [];
  const ordered = [...subtypeBoosts, ...CATEGORY_ORDER[groupType]];
  // Append any categories not in the order list (safety)
  const remaining = ALL_CATEGORIES.filter(c => !ordered.includes(c));
  return [...new Set([...ordered, ...remaining])];
}

const ONBOARDING_TIPS: Record<string, string[]> = {
  home: [
    'Set up recurring bills for rent and utilities',
    'Add your payment method so housemates can pay you',
    'Create auto-split templates for fixed bills',
  ],
  trip: [
    'Add your first shared trip expense',
    'Import from Splitwise if you are migrating',
    'Use quick expense entry for on-the-go logging',
  ],
  couple: [
    'Link your accounts to track as a unit',
    'Add your first shared expense',
    'Set a monthly budget together',
  ],
  workspace: [
    'Add shared workspace costs like rent, software, and internet',
    'Create templates for recurring charges and invoice reviews',
    'Assign who owns approvals, renewals, and vendor follow-up',
  ],
  project: [
    'Set a project budget to track spending',
    'Add team expenses as they happen',
    'Use categories to organize project costs',
  ],
  other: [
    'Add your first expense',
    'Invite group members',
    'Set up your payment method in Profile',
  ],
};

export function getOnboardingTips(groupType?: string): string[] {
  if (!groupType || !ONBOARDING_TIPS[groupType]) return ONBOARDING_TIPS.other!;
  return ONBOARDING_TIPS[groupType]!;
}
