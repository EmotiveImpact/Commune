/**
 * Persistent onboarding-completion state.
 *
 * Replaces the heuristic "does the user have any groups?" check with an
 * explicit completion flag stored in AsyncStorage. Set when the user
 * either finishes the celebration screen or skips the tour. The root
 * layout's redirect-to-onboarding logic can read this to avoid showing
 * onboarding twice.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'commune.onboarding.completedAt';

export function useOnboardingCompletion() {
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (mounted) setCompletedAt(v);
      })
      .catch(() => {
        // AsyncStorage failing means we treat onboarding as not-completed.
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const markCompleted = useCallback(async () => {
    const ts = new Date().toISOString();
    setCompletedAt(ts);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, ts);
    } catch {
      // best-effort persistence — UI state is already updated.
    }
  }, []);

  const reset = useCallback(async () => {
    setCompletedAt(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    hasCompleted: completedAt !== null,
    completedAt,
    isLoading,
    markCompleted,
    reset,
  };
}
