import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Pencil } from "lucide-react-native";
import { memberName } from "../src/lib/derive";
import { firstName, money, shortDate } from "../src/lib/format";
import type { RecurringBill } from "../src/lib/types";
import { failure, useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Button, Cal, Panel, State, T, tap } from "../src/ui/kit";
import { Text } from "../src/ui/text";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";
import { HOLD, useRemind } from "../src/ui/remind";

/**
 * Repeating bills, as in v7: each with its next date, who pays and each
 * person's share, and Pause or Resume and Edit right on the row. Pausing
 * stops the next bill; nothing already added changes.
 */
export default function Recurring() {
  const { current } = useApp();
  const bills = (current?.recurringBills ?? []).filter((bill) => !bill.archivedAt);
  if (!current) return null;
  return <Body>
    <Pad>
      <T kind="body" muted>These add a bill to {current.commune.name} on the same day each time. Pausing stops the next one; nothing already added changes.</T>
      {bills.length ? <Panel>{bills.map((bill, index) => <BillRow key={bill.id} bill={bill} first={index === 0} />)}</Panel>
        : <Panel pad><T kind="body" muted>Nothing repeats in {current.commune.name}.</T></Panel>}
      <T kind="note" muted style={{ paddingHorizontal: 4 }}>Everyone in {current.commune.name} sees when something is paused or changed.</T>
    </Pad>
  </Body>;
}

function BillRow({ bill, first }: { bill: RecurringBill; first: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { current, user, today, backend, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const remind = useRemind()(`recurring:${bill.id}`);
  const currency = current!.commune.currency;
  const people = bill.allocations.length;
  const payer = bill.paidByUserId === user?.id ? "you pay" : `${firstName(memberName(current!, bill.paidByUserId))} pays`;
  const each = people ? bill.allocations.find((item) => item.userId === user?.id)?.amountMinor ?? Math.round(bill.amountMinor / people) : null;

  async function pause(paused: boolean) {
    setBusy(true);
    try {
      await backend.setRecurringPaused(bill.id, paused);
      await refresh();
      tap("success");
      toast(paused ? `${bill.title} is paused. No new bill until you resume it.` : `${bill.title} is back on. The next bill is due ${shortDate(bill.nextDueOn)}.`, {
        label: "Undo",
        onPress: () => void backend.setRecurringPaused(bill.id, !paused).then(refresh).catch((cause) => toast(failure(cause, "Couldn’t undo that. Try again."))),
      });
    } catch (cause) {
      toast(failure(cause, "Couldn’t change that. Try again."));
    } finally { setBusy(false); }
  }

  // Hold the row for a reminder before the next bill.
  return <Pressable accessibilityHint="Hold for a reminder" onLongPress={remind} delayLongPress={HOLD}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: c.outline2, backgroundColor: pressed ? c.press : "transparent" })}>
    <View style={{ opacity: bill.paused ? 0.5 : 1 }}><Cal iso={bill.nextDueOn} today={today} small /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: "flex-start" }}>
      <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: "600", color: c.ink }}>{bill.title}</Text>
      <Text style={{ fontSize: 12.5, lineHeight: 17, color: c.ink2 }}>
        {money(bill.amountMinor, currency)} {bill.frequency} · {payer}{each != null ? ` · ${money(each, currency)} ${bill.allocations.some((item) => item.userId === user?.id) ? "yours" : "each"}` : ""}
      </Text>
      {bill.paused ? <State text="Paused" /> : <Text style={{ fontSize: 12.5, lineHeight: 17, color: c.ink2 }}>Next bill {shortDate(bill.nextDueOn)}</Text>}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Button size="sm" variant="secondary" busy={busy} label={bill.paused ? "Resume" : "Pause"} accessibilityLabel={`${bill.paused ? "Resume" : "Pause"} ${bill.title}`} onPress={() => void pause(!bill.paused)} />
        <Button size="sm" variant="secondary" label="Edit" icon={<Pencil size={14} color={c.ink} />} accessibilityLabel={`Edit ${bill.title}`} onPress={() => router.push(`/recurring-edit/${bill.id}`)} />
      </View>
    </View>
  </Pressable>;
}
