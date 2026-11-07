import { useEffect } from "react";
import { Linking, Switch, View } from "react-native";
import { useConfirm } from "../src/ui/confirm";
import { useRouter } from "expo-router";
import { Bell, Check, ChevronRight, CircleHelp, HandCoins, Lock, LogOut, Moon, ScanFace, Sun } from "lucide-react-native";
import { faceIdReady, unlock } from "../src/lib/faceId";
import { APPEARANCE_LABEL, notifySummary } from "../src/lib/prefsStore";
import { joinAnd } from "../src/lib/format";
import { PAY_PROVIDER_NAME } from "../src/lib/payLinks";
import { usePrefs, type HubTabsAt } from "../src/prefs";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Avatar, Badge, Panel, Row, SectionHead, T } from "../src/ui/kit";
import { Rise } from "../src/ui/motion";
import { Segmented } from "../src/ui/segmented";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

const HUB_TABS: Array<{ value: HubTabsAt; label: string }> = [
  { value: "top", label: "Under the photo" },
  { value: "bottom", label: "At the bottom" },
];

/** Settings: who you are signed in as, the Hub layout, how people pay you and signing out. */
export default function Account() {
  const { c, dark } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { hubTabsAt, setHubTabsAt, appearance, faceId, setFaceId, notify } = usePrefs();
  const { user, myPayLinks, loadMyPayLinks, signOut, backend } = useApp();
  useEffect(() => { loadMyPayLinks().catch(() => undefined); }, [loadMyPayLinks]);
  const confirm = useConfirm();
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
  const icon = (node: React.ReactNode) => <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <Body>
      <Pad gap={22}>
        <Rise index={0}><Panel>
          <Row first left={<Avatar name={user?.name ?? "You"} size={40} />} title={`Signed in as ${user?.email ?? ""}`}
            meta={<T kind="label" muted>{backend.mode === "demo" ? "Demo data kept on this phone" : "Your data is the same as on the web"}</T>}
            right={backend.mode === "demo" ? null : <Badge text="Synced" tone="settled" icon={<Check size={12} color={c.onSettled} />} />} />
        </Panel></Rise>
        <Rise index={1}><Panel>
          <Row first onPress={() => router.push("/notifications")} left={icon(<Bell size={17} color={c.ink} />)} title="Notifications"
            meta={<T kind="label" muted>{notifySummary(notify)}</T>} right={<ChevronRight size={17} color={c.ink2} />} />
          <Row left={icon(<ScanFace size={17} color={c.ink} />)} title="Unlock with Face ID" meta={<T kind="label" muted>Asked when the app opens</T>}
            right={<Switch accessibilityLabel="Unlock with Face ID" value={faceId} onValueChange={(on) => void toggleFaceId(on)} trackColor={{ true: c.action, false: c.recessed }} ios_backgroundColor={c.recessed} />} />
          <Row onPress={() => router.push("/appearance")} left={icon(dark ? <Moon size={17} color={c.ink} /> : <Sun size={17} color={c.ink} />)} title="Appearance"
            right={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><T kind="label" muted>{APPEARANCE_LABEL[appearance]}</T><ChevronRight size={17} color={c.ink2} /></View>} />
          <Row onPress={() => router.push("/pay-links")} left={icon(<HandCoins size={17} color={c.ink} />)} title="How people pay you"
            meta={<T kind="label" muted>{myPayLinks == null ? "Loading…" : myPayLinks.length ? joinAnd(myPayLinks.map((link) => PAY_PROVIDER_NAME[link.provider])) : "Not added yet"}</T>}
            right={<ChevronRight size={17} color={c.ink2} />} />
        </Panel></Rise>
        <Rise index={2} style={{ gap: 10 }}>
          <SectionHead title="Layout" />
          <Panel pad>
            <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>Hub tabs</T>
            <Segmented tone="frame" label="Hub tabs" options={HUB_TABS} value={hubTabsAt}
              onChange={(value) => { setHubTabsAt(value); toast(value === "bottom" ? "Hub tabs now sit at the bottom." : "Hub tabs now sit under the photo."); }} />
            <T kind="label" muted>Where Overview, Money, Chores and Notes sit in each commune’s Hub.</T>
          </Panel>
        </Rise>
        <Rise index={3}><Panel>
          <Row first onPress={() => void Linking.openURL("https://ourcommune.io/privacy")} left={icon(<Lock size={17} color={c.ink} />)} title="Privacy"
            meta={<T kind="label" muted>Who sees your pay links and notes</T>} right={<ChevronRight size={17} color={c.ink2} />} />
        </Panel></Rise>
        <Rise index={3}><Panel>
          <Row first onPress={() => router.push("/help")} left={icon(<CircleHelp size={17} color={c.ink} />)} title="Help and feedback" right={<ChevronRight size={17} color={c.ink2} />} />
        </Panel></Rise>
        <Rise index={4}><Panel>
          <Row first onPress={() => void askSignOut()} left={icon(<LogOut size={17} color={c.late} />)} title={<T kind="body" color={c.late} style={{ fontWeight: "500" }}>Sign out</T>} />
        </Panel></Rise>
        {backend.mode === "demo" ? <T kind="note" muted style={{ paddingHorizontal: 4 }}>You’re looking at demo data kept on this phone. Nothing you do here reaches anyone.</T> : null}
      </Pad>
    </Body>
  </View>;
}
