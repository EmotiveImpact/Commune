import { createFileRoute, redirect } from '@tanstack/react-router';
import { consumePendingInviteToken } from '../utils/invite-token';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    // Wait for auth to finish loading before making any redirect decisions
    if (context.auth.isLoading) {
      return;
    }
    if (context.auth.isAuthenticated) {
      // Check for pending invite token (set when user clicks invite link before auth)
      if (typeof window !== 'undefined') {
        const inviteToken = consumePendingInviteToken();
        if (inviteToken) {
          throw redirect({ to: '/invite/$token', params: { token: inviteToken } });
        }
      }
      throw redirect({ to: '/' });
    }
  },
});
