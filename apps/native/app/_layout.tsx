import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "../src/state";
import { ToastProvider } from "../src/ui/toast";
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
  const pushed = {
    headerShown: true,
    headerStyle: { backgroundColor: c.frame },
    headerTintColor: c.onFrame,
    headerTitleStyle: { fontWeight: "600" as const, fontSize: 17 },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal" as const,
    contentStyle: { backgroundColor: c.canvas },
  };
  const sheet = { ...pushed, presentation: "formSheet" as const, sheetGrabberVisible: true, sheetAllowedDetents: [0.92], headerShown: false };
  return <>
    <StatusBar style="light" />
    <PayReturn />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="expense/[id]" options={{ ...pushed, title: "Expense" }} />
      <Stack.Screen name="notifications" options={{ ...pushed, title: "Notifications" }} />
      <Stack.Screen name="account" options={{ ...pushed, title: "Account" }} />
      <Stack.Screen name="pay-links" options={{ ...pushed, title: "How people pay you" }} />
      <Stack.Screen name="tasks" options={{ ...pushed, title: "Chores and tasks" }} />
      <Stack.Screen name="notes" options={{ ...pushed, title: "Notes" }} />
      <Stack.Screen name="members" options={{ ...pushed, title: "Members" }} />
      <Stack.Screen name="recurring" options={{ ...pushed, title: "Recurring" }} />
      <Stack.Screen name="funds" options={{ ...pushed, title: "Funds" }} />
      <Stack.Screen name="templates" options={{ ...pushed, title: "Templates" }} />
      <Stack.Screen name="record/[shareId]" options={sheet} />
      <Stack.Screen name="pay/[shareId]" options={sheet} />
      <Stack.Screen name="paid/[shareId]" options={{ ...sheet, sheetAllowedDetents: "fitToContents" }} />
      <Stack.Screen name="add-expense" options={sheet} />
      <Stack.Screen name="switch" options={{ ...sheet, sheetAllowedDetents: "fitToContents" }} />
    </Stack>
  </>;
}

export default function Root() {
  return <AppProvider><ToastProvider><Screens /></ToastProvider></AppProvider>;
}
