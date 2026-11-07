import { useRouter } from "expo-router";
import { remindHref } from "../lib/remindKey";
import { tap } from "./kit";

/** How long to hold a panel before the reminder drawer opens. */
export const HOLD = 450;

/**
 * Opens the "Remind me" drawer for a key (see lib/remindKey). Used by every
 * swipe and press-and-hold in the app, so they all open the same drawer.
 */
export function useRemind() {
  const router = useRouter();
  return (key: string) => () => { tap("light"); router.push(remindHref(key) as never); };
}
