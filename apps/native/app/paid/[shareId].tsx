import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memberName, outstanding, pendingReport } from "../../src/lib/derive";
import { firstName, money } from "../../src/lib/format";
import { failure, useApp } from "../../src/state";
import { Button, ErrorText, T, tap } from "../../src/ui/kit";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

/**
 * Asked on coming back from a pay link: did the money go? Yes tells the
 * person you paid the whole share today, with the app you used as the
 * reference. They still confirm it before anything changes.
 */
export default function Paid() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { shareId, provider = "" } = useLocalSearchParams<{ shareId: string; provider?: string }>();
  const { snapshots, today, reportPayment } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const found = snapshots.flatMap((snapshot) => snapshot.expenses.flatMap((expense) => expense.shares
    .filter((share) => share.id === shareId).map((share) => ({ snapshot, expense, share }))))[0];
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const left = found ? outstanding(found.share) : 0;
  if (!found || !left || pendingReport(found.share)) {
    return <View style={{ flex: 1, padding: 24, gap: 14, backgroundColor: c.canvas }}>
      <T kind="title">{found && pendingReport(found.share) ? "Already recorded" : "Nothing left to pay"}</T>
      <Button label="Close" variant="secondary" onPress={close} />
    </View>;
  }
  const { snapshot, expense } = found;
  const name = firstName(memberName(snapshot, expense.paidByUserId));
  const amount = money(left, snapshot.commune.currency);

  async function yes() {
    setBusy(true); setError("");
    try {
      await reportPayment(snapshot.commune.id, shareId, left, today, provider || null);
      tap("success");
      toast(`Recorded. ${name} will confirm your ${amount}.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t record it. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return <View style={{ width: "100%", padding: 20, paddingTop: 22, gap: 16, backgroundColor: c.canvas }}>
    <View style={{ gap: 4 }}>
      <T kind="title" accessibilityRole="header">Did {amount} go to {name}?</T>
      <T kind="body" muted>{expense.title}{provider ? ` · paid with ${provider}, today` : ""}</T>
    </View>
    <T kind="body" muted>{provider ? `You opened ${provider} a moment ago. ` : ""}If it went through, tell {name} so they can confirm it.</T>
    <ErrorText>{error}</ErrorText>
    <View style={{ gap: 10 }}>
      <Button size="lg" block label={`Yes, tell ${name}`} busy={busy} onPress={() => void yes()} />
      <Button size="lg" block variant="secondary" label="Paid a different amount" disabled={busy} onPress={() => router.replace(`/record/${shareId}`)} />
      <Button size="lg" block variant="quiet" label="Not yet" disabled={busy} onPress={close} />
    </View>
    <T kind="note" muted>Your share stays open until {name} confirms they received it.</T>
  </View>;
}
