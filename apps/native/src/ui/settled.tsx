import { isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";
import Animated, {
  Easing, FadeIn, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from "react-native-reanimated";
import { curve, type DebtWeb, type WebDebt } from "../lib/debtWeb";
import { claimSettle, listen, newOwner, type Landed, type Settled } from "../lib/settled";
import { isFresh } from "../lib/fresh";
import { firstName, money } from "../lib/format";
import { Avatar, T, TextLink } from "./kit";
import { haptic, PressScale, useCalm } from "./motion";
import { Text } from "./text";
import { useTheme } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
// The opening flow's curve: quick to start, long soft landing, no overshoot.
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * The settled ring: a soft green circle whose tick draws on, as in the
 * opening flow's "All square." Plays once when it appears, or when `play`
 * turns true.
 */
export function TickRing({ size = 64, play = true, delay = 200 }: { size?: number; play?: boolean; delay?: number }) {
  const { c } = useTheme();
  const calm = useCalm();
  const drawn = useSharedValue(calm ? 1 : 0);
  useEffect(() => {
    if (!play) { drawn.value = 0; return; }
    drawn.value = calm ? 1 : withDelay(delay, withTiming(1, { duration: 600, easing: EASE }));
  }, [play, calm, delay, drawn]);
  const tick = useAnimatedProps(() => ({ strokeDashoffset: 40 * (1 - drawn.value) }));
  const icon = Math.round(size * 0.47);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.settled, alignItems: "center", justifyContent: "center" }}>
    <Svg width={icon} height={icon} viewBox="0 0 24 24">
      <AnimatedPath d="M5 12.5l4.5 4.5L19 7.5" stroke={c.onSettled} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={40} animatedProps={tick} />
    </Svg>
  </View>;
}

/**
 * "All square." as the opening flow ends: the ring, its tick drawing on,
 * then the words fading up a few points. Used on Settle, in the Hub and at
 * the end of paying or confirming.
 */
export function AllSquare({ title = "All square.", body, play = true, compact }: { title?: string; body?: ReactNode; play?: boolean; compact?: boolean }) {
  const calm = useCalm();
  const shown = useSharedValue(calm || !play ? 1 : 0);
  useEffect(() => {
    if (play && !calm) { shown.value = 0; shown.value = withTiming(1, { duration: 400, easing: EASE }); }
  }, [play, calm, shown]);
  const words = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 8 }] }));
  return <View accessibilityRole="summary" accessibilityLabel={typeof body === "string" ? `${title} ${body}` : title}
    style={{ alignItems: "center", gap: compact ? 8 : 10, paddingVertical: compact ? 8 : 18 }}>
    <TickRing size={compact ? 52 : 64} play={play} />
    <Animated.View style={[{ alignItems: "center", gap: 6 }, words]}>
      <T kind="title" style={{ fontSize: compact ? 22 : 26, lineHeight: compact ? 27 : 31, textAlign: "center" }}>{title}</T>
      {body ? typeof body === "string" ? <T kind="label" muted style={{ textAlign: "center", maxWidth: 280 }}>{body}</T> : body : null}
    </Animated.View>
  </View>;
}

/** One line in the drawing, drawn on, then (for the tangle) pulled away. */
function Edge({ d, length, colour, width, drawAt, leaveAt, arrow, calm }: {
  d: string; length: number; colour: string; width: number; drawAt: number; leaveAt: number | null; arrow: { x: number; y: number; angle: number }; calm: boolean;
}) {
  const offset = useSharedValue(calm ? 0 : length);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (calm) { offset.value = leaveAt == null ? 0 : -length; fade.value = leaveAt == null ? 1 : 0; return; }
    offset.value = length; fade.value = 1;
    offset.value = withDelay(drawAt, withTiming(0, { duration: leaveAt == null ? 800 : 700, easing: EASE }, () => undefined));
    if (leaveAt != null) {
      const leave = setTimeout(() => {
        offset.value = withTiming(-length, { duration: 520, easing: EASE });
        fade.value = withTiming(0.2, { duration: 520, easing: EASE });
      }, leaveAt);
      return () => clearTimeout(leave);
    }
    return undefined;
  }, [calm, drawAt, leaveAt, length, offset, fade]);
  const line = useAnimatedProps(() => ({ strokeDashoffset: offset.value, strokeOpacity: fade.value }));
  // The arrowhead appears once the line has reached it.
  const head = useAnimatedProps(() => ({ opacity: Math.max(0, 1 - Math.abs(offset.value) / Math.max(1, length * 0.08)) * fade.value }));
  const a = arrow.angle, s = width * 2.4;
  const tip = `M${arrow.x + Math.cos(a) * s} ${arrow.y + Math.sin(a) * s} L${arrow.x + Math.cos(a + 2.5) * s} ${arrow.y + Math.sin(a + 2.5) * s} L${arrow.x + Math.cos(a - 2.5) * s} ${arrow.y + Math.sin(a - 2.5) * s} Z`;
  return <>
    <AnimatedPath d={d} stroke={colour} strokeWidth={width} strokeLinecap="round" fill="none" strokeDasharray={length} animatedProps={line} />
    <AnimatedPath d={tip} fill={colour} animatedProps={head} />
  </>;
}

/** An amount on a payment line, fading in once the line has drawn. */
function Pill({ x, y, text, at, colour, ink, calm }: { x: number; y: number; text: string; at: number; colour: string; ink: string; calm: boolean }) {
  const shown = useSharedValue(calm ? 1 : 0);
  useEffect(() => { if (!calm) { shown.value = 0; shown.value = withDelay(at, withTiming(1, { duration: 400, easing: EASE })); } }, [at, calm, shown]);
  const style = useAnimatedProps(() => ({ opacity: shown.value }));
  const w = Math.max(50, text.length * 7 + 14);
  return <AnimatedG animatedProps={style}>
    <Rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} fill={colour} />
    <SvgText x={x} y={y + 4.2} textAnchor="middle" fontSize={12} fontWeight="600" fill={ink}>{text}</SvgText>
  </AnimatedG>;
}

/**
 * The opening flow's "Commune does the maths", on real bills: every unpaid
 * share draws in as a thin line, then the tangle pulls away and folds into
 * one green payment for each pair of people, the count rolling down as it
 * goes, and the payments list rises in underneath. Tap to watch it again.
 */
export function DebtFold({ web, viewerId }: { web: DebtWeb; viewerId: string }) {
  const { c } = useTheme();
  const calm = useCalm();
  const [width, setWidth] = useState(0);
  const [round, setRound] = useState(0);
  const [folded, setFolded] = useState(calm);
  const [count, setCount] = useState(calm ? web.payments.length : web.debts.length);
  // A row of about 88 points for each person on the right.
  const height = Math.max(200, (web.nodes.length - 1) * 88 + 24);
  const faces = 46;
  const tangleCount = web.debts.length;
  const drawn = 250 + Math.min(tangleCount, 10) * 110 + 700;
  const foldAt = drawn + 500;
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (calm) { setFolded(true); setCount(web.payments.length); return; }
    setFolded(false); setCount(web.debts.length);
    timers.current.push(setTimeout(() => {
      setFolded(true);
      haptic.light();
      let n = web.debts.length;
      const step = () => {
        if (n <= web.payments.length) return;
        n -= 1; setCount(n);
        timers.current.push(setTimeout(step, 90));
      };
      timers.current.push(setTimeout(step, 480));
    }, foldAt));
    return () => timers.current.forEach(clearTimeout);
  }, [round, calm, foldAt, web.debts.length, web.payments.length]);

  const at = (id: string) => web.nodes.find((node) => node.userId === id)!;
  const lines = useMemo(() => width ? {
    tangle: web.debts.map((debt, index) => ({ ...curve(at(debt.from), at(debt.to), width, height, faces / 2 + 6, 12 + (index % 3) * 8), key: `t${index}` })),
    // Two people who owe each other get two lines, bowed apart. Each amount sits nearer the payer, so the pair never overlaps.
    simple: web.payments.map((debt, index) => ({ ...curve(at(debt.from), at(debt.to), width, height, faces / 2 + 6,
      web.payments.some((other) => other.from === debt.to && other.to === debt.from) ? 30 : 6, 0.3), debt, key: `s${index}` })),
  } : null, [width, height, web]); // eslint-disable-line react-hooks/exhaustive-deps

  const who = (id: string) => (id === viewerId ? "You" : firstName(at(id).name));
  const sentence = (debt: WebDebt) => `${who(debt.from)} ${debt.from === viewerId ? "pay" : "pays"} ${debt.to === viewerId ? "you" : who(debt.to)}`;
  const shown = Math.min(5, web.payments.length);

  return <PressScale scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`${web.debts.length} unpaid ${web.debts.length === 1 ? "share" : "shares"} come down to ${web.payments.length} ${web.payments.length === 1 ? "payment" : "payments"}. Tap to watch again.`}
    onPress={() => { setRound((value) => value + 1); haptic.select(); }}
    style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.outline2, overflow: "hidden" }}>
    <View onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))} style={{ height }}>
      {lines ? <Svg key={round} width={width} height={height} style={{ position: "absolute" }}>
        {lines.tangle.map((line, index) => <Edge key={line.key} d={line.d} length={line.length} colour={c.calEdge} width={2.2} calm={calm}
          drawAt={250 + Math.min(index, 10) * 110} leaveAt={foldAt + index * 45} arrow={line.end} />)}
        {folded ? lines.simple.map((line, index) => <Edge key={line.key} d={line.d} length={line.length} colour={c.action} width={3} calm={calm}
          drawAt={480 + index * 220} leaveAt={null} arrow={line.end} />) : null}
        {folded ? lines.simple.map((line, index) => <Pill key={`p${line.key}`} x={line.label.x} y={line.label.y} text={money(line.debt.amountMinor, web.currency)}
          at={480 + 500 + index * 220} colour={c.action} ink={c.onAction} calm={calm} />) : null}
      </Svg> : null}
      {width ? web.nodes.map((node) => <View key={node.userId} pointerEvents="none"
        style={{ position: "absolute", left: node.x * width - 40, top: node.y * height - faces / 2, width: 80, alignItems: "center", gap: 4 }}>
        <Avatar name={node.name} size={faces} ring={c.surface} />
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: c.ink }}>{node.userId === viewerId ? "You" : firstName(node.name)}</Text>
      </View>) : null}
    </View>
    <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 34, lineHeight: 38, fontWeight: "400", letterSpacing: -1, color: c.ink, minWidth: 26, fontVariant: ["tabular-nums"] }}>{count}</Text>
        <T kind="body" style={{ flex: 1 }}>{folded
          ? `${web.payments.length === 1 ? "payment settles" : "payments settle"} all of it${web.payments.length === web.nodes.length - 1 ? ", one for each person" : ""}`
          : `unpaid ${web.debts.length === 1 ? "share" : "shares"} of bills between you and ${web.nodes.length - 1 === 1 ? "one other person" : `${web.nodes.length - 1} others`}`}</T>
      </View>
      {folded ? <View style={{ gap: 6 }}>
        {web.payments.slice(0, shown).map((debt, index) => <Animated.View key={`${round}-${index}`} entering={calm ? undefined : FadeIn.duration(450).delay(780 + index * 120)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.canvas, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 }}>
          <Avatar name={at(debt.from === viewerId ? debt.to : debt.from).name} size={28} />
          <T kind="body" style={{ flex: 1, fontSize: 14.5 }}>{sentence(debt)}</T>
          <T kind="body" style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>{money(debt.amountMinor, web.currency)}</T>
        </Animated.View>)}
        {web.payments.length > shown ? <T kind="label" muted style={{ paddingHorizontal: 4 }}>and {web.payments.length - shown} more</T> : null}
      </View> : <T kind="label" muted>Watch it come undone.</T>}
    </View>
  </PressScale>;
}

/**
 * The end of paying or confirming, inside the sheet: the ring draws its
 * tick, the words fade up, and the sheet closes itself after a moment (or
 * on Done), so the moment is seen before the list behind updates.
 */
export function SheetDone({ title, body, onDone }: { title: string; body: string; onDone(): void }) {
  const { c } = useTheme();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => done.current(), 2200);
    return () => clearTimeout(timer);
  }, []);
  return <View style={{ padding: 24, paddingTop: 28, gap: 14, backgroundColor: c.canvas }}>
    <AllSquare title={title} body={body} />
    <PressScale accessibilityRole="button" accessibilityLabel="Done" onPress={() => done.current()}
      style={{ alignSelf: "center", height: 44, paddingHorizontal: 22, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.recessed }}>
      <T kind="body" style={{ fontWeight: "600" }}>Done</T>
    </PressScale>
  </View>;
}

/**
 * For a card or list that ends a payment in place: `claim(id, slot)` as its
 * button is pressed, then `done` holds the result for a few seconds, with the
 * slot (row position) it came from.
 */
export function useInPlace(hold = 2800) {
  const owner = useRef(0);
  if (!owner.current) owner.current = newOwner();
  const [done, setDone] = useState<Landed | null>(null);
  useEffect(() => listen(owner.current, setDone), []);
  // Timed from when it first shows: changing its words (dropping Undo once saved) does not restart it.
  const shownId = done ? `${done.id}|${done.slot}` : null;
  useEffect(() => {
    if (!shownId) return;
    const timer = setTimeout(() => setDone(null), hold);
    return () => clearTimeout(timer);
  }, [shownId, hold]);
  return { done, claim: (id: string, slot = 0) => claimSettle(id, owner.current, slot), show: (event: Settled, slot = 0) => setDone({ ...event, slot }), clear: () => setDone(null) };
}

/** A card's content once its payment is recorded: the ring, its tick drawing on, and the words. */
export function InPlaceCard({ done }: { done: Settled }) {
  return <Animated.View key={`done-${done.id}`} entering={FadeIn.duration(220)}>
    <AllSquare compact title={done.title} body={done.body} />
    {done.action ? <TextLink centred muted label={done.action.label} onPress={done.action.run} /> : null}
  </Animated.View>;
}

/** A list row once its payment is recorded, in the place the row was. */
export function InPlaceRow({ done, first }: { done: Settled; first?: boolean }) {
  const { c } = useTheme();
  return <Animated.View key={`row-${done.id}`} entering={FadeIn.duration(220)} accessibilityRole="summary" accessibilityLabel={`${done.title} ${done.body}`}
    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64,
      borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline, backgroundColor: c.surface }}>
    <TickRing size={36} delay={120} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <T kind="strong" style={{ fontSize: 15.5 }}>{done.title}</T>
      <T kind="label" muted lines={2}>{done.body}</T>
    </View>
    {done.action ? <TextLink muted label={done.action.label} onPress={done.action.run} /> : null}
  </Animated.View>;
}

/** Puts the settled row back where the paid row was, for a few seconds. */
export function withLanded(rows: ReactNode[], done: Landed | null): ReactNode[] {
  if (!done) return rows;
  const at = Math.max(0, Math.min(done.slot, rows.length));
  const standIn = done.replaces ? rows.findIndex((row) => isValidElement(row) && row.key === done.replaces) : -1;
  if (standIn >= 0) return [...rows.slice(0, standIn), <InPlaceRow key={`landed-${done.id}`} done={done} first={standIn === 0} />, ...rows.slice(standIn + 1)];
  return [...rows.slice(0, at), <InPlaceRow key={`landed-${done.id}`} done={done} first={at === 0} />, ...rows.slice(at)];
}

/**
 * Something done that can still be taken back: shown at once, saved when
 * the few seconds are up (or when the screen goes), and Undo before then
 * simply never saves it.
 */
export function useDeferred(hold = 3200) {
  const pending = useRef<{ commit(): void; timer: ReturnType<typeof setTimeout> } | null>(null);
  const flush = () => {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    clearTimeout(job.timer);
    job.commit();
  };
  useEffect(() => flush, []);
  return {
    start(commit: () => void) {
      flush();
      pending.current = { commit, timer: setTimeout(flush, hold) };
    },
    undo() {
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = null;
    },
  };
}

/**
 * A button's place once it has done its job, such as "Sent to Jordan": the
 * small ring with its tick drawing on, at the height the button had.
 */
export function Sent({ text, size = "lg" }: { text: string; size?: "lg" | "sm" }) {
  const big = size === "lg";
  return <Animated.View entering={FadeIn.duration(200)} accessibilityRole="summary" accessibilityLabel={text} accessibilityLiveRegion="polite"
    style={{ height: big ? 48 : 34, flexDirection: "row", alignItems: "center", justifyContent: big ? "center" : "flex-end", gap: 8 }}>
    <TickRing size={big ? 26 : 22} delay={60} />
    <T kind={big ? "strong" : "label"} style={big ? { fontSize: 15.5 } : { fontWeight: "500" }}>{text}</T>
  </Animated.View>;
}

/**
 * A bill just added from this phone slides into its list from a little above,
 * with a pale green wash that fades, so you see where it went.
 */
export function Arrive({ communeId, title, amountMinor, radius = 0, children }: { communeId: string; title: string; amountMinor?: number; radius?: number; children: ReactNode }) {
  const { c } = useTheme();
  const calm = useCalm();
  const [fresh] = useState(() => isFresh(communeId, title, amountMinor));
  const shown = useSharedValue(fresh ? 0 : 1);
  const wash = useSharedValue(fresh ? 1 : 0);
  useEffect(() => {
    if (!fresh) return;
    shown.value = withTiming(1, { duration: calm ? 160 : 420, easing: EASE });
    wash.value = withDelay(calm ? 0 : 700, withTiming(0, { duration: 900, easing: EASE }));
  }, [fresh, calm, shown, wash]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: calm ? 0 : (1 - shown.value) * -14 }] }));
  const tint = useAnimatedStyle(() => ({ opacity: wash.value * 0.45 }));
  if (!fresh) return <>{children}</>;
  return <Animated.View style={style}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.settled, borderRadius: radius }, tint]} />
  </Animated.View>;
}
