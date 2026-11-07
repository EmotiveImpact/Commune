import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, ExternalLink } from "lucide-react-native";
import { memberName, outstanding, payLinksOf } from "../../src/lib/derive";
import { firstName, money } from "../../src/lib/format";
import { bankDetailsText, payLinkHref, payLinkLabel, PAY_PROVIDER_NAME } from "../../src/lib/payLinks";
import { useApp } from "../../src/state";
import { photoOf } from "../../src/ui/chrome";
import { Button, Panel, Row, T, Who, tap, FITTED } from "../../src/ui/kit";
import { PayMark } from "../../src/ui/marks";
import { Rise } from "../../src/ui/motion";
import { Sheet } from "../../src/ui/sheet";
import { swapSheet } from "../../src/ui/origin";
import { useTheme } from "../../src/ui/theme";

/**
 * "Pay Tom £5.90": every way they take money. Each opens your own app with
 * the amount filled in where it can; Commune never moves money. Coming back
 * asks whether it went.
 */
function PayBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const { snapshots, openPayLink } = useApp();
  const [copied, setCopied] = useState(false);
  const found = snapshots.flatMap((snapshot) => snapshot.expenses.flatMap((expense) => expense.shares
    .filter((share) => share.id === shareId).map((share) => ({ snapshot, expense, share }))))[0];
  const left = found ? outstanding(found.share) : 0;
  if (!found || !left) {
    return <View style={[FITTED, { padding: 24, gap: 14, backgroundColor: c.canvas }]}>
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

  const others = links.map((link) => (link.provider === "bank" ? "your bank" : PAY_PROVIDER_NAME[link.provider]));
  const movers = others.length < 2 ? others.join("") : `${others.slice(0, -1).join(", ")} or ${others[others.length - 1]}`;
  return <ScrollView style={[FITTED, { flexGrow: 0, backgroundColor: c.canvas }]} contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 18 }}>
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}>
      <Pressable accessibilityRole="button" onPress={close} hitSlop={8} style={{ minWidth: 64 }}><T kind="body" style={{ fontSize: 16 }}>Cancel</T></Pressable>
      <T kind="strong" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }} lines={1}>Pay {name} {amount}</T>
      <View style={{ minWidth: 64 }} />
    </View>
    <Rise index={0} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <Who name={memberName(snapshot, expense.paidByUserId)} photo={photoOf(snapshot.commune.kind)} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="section" lines={2}>{expense.title}</T>
        <T kind="body" muted>{snapshot.commune.name}</T>
      </View>
      <T kind="amount" style={{ fontSize: 21, lineHeight: 26 }}>{amount}</T>
    </Rise>
    {links.length ? <Rise index={1}><T kind="body" muted>{name} takes these. Pick one and it opens in your own app.</T></Rise> : null}
    {links.length ? <Rise index={2}><Panel>{links.map((link, index) => {
      const provider = PAY_PROVIDER_NAME[link.provider];
      const target = payLinkHref(link, left, currency, expense.title);
      const favourite = link.preferred ? " · their favourite" : "";
      if (!target) {
        return <Row key={link.provider} first={index === 0}
          left={<PayMark provider="bank" size={32} />}
          title="Bank transfer"
          meta={<T kind="label" muted>{payLinkLabel(link)}{favourite}</T>}
          right={<Button size="sm" variant="secondary" label={copied ? "Copied" : "Copy"} icon={copied ? <Check size={14} color={c.ink} /> : <Copy size={14} color={c.ink} />}
            accessibilityLabel={`Copy ${name}’s bank details`}
            onPress={() => { Clipboard.setStringAsync(bankDetailsText(link)).then(() => { setCopied(true); tap("success"); }).catch(() => undefined); }} />} />;
      }
      return <Row key={link.provider} first={index === 0} accessibilityLabel={`Open ${provider}`}
        onPress={() => { close(); openPayLink(shareId, provider, target.href); }}
        left={<PayMark provider={link.provider} size={32} />}
        title={`Open ${provider}`}
        meta={<T kind="label" muted>{target.amountFilled ? `With ${amount} filled in` : `On ${name}’s profile, then send ${amount}`}{favourite}</T>}
        right={<ExternalLink size={17} color={c.ink2} />} />;
    })}</Panel></Rise> : <T kind="body" muted>{name} hasn’t said how they like to be paid. Pay them however you usually do.</T>}
    {links.length ? <Rise index={3}><T kind="note" muted style={{ textAlign: "center" }}>{movers.charAt(0).toUpperCase() + movers.slice(1)} moves the money. Commune just records it.</T></Rise> : null}
    <Rise index={4}><Button size="lg" block variant="secondary" label={`I’ve already paid, tell ${name}`} onPress={() => { swapSheet(); router.replace(`/record/${shareId}`); }} /></Rise>
  </ScrollView>;
}

export default function Pay() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><PayBody close={() => setClosing(true)} /></Sheet>;
}
