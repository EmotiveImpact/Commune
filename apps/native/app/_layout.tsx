import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "../src/state";
import { ToastProvider } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

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
      <Stack.Screen name="add-expense" options={sheet} />
      <Stack.Screen name="switch" options={{ ...sheet, sheetAllowedDetents: "fitToContents" }} />
    </Stack>
  </>;
}

export default function Root() {
  return <AppProvider><ToastProvider><Screens /></ToastProvider></AppProvider>;
}
