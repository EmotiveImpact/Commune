import { useEffect } from 'react';
import type { Session, SupabaseAuthUser } from '@commune/api';
import { supabase, ensureProfile } from '@commune/api';
import type { User } from '@commune/types';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';

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
    created_at: authUser.created_at ?? new Date().toISOString(),
  };
}

async function resolveUser(authUser: SupabaseAuthUser): Promise<User> {
  try {
    return await ensureProfile(authUser.id);
  } catch (err) {
    console.error('Failed to ensure user profile, falling back to auth metadata.', err);
    return buildFallbackUser(authUser);
  }
}

export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();

  useEffect(() => {
    let mounted = true;

    async function syncSession(session: Session | null) {
      if (!mounted) {
        return;
      }

      if (!session?.user) {
        setActiveGroupId(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const user = await resolveUser(session.user);

      if (!mounted) {
        return;
      }

      setUser(user);
      setLoading(false);
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
  }, [setActiveGroupId, setUser, setLoading]);
}
