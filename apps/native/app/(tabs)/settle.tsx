import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { hasAny, payLinksOf } from "../../src/lib/derive";
import { debtWeb } from "../../src/lib/debtWeb";
import { AllSquare, DebtFold, Sent, useInPlace, withLanded } from "../../src/ui/settled";
import type { Landed } from "../../src/lib/settled";
import { firstName, money, moneyList, shortDate, word } from "../../src/lib/format";
import type { CurrencyCode } from "../../src/lib/types";
import { failure, useApp } from "../../src/state";
import { Body, Pad, TopBar } from "../../src/ui/chrome";
import { Avatar, Button, Kicker, Panel, Row, State, T } from "../../src/ui/kit";
import { useConfirm } from "../../src/ui/confirm";
import { useToast } from "../../src/ui/toast";
import { haptic, Still } from "../../src/ui/motion";
import { useRemind } from "../../src/ui/remind";
import { SwipeRow } from "../../src/ui/swipe";
import { useTheme } from "../../src/ui/theme";

const CURRENCY_WORD: Record<CurrencyCode, string> = { GBP: "pounds", EUR: "euros", USD: "dollars" };


/** The settled row for one currency's panel: slots count 1000 per panel. */
function inPanel(done: Landed | null, panel: number): Landed | null {
  return done && Math.floor(done.slot / 1000) === panel ? { ...done, slot: done.slot % 1000 } : null;
}

export default function Settle() {
  const askCard = useConfirm();
  const ask = (title: string, message: string, yes: string) => askCard({ title, message, yes });
  const { c } = useTheme();
  const router = useRouter();
  // Paying or confirming from a row ends in that row's place, as in the opening flow.
  const owePlace = useInPlace();
  const owedPlace = useInPlace();
  const { settle, owe, owed, recorded, resolveReport, nudge, snapshots, current, user } = useApp();
  const web = useMemo(() => (current && user ? debtWeb(current, user.id) : null), [current, user]);
  const payable = (communeId: string, userId: string) => payLinksOf(snapshots.find((item) => item.commune.id === communeId), userId).length > 0;
  const toast = useToast();
  const remindFor = useRemind();
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState("");
  const payTotalCurrencies = Object.keys(owe) as CurrencyCode[];
  const people = new Set(settle.youOwe.map((row) => row.userId)).size;
  const youOweCurrencies = [...new Set(settle.youOwe.map((row) => row.currency))];
  const owedCurrencies = [...new Set(settle.owedToYou.map((row) => row.currency))];

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
  async function sendNudge(communeId: string, shareIds: string[], name: string, spot: string) {
    setBusy(`n:${name}`);
    try {
      for (const id of shareIds) await nudge(communeId, id);
      // The button turns into "Sent to Jordan" where it was, then settles to "Nudged today".
      haptic.light();
      setSent(spot);
      setTimeout(() => setSent((value) => (value === spot ? "" : value)), 2600);
    } catch (cause) {
      toast(failure(cause, "Couldn’t send the nudge."));
    } finally { setBusy(""); }
  }

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="Settle" />
    <Body>
      <Pad>
        <Still index={0} style={{ gap: 6, paddingHorizontal: 4 }}>
          <T kind="title" accessibilityRole="header">{payTotalCurrencies.length ? `You owe ${moneyList(owe)} to ${word(people)} ${people === 1 ? "person" : "people"}.` : "You owe nobody."}</T>
          <T kind="body" muted>{hasAny(owed) ? `You’re owed ${moneyList(owed)}.` : "Nobody owes you anything."} Each currency is kept separate.</T>
        </Still>

        {web && web.debts.length > 1 ? <Still index={1} style={{ gap: 10 }}>
          <Kicker>You and the others in {current?.commune.name}</Kicker>
          <DebtFold web={web} viewerId={user?.id ?? ""} />
        </Still> : null}

        {youOweCurrencies.map((currency, panel) => <Still key={`owe-${currency}`} index={1 + panel} style={{ gap: 10 }}>
          <Kicker>You owe · {CURRENCY_WORD[currency]}</Kicker>
          <Panel>{withLanded(settle.youOwe.filter((row) => row.currency === currency).map((row, index) => <SwipeRow key={`${row.userId}-${currency}`} label={row.name} onRemind={remindFor(`share:${row.items[0].shareId}`)}>{(guard) => <Row first={index === 0}
            onLongPress={guard(remindFor(`share:${row.items[0].shareId}`))}
            left={<Avatar name={row.name} size={40} />}
            title={row.name}
            meta={<T kind="label" muted>{row.items.map((item) => item.title).join(", ")}</T>}
            right={<View style={{ alignItems: "flex-end", gap: 6 }}>
              <T kind="amount">{money(row.amountMinor, currency)}</T>
              {payable(row.items[0].communeId, row.userId)
                ? <View style={{ flexDirection: "row", gap: 6 }}>
                  <Button size="sm" variant="secondary" label="Already paid" accessibilityLabel={`Already paid ${row.name}`} onPress={() => { owePlace.claim(row.items[0].shareId, panel * 1000 + index); router.push(`/record/${row.items[0].shareId}`); }} />
                  <Button size="sm" label="Pay" accessibilityLabel={`Pay ${row.name}`} onPress={() => { owePlace.claim(row.items[0].shareId, panel * 1000 + index); router.push(`/pay/${row.items[0].shareId}`); }} />
                </View>
                : <Button size="sm" variant="secondary" label="I’ve paid" accessibilityLabel={`I’ve paid ${row.name}`} onPress={() => { owePlace.claim(row.items[0].shareId, panel * 1000 + index); router.push(`/record/${row.items[0].shareId}`); }} />}
            </View>} />}</SwipeRow>), inPanel(owePlace.done, panel))}</Panel>
        </Still>)}

        {/* The row's panel went with it (nothing left in that currency): show it on its own. */}
        {[owePlace.done, owedPlace.done].map((done, which) => done && Math.floor(done.slot / 1000) >= (which ? owedCurrencies : youOweCurrencies).length
          && (youOweCurrencies.length || owedCurrencies.length || recorded.length)
          ? <Panel key={`landed-${which}`}>{withLanded([], { ...done, slot: 0 })}</Panel> : null)}

        {recorded.length ? <Still index={1 + youOweCurrencies.length} style={{ gap: 10 }}>
          <Kicker>Waiting for them to confirm</Kicker>
          <Panel>{recorded.map((item, index) => <Row key={item.key} first={index === 0}
            left={<Avatar name={item.payerName} size={40} />}
            title={item.title}
            meta={<State text={`You recorded ${money(item.amountMinor, item.currency)} on ${shortDate(item.report.sentOn)}. ${firstName(item.payerName)} confirms it.`} />} />)}</Panel>
        </Still> : null}

        {owedCurrencies.map((currency, panel) => <Still key={`owed-${currency}`} index={2 + youOweCurrencies.length + panel} style={{ gap: 10 }}>
          <Kicker>Owed to you · {CURRENCY_WORD[currency]}</Kicker>
          <Panel>{withLanded(settle.owedToYou.filter((row) => row.currency === currency).map((row, index) => {
            const pending = row.items.filter((item) => item.debtor.pending);
            const nudgeable = row.items.filter((item) => item.debtor.canNudge && !item.debtor.nudgedToday && !item.debtor.pending);
            const nudged = row.items.some((item) => item.debtor.nudgedToday);
            const chase = remindFor(`expense:${row.items[0].waiting.expenseId}`);
            return <View key={`${row.userId}-${currency}`}>
              <SwipeRow label={row.name} onRemind={chase}>{(guard) => <Row first={index === 0}
                onLongPress={guard(chase)}
                left={<Avatar name={row.name} size={40} />}
                title={row.name}
                meta={<T kind="label" muted>{row.items.map((item) => item.waiting.title).join(", ")}</T>}
                right={<View style={{ alignItems: "flex-end", gap: 6 }}>
                  <T kind="amount">{money(row.amountMinor, currency)}</T>
                  {pending.length ? null
                    : sent === `${row.userId}-${currency}` ? <Sent size="sm" text={`Sent to ${firstName(row.name)}`} />
                    : nudgeable.length ? <Button size="sm" variant="secondary" label={`Nudge ${firstName(row.name)}`} busy={busy === `n:${row.name}`}
                      onPress={() => void sendNudge(nudgeable[0].waiting.communeId, nudgeable.map((item) => item.debtor.shareId), row.name, `${row.userId}-${currency}`)} />
                    : <T kind="note" muted>{nudged ? "Nudged today" : nudgeFrom(row.items.map((item) => item.waiting.dueOn))}</T>}
                </View>} />}</SwipeRow>
              {pending.map(({ waiting: entry, debtor }) => <View key={debtor.pending!.id} style={{ marginHorizontal: 16, marginBottom: 14, padding: 14, borderRadius: 12, backgroundColor: c.attentionSoft, gap: 10 }}>
                <T kind="body">{firstName(row.name)} says they’ve paid you {money(debtor.pending!.amountMinor, currency)} for {entry.title}, sent {shortDate(debtor.pending!.sentOn)}{debtor.pending!.reference ? `, reference “${debtor.pending!.reference}”` : ""}.</T>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Button size="sm" label={`Confirm ${money(debtor.pending!.amountMinor, currency)}`} busy={busy === debtor.pending!.id}
                    onPress={() => { owedPlace.claim(debtor.pending!.id, panel * 1000 + index); router.push(`/confirm/${debtor.pending!.id}`); }} />
                  <Button size="sm" variant="secondary" label="Not received" disabled={busy === debtor.pending!.id}
                    onPress={() => void decline(entry.communeId, debtor.pending!.id, row.name)} />
                </View>
              </View>)}
            </View>;
          }), inPanel(owedPlace.done, panel))}</Panel>
        </Still>)}

        {!youOweCurrencies.length && !owedCurrencies.length && !recorded.length
          ? <Panel pad><AllSquare body="Nothing to settle. Commune records what you pay each other, it never moves your money." /></Panel> : null}
        <T kind="note" muted style={{ paddingHorizontal: 4 }}>Commune records what you pay each other. It never moves money.</T>
      </Pad>
    </Body>
  </View>;
}

/** v7's "Nudge from 18 Oct": nudging opens on the earliest due date still to come. */
function nudgeFrom(dues: Array<string | null>): string {
  const next = dues.filter((due): due is string => !!due).sort()[0];
  return next ? `Nudge from ${shortDate(next)}` : "No due date";
}
