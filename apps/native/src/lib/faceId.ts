import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

/** Whether this phone can unlock with Face ID (or Touch ID), and has it set up. */
export async function faceIdReady(): Promise<"ready" | "no-hardware" | "not-enrolled"> {
  if (Platform.OS === "web") return "no-hardware";
  if (!(await LocalAuthentication.hasHardwareAsync())) return "no-hardware";
  if (!(await LocalAuthentication.isEnrolledAsync())) return "not-enrolled";
  return "ready";
}

/** Asks for Face ID once. The passcode is allowed as a fallback, as iOS apps usually do. */
export async function unlock(reason = "Unlock Commune"): Promise<boolean> {
  if (Platform.OS === "web") return true;
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: "Cancel" });
  return result.success;
}
