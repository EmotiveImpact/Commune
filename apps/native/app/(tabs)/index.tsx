import { TickRing } from "../../src/ui/settled";
import { ImageBackground, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "../../src/ui/text";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useState } from "react";
import { aheadBy, comingUp, hasAny, oweTotals, standingClause, type Need } from "../../src/lib/derive";
import { cap, feedTime, firstName, joinAnd, longDate, money, moneyList, plural, word } from "../../src/lib/format";
import type { CurrencyCode } from "../../src/lib/types";
import { useApp } from "../../src/state";
import { Body, TopBar, photoOf } from "../../src/ui/chrome";
import { Avatar, Cal, Faces, Panel, Row, SectionHead, T } from "../../src/ui/kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommuneTiles, NeedsList, NextStep, TaskCheck, WaitingList } from "../../src/ui/parts";
import { useTheme } from "../../src/ui/theme";
import { Still } from "../../src/ui/motion";
import { useRemind } from "../../src/ui/remind";
import { Swap } from "../../src/ui/rolling";
import { FirstDayCard } from "../../src/ui/firstday";
import { JoinWaitingCard } from "../../src/ui/joins";

/** Home, Direction B: your standing on the dark band, the next step raised over it. */
export default function Home() {
  const { c } = useTheme();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const remindFor = useRemind();
  const { user, today, needs, waiting, owe, owed, snapshots, refresh } = app;
  const [pulling, setPulling] = useState(false);
  const pull = <RefreshControl refreshing={pulling} tintColor={c.onFrame} onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} />;
  const late = needs.filter((need) => need.band === "Overdue").length;
  const lateText = late ? `${cap(plural(late, "thing is", "things are"))} overdue.` : "Nothing is overdue.";
  const oweCurrencies = Object.keys(owe).filter((key) => (owe[key as CurrencyCode] ?? 0) > 0) as CurrencyCode[];
  const places = [...new Set(needs.filter((need) => need.kind === "share").map((need) => need.communeId))];
  const choresLeft = needs.filter((need) => need.kind === "task").length;

  if (!needs.length && !hasAny(owed)) {
    const photo = snapshots[0] ? photoOf(snapshots[0].commune.kind) : undefined;
    const soon = comingUp(snapshots, user?.id ?? "", today);
    const people = [...new Set(snapshots.flatMap((snapshot) => snapshot.members.filter((member) => member.active !== false).map((member) => member.name)))];
    return <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <Body refreshControl={pull} ground={c.frame}>
        {/* v7's all-square Home: the photo runs under a clear top bar and the status bar. */}
        <ImageBackground source={photo ? { uri: photo } : undefined} style={{ minHeight: 470 + insets.top, justifyContent: "flex-end", backgroundColor: c.frame }}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <LinearGradient id="allSquareScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0e1018" stopOpacity={0.5} />
                <Stop offset="0.2" stopColor="#0e1018" stopOpacity={0.08} />
                <Stop offset="0.45" stopColor="#0e1018" stopOpacity={0.2} />
                <Stop offset="0.72" stopColor="#0e1018" stopOpacity={0.7} />
                <Stop offset="1" stopColor="#0e1018" stopOpacity={0.92} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#allSquareScrim)" />
          </Svg>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0 }}><TopBar clear /></View>
          <View style={{ padding: 20, paddingBottom: 28, gap: 10 }}>
            <TickRing size={48} delay={350} />
            <Text style={{ color: c.onFrame2, fontSize: 13, lineHeight: 18, fontWeight: "500" }}>{longDate(today)}</Text>
            <Text accessibilityRole="header" style={{ color: c.onFrame, fontSize: 36, lineHeight: 39, fontWeight: "500", letterSpacing: -0.9 }}>You’re all square, {firstName(user?.name ?? "")}.</Text>
            <Text style={{ color: "rgba(245,241,234,0.85)", fontSize: 14.5, lineHeight: 21 }}>Nothing owed and nothing waiting in your {snapshots.length === 1 ? "commune" : `${word(snapshots.length)} communes`}.</Text>
            {people.length ? <View style={{ marginTop: 6 }}><Faces names={people} size={28} ring="rgba(255,255,255,0.9)" /></View> : null}
          </View>
        </ImageBackground>
        <View style={{ padding: 16, paddingTop: 28, gap: 28 }}>
          <FirstDayCard />
          <JoinWaitingCard />
          <Still index={0} style={{ gap: 12 }}><SectionHead title="Your communes" /><CommuneTiles /></Still>
          {soon.length ? <Still index={1} style={{ gap: 12 }}>
            <SectionHead title="Coming up" count={soon.length} />
            <Panel>{soon.map((item, index) => <Row key={item.key} first={index === 0} onLongPress={remindFor(item.key)} left={<Cal iso={item.date} today={today} small />} title={item.title} meta={<T kind="label" muted>{item.meta}</T>} />)}</Panel>
          </Still> : null}
          <Still index={2}><Feed /></Still>
        </View>
      </Body>
    </View>;
  }

  const head = oweCurrencies.length
    ? oweCurrencies.length > 1
      ? <>You owe <Em>{moneyList(owe)}</Em>.</>
      : <>You owe <Em>{money(owe[oweCurrencies[0]]!, oweCurrencies[0])}</Em> {places.length > 1 ? `across ${word(places.length)} communes` : `in ${app.snapshotOf(places[0])?.commune.name ?? "one commune"}`}.</>
    : hasAny(owed) ? <>You’re owed <Em>{moneyList(owed)}</Em>.</> : <>You owe nothing.</>;
  const headKey = `${moneyList(owe)}|${moneyList(owed)}|${places.length}`;
  // Where you stand once both directions count, kept per currency.
  const many = new Set([...oweCurrencies, ...(Object.keys(owed) as CurrencyCode[]).filter((key) => (owed[key] ?? 0) > 0)]).size > 1;
  const net = joinAnd(aheadBy(owe, owed).map((item) => standingClause(item, many)));
  const sub = oweCurrencies.length
    ? `${hasAny(owed) ? `You’re owed ${moneyList(owed)}, ${net}. ` : ""}${lateText}`
    : `You owe nothing. ${choresLeft ? `${cap(plural(choresLeft, "chore is", "chores are"))} left.` : "Nothing needs you."}`;
  const rest = needs.slice(1);
  const chores = rest.filter((need): need is Extract<Need, { kind: "task" }> => need.kind === "task");
  const toPay = rest.filter((need) => need.kind === "share");
  const toPayTotal = moneyList(oweTotals(toPay));

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar />
    <Body refreshControl={pull} ground={c.frame}>
      <View style={{ backgroundColor: c.frame, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 66, gap: 10 }}>
        <Text style={{ color: c.onFrame2, fontSize: 13, lineHeight: 18, fontWeight: "500" }}>{longDate(today)}</Text>
        <Swap value={headKey}><Text accessibilityRole="header" style={{ color: c.onFrame, fontSize: 31, lineHeight: 35, fontWeight: "500", letterSpacing: -0.7 }}>{head}</Text></Swap>
        <Swap value={sub}><Text style={{ color: c.onFrame2, fontSize: 14.5, lineHeight: 21 }}>{boldStanding(sub, c.onFrame)}</Text></Swap>
      </View>
      <Still index={0} style={{ marginTop: -46, marginHorizontal: 16 }}><NextStep need={needs[0]} total={needs.length} /></Still>
      <View style={{ padding: 16, paddingTop: 28, gap: 28 }}>
        <FirstDayCard />
        <JoinWaitingCard />
        <Still index={1} style={{ gap: 12 }}><SectionHead title="Your communes" /><CommuneTiles /></Still>
        {chores.length ? <Still index={2} style={{ gap: 12 }}>
          <SectionHead title="Today" countText={`${chores.length} ${chores.length === 1 ? "chore" : "chores"}`} />
          <Panel>{chores.map((need, index) => {
            const snapshot = app.snapshotOf(need.communeId);
            return <TaskCheck key={need.key} first={index === 0} communeId={need.communeId} operationId={need.operationId} date={need.date}
              title={need.title} assigneeId={user?.id ?? null} assigneeName={user?.name ?? "You"} late={need.band === "Overdue"}
              meta={`${snapshot?.commune.name ?? ""} · ${need.band === "Overdue" ? need.status.text.toLowerCase() : "today"}`} />;
          })}</Panel>
        </Still> : null}
        {toPay.length ? <Still index={3} style={{ gap: 12 }}>
          <SectionHead title="Still to pay" countText={toPayTotal ? `${toPay.length} · ${toPayTotal}` : String(toPay.length)} />
          <Panel><NeedsList items={toPay} initial={4} /></Panel>
        </Still> : null}
        {waiting.length ? <Still index={4} style={{ gap: 12 }}>
          <SectionHead title="Waiting on others" count={waiting.length} />
          <Panel><WaitingList items={waiting} /></Panel>
        </Still> : null}
        <Still index={5}><Feed /></Still>
      </View>
    </Body>
  </View>;
}

/** v7 lifts "£92.45 ahead" (or behind) out of the grey subline in full cream. */
function boldStanding(text: string, color: string) {
  const parts = text.split(/((?:[£€$][\d,]+\.\d\d)(?: ahead| behind))/);
  return parts.map((part, index) => index % 2 ? <Text key={index} style={{ color, fontWeight: "500" }}>{part}</Text> : part);
}

function Em({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ color: c.onFrame }}>{children}</Text>;
}

function Feed() {
  const { feed, today } = useApp();
  if (!feed.length) return null;
  return <View style={{ gap: 12 }}>
    <SectionHead title="Since you last looked" />
    <Panel>{feed.map((item, index) => <Row key={item.key} first={index === 0}
      left={<Avatar name={item.actorName} size={28} />}
      title={<T kind="body" style={{ fontSize: 13.5, lineHeight: 19 }}><T kind="body" style={{ fontSize: 13.5, fontWeight: "600" }}>{firstName(item.actorName)}</T> {item.text}</T>}
      right={<T kind="note" muted>{feedTime(item.at, today)}</T>} />)}</Panel>
  </View>;
}

