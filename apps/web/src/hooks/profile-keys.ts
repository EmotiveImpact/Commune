export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};
