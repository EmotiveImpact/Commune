import { describe, expect, it } from 'vitest';
import { ExpenseCategory } from '@commune/types';
import { getSpacePreset } from './space-presets';

describe('space presets', () => {
  it('returns subtype-aware starter guidance', () => {
    const preset = getSpacePreset('workspace', 'coworking');

    expect(preset.title).toBe('Coworking starter pack');
    expect(preset.firstExpenseIdeas.some((idea) => idea.includes('internet'))).toBe(true);
    expect(preset.essentialSeeds.access).toContain('Front-door code');
  });

  it('keeps suggested categories unique when subtype presets override ordering', () => {
    const preset = getSpacePreset('trip', 'business_trip');

    expect(new Set(preset.suggestedCategories).size).toBe(preset.suggestedCategories.length);
    expect(preset.suggestedCategories[0]).toBe(ExpenseCategory.TRANSPORT);
  });

  it('adds workspace-specific subscription and vendor seeds for team-style groups', () => {
    const preset = getSpacePreset('workspace', 'team');

    expect(preset.title).toBe('Team workspace starter pack');
    expect(preset.essentialSeeds.billing).toContain('Invoice inbox');
    expect(preset.essentialSeeds.approvals).toContain('exceptions');
  });

  it('falls back to the base workspace starter pack when the subtype is unknown', () => {
    const preset = getSpacePreset('workspace', 'not-a-real-subtype');

    expect(preset.title).toBe('Workspace starter pack');
    expect(preset.essentialSeeds.access).toContain('Front-door access');
    expect(preset.essentialSeeds.approvals).toBeUndefined();
  });

  it('returns the shared default starter pack when no group type is supplied', () => {
    const preset = getSpacePreset();

    expect(preset.title).toBe('Shared space starter pack');
    expect(preset.essentialSeeds.instructions).toContain('Access notes');
    expect(preset.essentialSeeds.rules).toContain('Shared expectations');
  });

  it('separates freelancer collectives from team workspaces', () => {
    const preset = getSpacePreset('workspace', 'freelancers');

    expect(preset.title).toBe('Freelancer collective starter pack');
    expect(preset.essentialSeeds.booking).toContain('no-show handling');
    expect(preset.essentialSeeds.costs).toContain('reimbursements');
  });
});
