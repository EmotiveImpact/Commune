import { useEffect, type ReactNode } from "react";
import { Linking, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Bell, Check, ChevronRight, CircleHelp, Coins, HandCoins, Info, LayoutPanelTop, Lock, LogOut, Moon, ScanFace, Sun, UserRound } from "lucide-react-native";
import { faceIdReady, unlock } from "../src/lib/faceId";
import { APPEARANCE_LABEL, hourWords, notifySummary } from "../src/lib/prefsStore";
import { joinAnd } from "../src/lib/format";
import { PAY_PROVIDER_NAME } from "../src/lib/payLinks";
import { usePrefs, type HubTabsAt } from "../src/prefs";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { useConfirm } from "../src/ui/confirm";
import { Avatar, Badge, Kicker, Panel, Row, T } from "../src/ui/kit";
import { Rise } from "../src/ui/motion";
import { Segmented } from "../src/ui/segmented";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

const HUB_TABS: Array<{ value: HubTabsAt; label: string }> = [
  { value: "top", label: "Under the photo" },
  { value: "bottom", label: "At the bottom" },
];

/**
 * Settings, in groups: you, notifications, security, appearance, money,
 * Hub layout, privacy, help and about, then sign out. Every row goes
 * somewhere or switches something.
 */
export default function Account() {
  const { c, dark } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { hubTabsAt, setHubTabsAt, appearance, faceId, setFaceId, notify, remindHour } = usePrefs();
  const { user, myPayLinks, loadMyPayLinks, signOut, backend } = useApp();
  useEffect(() => { loadMyPayLinks().catch(() => undefined); }, [loadMyPayLinks]);

  async function askSignOut() {
    if (!(await confirm({ title: "Sign out of Commune on this phone?", message: "Your records stay in Commune. You’ll sign in again to see them.", yes: "Sign out", destructive: true }))) return;
    void signOut().then(() => router.replace("/sign-in"));
  }
  async function toggleFaceId(on: boolean) {
    if (!on) { setFaceId(false); toast("Commune opens without Face ID now."); return; }
    const ready = await faceIdReady();
    if (ready === "no-hardware") { toast("This phone can’t unlock with Face ID."); return; }
    if (ready === "not-enrolled") { toast("Set up Face ID in your phone’s Settings first."); return; }
    if (!(await unlock("Turn on Face ID for Commune"))) return;
    setFaceId(true);
    toast("Commune will ask for Face ID when it opens.");
  }

  const icon = (node: ReactNode, tone?: string) => <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tone ?? c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  const chevron = <ChevronRight size={17} color={c.ink2} />;
  const value = (text: string) => <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 160 }}>
    <T kind="label" muted lines={1}>{text}</T>{chevron}
  </View>;
  const sub = (text: string) => <T kind="label" muted style={{ fontSize: 12.5, lineHeight: 17 }}>{text}</T>;
  const toggle = (label: string, on: boolean, change: (on: boolean) => void) =>
    <Switch accessibilityLabel={label} value={on} onValueChange={change} trackColor={{ true: c.action, false: c.recessed }} ios_backgroundColor={c.recessed} />;
  const group = (index: number, title: string, children: ReactNode, note?: string) => <Rise index={index} style={{ gap: 8 }}>
    <Kicker>{title}</Kicker>
    {children}
    {note ? <T kind="note" muted style={{ paddingHorizontal: 4 }}>{note}</T> : null}
  </Rise>;
  const payWords = myPayLinks == null ? "Loading…" : myPayLinks.length ? joinAnd(myPayLinks.map((link) => PAY_PROVIDER_NAME[link.provider])) : "Not added yet";

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <Body refresh={false}>
      <Pad gap={20}>
        {group(0, "You", <Panel>
          <Row first onPress={() => router.push("/profile")} left={<Avatar name={user?.name ?? "You"} size={40} />}
            title={user?.name ?? "You"} meta={sub(user?.email ?? "")}
            right={backend.mode === "demo" ? chevron : <Badge text="Synced" tone="settled" icon={<Check size={12} color={c.onSettled} />} />} />
          <Row onPress={() => router.push("/edit-profile")} left={icon(<UserRound size={17} color={c.ink} />)} title="Profile details"
            meta={sub("Your name on this phone")} right={chevron} />
        </Panel>)}

        {group(1, "Notifications", <Panel>
          <Row first onPress={() => router.push("/notification-settings")} left={icon(<Bell size={17} color={c.ink} />)} title="Notification settings"
            meta={sub(`${notifySummary(notify)} · evening reminders at ${hourWords(remindHour)}`)} right={chevron} />
        </Panel>)}

        {group(2, "Security", <Panel>
          <Row first left={icon(<ScanFace size={17} color={c.ink} />)} title="Unlock with Face ID" meta={sub("Asked when the app opens")}
            right={toggle("Unlock with Face ID", faceId, (on) => void toggleFaceId(on))} />
        </Panel>)}

        {group(3, "Appearance", <Panel>
          <Row first onPress={() => router.push("/appearance")} left={icon(dark ? <Moon size={17} color={c.ink} /> : <Sun size={17} color={c.ink} />)}
            title="Light or dark" right={value(APPEARANCE_LABEL[appearance])} />
        </Panel>)}

        {group(4, "Money", <Panel>
          <Row first onPress={() => router.push("/pay-links")} left={icon(<HandCoins size={17} color={c.ink} />)} title="How people pay you"
            meta={sub(payWords)} right={chevron} />
          <Row left={icon(<Coins size={17} color={c.ink} />)} title="Currencies" meta={sub("Each commune keeps its own currency. Pounds, euros and dollars are never added together.")} />
        </Panel>, "Commune records what people pay each other. It never moves money.")}

        {group(5, "Hub layout", <Panel pad>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {icon(<LayoutPanelTop size={17} color={c.ink} />)}
            <View style={{ flex: 1 }}>
              <T kind="body" style={{ fontSize: 15, lineHeight: 20, fontWeight: "500" }}>Hub tabs</T>
              {sub("Where Overview, Money, Chores and Notes sit")}
            </View>
          </View>
          <Segmented tone="frame" label="Hub tabs" options={HUB_TABS} value={hubTabsAt}
            onChange={(next) => { setHubTabsAt(next); toast(next === "bottom" ? "Hub tabs now sit at the bottom." : "Hub tabs now sit under the photo."); }} />
        </Panel>)}

        {group(6, "Privacy and help", <Panel>
          <Row first onPress={() => void Linking.openURL("https://ourcommune.io/privacy").catch(() => undefined)} left={icon(<Lock size={17} color={c.ink} />)} title="Privacy"
            meta={sub("Who sees your pay links and notes")} right={chevron} />
          <Row onPress={() => router.push("/help")} left={icon(<CircleHelp size={17} color={c.ink} />)} title="Help and feedback" meta={sub("How Commune works, and writing to us")} right={chevron} />
          <Row left={icon(<Info size={17} color={c.ink} />)} title="About" right={<T kind="label" muted>Version {Constants.expoConfig?.version ?? "1.0"}</T>} />
        </Panel>)}

        <Rise index={7}><Panel>
          <Row first onPress={() => void askSignOut()} left={icon(<LogOut size={17} color={c.late} />, c.lateSoft)}
            title={<T kind="body" color={c.late} style={{ fontSize: 15, lineHeight: 20, fontWeight: "600" }}>Sign out</T>} />
        </Panel></Rise>
        {backend.mode === "demo" ? <T kind="note" muted style={{ paddingHorizontal: 4, textAlign: "center" }}>You’re looking at demo data kept on this phone. Nothing you do here reaches anyone.</T> : null}
      </Pad>
    </Body>
  </View>;
}
