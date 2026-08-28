import { describe, expect, it } from 'vitest';
import {
  countCompletedSetupChecklistItems,
  createSetupChecklistProgress,
  getAdminOnboardingChecklist,
  getAdminOnboardingChecklistItems,
  getIncompleteSetupChecklistItems,
  getGroupSubtypeOptions,
} from './space-playbooks';
import { getOperationTemplates } from './operations-templates';

describe('space playbooks', () => {
  it('returns shared subtype options by group type', () => {
    const homeOptions = getGroupSubtypeOptions('home');
    expect(homeOptions.some((option) => option.value === 'coliving')).toBe(true);

    const projectOptions = getGroupSubtypeOptions('project');
    expect(projectOptions.some((option) => option.value === 'production')).toBe(true);

    const workspaceOptions = getGroupSubtypeOptions('workspace');
    expect(workspaceOptions.some((option) => option.value === 'freelancers')).toBe(true);
  });

  it('adds subtype-specific admin checklist items', () => {
    const checklist = getAdminOnboardingChecklist('home', 'high_turnover');
    expect(checklist.some((item) => item.includes('deposit expectations'))).toBe(true);
  });

  it('extends workspace checklist guidance for team subtypes', () => {
    const checklist = getAdminOnboardingChecklist('workspace', 'team');

    expect(checklist.some((item) => item.includes('approves spend'))).toBe(true);
    expect(checklist.some((item) => item.includes('shared tools and subscriptions'))).toBe(true);
    expect(checklist.some((item) => item.includes('monthly closeout'))).toBe(true);
  });

  it('seeds the workspace team approval chain with a stable default checklist entry', () => {
    const progress = createSetupChecklistProgress('workspace', 'team');

    expect(progress['approval-chain-owner']).toEqual({
      label: 'Document who approves spend, who logs invoices, and who escalates unusual costs.',
      completed: false,
      completed_at: null,
    });
  });

  it('adds operational coverage for freelancer collectives', () => {
    const checklist = getAdminOnboardingChecklist('workspace', 'freelancers');

    expect(checklist.some((item) => item.includes('pooled software, space, or supply costs'))).toBe(true);
    expect(checklist.some((item) => item.includes('desk or studio bookings work'))).toBe(true);
  });

  it('creates persisted checklist progress with stable ids and preserves completion', () => {
    const items = getAdminOnboardingChecklistItems('workspace', 'coworking');
    const initialProgress = createSetupChecklistProgress('workspace', 'coworking');
    const firstItem = items[0]!;

    initialProgress[firstItem.id] = {
      label: firstItem.label,
      completed: true,
      completed_at: '2026-03-25T10:00:00.000Z',
    };

    const remappedProgress = createSetupChecklistProgress(
      'workspace',
      'coworking',
      initialProgress,
    );

    expect(remappedProgress[firstItem.id]?.completed).toBe(true);
    expect(countCompletedSetupChecklistItems(remappedProgress)).toBe(1);
    expect(getIncompleteSetupChecklistItems(remappedProgress).length).toBe(
      items.length - 1,
    );
  });

  it('extends starter operations for subtype-aware playbooks', () => {
    const baseTemplates = getOperationTemplates('workspace');
    const subtypeTemplates = getOperationTemplates('workspace', 'coworking');

    expect(subtypeTemplates.length).toBeGreaterThan(baseTemplates.length);
    expect(subtypeTemplates.some((item) => item.title === 'Guest access sweep')).toBe(true);
  });
});
