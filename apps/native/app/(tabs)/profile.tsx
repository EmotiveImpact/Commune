import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../src/ui/text";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Bell, ChevronRight, CircleHelp, LogOut, Pencil, Plus, Settings, Star } from "lucide-react-native";
import { cap, money, word } from "../../src/lib/format";
import { useConfirm } from "../../src/ui/confirm";
import { payLinkLabel, PAY_PROVIDER_NAME, PAY_PROVIDERS, type PayProvider } from "../../src/lib/payLinks";
import type { CurrencyCode, Snapshot } from "../../src/lib/types";
import { failure, useApp } from "../../src/state";
import { Body, TopBar } from "../../src/ui/chrome";
import { Avatar, Button, Panel, Row, SectionHead, T } from "../../src/ui/kit";
import { PayMark } from "../../src/ui/marks";
import { haptic, Still, PressScale } from "../../src/ui/motion";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

const CURRENCY_WORD: Record<CurrencyCode, string> = { GBP: "pounds", EUR: "euros", USD: "dollars" };
const CURRENCY_MARK: Record<CurrencyCode, string> = { GBP: "£", EUR: "€", USD: "$" };

/** Bills you added this month and chores waiting on you, from your communes. */
function activity(snapshots: Snapshot[], me: string, today: string) {
  const month = today.slice(0, 7);
  let billsAdded = 0, choresOnYou = 0;
  for (const snapshot of snapshots) {
    for (const expense of snapshot.expenses) {
      if (expense.voidedAt) continue;
      if (expense.paidByUserId === me && (expense.createdAt ?? "").slice(0, 7) === month) billsAdded += 1;
    }
    choresOnYou += (snapshot.operations ?? []).filter((op) => op.kind === "task" && op.status === "open" && op.assigneeId === me).length;
  }
  return { billsAdded, choresOnYou };
}

/** Profile: the person, shortcuts, this month, where they stand in each currency, how people pay them, and signing out. */
export default function Profile() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user, snapshots, owe, owed, myPayLinks, loadMyPayLinks, setPreferredPayLink, signOut, today, needs } = useApp();
  const confirm = useConfirm();
  async function askSignOut() {
    if (!(await confirm({ title: "Sign out of Commune on this phone?", message: "Your records stay in Commune. You’ll sign in again to see them.", yes: "Sign out", destructive: true }))) return;
    void signOut().then(() => router.replace("/sign-in"));
  }
  const stats = activity(snapshots, user?.id ?? "", today);
  const toPay = needs.filter((need) => need.kind === "share").length;
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadMyPayLinks().catch(() => undefined); }, [loadMyPayLinks]);

  // One line per currency. Pounds and euros are never added together.
  const currencies = [...new Set([...Object.keys(owe), ...Object.keys(owed)] as CurrencyCode[])]
    .filter((currency) => (owe[currency] ?? 0) > 0 || (owed[currency] ?? 0) > 0);
  const links = myPayLinks ?? [];
  const missing = PAY_PROVIDERS.filter((provider) => !links.some((link) => link.provider === provider)).map((provider) => provider === "bank" ? "bank details" : PAY_PROVIDER_NAME[provider]);

  async function star(provider: PayProvider) {
    const was = links.find((link) => link.preferred)?.provider ?? null;
    const next = was === provider ? null : provider;
    setBusy(true);
    try {
      await setPreferredPayLink(next);
      haptic.success();
      toast(next ? `${PAY_PROVIDER_NAME[next]} is now your favourite. People who owe you see “Pay with ${PAY_PROVIDER_NAME[next]}” first.` : `${PAY_PROVIDER_NAME[provider]} is no longer your favourite.`,
        { label: "Undo", onPress: () => void setPreferredPayLink(was).catch(() => undefined) });
    } catch (cause) {
      toast(failure(cause, "Couldn’t change your favourite. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const icon = (node: React.ReactNode, tone?: string) => <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tone ?? c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  let step = 0;
  const next = () => step++;
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="Profile" />
    <Body>
      <View style={{ padding: 16, gap: 24 }}>
        <Still index={next()} style={{ alignItems: "center", gap: 10, paddingTop: 8 }}>
          <Avatar name={user?.name ?? "You"} size={88} />
          <View style={{ alignItems: "center", gap: 2 }}>
            <T kind="title" accessibilityRole="header" style={{ textAlign: "center" }}>{user?.name ?? "You"}</T>
            <T kind="label" muted style={{ textAlign: "center" }}>{user?.email}</T>
            <T kind="label" muted style={{ textAlign: "center" }}>In {word(snapshots.length)} {snapshots.length === 1 ? "commune" : "communes"}</T>
          </View>
          <View style={{ alignSelf: "stretch", flexDirection: "row", justifyContent: "center" }}>
            <Button size="sm" variant="secondary" label="Edit profile" icon={<Pencil size={14} color={c.ink} />} onPress={() => router.push("/edit-profile")} />
          </View>
        </Still>

        <Still index={next()} style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Settings", Icon: Settings, go: "/account" },
            { label: "Notifications", Icon: Bell, go: "/notifications" },
            { label: "Help", Icon: CircleHelp, go: "/help" },
          ].map(({ label, Icon, go }) => <PressScale key={label} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(go as never)}
            style={({ pressed }) => ({ flex: 1, minHeight: 76, borderRadius: 16, backgroundColor: pressed ? c.press : c.surface, alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: c.outline2 })}>
            <Icon size={20} color={c.ink} strokeWidth={1.8} />
            <Text style={{ fontSize: 13, lineHeight: 17, fontWeight: "500", color: c.ink }}>{label}</Text>
          </PressScale>)}
        </Still>

        <Still index={next()} style={{ gap: 10 }}>
          <SectionHead title="At a glance" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { n: stats.billsAdded, label: stats.billsAdded === 1 ? "bill you added this month" : "bills you added this month" },
              { n: toPay, label: toPay === 1 ? "bill still to pay" : "bills still to pay" },
              { n: stats.choresOnYou, label: stats.choresOnYou === 1 ? "chore on you" : "chores on you" },
            ].map((item) => <View key={item.label} style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: c.surface, gap: 2 }}>
              <Text style={{ fontSize: 26, lineHeight: 30, fontWeight: "600", color: c.ink, fontVariant: ["tabular-nums"] }}>{item.n}</Text>
              <Text style={{ fontSize: 12.5, lineHeight: 17, color: c.ink2 }}>{item.label}</Text>
            </View>)}
          </View>
        </Still>

        <Still index={next()} style={{ gap: 10 }}>
          <SectionHead title="Where you stand" />
          <Panel>
            {currencies.length ? currencies.map((currency, index) => {
              const o = owe[currency] ?? 0, d = owed[currency] ?? 0, net = d - o;
              return <Row key={currency} first={index === 0}
                left={<View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{CURRENCY_MARK[currency]}</Text></View>}
                title={cap(CURRENCY_WORD[currency])}
                meta={<T kind="label" muted>{o ? `You owe ${money(o, currency)}` : "You owe nothing"}{d ? `, you’re owed ${money(d, currency)}` : ""}</T>}
                right={<T kind="amount" color={net > 0 ? c.action : c.ink}>{net === 0 ? "Square" : `${money(Math.abs(net), currency)} ${net > 0 ? "ahead" : "behind"}`}</T>} />;
            }) : <Row first title="All square" meta={<T kind="label" muted>Nothing owed either way.</T>} />}
          </Panel>
          {currencies.length > 1 ? <T kind="label" muted style={{ paddingHorizontal: 4 }}>One line for each currency. Commune never adds {CURRENCY_WORD[currencies[0]]} and {CURRENCY_WORD[currencies[1]]} together.</T> : null}
        </Still>

        <Still index={next()} style={{ gap: 10 }}>
          <SectionHead title="How people pay you" right={<Pressable accessibilityRole="button" onPress={() => router.push("/pay-links")} hitSlop={8}><T kind="label" style={{ fontWeight: "600", textDecorationLine: "underline" }}>Edit</T></Pressable>} />
          <Panel>
            {myPayLinks == null ? <Row first title="Loading…" /> : null}
            {links.map((link, index) => <Row key={link.provider} first={index === 0}
              left={<PayMark provider={link.provider} />}
              title={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{PAY_PROVIDER_NAME[link.provider]}</T>
                {link.preferred ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.recessed, borderRadius: 10, paddingHorizontal: 7, height: 20 }}>
                  <Star size={11} color={c.favouriteEdge} fill={c.favourite} /><Text style={{ fontSize: 11.5, fontWeight: "600", color: c.ink2 }}>Favourite</Text>
                </View> : null}
              </View>}
              meta={<T kind="label" muted lines={1}>{payLinkLabel(link)}</T>}
              right={<PressScale accessibilityRole="button" disabled={busy} accessibilityState={{ selected: !!link.preferred }}
                accessibilityLabel={link.preferred ? `${PAY_PROVIDER_NAME[link.provider]} is your favourite` : `Make ${PAY_PROVIDER_NAME[link.provider]} your favourite`}
                onPress={() => void star(link.provider)} hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Star size={20} color={link.preferred ? c.favouriteEdge : c.ink2} fill={link.preferred ? c.favourite : "transparent"} strokeWidth={1.7} />
              </PressScale>} />)}
            {missing.length ? <Row first={!links.length && myPayLinks != null} onPress={() => router.push("/pay-links")}
              left={icon(<Plus size={17} color={c.ink} />)} title={`Add ${missing.slice(0, 2).join(" or ")}`} right={<ChevronRight size={17} color={c.ink2} />} /> : null}
          </Panel>
          <T kind="label" muted style={{ paddingHorizontal: 4 }}>People in your communes see these when they owe you, with the amount filled in. Star one to make it your favourite.</T>
        </Still>

        <Still index={next()}>
          <Panel>
            <Row first onPress={() => void askSignOut()} left={icon(<LogOut size={17} color={c.late} />, c.lateSoft)}
              title={<T kind="body" color={c.late} style={{ fontSize: 15, lineHeight: 20, fontWeight: "600" }}>Sign out</T>} />
          </Panel>
        </Still>
        <T kind="label" muted style={{ textAlign: "center" }}>Commune {Constants.expoConfig?.version ?? ""}</T>
      </View>
    </Body>
  </View>;
}
