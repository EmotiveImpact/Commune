import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { handBackSoon } from "../../src/lib/settled";
import { leftFrom, memberName, pendingReport } from "../../src/lib/derive";
import { SheetDone } from "../../src/ui/settled";
import { addDays, firstName, money, shortDate } from "../../src/lib/format";
import { splitReference } from "../../src/lib/reference";
import { failure, useApp } from "../../src/state";
import { photoOf } from "../../src/ui/chrome";
import { BigAmount, Facts, SheetBar } from "../../src/ui/form";
import { Button, ErrorText, T, Who, tap, FITTED } from "../../src/ui/kit";
import { Rise } from "../../src/ui/motion";
import { Sheet } from "../../src/ui/sheet";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

/**
 * "Jordan says they've paid you". You look at your own account, then confirm
 * it or say it hasn't arrived. Commune never moves money; confirming records
 * it against their share.
 */
function ConfirmBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const { snapshots, today, resolveReport, user } = useApp();
  const [finished, setFinished] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState<"" | "confirm" | "decline">("");
  const [error, setError] = useState("");
  const live = snapshots.flatMap((snapshot) => snapshot.expenses.flatMap((expense) => expense.shares
    .filter((share) => pendingReport(share)?.id === reportId).map((share) => ({ snapshot, expense, share, report: pendingReport(share)! }))))[0];
  // Kept from when the sheet opened, so answering doesn't blank it while it closes.
  const [first] = useState(live);
  const found = live ?? first;
  if (finished) return <SheetDone title={finished.title} body={finished.body} onDone={close} />;
  if (!found) {
    return <View style={[FITTED, { padding: 24, gap: 14, backgroundColor: c.canvas }]}>
      <T kind="title">Already sorted</T>
      <T kind="body" muted>This payment has been confirmed or answered already.</T>
      <Button label="Close" variant="secondary" onPress={close} />
    </View>;
  }
  const { snapshot, expense, share, report } = found;
  const currency = snapshot.commune.currency;
  const full = memberName(snapshot, share.userId);
  const name = firstName(full);
  const amount = money(report.amountMinor, currency);
  const { how, note } = splitReference(report.reference);
  const when = report.sentOn === today ? "Today" : report.sentOn === addDays(today, -1) ? `Yesterday, ${shortDate(report.sentOn)}` : shortDate(report.sentOn);

  async function answer(decision: "confirm" | "decline") {
    setBusy(decision); setError("");
    try {
      if (decision === "confirm") {
        await resolveReport(snapshot.commune.id, report.id, "confirm");
        tap("success");
        const rest = leftFrom(snapshot, user?.id ?? "", share.userId, share.id) + Math.max(0, share.amountMinor - share.settledMinor - report.amountMinor);
        const end = rest > 0
          ? { title: "Confirmed.", body: `${name}’s ${amount} is recorded against their share. They still owe you ${money(rest, currency)}.` }
          : { title: `All square with ${name}.`, body: `${name}’s ${amount} is recorded. Nothing is owed between you in ${snapshot.commune.name}.` };
        if (await handBackSoon({ id: report.id, ...end })) close(); else setFinished(end);
        return;
      }
      await resolveReport(snapshot.commune.id, report.id, "decline", "Not received yet");
      toast(`${name} will see it hasn’t arrived.`);
      close();
    } catch (cause) {
      setError(failure(cause, decision === "confirm" ? "Couldn’t confirm it. Try again." : "Couldn’t send that. Try again."));
    } finally { setBusy(""); }
  }

  return <ScrollView style={[FITTED, { flexGrow: 0, backgroundColor: c.canvas }]} contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 18 }}>
    <SheetBar title="Confirm a payment" onCancel={close} />
    <Rise index={0} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <Who name={full} photo={photoOf(snapshot.commune.kind)} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="section" lines={2}>{name} says they’ve paid you</T>
        <T kind="body" muted lines={1}>{expense.title} · {snapshot.commune.name}</T>
      </View>
    </Rise>
    <Rise index={1}><BigAmount text={amount} /></Rise>
    <Rise index={2}><Facts rows={[["How", how ?? "Not said"], ["When", when], ["Note", note ?? "None"]]} /></Rise>
    <ErrorText>{error}</ErrorText>
    <Rise index={3} style={{ gap: 10 }}>
      <Button size="lg" block label={`Confirm ${name}’s ${amount}`} busy={busy === "confirm"} disabled={busy === "decline"} onPress={() => void answer("confirm")} />
      <Button size="lg" block variant="secondary" label="It hasn’t arrived yet" busy={busy === "decline"} disabled={busy === "confirm"} onPress={() => void answer("decline")} />
      <T kind="note" muted style={{ textAlign: "center" }}>Check your account first. Confirming records it against {name}’s share; Commune never moves money.</T>
    </Rise>
  </ScrollView>;
}

export default function Confirm() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><ConfirmBody close={() => setClosing(true)} /></Sheet>;
}
