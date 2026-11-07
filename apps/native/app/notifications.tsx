import { useEffect, useRef } from "react";
import { Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { memberName } from "../src/lib/derive";
import { feedTime, firstName, money } from "../src/lib/format";
import type { Notification } from "../src/lib/types";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Avatar, Button, Kicker, Panel, Row, T } from "../src/ui/kit";
import { NOTIFY_KINDS, usePrefs } from "../src/prefs";
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

export default function Notifications() {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, today, waiting, markAllRead } = useApp();
  const { notify, setNotify } = usePrefs();
  // Seeing the list counts as reading it.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markAllRead().catch(() => undefined);
  }, [markAllRead]);
  const items = snapshots.flatMap((snapshot) => snapshot.notifications.map((item) => ({ snapshot, item })))
    .sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
  const toConfirm = waiting.flatMap((entry) => entry.debtors.filter((debtor) => debtor.pending).map((debtor) => ({ entry, debtor })));
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <Body>
      <Pad>
        {toConfirm.length ? <Panel>{toConfirm.map(({ entry, debtor }, index) => <Row key={debtor.pending!.id} first={index === 0}
          left={<Avatar name={debtor.name} size={40} />}
          title={<T kind="bodyL">{firstName(debtor.name)} says they’ve paid you {money(debtor.pending!.amountMinor, entry.currency)} for {entry.title}.</T>}
          meta={<View style={{ gap: 8, marginTop: 4 }}><T kind="label" muted>{snapshots.find((s) => s.commune.id === entry.communeId)?.commune.name}</T>
            <View style={{ alignSelf: "flex-start" }}><Button size="sm" label={`Confirm ${firstName(debtor.name)}’s ${money(debtor.pending!.amountMinor, entry.currency)}`}
              onPress={() => router.push(`/confirm/${debtor.pending!.id}`)} /></View></View>} />)}</Panel> : null}
        {items.length ? <Panel>{items.map(({ snapshot, item }, index) => {
          const name = firstName(memberName(snapshot, item.senderUserId));
          const amount = item.amountMinor != null ? money(item.amountMinor, snapshot.commune.currency) : "";
          return <Row key={item.id} first={index === 0}
            onPress={item.expenseId ? () => router.push(`/expense/${item.expenseId}`) : undefined}
            left={<Avatar name={memberName(snapshot, item.senderUserId)} size={40} />}
            title={<T kind="body" style={{ fontWeight: item.readAt ? "400" : "600" }}>{WORDS[item.kind]?.(name, amount, item.title ?? snapshot.expenses.find((expense) => expense.id === item.expenseId || expense.shares.some((share) => share.id === item.sourceId))?.title ?? "an expense") ?? item.detail ?? "Something changed."}</T>}
            meta={<T kind="label" muted>{snapshot.commune.name} · {feedTime(item.createdAt, today)}</T>} />;
        })}</Panel> : !toConfirm.length ? <Panel pad><T kind="body" muted>Nothing new. You’ll see payments, nudges and changes to your expenses here.</T></Panel> : null}
        <View style={{ gap: 10 }}>
          <Kicker>Send me a notification when</Kicker>
          <Panel>{NOTIFY_KINDS.map((kind, index) => <Row key={kind.id} first={index === 0} title={kind.label}
            right={<Switch accessibilityLabel={kind.label} value={notify[kind.id]} onValueChange={(on) => setNotify(kind.id, on)}
              trackColor={{ true: c.action, false: c.recessed }} ios_backgroundColor={c.recessed} />} />)}</Panel>
          <T kind="note" muted style={{ paddingHorizontal: 4 }}>These choices are kept on this phone for now. Quiet hours follow your phone’s Focus settings.</T>
        </View>
      </Pad>
    </Body>
  </View>;
}
