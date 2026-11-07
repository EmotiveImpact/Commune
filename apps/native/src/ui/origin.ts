import { makeMutable } from "react-native-reanimated";

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Where the last button press happened, so a sheet that opens because of it
 * can grow out of that button (v7's button-to-sheet opener). A press counts
 * for 400 ms. `hidden` names the button hidden while its sheet is up.
 */
export const lastPress: { rect: Rect | null; color: string; radius: number; at: number; id: string } = { rect: null, color: "", radius: 0, at: 0, id: "" };
export const hiddenButton = makeMutable("");

/** A sheet replacing another in place (pay, then "I've already paid") starts from the old one's height. */
export const lastSheet: { height: number; at: number; swapping: boolean } = { height: 0, at: 0, swapping: false };

/** How far the screen behind has stepped back for a sheet: 0 none, 1 fully. */
export const sheetDepth = makeMutable(0);

export function recentPress(): typeof lastPress | null {
  return lastPress.rect && Date.now() - lastPress.at < 400 ? lastPress : null;
}

/** Call just before router.replace from one sheet to another. */
export function swapSheet() {
  lastSheet.swapping = true;
  lastSheet.at = Date.now();
}
