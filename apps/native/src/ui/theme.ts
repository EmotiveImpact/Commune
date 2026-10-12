import { Platform, useColorScheme } from "react-native";

/** The design language tokens (docs/DESIGN-LANGUAGE.md, design-language/system/cm.css). */
const light = {
  canvas: "#f5f1ea",
  recessed: "#eee8de",
  surface: "#ffffff",
  frame: "#1a1e2b",
  frameRaised: "#262b3a",
  onFrame: "#f5f1ea",
  onFrame2: "rgba(245,241,234,0.68)",
  ink: "#1a1e2b",
  ink2: "#59675f",
  outline: "rgba(26,30,43,0.13)",
  outline2: "rgba(26,30,43,0.075)",
  action: "#2d6a4f",
  onAction: "#ffffff",
  settled: "#d9ebe5",
  onSettled: "#1b4332",
  late: "#a12f2a",
  lateSoft: "#fbe7e2",
  attention: "#8a4b1f",
  attentionSoft: "#f7e8d6",
  press: "rgba(26,30,43,0.08)",
  calFace: "#fffdf9",
  calEdge: "#e8e2d8",
  calStrip: "#e8efe8",
  calStripInk: "#2d6a4f",
  dot: "#f08a7c",
  monzo: "#14233c",
  paypal: "#003087",
  revolut: "#191c1f",
};
export type Palette = typeof light;
const dark: Palette = {
  canvas: "#13161d",
  recessed: "#191d26",
  surface: "#1e2330",
  frame: "#0d1016",
  frameRaised: "#1b2030",
  onFrame: "#f2ede4",
  onFrame2: "rgba(242,237,228,0.66)",
  ink: "#f2ede4",
  ink2: "#a9b4ae",
  outline: "rgba(242,237,228,0.14)",
  outline2: "rgba(242,237,228,0.08)",
  action: "#7cc39f",
  onAction: "#0c1912",
  settled: "#1d3a2d",
  onSettled: "#bfe3cf",
  late: "#f2a89b",
  lateSoft: "#3a2222",
  attention: "#ebb886",
  attentionSoft: "#392b1e",
  press: "rgba(242,237,228,0.09)",
  calFace: "#202a37",
  calEdge: "#3d4a45",
  calStrip: "#253b34",
  calStripInk: "#c2ddcc",
  dot: "#f08a7c",
  monzo: "#ff4f40",
  paypal: "#7aa7ff",
  revolut: "#3a3f47",
};

export function useTheme(): { c: Palette; dark: boolean } {
  const scheme = useColorScheme();
  return scheme === "dark" ? { c: dark, dark: true } : { c: light, dark: false };
}

export const radius = { inner: 4, control: 9, surface: 15, pill: 999 };
export const font = {
  display: Platform.select({ ios: "System", default: undefined }),
};

/** Photos used for communes until people add their own, as on the web. */
export const KIND_PHOTO: Record<"household" | "workspace" | "trip", string> = {
  household: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=70",
  workspace: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=70",
  trip: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&q=70",
};
export const KIND_NAME: Record<"household" | "workspace" | "trip", string> = {
  household: "Household", workspace: "Workspace", trip: "Trip",
};
