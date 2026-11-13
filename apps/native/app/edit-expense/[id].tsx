import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { activeMembers } from "../../src/lib/derive";
import type { Snapshot } from "../../src/lib/types";
import { changed, correctedShares, wasEven } from "../../src/lib/correction";
import { addDays, firstName, money, parseAmount, requestId, shortDate } from "../../src/lib/format";
import { failure, useApp } from "../../src/state";
import { Button, ErrorText, FITTED, Panel, T, tap } from "../../src/ui/kit";
import { Chips, DateChips, Field, People, PersonChip, SheetHead } from "../../src/ui/form";
import { useConfirm } from "../../src/ui/confirm";
import { Sheet } from "../../src/ui/sheet";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

const CATEGORIES = ["Bills", "Groceries", "Household", "Food", "Rent", "Travel", "Other"];

/**
 * Correct a bill: its name, amount, date, who paid and who shares it, with a
 * short reason. Commune keeps the bill as it was beside the change, with who
 * changed it and why; the edit is based on the version you opened, so two
 * people can't overwrite each other. Void takes the bill off the books and
 * keeps it on record.
 */
export default function EditExpense() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><Body close={() => setClosing(true)} /></Sheet>;
}

function Body({ close }: { close(): void }) {
  const { snapshots } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const snapshot = snapshots.find((item) => item.expenses.some((expense) => expense.id === id));
  const expense = snapshot?.expenses.find((item) => item.id === id);
  if (!snapshot || !expense) {
    return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 10 }]}>
      <SheetHead title="Edit bill" onClose={close} />
      <T kind="body" muted>This bill is no longer here.</T>
    </View>;
  }
  return <Form key={expense.id} close={close} opened={snapshot} />;
}

function Form({ close, opened }: { close(): void; opened: Snapshot }) {
  const { c } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { backend, user, today, refresh } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The bill as it was when the form opened: the edit is based on this version.
  const [snapshot] = useState(opened);
  const [expense] = useState(() => opened.expenses.find((item) => item.id === id)!);
  const [title, setTitle] = useState(expense.title);
  const [amount, setAmount] = useState((expense.amountMinor / 100).toFixed(2));
  const [category, setCategory] = useState(expense.category ?? "Other");
  const [due, setDue] = useState<string>(expense.dueOn ?? "");
  const [payer, setPayer] = useState(expense.paidByUserId ?? "");
  const [included, setIncluded] = useState<string[]>(expense.shares.map((share) => share.userId));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One request id per sheet, so a retry after a dropped connection counts once.
  const [request] = useState(requestId);
  const currency = snapshot.commune.currency;
  const people = activeMembers(snapshot);
  // Someone who has left still shows if they were on the bill, so their share isn't lost by accident.
  const everyone = [...people, ...expense.shares.filter((share) => !people.some((member) => member.userId === share.userId))
    .map((share) => ({ userId: share.userId, name: snapshot.members.find((member) => member.userId === share.userId)?.name ?? "Someone", role: "member" as const }))];
  const minor = parseAmount(amount) ?? 0;
  const split = correctedShares(expense, { amountMinor: minor, included });
  const draft = { title, amountMinor: minor, category, dueOn: due || null, paidByUserId: payer, included };
  const dirty = changed(expense, draft);
  const label = (userId: string, name: string) => userId === user?.id ? "You" : firstName(name);
  const nameOf = (userId: string) => everyone.find((member) => member.userId === userId)?.name ?? "Someone";

  async function save() {
    if (!title.trim()) { setError("Give the bill a name."); return; }
    if (!minor) { setError("Type the amount."); return; }
    if (!split) { setError("Choose who shares it."); return; }
    if (!reason.trim()) { setError("Say why it changed. Everyone in the commune can see it."); return; }
    setBusy(true); setError("");
    try {
      await backend.correctExpense(expense!.id, {
        expectedVersion: expense!.version ?? 1, title: title.trim(), amountMinor: minor, category, dueOn: due || null, paidByUserId: payer,
        shares: split.shares, reason: reason.trim(), requestId: request,
      });
      await refresh();
      tap("success");
      toast(`${title.trim()} corrected. The earlier version is kept.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t save the change. Try again."));
    } finally { setBusy(false); }
  }

  async function voidIt() {
    if (!reason.trim()) { setError("Say why it’s being voided first. Everyone in the commune can see it."); return; }
    if (!(await confirm({ title: `Void ${expense!.title}?`, message: "It comes off everyone’s balances. The bill and your reason stay on record.", yes: "Void bill", destructive: true }))) return;
    setBusy(true); setError("");
    try {
      await backend.voidExpense(expense!.id, { expectedVersion: expense!.version ?? 1, reason: reason.trim(), requestId: request });
      await refresh();
      tap("success");
      toast(`${expense!.title} voided.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t void it. Try again."));
    } finally { setBusy(false); }
  }

  const toggle = (userId: string) => setIncluded(included.includes(userId) ? included.filter((value) => value !== userId)
    : everyone.map((member) => member.userId).filter((value) => value === userId || included.includes(value)));
  const settledSomewhere = expense.shares.some((share) => share.userId !== expense.paidByUserId && share.settledMinor > 0);
  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title="Edit bill" sub={`${snapshot.commune.name} · everyone sees what changed`} onClose={close} />
    <Field label="What was it for?" value={title} onChange={setTitle} placeholder="Big Tesco shop" />
    <Field label="Amount" value={amount} onChange={(value) => setAmount(value.replace(/[^0-9.]/g, ""))} max={12} keyboardType="decimal-pad"
      placeholder="0.00" note={minor ? money(minor, currency) : "Type the amount, such as 23.40"} />
    <People label="Who paid">
      {everyone.map((member) => <PersonChip key={member.userId} name={member.name} label={label(member.userId, member.name)}
        on={payer === member.userId} onPress={() => { tap("select"); setPayer(member.userId); }} />)}
    </People>
    <People label="Shared between">
      {everyone.map((member) => <PersonChip key={member.userId} many name={member.name} label={label(member.userId, member.name)}
        on={included.includes(member.userId)} onPress={() => { tap("select"); toggle(member.userId); }} />)}
    </People>
    {split ? <Panel>{split.shares.map((share, index) => <View key={share.userId} style={{ flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: 16,
      borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: c.outline }}>
      <T kind="body" style={{ flex: 1 }}>{share.userId === user?.id ? "You" : nameOf(share.userId)}</T>
      <T kind="body" style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>{money(share.amountMinor, currency)}</T>
    </View>)}</Panel> : <T kind="note" muted>Choose at least one person to share it.</T>}
    {split && !split.kept && !wasEven(expense) ? <T kind="note" muted>The split was uneven. Changing the amount or people splits it equally.</T> : null}
    <Chips label="Category" options={CATEGORIES.map((value) => [value, value])} chosen={[category]} onPick={setCategory} />
    <DateChips label="Due" chosen={due} onPick={setDue}
      options={[...(expense.dueOn && expense.dueOn !== today && expense.dueOn !== addDays(today, 7) ? [[expense.dueOn, `As it was, ${shortDate(expense.dueOn)}`] as [string, string]] : []),
        [today, "Today"], [addDays(today, 7), `In a week, ${shortDate(addDays(today, 7))}`], ["", "No due date"]]} />
    <Field label="Why it changed" value={reason} onChange={setReason} max={240} placeholder="Receipt said £23.40, not £24.30"
      note="Required. It’s kept with the change, beside the bill as it was." />
    {settledSomewhere ? <T kind="note" muted>Some of this has been paid back already. Those payments stay recorded against the bill.</T> : null}
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label="Save change" busy={busy} disabled={!dirty} onPress={() => void save()} />
    <Button block variant="danger" label="Void this bill" disabled={busy} onPress={() => void voidIt()} />
  </ScrollView>;
}
