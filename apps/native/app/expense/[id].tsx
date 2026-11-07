import { useState } from "react";
import { Image, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "../../src/ui/text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Clock3, PenLine } from "lucide-react-native";
import { memberName, outstanding, pendingReport, statusFor } from "../../src/lib/derive";
import { dayDate, firstName, money, shortDate } from "../../src/lib/format";
import { failure, useApp } from "../../src/state";
import { Body, Pad, photoOf } from "../../src/ui/chrome";
import { Avatar, Badge, Button, Cal, Panel, Row, State, T } from "../../src/ui/kit";
import { PayPrimary } from "../../src/ui/pay";
import { InPlaceCard, useInPlace } from "../../src/ui/settled";
import { ToastLift, useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";
import { useRemind } from "../../src/ui/remind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ExpenseDetail() {
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshots, user, today, withdrawReport } = useApp();
  const [busy, setBusy] = useState(false);
  // Paid from the dock: the dock itself says All square, as in the opening flow.
  const place = useInPlace();
  const remindFor = useRemind();
  const router = useRouter();
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
  // What happened to this bill, newest first: added, then each payment someone recorded and what came of it.
  const who = (userId: string | null) => { const name = userId ? memberName(snapshot, userId, viewerId) : "Someone"; return name === "You" ? "You" : firstName(name); };
  const history = [
    ...(expense.createdAt ? [{ key: "added", day: expense.createdAt.slice(0, 10), text: `${who(expense.paidByUserId)} added it` }] : []),
    ...expense.shares.flatMap((share) => (share.paymentReports ?? []).flatMap((report) => [
      { key: `${report.id}-sent`, day: report.reportedAt.slice(0, 10), text: `${who(report.reportedBy)} said they’d sent ${money(report.amountMinor, currency)}` },
      ...(report.resolvedAt && report.status !== "pending" ? [{ key: `${report.id}-done`, day: report.resolvedAt.slice(0, 10),
        text: report.status === "confirmed" ? `${who(report.resolvedBy)} confirmed ${money(report.amountMinor, currency)}` : report.status === "declined" ? `${who(report.resolvedBy)} said it hadn’t arrived` : `${who(report.reportedBy)} withdrew it` }] : []),
    ])),
    ...(expense.voidedAt ? [{ key: "void", day: expense.voidedAt.slice(0, 10), text: "Voided" }] : []),
  ].sort((a, b) => b.day.localeCompare(a.day));

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
            {/* v7's place tag: the commune's photo, small, beside its name. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Image source={{ uri: photoOf(snapshot.commune.kind) }} style={{ width: 14, height: 14, borderRadius: 4 }} />
              <T kind="label" muted>{snapshot.commune.name} · {expense.category ?? "Other"}</T>
            </View>
          </View>
        </View>
        {expense.voidedAt ? <Badge text="Voided" /> : null}
        <Panel style={{ padding: 24, gap: 6 }}>
          <T kind="label" muted>{mine && expense.paidByUserId !== viewerId ? "Your share" : "Total"}</T>
          <Text accessibilityRole="header" style={{ fontSize: 44, lineHeight: 48, fontWeight: "500", letterSpacing: -1.2, color: c.ink, fontVariant: ["tabular-nums"] }}>{money(mine && expense.paidByUserId !== viewerId ? mine.amountMinor : expense.amountMinor, currency)}</Text>
          <T kind="body" muted>{payer === "You" ? "You" : firstName(payer)} paid {money(expense.amountMinor, currency)}{expense.createdAt ? ` on ${dayDate(expense.createdAt.slice(0, 10))}` : ""}.</T>
          {myReport ? <State text={`Recorded, waiting for ${firstName(payer)}`} />
            : iOwe ? <State text={status.text} tone={status.tone} /> : null}
        </Panel>
        {expense.voidedAt ? null : <Button variant="secondary" block label={iOwe ? "Remind me to pay" : "Remind me"} accessibilityLabel={`Remind me about ${expense.title}`}
          icon={<Clock3 size={16} color={c.ink} />} onPress={remindFor(`expense:${expense.id}`)} />}
        {/* Whoever paid, or an admin, can correct it. The earlier version is kept beside the change. */}
        {!expense.voidedAt && (expense.paidByUserId === viewerId || snapshot.commune.role === "admin")
          ? <Button variant="quiet" block label="Edit bill" accessibilityLabel={`Edit ${expense.title}`}
            icon={<PenLine size={16} color={c.ink} />} onPress={() => router.push(`/edit-expense/${expense.id}`)} /> : null}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "500", color: c.ink2, paddingHorizontal: 4 }}>{expense.shares.every((share) => share.amountMinor === expense.shares[0].amountMinor) ? "Split equally" : "Split"}</Text>
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
                : <T kind="label" muted style={{ fontSize: 14 }}>{money(share.amountMinor, currency)}</T>} />;
          })}</Panel>
        </View>
        {history.length ? <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "500", color: c.ink2, paddingHorizontal: 4 }}>History</Text>
          <Panel>{history.map((item, index) => <Row key={item.key} first={index === 0} title={<T kind="label">{item.text}</T>} right={<T kind="note" muted>{shortDate(item.day)}</T>} />)}</Panel>
        </View> : null}
      </Pad>
    </Body>
    {(iOwe && mine) || place.done ? <View style={{ padding: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), gap: 8, backgroundColor: c.canvas }}>
      {/* v7's dock: the page fades into it instead of meeting a hard line. */}
      <Svg pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: -28, height: 28 }} width="100%" height={28} preserveAspectRatio="none">
        <Defs><LinearGradient id="dockFade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.canvas} stopOpacity={0} /><Stop offset="1" stopColor={c.canvas} stopOpacity={1} /></LinearGradient></Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dockFade)" />
      </Svg>
      <ToastLift />
      {place.done || !mine ? place.done ? <InPlaceCard done={place.done} /> : null : <PayPrimary onStart={() => place.claim(mine.id)} target={{ shareId: mine.id, communeId: snapshot.commune.id, payerId: expense.paidByUserId, payerName: memberName(snapshot, expense.paidByUserId), amountMinor: outstanding(mine), currency, title: expense.title }} />}
    </View> : null}
  </View>;
}
