import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../src/ui/text";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { ChevronRight, Mail, Plus, Settings, Star, User } from "lucide-react-native";
import { cap, money, word } from "../../src/lib/format";
import { payLinkLabel, PAY_PROVIDER_NAME, PAY_PROVIDERS, type PayProvider } from "../../src/lib/payLinks";
import type { CurrencyCode } from "../../src/lib/types";
import { failure, useApp } from "../../src/state";
import { Body, TopBar } from "../../src/ui/chrome";
import { Avatar, Panel, Row, SectionHead, T } from "../../src/ui/kit";
import { PayMark } from "../../src/ui/marks";
import { haptic, Still, PressScale } from "../../src/ui/motion";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

const CURRENCY_WORD: Record<CurrencyCode, string> = { GBP: "pounds", EUR: "euros", USD: "dollars" };
const CURRENCY_MARK: Record<CurrencyCode, string> = { GBP: "£", EUR: "€", USD: "$" };

/** Profile: the person, where they stand in each currency, and how people pay them. */
export default function Profile() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user, snapshots, owe, owed, myPayLinks, loadMyPayLinks, setPreferredPayLink } = useApp();
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadMyPayLinks().catch(() => undefined); }, [loadMyPayLinks]);

  // One line per currency. Pounds and euros are never added together.
  const currencies = [...new Set([...Object.keys(owe), ...Object.keys(owed)] as CurrencyCode[])]
    .filter((currency) => (owe[currency] ?? 0) > 0 || (owed[currency] ?? 0) > 0);
  const links = myPayLinks ?? [];
  const missing = PAY_PROVIDERS.filter((provider) => !links.some((link) => link.provider === provider)).map((provider) => provider === "bank" ? "bank details" : PAY_PROVIDER_NAME[provider]);

  async function star(provider: PayProvider) {
    const was = links.find((link) => link.preferred)?.provider ?? null;
    const next = was === provider ? null : provider;
    setBusy(true);
    try {
      await setPreferredPayLink(next);
      haptic.success();
      toast(next ? `${PAY_PROVIDER_NAME[next]} is now your favourite. People who owe you see “Pay with ${PAY_PROVIDER_NAME[next]}” first.` : `${PAY_PROVIDER_NAME[provider]} is no longer your favourite.`,
        { label: "Undo", onPress: () => void setPreferredPayLink(was).catch(() => undefined) });
    } catch (cause) {
      toast(failure(cause, "Couldn’t change your favourite. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const icon = (node: React.ReactNode) => <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  let step = 0;
  const next = () => step++;
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="Profile" />
    <Body>
      <View style={{ padding: 16, gap: 24 }}>
        <Still index={next()} style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 4, paddingTop: 6 }}>
          <Avatar name={user?.name ?? "You"} size={72} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T kind="title" accessibilityRole="header">{user?.name ?? "You"}</T>
            <T kind="body" muted>In {word(snapshots.length)} {snapshots.length === 1 ? "commune" : "communes"}</T>
          </View>
        </Still>

        <Still index={next()} style={{ gap: 10 }}>
          <SectionHead title="Where you stand" />
          <Panel>
            {currencies.length ? currencies.map((currency, index) => {
              const o = owe[currency] ?? 0, d = owed[currency] ?? 0, net = d - o;
              return <Row key={currency} first={index === 0}
                left={<View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{CURRENCY_MARK[currency]}</Text></View>}
                title={cap(CURRENCY_WORD[currency])}
                meta={<T kind="label" muted>{o ? `You owe ${money(o, currency)}` : "You owe nothing"}{d ? `, you’re owed ${money(d, currency)}` : ""}</T>}
                right={<T kind="amount" color={net > 0 ? c.action : c.ink}>{net === 0 ? "Square" : `${money(Math.abs(net), currency)} ${net > 0 ? "ahead" : "behind"}`}</T>} />;
            }) : <Row first title="All square" meta={<T kind="label" muted>Nothing owed either way.</T>} />}
          </Panel>
          {currencies.length > 1 ? <T kind="label" muted style={{ paddingHorizontal: 4 }}>One line for each currency. Commune never adds {CURRENCY_WORD[currencies[0]]} and {CURRENCY_WORD[currencies[1]]} together.</T> : null}
        </Still>

        <Still index={next()} style={{ gap: 10 }}>
          <SectionHead title="How people pay you" right={<Pressable accessibilityRole="button" onPress={() => router.push("/pay-links")} hitSlop={8}><T kind="label" style={{ fontWeight: "600", textDecorationLine: "underline" }}>Edit</T></Pressable>} />
          <Panel>
            {myPayLinks == null ? <Row first title="Loading…" /> : null}
            {links.map((link, index) => <Row key={link.provider} first={index === 0}
              left={<PayMark provider={link.provider} />}
              title={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{PAY_PROVIDER_NAME[link.provider]}</T>
                {link.preferred ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.recessed, borderRadius: 10, paddingHorizontal: 7, height: 20 }}>
                  <Star size={11} color={c.favouriteEdge} fill={c.favourite} /><Text style={{ fontSize: 11.5, fontWeight: "600", color: c.ink2 }}>Favourite</Text>
                </View> : null}
              </View>}
              meta={<T kind="label" muted lines={1}>{payLinkLabel(link)}</T>}
              right={<PressScale accessibilityRole="button" disabled={busy} accessibilityState={{ selected: !!link.preferred }}
                accessibilityLabel={link.preferred ? `${PAY_PROVIDER_NAME[link.provider]} is your favourite` : `Make ${PAY_PROVIDER_NAME[link.provider]} your favourite`}
                onPress={() => void star(link.provider)} hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Star size={20} color={link.preferred ? c.favouriteEdge : c.ink2} fill={link.preferred ? c.favourite : "transparent"} strokeWidth={1.7} />
              </PressScale>} />)}
            {missing.length ? <Row first={!links.length && myPayLinks != null} onPress={() => router.push("/pay-links")}
              left={icon(<Plus size={17} color={c.ink} />)} title={`Add ${missing.slice(0, 2).join(" or ")}`} right={<ChevronRight size={17} color={c.ink2} />} /> : null}
          </Panel>
          <T kind="label" muted style={{ paddingHorizontal: 4 }}>People in your communes see these when they owe you, with the amount filled in. Star one to make it your favourite.</T>
        </Still>

        <Still index={next()} style={{ gap: 10 }}>
          <SectionHead title="Account" />
          <Panel>
            <Row first onPress={() => router.push("/account")} left={icon(<User size={17} color={c.ink} />)} title="Name" meta={<T kind="label" muted>{user?.name}</T>} right={<ChevronRight size={17} color={c.ink2} />} />
            <Row onPress={() => router.push("/account")} left={icon(<Mail size={17} color={c.ink} />)} title="Email" meta={<T kind="label" muted>{user?.email}</T>} right={<ChevronRight size={17} color={c.ink2} />} />
            <Row onPress={() => router.push("/account")} left={icon(<Settings size={17} color={c.ink} />)} title="Settings"
              meta={<T kind="label" muted>Hub layout, notifications and sign out</T>} right={<ChevronRight size={17} color={c.ink2} />} />
          </Panel>
        </Still>
        <T kind="label" muted style={{ textAlign: "center" }}>Commune {Constants.expoConfig?.version ?? ""}</T>
      </View>
    </Body>
  </View>;
}
