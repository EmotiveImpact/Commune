import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { activeMembers } from "../src/lib/derive";
import { addDays, equalShares, firstName, money, parseAmount, shortDate, word } from "../src/lib/format";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, T, tap, FITTED } from "../src/ui/kit";
import { BigAmount, Chips, Field, People, PersonChip, SheetBar } from "../src/ui/form";
import { Keypad } from "../src/ui/keypad";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

const CATEGORIES = ["Bills", "Groceries", "Household", "Food", "Rent", "Travel", "Other"];

/**
 * Add an expense to the commune in view, split equally between the people
 * chosen. The amount is typed on the app's own keypad under the big figure.
 */
function AddBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { current, user, today, addExpense } = useApp();
  const people = current ? activeMembers(current) : [];
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(user?.id ?? "");
  const [included, setIncluded] = useState<string[]>(people.map((member) => member.userId));
  const [category, setCategory] = useState("Other");
  const [due, setDue] = useState<string>(addDays(today, 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!current) return null;
  const currency = current.commune.currency;
  const minor = parseAmount(amount);
  const nameOf = (userId: string) => userId === user?.id ? "you" : firstName(people.find((member) => member.userId === userId)?.name ?? "");
  let shares: Array<{ userId: string; amountMinor: number }> | null = null;
  try { if (minor && included.length) shares = equalShares(minor, included); } catch { shares = null; }
  const valid = !!title.trim() && !!shares && !!payer;

  // "£10.80 each between four. Paid by you."
  let help = "Type the amount, then choose who shares it.";
  if (minor && !included.length) help = "Choose at least one person to share it.";
  else if (minor && !shares) help = "That’s less than a penny each.";
  else if (shares && minor) {
    const paidBy = `Paid by ${nameOf(payer)}.`;
    const high = shares[0].amountMinor;
    const low = shares[shares.length - 1].amountMinor;
    const each = high === low ? `${money(low, currency)} each` : `${money(low, currency)} or ${money(high, currency)} each`;
    help = shares.length === 1
      ? `All ${money(minor, currency)} on ${nameOf(shares[0].userId)}. ${paidBy}`
      : `${each} between ${shares.length < 10 ? word(shares.length) : shares.length}. ${paidBy}`;
  }

  async function save() {
    if (!valid || !shares || !minor) return;
    setBusy(true); setError("");
    try {
      await addExpense(current!.commune.id, { title: title.trim(), amountMinor: minor, category, dueOn: due || null, paidByUserId: payer, shares });
      tap("success");
      toast(`${title.trim()} added to ${current!.commune.name}.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t add it. Try again."));
    } finally { setBusy(false); }
  }

  const toggle = (userId: string) => setIncluded(included.includes(userId)
    ? included.filter((value) => value !== userId)
    : people.map((member) => member.userId).filter((value) => value === userId || included.includes(value)));
  const label = (userId: string, name: string) => userId === user?.id ? "You" : firstName(name);
  return <ScrollView style={[FITTED, { flexGrow: 0, backgroundColor: c.canvas }]} contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 18 }} keyboardShouldPersistTaps="handled">
    <SheetBar title="Add an expense" onCancel={close} />
    <View style={{ gap: 2, paddingVertical: 4 }}>
      <BigAmount text={money(minor ?? 0, currency)} empty={!minor} label={`Amount, ${money(minor ?? 0, currency)}`} />
      <T kind="label" muted style={{ textAlign: "center" }}>{current.commune.name}</T>
    </View>
    <Keypad value={amount} onChange={setAmount} />
    <Field label="What was it for?" value={title} onChange={setTitle} placeholder="Big Tesco shop" />
    <People label="Who paid">
      {people.map((member) => <PersonChip key={member.userId} name={member.name} label={label(member.userId, member.name)}
        on={payer === member.userId} onPress={() => { tap("select"); setPayer(member.userId); }} />)}
    </People>
    <View style={{ gap: 8 }}>
      <People label="Split equally between">
        {people.map((member) => <PersonChip key={member.userId} many name={member.name} label={label(member.userId, member.name)}
          on={included.includes(member.userId)} onPress={() => { tap("select"); toggle(member.userId); }} />)}
      </People>
      <T kind="note" muted accessibilityRole="text">{help}</T>
    </View>
    <Chips label="Category" options={CATEGORIES.map((value) => [value, value])} chosen={[category]} onPick={setCategory} />
    <Chips label="Due" options={[[today, "Today"], [addDays(today, 7), `In a week, ${shortDate(addDays(today, 7))}`], ["", "No due date"]]}
      chosen={[due]} onPick={setDue} />
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label={minor ? `Add ${money(minor, currency)}` : "Add expense"} busy={busy} disabled={!valid} onPress={() => void save()} />
  </ScrollView>;
}

export default function AddExpense() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><AddBody close={() => setClosing(true)} /></Sheet>;
}
