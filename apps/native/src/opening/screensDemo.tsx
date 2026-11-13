/**
 * The demo: split the story's bill, see the whole week worked through in
 * three steps, then settle up on a small Home. No account needed.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui/text";
import { haptic, useCalm } from "../ui/motion";
import { billInSentence, computeWeek, dayLine, nameOf, shortFace, split, storyMoney, type Week, type WeekBill, type Who } from "./engine";
import { useFlow } from "./flow";
import { CAST, type CastId } from "./stories";
import { Av, Chevron, CloseX, Drawer, EASE, Foot, Handle, MonzoMark, O, Pill, Rise, RowC, St, Tick, TopBar, Wordmark, img, type } from "./ui";

/** A number that rolls to its new value over half a second. */
function useRolling(target: number): number {
  const calm = useCalm();
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (calm || from.current === target) { from.current = target; setShown(target); return; }
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / 520);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (target - a) * e));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, calm]);
  return shown;
}

function youInitial(name: string) { return (name.trim().charAt(0) || "Y").toUpperCase(); }

/* ---------- demo split ---------- */

function PickFace({ who, on, label, locked, onPress, initial }: { who: Who; on: boolean; label: string; locked: boolean; onPress(): void; initial: string }) {
  const calm = useCalm();
  const s = useSharedValue(1);
  const tick = useSharedValue(on ? 1 : 0);
  useEffect(() => { tick.value = withTiming(on ? 1 : 0, { duration: 250, easing: EASE }); }, [on, tick]);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 0.45 + 0.55 * tick.value }));
  const t = useAnimatedStyle(() => ({ opacity: tick.value, transform: [{ scale: 0.6 + 0.4 * tick.value }] }));
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: locked }} accessibilityLabel={label}
    onPress={() => { if (locked) return; haptic.select(); if (!calm) { s.value = 0.9; s.value = withTiming(1, { duration: 320, easing: EASE }); } onPress(); }}
    style={{ flex: 1, alignItems: "center", gap: 7 }}>
    <Animated.View style={[{ width: 59, height: 59, borderRadius: 30, borderWidth: 2, borderColor: on ? O.action : "transparent", alignItems: "center", justifyContent: "center" }, face]}>
      {who === "you" ? <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: O.frame, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#f5f1ea", fontSize: 17, fontWeight: "600" }}>{initial}</Text>
      </View> : <Av who={who} size={50} />}
      <Animated.View style={[{ position: "absolute", right: -1, bottom: -1, width: 20, height: 20, borderRadius: 10, backgroundColor: O.action, borderWidth: 2, borderColor: O.canvas, alignItems: "center", justifyContent: "center" }, t]}>
        <Tick size={11} width={3.4} />
      </Animated.View>
    </Animated.View>
    <Text style={{ fontSize: 12.5, color: on ? O.ink : O.ink2 }}>{shortFace(who)}</Text>
  </Pressable>;
}

export function DemoSplit() {
  const flow = useFlow();
  const b = flow.story.bill;
  const cur = b.cur ?? "£";
  const payer = CAST[b.payer];
  const n = flow.sel.filter(Boolean).length;
  const { each, rem } = split(b.p, n);
  const rolled = useRolling(each);
  const owe = n - 1;
  const toggle = (i: number) => {
    if (i <= 1) return;
    if (flow.sel[i] && n <= 2) return;
    flow.set({ sel: flow.sel.map((v, k) => (k === i ? !v : v)) });
  };
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} prog={[1, 3]} skip={() => flow.go("signup")} />
    <St i={0} style={{ paddingHorizontal: 24 }}>
      <Text style={[type.eyebrow, { color: O.action, marginTop: 14, marginBottom: 10 }]}>Try it. No account needed</Text>
      <Text accessibilityRole="header" style={type.h2}>{`Split the ${billInSentence(b.n)}.`}</Text>
      <Text style={type.lede}>{`Your turn. ${payer.n} paid. Tap who was there.`}</Text>
    </St>
    <St i={1}>
      <View style={{ marginTop: 20, marginHorizontal: 24, backgroundColor: O.surface, borderRadius: 24, padding: 16, flexDirection: "row", gap: 14, alignItems: "center",
        shadowColor: O.ink, shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }}>
        <Image source={img(b.img)} resizeMode="cover" style={{ width: 62, height: 62, borderRadius: 14 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 17, lineHeight: 20.5, fontWeight: "600", color: O.ink }}>{b.n}</Text>
          <Text style={type.small}>{`Today · ${payer.n} paid`}</Text>
        </View>
        <Text style={[type.num, { fontSize: 24, fontWeight: "600", letterSpacing: -0.5, color: O.ink }]}>{storyMoney(b.p, cur)}</Text>
      </View>
    </St>
    <St i={2} style={{ marginTop: 22, marginHorizontal: 24 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: O.ink }}>Who was there?</Text>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
        {flow.people.map((who, i) => <PickFace key={who} who={who} on={flow.sel[i]} locked={i <= 1} initial={youInitial(flow.name)}
          label={who === "you" ? "You" : CAST[who as CastId].n} onPress={() => toggle(i)} />)}
      </View>
    </St>
    <St i={3}>
      <View style={{ marginTop: 26, marginHorizontal: 24, padding: 20, borderRadius: 24, backgroundColor: O.pale }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <Text accessibilityLabel={`${storyMoney(each, cur)} each`} style={[type.num, { fontSize: 54, lineHeight: 58, letterSpacing: -2.2, color: O.ink }]}>{storyMoney(rolled, cur)}</Text>
          <Text style={{ fontSize: 17, fontWeight: "500", color: O.onSettled }}>each</Text>
        </View>
        <Text style={{ marginTop: 10, fontSize: 14, lineHeight: 20.3, color: O.onSettled }}>
          {`${n} people, so ${owe === 1 ? "1 person owes" : `${owe} of you owe`} ${payer.n} ${storyMoney(each, cur)}.${rem ? ` The ${cur === "£" ? `${rem}p` : storyMoney(rem, cur)} that doesn't divide stays with ${payer.n}.` : " It divides exactly."}`}
        </Text>
      </View>
    </St>
    <View style={{ flex: 1 }} />
    <Foot><Pill label="Split it" onPress={() => flow.go("demo-maths")} /></Foot>
  </View>;
}

/* ---------- demo maths ---------- */

function money(w: Week, v: number, cur: "£" | "€") { void w; return storyMoney(v, cur); }

function BillCard({ x, stage, cur }: { x: WeekBill; stage: number; cur: "£" | "€" }) {
  return <View style={{ backgroundColor: O.surface, borderRadius: 20, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: O.outline2 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
      <Av who={x.payer} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 19, fontWeight: "600", color: O.ink }}>{x.n}</Text>
        <Text style={{ fontSize: 12.5, color: O.ink2, marginTop: 2 }}>{`${nameOf(x.payer)} paid`}{x.mine ? <Text style={{ color: O.action, fontWeight: "600" }}>{" · you just split this"}</Text> : null}</Text>
      </View>
      <Text style={[type.num, { fontSize: 16, fontWeight: "600", color: O.ink }]}>{storyMoney(x.p, cur)}</Text>
    </View>
    <View style={{ marginTop: 10, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12, backgroundColor: O.pale }}>
      <Text style={[type.num, { fontSize: 13, lineHeight: 17.5, color: O.onSettled }]}>
        {`${storyMoney(x.p, cur)} ÷ ${x.who.length} people = `}<Text style={{ fontWeight: "700", color: O.onSettled }}>{`${storyMoney(x.each, cur)} each`}</Text>
        {x.rem ? <Text style={{ opacity: 0.8, color: O.onSettled }}>{` · ${nameOf(x.payer)} covers the odd ${cur === "£" ? `${x.rem}p` : storyMoney(x.rem, cur)}`}</Text> : null}
      </Text>
    </View>
    {stage >= 2 ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 }}>
      {x.ious.map((o, i) => <Rise key={`${o.from}-${i}`} delay={120 + i * 35} from={0} duration={320}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3, paddingLeft: 3, paddingRight: 9, borderRadius: 999, backgroundColor: O.attentionSoft }}>
          <Av who={o.from} size={22} />
          <Text style={[type.num, { fontSize: 12, fontWeight: "600", color: O.attention }]}>{storyMoney(o.amt, cur)}</Text>
        </View>
      </Rise>)}
      <Text style={{ fontSize: 12, fontWeight: "600", color: O.ink2 }}>{`to ${nameOf(x.payer)}`}</Text>
    </View> : null}
  </View>;
}

function PayRow({ from, to, amt, cur, i }: { from: Who; to: Who; amt: number; cur: "£" | "€"; i: number }) {
  return <Rise delay={200 + i * 120} from={8} duration={450}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: O.surface, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Av who={from} size={30} />
      <Text style={{ flex: 1, fontSize: 14.5, color: O.ink }}>{from === "you" ? `You pay ${nameOf(to)}` : `${nameOf(from)} pays ${nameOf(to)}`}</Text>
      <Text style={[type.num, { fontSize: 14.5, fontWeight: "600", color: O.ink }]}>{storyMoney(amt, cur)}</Text>
    </View>
  </Rise>;
}

export function DemoMaths() {
  const flow = useFlow();
  const W = useMemo(() => computeWeek(flow.story, flow.people, flow.sel), [flow.story, flow.people, flow.sel]);
  const cur = flow.story.bill.cur ?? "£";
  const [stage, setStage] = useState(1);
  const scroll = useRef<ScrollView>(null);
  const to = (s: number) => { if (s === stage) return; haptic.select(); setStage(s); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const head = stage === 1 ? "Now add two more bills." : stage === 2 ? "Who owes who." : "Make it simple.";
  const lede = stage === 1 ? `Here is the rest of the week at ${flow.story.commune}. Each bill is split the same way you just did.`
    : stage === 2 ? "Paid bill by bill, every share is its own bank transfer."
    : "Commune adds up what each person paid and what their shares came to. Only the difference has to move.";
  const steps = ["1  Bills", "2  Who owes who", "3  Simple"];
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} prog={[2, 3]} skip={() => flow.go("signup")} />
    <St i={0} style={{ paddingHorizontal: 24 }}>
      <Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>{head}</Text>
      <Text style={type.lede}>{lede}</Text>
    </St>
    <St i={1} style={{ flexDirection: "row", gap: 6, marginTop: 16, marginHorizontal: 20 }}>
      {steps.map((s, i) => {
        const on = i === stage - 1;
        const done = i < stage - 1;
        return <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => to(i + 1)}
          style={{ flexGrow: 1, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 999, alignItems: "center", backgroundColor: on ? O.action : done ? O.settled : O.recessed }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: on ? "#fff" : done ? O.onSettled : O.ink2 }}>{s}</Text>
        </Pressable>;
      })}
    </St>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 8, gap: 10 }} showsVerticalScrollIndicator={false}>
      <Rise key={stage} from={10} duration={420} style={{ gap: 10 }}>
        {stage < 3 ? W.bills.map((x) => <BillCard key={x.n} x={x} stage={stage} cur={cur} />) : <>
          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.72, textTransform: "uppercase", color: O.ink2, marginTop: 6, marginHorizontal: 2 }}>
            {`${W.pays.length} payment${W.pays.length === 1 ? " settles" : "s settle"} the whole week`}
          </Text>
          <View style={{ gap: 8 }}>{W.pays.map((p, i) => <PayRow key={`${p.from}-${p.to}`} {...p} cur={cur} i={i} />)}</View>
          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.72, textTransform: "uppercase", color: O.ink2, marginTop: 12, marginHorizontal: 2 }}>How Commune got there</Text>
          <View style={{ backgroundColor: O.surface, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 14 }}>
            {W.keys.filter((k) => W.paid[k] || W.share[k]).map((k, i) => {
              const v = W.net[k];
              return <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: O.outline2 }}>
                <Av who={k} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, lineHeight: 17, fontWeight: "600", color: O.ink }}>{nameOf(k)}</Text>
                  <Text style={[type.num, { fontSize: 12, color: O.ink2, marginTop: 2 }]}>{`paid ${money(W, W.paid[k], cur)} · shares ${money(W, W.share[k], cur)}`}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={[type.num, { fontSize: 15, fontWeight: "600", color: v > 0 ? O.action : v < 0 ? O.attention : O.ink }]}>{`${v > 0 ? "+" : v < 0 ? "−" : ""}${storyMoney(Math.abs(v), cur)}`}</Text>
                  <Text style={{ fontSize: 11.5, color: O.ink2 }}>{v > 0 ? "gets back" : v < 0 ? "owes" : "all square"}</Text>
                </View>
              </View>;
            })}
          </View>
          <Text style={{ marginTop: 2, marginHorizontal: 2, fontSize: 13, lineHeight: 18.85, color: O.ink2 }}>
            Paid minus shares gives each person one number. Those who owe pay those who are owed until everyone is at zero. Nobody pays a penny more than their shares.
          </Text>
        </>}
      </Rise>
    </ScrollView>
    {stage > 1 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 24, marginTop: 8 }}>
      <Text style={[type.num, { fontSize: 30, lineHeight: 32, letterSpacing: -0.9, color: O.ink }]}>{stage === 2 ? String(W.ious) : `${W.ious} → ${W.pays.length}`}</Text>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "500", color: O.ink }}>{stage === 2 ? "separate payments. Most of them cancel out." : "payments"}</Text>
    </View> : null}
    <Foot><Pill label={stage === 1 ? "Show who owes who" : stage === 2 ? "Make it simple" : "Settle up"} onPress={() => (stage < 3 ? to(stage + 1) : flow.go("demo-settle"))} /></Foot>
  </View>;
}

/* ---------- demo settle: a small Home ---------- */

const AnimatedPath = Animated.createAnimatedComponent(Path);

function SquareRing({ show }: { show: boolean }) {
  const d = useSharedValue(40);
  useEffect(() => { d.value = show ? withDelay(200, withTiming(0, { duration: 600, easing: EASE })) : 40; }, [show, d]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: d.value }));
  return <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: O.settled, alignItems: "center", justifyContent: "center" }}>
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none"><AnimatedPath d="M5 12.5l4.5 4.5L19 7.5" stroke={O.onSettled} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} animatedProps={props} /></Svg>
  </View>;
}

export function DemoSettle() {
  const flow = useFlow();
  const insets = useSafeAreaInsets();
  const b = flow.story.bill;
  const cur = b.cur ?? "£";
  const W = useMemo(() => computeWeek(flow.story, flow.people, flow.sel), [flow.story, flow.people, flow.sel]);
  const mine = W.mine[0] ?? { to: b.payer as Who, amt: split(b.p, flow.sel.filter(Boolean).length).each };
  const p = CAST[mine.to as CastId];
  const amt = storyMoney(mine.amt, cur);
  const [open, setOpen] = useState(false);
  const [square, setSquare] = useState(false);
  const sq = useSharedValue(0);
  const own = useSharedValue(0);
  useEffect(() => {
    sq.value = withTiming(square ? 1 : 0, { duration: 400, easing: EASE });
    own.value = square ? withDelay(500, withTiming(1, { duration: 600, easing: EASE })) : 0;
  }, [square, sq, own]);
  const sqStyle = useAnimatedStyle(() => ({ opacity: sq.value }));
  const ownStyle = useAnimatedStyle(() => ({ opacity: own.value, transform: [{ translateY: (1 - own.value) * 10 }] }));
  const confirm = () => { setOpen(false); setTimeout(() => { haptic.success(); setSquare(true); }, 380); };
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <View style={{ backgroundColor: O.frame, paddingTop: Math.max(insets.top, 20) + 10, paddingHorizontal: 22, paddingBottom: 70 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 40 }}>
        <Wordmark size={25} color="#f5f1ea" />
        <Pressable accessibilityRole="button" onPress={() => flow.go("signup")} hitSlop={8} style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(245,241,234,0.7)" }}>Skip</Text>
        </Pressable>
      </View>
      <Text style={{ marginTop: 18, marginBottom: 6, fontSize: 14, color: "rgba(245,241,234,0.62)" }}>{dayLine(new Date())}</Text>
      <Text accessibilityRole="header" style={[type.h2, { fontSize: 30, lineHeight: 32, color: "#f5f1ea" }]}>
        {`You owe ${p.n} ${amt}.${W.mine.length > 1 ? ` One of ${W.mine.length} payments that cover all three bills.` : " That covers all three bills."}`}
      </Text>
    </View>
    <St i={0}>
      <View style={{ marginTop: -52, marginHorizontal: 16, backgroundColor: O.surface, borderRadius: 24, padding: 18, shadowColor: O.ink, shadowOpacity: 0.16, shadowRadius: 25, shadowOffset: { width: 0, height: 20 } }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13.5, color: O.ink2 }}>Your next step</Text>
          <Text style={{ fontSize: 13.5, color: O.ink2 }}>{`1 of ${Math.max(1, W.mine.length)}`}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, marginBottom: 16 }}>
          <Image source={img(p.av)} style={{ width: 44, height: 44, borderRadius: 22 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 18, lineHeight: 21.6, fontWeight: "600", color: O.ink }}>This week, all three bills</Text>
            <Text style={{ fontSize: 13.5, color: O.ink2, marginTop: 3 }}>{`${p.n} · 3 bills in one payment`}</Text>
          </View>
          <Text style={[type.num, { fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: O.ink }]}>{amt}</Text>
        </View>
        <Pill label={`Pay ${amt} with Monzo`} onPress={() => setOpen(true)} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pill kind="ghost" label="Other ways" height={46} fontSize={15} style={{ flex: 1 }} onPress={() => setOpen(true)} />
          <Pill kind="ghost" label="Already paid" height={46} fontSize={15} style={{ flex: 1 }} onPress={() => setOpen(true)} />
        </View>
        <Animated.View pointerEvents={square ? "auto" : "none"} style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, backgroundColor: O.surface, alignItems: "center", justifyContent: "center", gap: 10 }, sqStyle]}>
          <SquareRing show={square} />
          <Text style={{ fontSize: 26, lineHeight: 28, letterSpacing: -0.5, color: O.ink }}>All square.</Text>
          <Text style={{ fontSize: 13.5, lineHeight: 18.5, color: O.ink2, textAlign: "center", maxWidth: 250 }}>{`${p.n} gets a note to confirm it. Commune records the payment, it never moves your money.`}</Text>
        </Animated.View>
      </View>
    </St>
    <St i={1} style={{ paddingHorizontal: 24, marginTop: 18 }}>
      <Text style={type.small}>{square ? "That's Commune. Every bill, chore and payment in your home works like this." : "Tap the green button. This is the whole loop: someone pays, everyone splits, you settle."}</Text>
    </St>
    <View style={{ flex: 1 }} />
    <Foot><Animated.View pointerEvents={square ? "auto" : "none"} style={ownStyle}><Pill label="Now make your own commune" onPress={() => flow.go("signup")} /></Animated.View></Foot>
    <Drawer open={open} onClose={() => setOpen(false)} label={`Tell ${p.n} you've paid`}>
      <Handle />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <View><Text style={{ fontSize: 20, lineHeight: 24, fontWeight: "600", color: O.ink }}>{`Tell ${p.n} you've paid`}</Text>
          <Text style={type.small}>{`Your week at ${flow.story.commune}`}</Text></View>
        <CloseX onPress={() => setOpen(false)} />
      </View>
      <RowC>
        <MonzoMark />
        <View style={{ flex: 1 }}><Text style={{ fontSize: 14.5, fontWeight: "600", color: O.ink }}>Pay with Monzo</Text>
          <Text style={{ fontSize: 12.5, color: O.ink2, marginTop: 2 }}>{`${amt} filled in · ${p.n}'s favourite`}</Text></View>
        <View style={{ transform: [{ rotate: "180deg" }] }}><Chevron size={16} color={O.ink2} /></View>
      </RowC>
      <RowC>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 12.5, color: O.ink2 }}>Amount you sent</Text>
          <Text style={[type.num, { fontSize: 22, lineHeight: 26, fontWeight: "600", marginTop: 4, color: O.ink }]}>{amt}</Text></View>
        <Text style={type.small}>Today</Text>
      </RowC>
      <Pill label={`I've sent ${p.n} ${amt}`} onPress={confirm} style={{ marginTop: 10 }} />
    </Drawer>
  </View>;
}
