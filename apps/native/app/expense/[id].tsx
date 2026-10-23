import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Check } from "lucide-react-native";
import { memberName, outstanding, pendingReport, statusFor } from "../../src/lib/derive";
import { dayDate, firstName, money, shortDate } from "../../src/lib/format";
import { failure, useApp } from "../../src/state";
import { Body, Pad } from "../../src/ui/chrome";
import { Avatar, Badge, Button, Cal, Kicker, Panel, Row, State, T } from "../../src/ui/kit";
import { PayPrimary } from "../../src/ui/pay";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ExpenseDetail() {
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshots, user, today, withdrawReport } = useApp();
  const [busy, setBusy] = useState(false);
  const snapshot = snapshots.find((item) => item.expenses.some((expense) => expense.id === id));
  const expense = snapshot?.expenses.find((item) => item.id === id);
  if (!snapshot || !expense) return <Body><Pad><T kind="body" muted>This expense is no longer here.</T></Pad></Body>;
  const currency = snapshot.commune.currency;
  const viewerId = user?.id ?? "";
  const payer = memberName(snapshot, expense.paidByUserId, viewerId);
  const mine = expense.shares.find((share) => share.userId === viewerId);
  const myReport = mine ? pendingReport(mine) : null;
  const iOwe = !!mine && expense.paidByUserId !== viewerId && outstanding(mine) > 0 && !myReport && !expense.voidedAt;
  const status = statusFor(expense.dueOn, today);

  async function withdraw() {
    if (!myReport) return;
    setBusy(true);
    try {
      await withdrawReport(snapshot!.commune.id, myReport.id);
      toast("Withdrawn. Your share is open again.");
    } catch (cause) {
      toast(failure(cause, "Couldn’t withdraw it."));
    } finally { setBusy(false); }
  }

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <Body>
      <Pad>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Cal iso={expense.dueOn} today={today} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T kind="title" accessibilityRole="header">{expense.title}</T>
            <T kind="body" muted>{snapshot.commune.name} · {expense.category ?? "Other"}</T>
          </View>
        </View>
        {expense.voidedAt ? <Badge text="Voided" /> : null}
        <Panel pad>
          <T kind="label" muted>{mine && expense.paidByUserId !== viewerId ? "Your share" : "Total"}</T>
          <T kind="headline" style={{ fontVariant: ["tabular-nums"] }}>{money(mine && expense.paidByUserId !== viewerId ? mine.amountMinor : expense.amountMinor, currency)}</T>
          <T kind="body" muted>{payer === "You" ? "You" : firstName(payer)} paid {money(expense.amountMinor, currency)}{expense.createdAt ? ` on ${dayDate(expense.createdAt.slice(0, 10))}` : ""}.</T>
          {myReport ? <State text={`Recorded, waiting for ${firstName(payer)}`} />
            : iOwe ? <State text={status.text} tone={status.tone} /> : null}
        </Panel>
        <View style={{ gap: 10 }}>
          <Kicker>Split</Kicker>
          <Panel>{expense.shares.map((share, index) => {
            const name = memberName(snapshot, share.userId, viewerId);
            const report = pendingReport(share);
            const isPayer = share.userId === expense.paidByUserId;
            const left = outstanding(share);
            return <Row key={share.id} first={index === 0}
              left={<Avatar name={name === "You" ? user?.name ?? "You" : name} size={32} />}
              title={name}
              meta={<T kind="label" muted>{isPayer ? `Paid ${money(expense.amountMinor, currency)}`
                : report ? `Said they’d paid on ${shortDate(report.sentOn)}, waiting to confirm`
                : left ? `${money(left, currency)} to pay` : `Confirmed by ${firstName(payer)}`}</T>}
              right={share.userId === viewerId && report
                ? <Button size="sm" variant="secondary" label="Withdraw" busy={busy} onPress={() => void withdraw()} />
                : !isPayer && !left ? <Badge text="Paid" tone="settled" icon={<Check size={13} color={c.onSettled} strokeWidth={2.2} />} />
                : <T kind="amount">{money(share.amountMinor, currency)}</T>} />;
          })}</Panel>
        </View>
      </Pad>
    </Body>
    {iOwe && mine ? <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 8, backgroundColor: c.canvas, borderTopWidth: 1, borderTopColor: c.outline }}>
      <PayPrimary target={{ shareId: mine.id, communeId: snapshot.commune.id, payerId: expense.paidByUserId, payerName: memberName(snapshot, expense.paidByUserId), amountMinor: outstanding(mine), currency, title: expense.title }} />
    </View> : null}
  </View>;
}
