import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useApp } from "../state";
import { useOpening } from "./store";

/**
 * Signing out ends where a new person starts: the opening flow, with its
 * Sign in link, never straight back into an account.
 */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useApp();
  const opening = useOpening();
  const router = useRouter();
  return useCallback(async () => {
    opening.save({ done: false, signedOut: true });
    await signOut();
    router.replace("/opening");
  }, [signOut, opening, router]);
}
