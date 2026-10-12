import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { hasAny } from "../../src/lib/derive";
import { firstName, money, moneyList, shortDate, word } from "../../src/lib/format";
import type { CurrencyCode } from "../../src/lib/types";
import { failure, useApp } from "../../src/state";
import { Body, Pad, TopBar } from "../../src/ui/chrome";
import { Avatar, Button, Kicker, Panel, Row, State, T, tap } from "../../src/ui/kit";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

const CURRENCY_WORD: Record<CurrencyCode, string> = { GBP: "pounds", EUR: "euros", USD: "dollars" };

function ask(title: string, message: string, yes: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? true);
  return new Promise((resolve) => Alert.alert(title, message, [
    { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
    { text: yes, onPress: () => resolve(true) },
  ]));
}

export default function Settle() {
  const { c } = useTheme();
  const router = useRouter();
  const { settle, owe, owed, recorded, resolveReport, nudge } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const payTotalCurrencies = Object.keys(owe) as CurrencyCode[];
  const people = new Set(settle.youOwe.map((row) => row.userId)).size;
  const youOweCurrencies = [...new Set(settle.youOwe.map((row) => row.currency))];
  const owedCurrencies = [...new Set(settle.owedToYou.map((row) => row.currency))];

  async function confirm(communeId: string, reportId: string, name: string, amount: string) {
    if (!(await ask(`Confirm ${firstName(name)}’s ${amount}?`, `Only confirm once the money is in your account. This records it against ${firstName(name)}’s share.`, "Confirm"))) return;
    setBusy(reportId);
    try {
      await resolveReport(communeId, reportId, "confirm");
      tap("success");
      toast(`Confirmed. ${firstName(name)}’s ${amount} is recorded.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t confirm it."));
    } finally { setBusy(""); }
  }
  async function decline(communeId: string, reportId: string, name: string) {
    if (!(await ask(`Not received from ${firstName(name)}?`, `${firstName(name)} sees that it hasn’t arrived yet and can report it again.`, "Not received"))) return;
    setBusy(reportId);
    try {
      await resolveReport(communeId, reportId, "decline", "Not received yet");
      toast(`${firstName(name)} will see it hasn’t arrived.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t send that."));
    } finally { setBusy(""); }
  }
  async function sendNudge(communeId: string, shareIds: string[], name: string) {
    setBusy(`n:${name}`);
    try {
      for (const id of shareIds) await nudge(communeId, id);
      toast(`Nudged ${firstName(name)}.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t send the nudge."));
    } finally { setBusy(""); }
  }

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="Settle" />
    <Body>
      <Pad>
        <View style={{ gap: 6, paddingHorizontal: 4 }}>
          <T kind="title" accessibilityRole="header">{payTotalCurrencies.length ? `You owe ${moneyList(owe)} to ${word(people)} ${people === 1 ? "person" : "people"}.` : "You owe nobody."}</T>
          <T kind="body" muted>{hasAny(owed) ? `You’re owed ${moneyList(owed)}.` : "Nobody owes you anything."} Each currency is kept separate.</T>
        </View>

        {youOweCurrencies.map((currency) => <View key={`owe-${currency}`} style={{ gap: 10 }}>
          <Kicker>You owe · {CURRENCY_WORD[currency]}</Kicker>
          <Panel>{settle.youOwe.filter((row) => row.currency === currency).map((row, index) => <Row key={`${row.userId}-${currency}`} first={index === 0}
            left={<Avatar name={row.name} size={40} />}
            title={row.name}
            meta={<T kind="label" muted>{row.items.map((item) => item.title).join(", ")}</T>}
            right={<View style={{ alignItems: "flex-end", gap: 6 }}>
              <T kind="amount">{money(row.amountMinor, currency)}</T>
              <Button size="sm" variant="secondary" label="I’ve paid" accessibilityLabel={`I’ve paid ${row.name}`} onPress={() => router.push(`/record/${row.items[0].shareId}`)} />
            </View>} />)}</Panel>
        </View>)}

        {recorded.length ? <View style={{ gap: 10 }}>
          <Kicker>Waiting for them to confirm</Kicker>
          <Panel>{recorded.map((item, index) => <Row key={item.key} first={index === 0}
            left={<Avatar name={item.payerName} size={40} />}
            title={item.title}
            meta={<State text={`You recorded ${money(item.amountMinor, item.currency)} on ${shortDate(item.report.sentOn)}. ${firstName(item.payerName)} confirms it.`} />} />)}</Panel>
        </View> : null}

        {owedCurrencies.map((currency) => <View key={`owed-${currency}`} style={{ gap: 10 }}>
          <Kicker>Owed to you · {CURRENCY_WORD[currency]}</Kicker>
          <Panel>{settle.owedToYou.filter((row) => row.currency === currency).map((row, index) => {
            const pending = row.items.filter((item) => item.debtor.pending);
            const nudgeable = row.items.filter((item) => item.debtor.canNudge && !item.debtor.nudgedToday && !item.debtor.pending);
            const nudged = row.items.some((item) => item.debtor.nudgedToday);
            return <View key={`${row.userId}-${currency}`}>
              <Row first={index === 0}
                left={<Avatar name={row.name} size={40} />}
                title={row.name}
                meta={<T kind="label" muted>{row.items.map((item) => item.waiting.title).join(", ")}</T>}
                right={<View style={{ alignItems: "flex-end", gap: 6 }}>
                  <T kind="amount">{money(row.amountMinor, currency)}</T>
                  {pending.length ? null
                    : nudgeable.length ? <Button size="sm" variant="secondary" label={`Nudge ${firstName(row.name)}`} busy={busy === `n:${row.name}`}
                      onPress={() => void sendNudge(nudgeable[0].waiting.communeId, nudgeable.map((item) => item.debtor.shareId), row.name)} />
                    : <T kind="note" muted>{nudged ? "Nudged today" : "Not due yet"}</T>}
                </View>} />
              {pending.map(({ waiting: entry, debtor }) => <View key={debtor.pending!.id} style={{ marginHorizontal: 16, marginBottom: 14, padding: 14, borderRadius: 12, backgroundColor: c.attentionSoft, gap: 10 }}>
                <T kind="body">{firstName(row.name)} says they’ve paid you {money(debtor.pending!.amountMinor, currency)} for {entry.title}, sent {shortDate(debtor.pending!.sentOn)}{debtor.pending!.reference ? `, reference “${debtor.pending!.reference}”` : ""}.</T>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Button size="sm" label={`Confirm ${money(debtor.pending!.amountMinor, currency)}`} busy={busy === debtor.pending!.id}
                    onPress={() => void confirm(entry.communeId, debtor.pending!.id, row.name, money(debtor.pending!.amountMinor, currency))} />
                  <Button size="sm" variant="secondary" label="Not received" disabled={busy === debtor.pending!.id}
                    onPress={() => void decline(entry.communeId, debtor.pending!.id, row.name)} />
                </View>
              </View>)}
            </View>;
          })}</Panel>
        </View>)}

        {!youOweCurrencies.length && !owedCurrencies.length && !recorded.length
          ? <Panel pad><T kind="body" muted>Everyone is square. Nothing to settle.</T></Panel> : null}
        <T kind="note" muted style={{ paddingHorizontal: 4 }}>Commune records what you pay each other. It never moves money.</T>
      </Pad>
    </Body>
  </View>;
}
