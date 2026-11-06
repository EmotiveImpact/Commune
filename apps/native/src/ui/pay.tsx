import { View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowUpRight, ChevronRight } from "lucide-react-native";
import { payLinksOf } from "../lib/derive";
import { firstName, money } from "../lib/format";
import { payLinkHref, PAY_PROVIDER_NAME } from "../lib/payLinks";
import type { CurrencyCode } from "../lib/types";
import { useApp } from "../state";
import { Button, T } from "./kit";
import { useTheme } from "./theme";

export type PayTarget = {
  shareId: string; communeId: string; payerId: string; payerName: string;
  amountMinor: number; currency: CurrencyCode; title: string;
};

/**
 * The main way to pay someone. With a favourite, the button opens it with the
 * amount filled in; with several and no favourite, it opens a sheet of all of
 * them; with none, it records a payment made however you usually pay them.
 */
export function PayPrimary({ target, size = "lg" }: { target: PayTarget; size?: "lg" | "md" }) {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, openPayLink } = useApp();
  const links = payLinksOf(snapshots.find((item) => item.commune.id === target.communeId), target.payerId);
  const amount = money(target.amountMinor, target.currency);
  const name = firstName(target.payerName);
  const tell = () => router.push(`/record/${target.shareId}`);
  const sheet = () => router.push(`/pay/${target.shareId}`);
  if (!links.length) {
    return <>
      <Button size={size} block label={`I’ve paid ${name} ${amount}`} onPress={tell} />
      <T kind="note" muted>{name} hasn’t said how they like to be paid. Pay them however you usually do, then record it here.</T>
    </>;
  }
  const favourite = links.find((link) => link.preferred);
  if (favourite) {
    const provider = PAY_PROVIDER_NAME[favourite.provider];
    const href = payLinkHref(favourite, target.amountMinor, target.currency, target.title);
    const others = links.length - 1;
    return <>
      {href
        ? <Button size={size} block label={`Pay ${amount} with ${provider}`} accessibilityLabel={`Pay ${amount} with ${provider}, opens ${provider}`}
          trailing={<ArrowUpRight size={16} color={c.onAction} />} onPress={() => openPayLink(target.shareId, provider, href.href)} />
        : <Button size={size} block label={`Pay ${amount} by bank transfer`} onPress={sheet} />}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {others > 0 ? <View style={{ flex: 1 }}><Button block variant="secondary" label={`Other ways (${others})`} onPress={sheet} /></View> : null}
        <View style={{ flex: 1 }}><Button block variant="secondary" label="Already paid" accessibilityLabel={`Already paid ${name}`} onPress={tell} /></View>
      </View>
      <T kind="note" muted>{href?.amountFilled ? `${name}’s favourite. It opens with ${amount} filled in.` : href ? `${name}’s favourite. Enter ${amount} when it opens.` : `${name}’s favourite. Their details are a tap away.`}</T>
    </>;
  }
  return <>
    <Button size={size} block label={`Pay ${name} ${amount}`} trailing={<ChevronRight size={16} color={c.onAction} />} onPress={sheet} />
    <T kind="note" muted>{links.map((link) => PAY_PROVIDER_NAME[link.provider]).join(" · ")}</T>
    <Button variant="quiet" size="sm" label={`Already paid? Tell ${name}`} onPress={tell} />
  </>;
}

/** True when the person you owe has said how they like to be paid. */
export function usePayable(communeId: string, payerId: string) {
  const { snapshots } = useApp();
  return payLinksOf(snapshots.find((item) => item.commune.id === communeId), payerId).length > 0;
}
