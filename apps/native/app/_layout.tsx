import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PrefsProvider } from "../src/prefs";
import { AppProvider, useApp } from "../src/state";
import { ConfirmProvider } from "../src/ui/confirm";
import { HeroFlight } from "../src/ui/hero";
import { ToastProvider } from "../src/ui/toast";
import { LockGate } from "../src/ui/lock";
import { PushedBar } from "../src/ui/chrome";
import { SHEET_SCREEN } from "../src/ui/sheet";
import { useTheme } from "../src/ui/theme";

/**
 * After a pay link opens another app, coming back asks whether the money
 * went. It asks only once the app was actually left, so a link that failed
 * to open asks nothing.
 */
function PayReturn() {
  const router = useRouter();
  const { payingAway, clearPayingAway } = useApp();
  const left = useRef(false);
  const latest = useRef({ router, clearPayingAway });
  latest.current = { router, clearPayingAway };
  useEffect(() => {
    if (!payingAway) return;
    left.current = false;
    const back = () => {
      if (!left.current) return;
      left.current = false;
      latest.current.clearPayingAway();
      latest.current.router.push({ pathname: "/paid/[shareId]", params: { shareId: payingAway.shareId, provider: payingAway.provider } });
    };
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") back(); else left.current = true;
    });
    if (Platform.OS !== "web" || typeof window === "undefined") return () => app.remove();
    const away = () => { if (document.visibilityState === "hidden") left.current = true; else back(); };
    const blur = () => { left.current = true; };
    window.addEventListener("blur", blur);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", away);
    return () => {
      app.remove();
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", away);
    };
  }, [payingAway]);
  return null;
}

function Screens() {
  const { c } = useTheme();
  // Inner screens slide in from the right and swipe back from anywhere on
  // the screen, under a top bar the same height as the tabs' one.
  const pushed = {
    headerShown: true,
    header: ({ navigation, options, back }: { navigation: { goBack(): void }; options: { title?: string }; back?: unknown }) =>
      <PushedBar title={options.title ?? ""} onBack={back ? () => navigation.goBack() : undefined} />,
    animation: "slide_from_right" as const,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: c.canvas },
  };
  return <>
    <StatusBar style="light" />
    <PayReturn />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="expense/[id]" options={{ ...pushed, title: "Expense" }} />
      <Stack.Screen name="notifications" options={{ ...pushed, title: "Notifications" }} />
      <Stack.Screen name="account" options={{ ...pushed, title: "Settings" }} />
      <Stack.Screen name="help" options={{ ...pushed, title: "Help and feedback" }} />
      <Stack.Screen name="pay-links" options={{ ...pushed, title: "How people pay you" }} />
      <Stack.Screen name="tasks" options={{ ...pushed, title: "Chores and tasks" }} />
      <Stack.Screen name="notes" options={{ ...pushed, title: "Notes" }} />
      <Stack.Screen name="members" options={{ ...pushed, title: "Members" }} />
      <Stack.Screen name="recurring" options={{ ...pushed, title: "Recurring" }} />
      <Stack.Screen name="funds" options={{ ...pushed, title: "Funds" }} />
      <Stack.Screen name="templates" options={{ ...pushed, title: "Templates" }} />
      <Stack.Screen name="record/[shareId]" options={SHEET_SCREEN} />
      <Stack.Screen name="pay/[shareId]" options={SHEET_SCREEN} />
      <Stack.Screen name="paid/[shareId]" options={SHEET_SCREEN} />
      <Stack.Screen name="add-expense" options={SHEET_SCREEN} />
      <Stack.Screen name="confirm/[reportId]" options={SHEET_SCREEN} />
      <Stack.Screen name="nudge/[expenseId]" options={SHEET_SCREEN} />
      <Stack.Screen name="recurring-edit/[id]" options={SHEET_SCREEN} />
      <Stack.Screen name="remind/[key]" options={SHEET_SCREEN} />
      <Stack.Screen name="new-commune" options={SHEET_SCREEN} />
      <Stack.Screen name="switch" options={SHEET_SCREEN} />
      <Stack.Screen name="invite" options={SHEET_SCREEN} />
      <Stack.Screen name="add-note" options={SHEET_SCREEN} />
      <Stack.Screen name="add-chore" options={SHEET_SCREEN} />
      <Stack.Screen name="announce" options={SHEET_SCREEN} />
      <Stack.Screen name="appearance" options={SHEET_SCREEN} />
    </Stack>
    <HeroFlight />
    <LockGate />
  </>;
}

export default function Root() {
  // The design language's faces; the first frame waits for them so text never jumps.
  const [ready, fontError] = useFonts({ CommuneWordmark25: require("../assets/fonts/commune-wordmark-25.ttf"), CommuneWordmark36: require("../assets/fonts/commune-wordmark-36.ttf"), DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!ready && !fontError) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <PrefsProvider><AppProvider><ToastProvider><ConfirmProvider><Screens /></ConfirmProvider></ToastProvider></AppProvider></PrefsProvider>
  </GestureHandlerRootView>;
}
