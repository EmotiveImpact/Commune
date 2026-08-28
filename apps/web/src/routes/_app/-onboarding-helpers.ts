export function shouldRedirectFromOnboarding(
  activeGroupId: string | null,
  groupId: string | null,
) {
  return Boolean(activeGroupId && !groupId);
}

export function shouldResumeExistingGroup(
  existingGroupId: string | null | undefined,
  groupId: string | null,
) {
  return Boolean(existingGroupId && !groupId);
}
