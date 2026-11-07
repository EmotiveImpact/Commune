import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memberName } from "../../src/lib/derive";
import { firstName, money, parseAmount, word } from "../../src/lib/format";
import { isEven, rescale } from "../../src/lib/recurringSplit";
import { failure, useApp } from "../../src/state";
import { SheetHead } from "../../src/ui/form";
import { Button, ErrorText, FITTED, Panel, Row, T, tap } from "../../src/ui/kit";
import { Segmented } from "../../src/ui/segmented";
import { Sheet } from "../../src/ui/sheet";
import { Text, TextInput } from "../../src/ui/text";
import { useToast } from "../../src/ui/toast";
import { radius, useTheme } from "../../src/ui/theme";

type Freq = "weekly" | "monthly";
const FREQS: Array<{ value: Freq; label: string }> = [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }];

/** Edit a repeating bill (v7's recEditSheet): the amount each time and how often. Changes start with the next bill. */
export default function RecurringEdit() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><EditBody close={() => setClosing(true)} /></Sheet>;
}

function EditBody({ close }: { close(): void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { current, user, backend, refresh } = useApp();
  const bill = current?.recurringBills?.find((item) => item.id === id);
  const [amount, setAmount] = useState(() => (bill ? (bill.amountMinor / 100).toFixed(2) : ""));
  const [freq, setFreq] = useState<Freq>(bill?.frequency ?? "monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!current || !bill) {
    return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 10 }]}><T kind="title">This bill has gone</T><T kind="body" muted>It may have been removed on the web.</T></View>;
  }
  const currency = current.commune.currency;
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "£";
  const minor = parseAmount(amount);
  const people = bill.allocations.length;
  const splitText = !people ? "Not split yet" : isEven(bill.allocations) ? `Equally between ${word(people)}` : `Same proportions between ${word(people)}`;
  const payer = bill.paidByUserId === user?.id ? "You" : firstName(memberName(current, bill.paidByUserId));
  const changed = minor !== bill.amountMinor || freq !== bill.frequency;

  async function save() {
    if (!minor) { setError("Enter the amount each time, like 17.99."); return; }
    setBusy(true); setError("");
    try {
      await backend.saveRecurring(current!.commune.id, {
        id: bill!.id, expectedVersion: bill!.version ?? 1, title: bill!.title, amountMinor: minor, paidByUserId: bill!.paidByUserId,
        allocations: rescale(bill!.allocations, minor), frequency: freq, nextDueOn: bill!.nextDueOn,
      });
      await refresh();
      tap("success");
      toast(`${bill!.title} is now ${money(minor, currency)} ${freq}, from the next bill.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t save that. Try again."));
    } finally { setBusy(false); }
  }

  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title={`Edit ${bill.title}`} onClose={close} />
    <View style={{ gap: 6 }}>
      <T kind="label" style={{ fontWeight: "600" }}>Amount each time</T>
      <View style={{ justifyContent: "center" }}>
        <Text style={{ position: "absolute", left: 12, fontSize: 15, color: c.ink2 }}>{symbol}</Text>
        <TextInput accessibilityLabel="Amount each time" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal"
          style={{ height: 46, borderRadius: radius.control, borderWidth: 1, borderColor: amount && !minor ? c.late : c.outline, backgroundColor: c.surface, paddingLeft: 26, paddingRight: 12, fontSize: 16, color: c.ink, fontVariant: ["tabular-nums"] }} />
      </View>
    </View>
    <View style={{ gap: 6 }}>
      <T kind="label" style={{ fontWeight: "600" }}>How often</T>
      <Segmented tone="frame" label="How often" options={FREQS} value={freq} onChange={(value) => setFreq(value as Freq)} />
    </View>
    <Panel>
      <Row first title="Paid by" right={<T kind="body" muted>{payer}</T>} />
      <Row title="Split" right={<T kind="body" muted>{splitText}</T>} />
    </Panel>
    <ErrorText>{error}</ErrorText>
    <View style={{ gap: 8, alignItems: "center" }}>
      <Button size="lg" block busy={busy} disabled={!changed} label="Save changes" onPress={() => void save()} />
      <T kind="note" muted style={{ textAlign: "center" }}>Changes start with the next bill. Bills already added stay as they were.</T>
    </View>
  </ScrollView>;
}
