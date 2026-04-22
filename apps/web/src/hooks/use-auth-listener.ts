import { useEffect } from 'react';
import type { Session, SupabaseAuthUser } from '@commune/api';
import { supabase, getProfile } from '@commune/api';
import type { User } from '@commune/types';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { queryClient } from '../lib/query-client';
import { router } from '../lib/router';
import { profileKeys } from './profile-keys';

function splitName(fullName: string): { first_name: string; last_name: string } {
  const spaceIndex = fullName.indexOf(' ');
  if (spaceIndex > 0) {
    return {
      first_name: fullName.substring(0, spaceIndex),
      last_name: fullName.substring(spaceIndex + 1),
    };
  }
  return { first_name: fullName, last_name: '' };
}

function buildFallbackUser(authUser: SupabaseAuthUser): User {
  const email = authUser.email ?? '';
  const metadata = authUser.user_metadata ?? {};
  const derivedName =
    metadata.name ??
    metadata.full_name ??
    metadata.user_name ??
    (email.includes('@') ? email.split('@')[0] : 'Commune member');
  const { first_name, last_name } = splitName(derivedName);

  return {
    id: authUser.id,
    first_name,
    last_name,
    name: derivedName,
    email,
    avatar_url: metadata.avatar_url ?? null,
    phone: null,
    country: null,
    default_currency: 'GBP',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    show_shared_groups: true,
    is_deactivated: false,
    deletion_requested_at: null,
    deletion_scheduled_for: null,
    created_at: authUser.created_at ?? new Date().toISOString(),
  };
}

async function resolveUser(authUser: SupabaseAuthUser): Promise<User> {
  try {
    return await getProfile(authUser.id);
  } catch (err) {
    console.error('Failed to resolve user profile, falling back to auth metadata.', err);
    return buildFallbackUser(authUser);
  }
}

export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();
  const { setActiveGroupId, setActiveGroupUserId } = useGroupStore();

  useEffect(() => {
    let mounted = true;
    let initialised = false;
    let lastUserId: string | null = null;
    let pendingUserId: string | null = null;

    async function syncSession(session: Session | null) {
      if (!mounted) return;

      if (!session?.user) {
        if (lastUserId !== null) {
          lastUserId = null;
          pendingUserId = null;
          queryClient.clear();
          setActiveGroupId(null);
          setActiveGroupUserId(null);
          setUser(null);
          void router.invalidate();
        }
        if (!initialised) {
          initialised = true;
          setLoading(false);
          void router.invalidate();
        }
        return;
      }

      // Skip if the same user is already resolved — avoids re-render on token refresh
      if (session.user.id === lastUserId && initialised) return;
      if (session.user.id === pendingUserId) return;

      if (lastUserId && lastUserId !== session.user.id) {
        queryClient.clear();
        setActiveGroupId(null);
      }

      const { activeGroupUserId } = useGroupStore.getState();
      if (activeGroupUserId && activeGroupUserId !== session.user.id) {
        setActiveGroupId(null);
      }

      const requestUserId = session.user.id;
      pendingUserId = requestUserId;
      lastUserId = requestUserId;
      const cachedUser = queryClient.getQueryData<User>(profileKeys.detail(requestUserId));
      const optimisticUser = cachedUser ?? buildFallbackUser(session.user);
      queryClient.setQueryData(profileKeys.detail(optimisticUser.id), optimisticUser);
      setActiveGroupUserId(optimisticUser.id);
      setUser(optimisticUser);
      void router.invalidate();

      if (!initialised) {
        initialised = true;
        setLoading(false);
      }

      void resolveUser(session.user)
        .then((user) => {
          if (!mounted) return;
          // A newer auth event took over while we were resolving; drop the result
          // rather than racing it onto the store (prevents a stale user from
          // winning after a quick A→B→A switch).
          if (pendingUserId !== requestUserId) return;

          pendingUserId = null;
          queryClient.setQueryData(profileKeys.detail(user.id), user);
          setUser(user);
        })
        .catch((error) => {
          pendingUserId = null;
          console.error('Failed to resolve user profile after optimistic bootstrap.', error);
        });
    }

    void supabase.auth.getSession().then(({ data: { session } }) => syncSession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setActiveGroupId, setActiveGroupUserId, setUser, setLoading]);
}
