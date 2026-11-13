import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { BellOff, Settings } from "lucide-react-native";
import { memberName } from "../src/lib/derive";
import { feedTime, firstName, money } from "../src/lib/format";
import { askedWords } from "../src/lib/joinCodes";
import type { Notification, Snapshot } from "../src/lib/types";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Avatar, Button, Empty, Kicker, Panel, Row, T } from "../src/ui/kit";
import { PressScale } from "../src/ui/motion";
import { useTheme } from "../src/ui/theme";

const WORDS: Record<Notification["kind"], (name: string, amount: string, title: string) => string> = {
  "nudge": (name, amount, title) => `${name} nudged you about ${title}${amount ? `, ${amount}` : ""}.`,
  "chase": (name, amount, title) => `${name} reminded you about your pledge to ${title}${amount ? `, ${amount}` : ""}.`,
  "payment-reported": (name, amount, title) => `${name} says they’ve paid you ${amount} for ${title}.`,
  "payment-confirmed": (name, amount, title) => `${name} confirmed your ${amount} for ${title}.`,
  "payment-declined": (name, _amount, title) => `${name} hasn’t received your payment for ${title} yet.`,
  "receipt-reversed": (name, amount, title) => `${name} reversed a ${amount} payment on ${title}.`,
  "expense-corrected": (name, _amount, title) => `${name} corrected ${title}.`,
  "expense-voided": (name, _amount, title) => `${name} voided ${title}.`,
};

type Item = { snapshot: Snapshot; item: Notification };

/**
 * Notifications: what needs you first, then today and earlier. Each one has
 * the thing you'd do next on it. The gear opens notification settings.
 */
export default function Notifications() {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, today, waiting, markAllRead, joinWaiting, setCurrent } = useApp();
  // What was new when the page opened keeps its dot until you leave.
  const [fresh] = useState(() => new Set(snapshots.flatMap((snapshot) => snapshot.notifications.filter((item) => !item.readAt).map((item) => item.id))));
  // Seeing the list counts as reading it.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markAllRead().catch(() => undefined);
  }, [markAllRead]);
  const items: Item[] = snapshots.flatMap((snapshot) => snapshot.notifications.map((item) => ({ snapshot, item })))
    .sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
  const todays = items.filter(({ item }) => item.createdAt.slice(0, 10) >= today);
  const earlier = items.filter(({ item }) => item.createdAt.slice(0, 10) < today);
  const toConfirm = waiting.flatMap((entry) => entry.debtors.filter((debtor) => debtor.pending).map((debtor) => ({ entry, debtor })));
  const gear = () => <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Notification settings" hitSlop={6}
    onPress={() => router.push("/notification-settings")}
    style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
    <Settings size={21} color={c.onFrame} strokeWidth={1.8} />
  </PressScale>;

  function open({ item }: Item): (() => void) | undefined {
    if (item.kind === "chase") return () => router.push("/funds");
    return item.expenseId ? () => router.push(`/expense/${item.expenseId}`) : undefined;
  }
  function action({ snapshot, item }: Item) {
    const name = firstName(memberName(snapshot, item.senderUserId));
    if (item.kind === "nudge") {
      const share = snapshot.expenses.flatMap((expense) => expense.shares).find((entry) => entry.id === item.sourceId);
      if (share && share.settledMinor < share.amountMinor) {
        return <Button size="sm" label={`Pay ${name} ${money(share.amountMinor - share.settledMinor, snapshot.commune.currency)}`} onPress={() => router.push(`/pay/${share.id}`)} />;
      }
    }
    if (item.kind === "chase") return <Button size="sm" variant="secondary" label="Open Funds" onPress={() => router.push("/funds")} />;
    if (item.expenseId) return <Button size="sm" variant="secondary" label="Open" onPress={() => router.push(`/expense/${item.expenseId}`)} />;
    return null;
  }
  function list(group: Item[]) {
    return <Panel>{group.map((entry, index) => {
      const { snapshot, item } = entry;
      const name = firstName(memberName(snapshot, item.senderUserId));
      const amount = item.amountMinor != null ? money(item.amountMinor, snapshot.commune.currency) : "";
      const title = item.title ?? snapshot.expenses.find((expense) => expense.id === item.expenseId || expense.shares.some((share) => share.id === item.sourceId))?.title ?? "an expense";
      const next = action(entry);
      return <Row key={item.id} first={index === 0} onPress={open(entry)}
        left={<View>
          <Avatar name={memberName(snapshot, item.senderUserId)} size={40} />
          {!fresh.has(item.id) ? null : <View accessibilityLabel="New" style={{ position: "absolute", top: -1, right: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: c.dot, borderWidth: 2, borderColor: c.surface }} />}
        </View>}
        title={<T kind="body" style={{ fontSize: 15, lineHeight: 20, fontWeight: fresh.has(item.id) ? "600" : "400" }}>{WORDS[item.kind]?.(name, amount, title) ?? item.detail ?? "Something changed."}</T>}
        meta={<View style={{ gap: 8, marginTop: 2 }}>
          <T kind="label" muted style={{ fontSize: 12.5, lineHeight: 17 }}>{snapshot.commune.name} · {feedTime(item.createdAt, today)}</T>
          {next ? <View style={{ alignSelf: "flex-start" }}>{next}</View> : null}
        </View>} />;
    })}</Panel>;
  }
  const nothing = !items.length && !toConfirm.length && !joinWaiting.length;
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <Stack.Screen options={{ headerRight: gear }} />
    <Body>
      <Pad gap={18}>
        {toConfirm.length || joinWaiting.length ? <View style={{ gap: 8 }}>
          <Kicker>Needs you</Kicker>
          <Panel>{joinWaiting.map(({ communeId, communeName, request }, index) => <Row key={request.id} first={index === 0}
            onPress={() => { setCurrent(communeId); router.push("/members"); }}
            left={<Avatar name={request.name} size={40} />}
            title={<T kind="body" style={{ fontSize: 15, lineHeight: 20, fontWeight: "600" }}>{request.name} wants to join {communeName}.</T>}
            meta={<View style={{ gap: 8, marginTop: 2 }}>
              <T kind="label" muted style={{ fontSize: 12.5, lineHeight: 17 }}>{communeName} · Scanned your QR code {askedWords(request.createdAt)}</T>
              <View style={{ alignSelf: "flex-start" }}><Button size="sm" label="Review" onPress={() => { setCurrent(communeId); router.push("/members"); }} /></View>
            </View>} />)}
          {toConfirm.map(({ entry, debtor }, index) => <Row key={debtor.pending!.id} first={index === 0 && !joinWaiting.length}
            left={<Avatar name={debtor.name} size={40} />}
            title={<T kind="body" style={{ fontSize: 15, lineHeight: 20, fontWeight: "600" }}>{firstName(debtor.name)} says they’ve paid you {money(debtor.pending!.amountMinor, entry.currency)} for {entry.title}.</T>}
            meta={<View style={{ gap: 8, marginTop: 2 }}>
              <T kind="label" muted style={{ fontSize: 12.5, lineHeight: 17 }}>{snapshots.find((s) => s.commune.id === entry.communeId)?.commune.name} · Check it arrived, then confirm</T>
              <View style={{ alignSelf: "flex-start" }}><Button size="sm" label={`Confirm ${money(debtor.pending!.amountMinor, entry.currency)}`}
                onPress={() => router.push(`/confirm/${debtor.pending!.id}`)} /></View>
            </View>} />)}</Panel>
        </View> : null}
        {todays.length ? <View style={{ gap: 8 }}><Kicker>Today</Kicker>{list(todays)}</View> : null}
        {earlier.length ? <View style={{ gap: 8 }}><Kicker>Earlier</Kicker>{list(earlier)}</View> : null}
        {nothing ? <Panel><Empty icon={<BellOff size={18} color={c.onSettled} />} title="You’re all caught up"
          body="Payments to confirm, nudges and changes to your expenses show up here." /></Panel> : null}
        <T kind="note" muted style={{ paddingHorizontal: 4, textAlign: "center" }}>Choose what you’re told about with the gear at the top.</T>
      </Pad>
    </Body>
  </View>;
}
