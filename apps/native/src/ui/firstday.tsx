import { useEffect } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Check, X } from "lucide-react-native";
import { joinAnd } from "../lib/format";
import { PAY_PROVIDER_NAME } from "../lib/payLinks";
import { usePrefs } from "../prefs";
import { useApp } from "../state";
import { Button, Panel, T } from "./kit";
import { PressScale } from "./motion";
import { useTheme } from "./theme";

/**
 * v7's first-day card on Home after joining from an invitation: four steps
 * with round ticks and "1 of 4". It stays until every step is done or it is
 * closed.
 */
export function FirstDayCard() {
  const { c } = useTheme();
  const router = useRouter();
  const { firstDay, setFirstDay } = usePrefs();
  const { myPayLinks, loadMyPayLinks, snapshotOf } = useApp();
  useEffect(() => { if (firstDay && !firstDay.dismissed && myPayLinks == null) void loadMyPayLinks(); }, [firstDay, myPayLinks, loadMyPayLinks]);
  if (!firstDay || firstDay.dismissed || !snapshotOf(firstDay.communeId)) return null;
  const links = myPayLinks ?? [];
  const steps = [
    { done: true, title: `Joined ${firstDay.communeName}`, sub: "Everyone in it can see you now" },
    { done: firstDay.partSeen, title: "Checked your part", sub: "What is yours from today", action: "Open", go: () => { setFirstDay({ ...firstDay, partSeen: true }); router.navigate("/hub"); } },
    { done: links.length > 0, title: "Say how people pay you", sub: links.length ? `${joinAnd(links.map((link) => PAY_PROVIDER_NAME[link.provider]))} added` : "So they can pay you in one tap", action: "Add", go: () => router.push("/pay-links") },
    { done: firstDay.notifications, title: "Turn on notifications", sub: "Hear when something is yours", action: "Turn on", go: async () => {
      const status = Platform.OS === "web" ? "granted" : (await Notifications.requestPermissionsAsync().catch(() => ({ status: "denied" }))).status;
      if (status === "granted") setFirstDay({ ...firstDay, notifications: true });
    } },
  ];
  const done = steps.filter((step) => step.done).length;
  return <Panel style={{ paddingTop: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 8 }}>
      <T kind="label" muted style={{ flex: 1, fontWeight: "600" }}>Your first day</T>
      <T kind="label" muted>{done} of {steps.length}</T>
      <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Close your first day" hitSlop={8}
        onPress={() => setFirstDay({ ...firstDay, dismissed: true })} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
        <X size={16} color={c.ink2} />
      </PressScale>
    </View>
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      {steps.map((step, index) => <View key={step.title} accessibilityLabel={`${step.title}${step.done ? ", done" : ""}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingVertical: 6, borderTopWidth: index ? 1 : 0, borderTopColor: c.outline2 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
          backgroundColor: step.done ? c.action : "transparent", borderWidth: step.done ? 0 : 1.5, borderColor: c.outline }}>
          {step.done ? <Check size={14} color={c.onAction} strokeWidth={2.6} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T kind="body" color={step.done ? c.ink2 : c.ink} style={{ fontSize: 14.5, lineHeight: 19, fontWeight: "500" }}>{step.title}</T>
          <T kind="note" muted style={{ fontSize: 12.5, lineHeight: 17 }}>{step.sub}</T>
        </View>
        {!step.done && step.action && step.go ? <Button size="sm" variant="secondary" label={step.action} onPress={() => void step.go!()} /> : null}
      </View>)}
    </View>
  </Panel>;
}
