import { describe, expect, it } from 'vitest';
import {
  getSpaceEssentialDefinitions,
  normalizeSpaceEssentials,
} from './space-essentials';

describe('getSpaceEssentialDefinitions', () => {
  it('returns workspace-specific fields', () => {
    const fields = getSpaceEssentialDefinitions('workspace');
    expect(fields.map((field) => field.key)).toContain('access');
    expect(fields.map((field) => field.key)).toContain('building_contact');
  });
});

describe('normalizeSpaceEssentials', () => {
  it('hydrates structured essentials as-is', () => {
    const result = normalizeSpaceEssentials('workspace', {
      access: { label: 'Access info', value: 'Code 1234', visible: false },
    });

    expect(result.access).toEqual({
      label: 'Access info',
      value: 'Code 1234',
      visible: false,
    });
  });

  it('falls back to legacy house info', () => {
    const result = normalizeSpaceEssentials('home', null, {
      wifi: 'Network / password',
      rules: 'Quiet after 10pm',
    });

    expect(result.wifi?.value).toBe('Network / password');
    expect(result.rules?.label).toBe('House rules');
  });
});
