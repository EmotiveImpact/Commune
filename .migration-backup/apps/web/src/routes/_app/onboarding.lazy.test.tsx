import {
  shouldRedirectFromOnboarding,
  shouldResumeExistingGroup,
} from './-onboarding-helpers';

describe('shouldRedirectFromOnboarding', () => {
  it('keeps newly created groups inside onboarding until starter setup is done', () => {
    expect(shouldRedirectFromOnboarding('group-1', 'group-1')).toBe(false);
    expect(shouldRedirectFromOnboarding('group-1', null)).toBe(true);
  });
});

describe('shouldResumeExistingGroup', () => {
  it('does not resume an existing group while onboarding is mid-flow for a new group', () => {
    expect(shouldResumeExistingGroup('group-1', 'group-1')).toBe(false);
    expect(shouldResumeExistingGroup('group-1', null)).toBe(true);
  });
});
