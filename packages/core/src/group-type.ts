import { ExpenseCategory } from '@commune/types';

const ALL_CATEGORIES = Object.values(ExpenseCategory) as ExpenseCategory[];

const CATEGORY_ORDER: Record<string, ExpenseCategory[]> = {
  home: ['rent', 'utilities', 'internet', 'groceries', 'cleaning', 'household_supplies', 'transport', 'entertainment', 'work_tools', 'miscellaneous'] as ExpenseCategory[],
  trip: ['transport', 'groceries', 'entertainment', 'miscellaneous', 'utilities', 'rent', 'cleaning', 'household_supplies', 'internet', 'work_tools'] as ExpenseCategory[],
  couple: ['groceries', 'entertainment', 'utilities', 'rent', 'internet', 'transport', 'household_supplies', 'cleaning', 'work_tools', 'miscellaneous'] as ExpenseCategory[],
  workspace: ['work_tools', 'utilities', 'internet', 'cleaning', 'rent', 'transport', 'household_supplies', 'miscellaneous', 'groceries', 'entertainment'] as ExpenseCategory[],
  project: ['work_tools', 'transport', 'miscellaneous', 'utilities', 'internet', 'rent', 'cleaning', 'groceries', 'household_supplies', 'entertainment'] as ExpenseCategory[],
};

export function getCategoriesByGroupType(groupType?: string): ExpenseCategory[] {
  if (!groupType || !CATEGORY_ORDER[groupType]) return ALL_CATEGORIES;
  const ordered = CATEGORY_ORDER[groupType];
  // Append any categories not in the order list (safety)
  const remaining = ALL_CATEGORIES.filter(c => !ordered.includes(c));
  return [...ordered, ...remaining];
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
    'Add shared office costs like rent and internet',
    'Create templates for recurring charges',
    'Invite team members to start splitting',
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
