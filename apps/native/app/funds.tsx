import { useState } from "react";
import { Image, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { memberName } from "../src/lib/derive";
import { money, requestId } from "../src/lib/format";
import type { Fund, Snapshot } from "../src/lib/types";
import { failure, useApp } from "../src/state";
import { Body, Pad, photoOf } from "../src/ui/chrome";
import { Avatar, Button, ErrorText, Kicker, Panel, Row, T, tap } from "../src/ui/kit";
import { Text } from "../src/ui/text";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

/**
 * Shared pots, as in v7: a card with the photo, how far the pot has got and
 * a bar, then "I've put in £x" for your own pledge, with Undo, and who has
 * put in what. Commune records the money; it never moves it.
 */
export default function Funds() {
  const { current } = useApp();
  const funds = (current?.funds ?? []).filter((fund) => !fund.archivedAt);
  return <Body>
    <Pad gap={18}>
      {current && funds.length ? funds.map((fund) => <Pot key={fund.id} fund={fund} snapshot={current} />)
        : <Panel pad><T kind="body" muted>No shared pots in {current?.commune.name} yet.</T></Panel>}
    </Pad>
  </Body>;
}

function Pot({ fund, snapshot }: { fund: Fund; snapshot: Snapshot }) {
  const { c } = useTheme();
  const toast = useToast();
  const { backend, user, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currency = snapshot.commune.currency;
  const live = fund.commitments.filter((item) => !item.cancelledAt);
  const total = live.reduce((sum, item) => sum + item.contributedMinor, 0);
  const target = fund.targetMinor;
  const share = target ? Math.min(1, total / target) : 0;
  const full = target != null && total >= target;
  const mine = live.find((item) => item.userId === user?.id);
  const left = mine ? Math.max(0, mine.amountMinor - mine.contributedMinor) : 0;

  async function putIn() {
    if (!mine || !left) return;
    setBusy(true); setError("");
    try {
      const id = await backend.contribute(mine.id, left, requestId());
      await refresh();
      tap("success");
      toast(`Recorded: you put ${money(left, currency)} into ${fund.name}.`, {
        label: "Undo",
        onPress: () => void backend.voidContribution(id, "Undone straight after recording").then(refresh)
          .then(() => toast("Taken off the record."))
          .catch((cause) => toast(failure(cause, "Couldn’t undo that. Try again."))),
      });
    } catch (cause) {
      setError(failure(cause, "Couldn’t record that. Try again."));
    } finally { setBusy(false); }
  }

  return <View style={{ gap: 18 }}>
    <View style={{ backgroundColor: c.surface, borderRadius: 15, borderWidth: 1, borderColor: c.outline2, overflow: "hidden" }}>
      <View style={{ height: 118, justifyContent: "flex-end" }}>
        <Image source={{ uri: photoOf(snapshot.commune.kind) }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.recessed }} />
        <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none">
          <Defs><LinearGradient id="potShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0e1018" stopOpacity={0} /><Stop offset="1" stopColor="#0e1018" stopOpacity={0.6} />
          </LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#potShade)" />
        </Svg>
        <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "500", paddingHorizontal: 14, paddingVertical: 10 }}>Shared pot · {snapshot.commune.name}</Text>
      </View>
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        <T kind="title" style={{ fontSize: 21 }}>{fund.name}</T>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <Text style={{ fontSize: 26, lineHeight: 30, fontWeight: "600", color: c.ink, fontVariant: ["tabular-nums"] }}>{money(total, currency)}</Text>
          <T kind="body" muted>{target ? `of ${money(target, currency)}` : "recorded in"}</T>
        </View>
        {target ? <View accessibilityRole="progressbar" accessibilityLabel={`${Math.round(share * 100)}% of the goal`}
          style={{ height: 8, borderRadius: 4, backgroundColor: c.recessed, overflow: "hidden" }}>
          <View style={{ width: `${share * 100}%`, height: "100%", borderRadius: 4, backgroundColor: c.action }} />
        </View> : null}
        <T kind="label" muted>
          {full ? "The pot is full." : target ? `${money(target - total, currency)} to go` : `${live.length} ${live.length === 1 ? "person has" : "people have"} pledged`}
          {mine && !full ? ` · you pledged ${money(mine.amountMinor, currency)}` : ""}
        </T>
      </View>
    </View>
    <View style={{ gap: 8, alignItems: "center" }}>
      {mine && left > 0 && !full
        ? <Button size="lg" block busy={busy} label={`I’ve put in ${money(left, currency)}`} onPress={() => void putIn()} />
        : <T kind="body" muted style={{ textAlign: "center" }}>{mine ? "You’ve put in everything you pledged." : "You haven’t pledged to this pot."}</T>}
      <ErrorText>{error}</ErrorText>
      <T kind="note" muted style={{ textAlign: "center" }}>Put it in the pot however you agreed, then record it here. Commune never moves money.</T>
    </View>
    <View style={{ gap: 10 }}>
      <Kicker>Who’s put in</Kicker>
      <Panel>{live.map((item, index) => {
        const name = item.userId === user?.id ? "You" : memberName(snapshot, item.userId);
        return <Row key={item.id} first={index === 0} left={<Avatar name={item.userId === user?.id ? user.name : name} size={32} />} title={name}
          right={<T kind="body" style={{ fontWeight: "500", fontVariant: ["tabular-nums"] }}>{money(item.contributedMinor, currency)}</T>} />;
      })}</Panel>
    </View>
  </View>;
}
