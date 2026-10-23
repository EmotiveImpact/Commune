import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Copy, ExternalLink, Landmark, X } from "lucide-react-native";
import { memberName, outstanding, payLinksOf } from "../../src/lib/derive";
import { firstName, money } from "../../src/lib/format";
import { bankDetailsText, payLinkHref, payLinkLabel, PAY_PROVIDER_NAME } from "../../src/lib/payLinks";
import { useApp } from "../../src/state";
import { Button, Panel, Row, T } from "../../src/ui/kit";
import { useTheme } from "../../src/ui/theme";

/**
 * "Pay Tom £5.90": every way they take money. Each opens your own app with
 * the amount filled in where it can; Commune never moves money. Coming back
 * asks whether it went.
 */
export default function Pay() {
  const { c } = useTheme();
  const router = useRouter();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const { snapshots, openPayLink } = useApp();
  const [copied, setCopied] = useState(false);
  const found = snapshots.flatMap((snapshot) => snapshot.expenses.flatMap((expense) => expense.shares
    .filter((share) => share.id === shareId).map((share) => ({ snapshot, expense, share }))))[0];
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const left = found ? outstanding(found.share) : 0;
  if (!found || !left) {
    return <View style={{ flex: 1, padding: 24, gap: 14, backgroundColor: c.canvas }}>
      <T kind="title">Nothing left to pay</T>
      <T kind="body" muted>This share is settled or no longer here.</T>
      <Button label="Close" variant="secondary" onPress={close} />
    </View>;
  }
  const { snapshot, expense } = found;
  const currency = snapshot.commune.currency;
  const name = firstName(memberName(snapshot, expense.paidByUserId));
  const amount = money(left, currency);
  const links = payLinksOf(snapshot, expense.paidByUserId);

  return <ScrollView style={{ backgroundColor: c.canvas }} contentContainerStyle={{ padding: 20, paddingTop: 22, gap: 18 }}>
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T kind="title" accessibilityRole="header">Pay {name} {amount}</T>
        <T kind="body" muted>{expense.title} · {snapshot.commune.name}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
        <X size={18} color={c.ink} />
      </Pressable>
    </View>
    {links.length ? <T kind="body" muted>{name} takes these. Pick one and it opens in your own app.</T> : null}
    {links.length ? <Panel>{links.map((link, index) => {
      const provider = PAY_PROVIDER_NAME[link.provider];
      const target = payLinkHref(link, left, currency, expense.title);
      const favourite = link.preferred ? " · their favourite" : "";
      if (!target) {
        return <Row key={link.provider} first={index === 0}
          left={<Mark c={c.recessed}><Landmark size={17} color={c.ink} /></Mark>}
          title={provider}
          meta={<T kind="label" muted>{payLinkLabel(link)}{favourite}</T>}
          right={<Button size="sm" variant="secondary" label={copied ? "Copied" : "Copy"} icon={<Copy size={14} color={c.ink} />}
            accessibilityLabel={`Copy ${name}’s bank details`}
            onPress={() => { Clipboard.setStringAsync(bankDetailsText(link)).then(() => setCopied(true)).catch(() => undefined); }} />} />;
      }
      return <Row key={link.provider} first={index === 0} accessibilityLabel={`Pay with ${provider}`}
        onPress={() => { close(); openPayLink(shareId, provider, target.href); }}
        left={<Mark c={link.provider === "monzo" ? c.monzo : link.provider === "paypal" ? c.paypal : c.revolut}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{provider[0]}</Text></Mark>}
        title={`Pay with ${provider}`}
        meta={<T kind="label" muted>{target.amountFilled ? `${amount} filled in` : `Enter ${amount} when it opens`}{favourite}</T>}
        right={<ExternalLink size={17} color={c.ink2} />} />;
    })}</Panel> : <T kind="body" muted>{name} hasn’t said how they like to be paid. Pay them however you usually do.</T>}
    <T kind="note" muted>The money moves in your own app. Commune never sees it.</T>
    <Button size="lg" block variant="secondary" label={`I’ve already paid, tell ${name}`} onPress={() => router.replace(`/record/${shareId}`)} />
  </ScrollView>;
}

function Mark({ c, children }: { c: string; children: React.ReactNode }) {
  return <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c, alignItems: "center", justifyContent: "center" }}>{children}</View>;
}
