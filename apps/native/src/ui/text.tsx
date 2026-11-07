import { forwardRef } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from "react-native";

/**
 * The type faces from the design language: DM Sans for display sizes (24 px
 * and up: headlines, big amounts, the wordmark) and Inter for everything else.
 * React Native picks a custom face by name, not by weight, so these wrappers
 * turn fontWeight into the matching face. Use them in place of React
 * Native's Text and TextInput everywhere.
 */
const INTER: Record<string, string> = {
  "400": "Inter_400Regular", normal: "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold", bold: "Inter_700Bold", "800": "Inter_700Bold", "900": "Inter_700Bold",
};
const DM: Record<string, string> = {
  "400": "DMSans_400Regular", normal: "DMSans_400Regular",
  "500": "DMSans_500Medium",
  "600": "DMSans_600SemiBold",
  "700": "DMSans_700Bold", bold: "DMSans_700Bold", "800": "DMSans_700Bold", "900": "DMSans_700Bold",
};

export function face(style: TextStyle | undefined): TextStyle {
  const flat = style ?? {};
  if (flat.fontFamily) return {};
  const weight = String(flat.fontWeight ?? "400");
  const display = (flat.fontSize ?? 14) >= 24;
  return { fontFamily: (display ? DM : INTER)[weight] ?? (display ? DM["400"] : INTER["400"]), fontWeight: undefined };
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return <RNText ref={ref} {...rest} style={[flat, face(flat)]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return <RNTextInput ref={ref} {...rest} style={[flat, face(flat)]} />;
});

export const FONTS_TO_LOAD = [INTER, DM];
