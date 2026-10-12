import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Copy, ExternalLink, Landmark, X } from "lucide-react-native";
import { memberName, outstanding, payLinksOf, pendingReport } from "../../src/lib/derive";
import { addDays, firstName, money, parseAmount, shortDate } from "../../src/lib/format";
import { bankDetailsText, payLinkHref, payLinkLabel, PAY_PROVIDER_NAME } from "../../src/lib/payLinks";
import { failure, useApp } from "../../src/state";
import { Button, ErrorText, Panel, Row, T, tap } from "../../src/ui/kit";
import { useToast } from "../../src/ui/toast";
import { radius, useTheme } from "../../src/ui/theme";

/**
 * "I’ve sent it". The bill payer's own pay links come first, so you can pay
 * in your banking app with the amount filled in, then record it here. It is
 * a claim until they confirm it; Commune never moves money.
 */
export default function Record() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const { snapshots, today, reportPayment } = useApp();
  const found = snapshots.flatMap((snapshot) => snapshot.expenses.flatMap((expense) => expense.shares
    .filter((share) => share.id === shareId).map((share) => ({ snapshot, expense, share }))))[0];
  const left = found ? outstanding(found.share) : 0;
  const currency = found?.snapshot.commune.currency ?? "GBP";
  const [amount, setAmount] = useState(left ? (left / 100).toFixed(2) : "");
  const [sentOn, setSentOn] = useState(today);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  if (!found || !left || pendingReport(found.share)) {
    return <View style={{ flex: 1, padding: 24, gap: 14, backgroundColor: c.canvas }}>
      <T kind="title">{found && pendingReport(found.share) ? "Already recorded" : "Nothing left to pay"}</T>
      <T kind="body" muted>{found && pendingReport(found.share) ? "You’ve told them you’ve paid this. They’ll confirm it." : "This share is settled or no longer here."}</T>
      <Button label="Close" variant="secondary" onPress={close} />
    </View>;
  }
  const { snapshot, expense } = found;
  const payer = memberName(snapshot, expense.paidByUserId);
  const name = firstName(payer);
  const minor = parseAmount(amount);
  const links = payLinksOf(snapshot, expense.paidByUserId);

  async function submit() {
    if (!minor) { setError("Enter the amount you sent, for example 16.00."); return; }
    if (minor > left) { setError(`That’s more than the ${money(left, currency)} left on your share.`); return; }
    setBusy(true); setError("");
    try {
      await reportPayment(snapshot.commune.id, shareId, minor, sentOn, reference.trim() || null);
      tap("success");
      toast(`Recorded. ${name} will confirm your ${money(minor, currency)}.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t record it. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const input = { height: 46, borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 12, fontSize: 16, color: c.ink };
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 22, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T kind="title" accessibilityRole="header">Tell {name} you’ve paid</T>
          <T kind="body" muted>{expense.title} · {snapshot.commune.name}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
          <X size={18} color={c.ink} />
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600" }}>How {name} likes to be paid</T>
        {links.length ? <Panel>{links.map((link, index) => {
          const target = payLinkHref(link, minor ?? left, currency, expense.title);
          const shown = money(minor ?? left, currency);
          if (!target) {
            return <Row key={link.provider} first={index === 0}
              left={<Mark c={c.recessed}><Landmark size={17} color={c.ink} /></Mark>}
              title={PAY_PROVIDER_NAME[link.provider]}
              meta={<T kind="label" muted>{payLinkLabel(link)}</T>}
              right={<Button size="sm" variant="secondary" label={copied ? "Copied" : "Copy"} icon={<Copy size={14} color={c.ink} />}
                accessibilityLabel={`Copy ${name}’s bank details`}
                onPress={() => { Clipboard.setStringAsync(bankDetailsText(link)).then(() => setCopied(true)).catch(() => undefined); }} />} />;
          }
          return <Row key={link.provider} first={index === 0} accessibilityLabel={`Pay with ${PAY_PROVIDER_NAME[link.provider]}`}
            onPress={() => { tap(); void Linking.openURL(target.href); }}
            left={<Mark c={link.provider === "monzo" ? c.monzo : link.provider === "paypal" ? c.paypal : c.revolut}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{PAY_PROVIDER_NAME[link.provider][0]}</Text></Mark>}
            title={`Pay with ${PAY_PROVIDER_NAME[link.provider]}`}
            meta={<T kind="label" muted>{payLinkLabel(link)} · {target.amountFilled ? `${shown} filled in` : `enter ${shown} when it opens`}</T>}
            right={<ExternalLink size={17} color={c.ink2} />} />;
        })}</Panel> : <T kind="body" muted>{name} hasn’t added how they like to be paid. Pay them however you usually do.</T>}
      </View>

      <View style={{ gap: 6 }}>
        <T kind="label" style={{ fontWeight: "600" }}>Amount you sent</T>
        <TextInput accessibilityLabel="Amount you sent" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" style={input} />
        <T kind="note" muted>{money(left, currency)} is left on your share.</T>
      </View>

      <View style={{ gap: 6 }}>
        <T kind="label" style={{ fontWeight: "600" }}>When you sent it</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[today, addDays(today, -1)].map((day, index) => {
            const on = sentOn === day;
            return <Pressable key={day} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setSentOn(day)}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center", backgroundColor: on ? c.frame : c.surface, borderWidth: 1, borderColor: on ? c.frame : c.outline }}>
              <Text style={{ fontSize: 13.5, fontWeight: "500", color: on ? c.onFrame : c.ink }}>{index === 0 ? "Today" : `Yesterday, ${shortDate(day)}`}</Text>
            </Pressable>;
          })}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <T kind="label" style={{ fontWeight: "600" }}>Reference (optional)</T>
        <TextInput accessibilityLabel="Reference" value={reference} onChangeText={setReference} maxLength={80} placeholder="What you put on the payment" placeholderTextColor={c.ink2} style={input} />
      </View>

      <ErrorText>{error}</ErrorText>
      <View style={{ gap: 10 }}>
        <Button size="lg" block label={minor ? `I’ve sent ${name} ${money(minor, currency)}` : "I’ve sent it"} busy={busy} onPress={() => void submit()} />
        <T kind="note" muted>{name} confirms it before anything changes. Commune never moves money.</T>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Mark({ c, children }: { c: string; children: React.ReactNode }) {
  return <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c, alignItems: "center", justifyContent: "center" }}>{children}</View>;
}
