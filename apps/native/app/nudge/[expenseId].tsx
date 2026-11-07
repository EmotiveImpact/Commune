import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memberName } from "../../src/lib/derive";
import { firstName, joinAnd, money, word } from "../../src/lib/format";
import { failure, useApp } from "../../src/state";
import { People, PersonChip, SheetBar } from "../../src/ui/form";
import { Button, ErrorText, T, tap, FITTED } from "../../src/ui/kit";
import { Sheet } from "../../src/ui/sheet";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

/**
 * Nudge the people who still owe on an expense you paid: choose who, see the
 * reminder they'll get, then send it. Nobody is nudged until you press Send.
 */
function NudgeBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { waiting, snapshots, user, nudge } = useApp();
  const entry = waiting.find((item) => item.expenseId === expenseId);
  // Kept from when the sheet opened, so sending doesn't empty it while it closes.
  const [open] = useState(() => entry?.debtors.filter((debtor) => debtor.canNudge && !debtor.nudgedToday && !debtor.pending) ?? []);
  const [chosen, setChosen] = useState<string[]>(open.map((debtor) => debtor.shareId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!entry || !open.length) {
    return <View style={[FITTED, { padding: 24, gap: 14, backgroundColor: c.canvas }]}>
      <T kind="title">No one to nudge</T>
      <T kind="body" muted>Everyone has paid, said they’ve paid or been nudged today.</T>
      <Button label="Close" variant="secondary" onPress={close} />
    </View>;
  }
  const snapshot = snapshots.find((item) => item.commune.id === entry.communeId);
  const me = snapshot && user ? memberName(snapshot, user.id) : "You";
  const picked = open.filter((debtor) => chosen.includes(debtor.shareId));
  const sample = picked[0] ?? open[0];
  const skipped = entry.debtors.filter((debtor) => !open.some((item) => item.shareId === debtor.shareId));
  const label = picked.length === 1 ? `Send nudge to ${firstName(picked[0].name)}`
    : `Send nudge to ${picked.length < 10 ? word(picked.length) : picked.length} people`;

  async function send() {
    setBusy(true); setError("");
    const sent: string[] = [];
    try {
      for (const debtor of picked) { await nudge(entry!.communeId, debtor.shareId); sent.push(firstName(debtor.name)); }
      tap("success");
      toast(`Nudged ${joinAnd(sent)}.`);
      close();
    } catch (cause) {
      setError(failure(cause, sent.length ? `Nudged ${joinAnd(sent)}, but couldn’t send the rest.` : "Couldn’t send the nudge. Try again."));
    } finally { setBusy(false); }
  }

  return <ScrollView style={[FITTED, { flexGrow: 0, backgroundColor: c.canvas }]} contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 18 }}>
    <SheetBar title="Send a nudge" onCancel={close} />
    <View style={{ gap: 2 }}>
      <T kind="section" lines={2}>{entry.title}</T>
      <T kind="body" muted>{snapshot?.commune.name}</T>
    </View>
    <View style={{ gap: 8 }}>
      <People label="Who to nudge">
        {open.map((debtor) => <PersonChip key={debtor.shareId} many name={debtor.name} label={firstName(debtor.name)} detail={money(debtor.amountMinor, entry.currency)}
          on={chosen.includes(debtor.shareId)}
          onPress={() => { tap("select"); setChosen(chosen.includes(debtor.shareId) ? chosen.filter((id) => id !== debtor.shareId) : [...chosen, debtor.shareId]); }} />)}
      </People>
      {skipped.length ? <T kind="note" muted>{joinAnd(skipped.map((debtor) => firstName(debtor.name)))} {skipped.length === 1 ? "isn’t" : "aren’t"} here: already nudged today or said they’ve paid.</T> : null}
    </View>
    <View style={{ gap: 8 }}>
      <T kind="label" style={{ fontWeight: "600" }}>They’ll see</T>
      <View style={{ padding: 16, borderRadius: 14, backgroundColor: c.recessed, gap: 6 }}>
        <T kind="strong">A reminder from {me}</T>
        <T kind="body">{me} reminded you about your {money(sample.amountMinor, entry.currency)} expense share for {entry.title}{snapshot ? ` in ${snapshot.commune.name}` : ""}.</T>
      </View>
      {picked.length > 1 ? <T kind="note" muted>Each person sees their own amount.</T> : null}
    </View>
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label={label} busy={busy} disabled={!picked.length} onPress={() => void send()} />
  </ScrollView>;
}

export default function Nudge() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><NudgeBody close={() => setClosing(true)} /></Sheet>;
}
