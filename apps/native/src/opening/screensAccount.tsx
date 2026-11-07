/**
 * Making an account: sign-up, number, code, name, and sign-in for people
 * coming back. On the demo build nothing is sent; the code screen offers
 * the demo code the way iOS offers one from Messages.
 */
import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, View, type TextInput as RNTextInput } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../ui/text";
import { haptic, useCalm } from "../ui/motion";
import { unlock } from "../lib/faceId";
import { useApp } from "../state";
import { billInSentence } from "./engine";
import { useActive, useFlow } from "./flow";
import { EASE, Foot, LinkBtn, O, Pill, Shade, St, TopBar, Wordmark, FILL, img, type } from "./ui";

const AppleLogo = () => <Svg width={17} height={20} viewBox="0 0 17 20" fill="#fff"><Path d="M14.1 10.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9C3.8 5 2.2 6 1.3 7.6c-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.3.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.5zM11.6 3.3c.7-.9 1.2-2 1-3.3-1 .1-2.2.7-3 1.6-.6.7-1.2 1.9-1 3.1 1.1.1 2.3-.6 3-1.4z" /></Svg>;
const GoogleLogo = () => <Svg width={18} height={18} viewBox="0 0 18 18">
  <Path d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 01-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" fill="#4285F4" />
  <Path d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.7H.9v2.3A9 9 0 009 18z" fill="#34A853" />
  <Path d="M3.9 10.8a5.4 5.4 0 010-3.6V4.9H.9a9 9 0 000 8.2l3-2.3z" fill="#FBBC05" />
  <Path d="M9 3.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6A9 9 0 00.9 4.9l3 2.3C4.6 5.1 6.6 3.6 9 3.6z" fill="#EA4335" />
</Svg>;

const fieldStyle = { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, height: 62, paddingHorizontal: 18, borderRadius: 18, backgroundColor: O.surface, marginTop: 26 };
const inputText = { flex: 1, minWidth: 0, fontSize: 20, fontWeight: "500" as const, color: O.ink, letterSpacing: 0.2, paddingVertical: 0 };

function Field({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  return <View style={[fieldStyle, { borderWidth: focused ? 2 : 1.5, borderColor: focused ? O.action : O.outline2 }]}>{children}</View>;
}

export function Signup() {
  const flow = useFlow();
  const invite = flow.mode === "invite";
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <View style={{ height: "52%", overflow: "hidden" }}>
      <Image source={img("bench")} resizeMode="cover" style={FILL} />
      <Shade stops={[[0, "rgba(10,30,70,0.25)"], [0.35, "rgba(10,30,70,0)"], [0.62, "rgba(245,241,234,0)"], [0.98, "rgba(245,241,234,1)"]]} />
      <View style={{ position: "absolute", top: 64, left: 24 }}><Wordmark size={30} /></View>
    </View>
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 30, marginTop: -6 }}>
      <St i={0}><Text accessibilityRole="header" style={type.h2}>{invite ? `Join ${flow.inv.commune}.` : "Make your commune."}</Text></St>
      <St i={1}><Text style={type.lede}>{invite
        ? `${flow.inv.by} and the others are waiting. About thirty seconds, and nothing to pay: the commune already has a plan.`
        : `Keep the ${billInSentence(flow.story.bill.n)} you just split. About a minute to set up, and your free week starts when you pick a plan.`}</Text></St>
      <View style={{ marginTop: "auto", gap: 10 }}>
        <St i={2}><Pill kind="black" icon={<AppleLogo />} label="Continue with Apple" onPress={() => flow.go("name")} /></St>
        <St i={3}><Pill kind="light" icon={<GoogleLogo />} label="Continue with Google" onPress={() => flow.go("name")} /></St>
        <St i={4}><Pill label="Continue with your number" onPress={() => flow.go("phone")} /></St>
        <St i={5}><LinkBtn text="Use email instead" onPress={() => flow.go("phone")} style={{ padding: 8 }} /></St>
      </View>
      <St i={6}><Text style={{ fontSize: 11.5, lineHeight: 16.7, color: O.ink2, textAlign: "center", marginTop: 12, marginHorizontal: 8 }}>By continuing you agree to Commune's Terms and Privacy Policy.</Text></St>
    </View>
  </View>;
}

export function Phone() {
  const flow = useFlow();
  const [focused, setFocused] = useState(false);
  const digits = flow.phone.replace(/\D/g, "");
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} />
    <View style={{ paddingHorizontal: 24 }}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>What's your number?</Text></St>
      <St i={1}><Text style={type.lede}>We'll text a six-digit code to sign you in. No passwords to remember.</Text></St>
      <St i={2}><Field focused={focused}>
        <View style={{ paddingRight: 12, borderRightWidth: 1, borderRightColor: O.outline }}><Text style={{ fontSize: 20, fontWeight: "600", color: O.ink }}>UK +44</Text></View>
        <TextInput value={flow.phone} onChangeText={(v) => flow.set({ phone: v.replace(/[^\d ]/g, "").slice(0, 13) })} keyboardType="phone-pad" textContentType="telephoneNumber"
          autoComplete="tel-national" placeholder="7700 900000" placeholderTextColor={O.outline} accessibilityLabel="Mobile number"
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputText} />
      </Field></St>
    </View>
    <View style={{ flex: 1 }} />
    <Foot><Pill label="Send code" disabled={digits.length < 9} onPress={() => flow.go("code")} /></Foot>
  </KeyboardAvoidingView>;
}

export function Code() {
  const flow = useFlow();
  const active = useActive();
  const calm = useCalm();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(30);
  const input = useRef<RNTextInput>(null);
  const pulse = useSharedValue(1);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const f = setTimeout(() => input.current?.focus(), 600);
    return () => { clearInterval(t); clearTimeout(f); };
  }, []);
  const take = (v: string) => {
    const next = v.replace(/\D/g, "").slice(0, 6);
    setCode(next);
    if (next.length === 6) {
      haptic.success();
      if (!calm) pulse.value = withSequence(withTiming(1.02, { duration: 180, easing: EASE }), withTiming(1, { duration: 180, easing: EASE }));
      setTimeout(() => { if (active) flow.go("name"); }, 520);
    }
  };
  const fillDemo = () => { "482913".split("").forEach((_, i) => setTimeout(() => take("482913".slice(0, i + 1)), i * 70)); };
  const p = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const shown = flow.phone.trim() || "7700 900482";
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} />
    <View style={{ paddingHorizontal: 24 }}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>Enter the code</Text></St>
      <St i={1}><Text style={type.lede}>{`Sent to +44 ${shown}. `}<Text style={[type.num, { color: O.ink2 }]}>{left > 0 ? `Send again in 0:${String(left).padStart(2, "0")}` : "Send again"}</Text></Text></St>
      <St i={2}>
        <Pressable accessibilityLabel="Six-digit code" onPress={() => input.current?.focus()}>
          <Animated.View style={[{ flexDirection: "row", gap: 8, marginTop: 28 }, p]}>
            {Array.from({ length: 6 }, (_, i) => {
              const ch = code[i] ?? "";
              const focus = i === Math.min(code.length, 5);
              return <View key={i} style={{ flex: 1, height: 64, borderRadius: 16, backgroundColor: O.surface, alignItems: "center", justifyContent: "center",
                borderWidth: focus ? 2 : 1.5, borderColor: ch ? O.action : focus ? O.action : O.outline2 }}>
                <Text style={[type.num, { fontSize: 26, fontWeight: "600", color: O.ink }]}>{ch}</Text>
              </View>;
            })}
          </Animated.View>
        </Pressable>
        <TextInput ref={input} value={code} onChangeText={take} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6}
          caretHidden style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
      </St>
    </View>
    <View style={{ flex: 1 }} />
    {flow.backendMode === "demo" ? <View style={{ alignItems: "center", paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fill in the demo code, 482 913" onPress={fillDemo}
        style={({ pressed }) => ({ backgroundColor: "#fff", borderRadius: 9, paddingVertical: 9, paddingHorizontal: 16, alignItems: "center", gap: 3, opacity: pressed ? 0.7 : 1,
          shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 0, shadowOffset: { width: 0, height: 1 } })}>
        <Text style={{ fontSize: 11, color: "#6b6f78" }}>From Messages</Text>
        <Text style={{ fontSize: 14, color: O.ink }}>482 913</Text>
      </Pressable>
    </View> : null}
  </KeyboardAvoidingView>;
}

export function Name() {
  const flow = useFlow();
  const [focused, setFocused] = useState(false);
  const initial = (flow.name.trim().charAt(0) || "?").toUpperCase();
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} />
    <View style={{ paddingHorizontal: 24 }}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>What do your people call you?</Text></St>
      <St i={1}><Text style={type.lede}>This is how you'll show up on bills, chores and nudges.</Text></St>
      <St i={2}><View style={{ width: 104, height: 104, borderRadius: 52, marginTop: 26, alignSelf: "center", backgroundColor: O.frame, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 44, color: "#f5f1ea" }}>{initial}</Text>
        <View style={{ position: "absolute", right: 0, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: O.action, borderWidth: 3, borderColor: O.canvas, alignItems: "center", justifyContent: "center" }}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinejoin="round"><Path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><Path d="M15.5 13a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z" /></Svg>
        </View>
      </View></St>
      <St i={3}><Field focused={focused}>
        <TextInput value={flow.name} onChangeText={(v) => flow.set({ name: v.slice(0, 40) })} autoComplete="given-name" textContentType="givenName" autoCapitalize="words"
          placeholder="Your first name" placeholderTextColor={O.outline} accessibilityLabel="First name" returnKeyType="done"
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputText} />
      </Field></St>
    </View>
    <View style={{ flex: 1 }} />
    <Foot><Pill label="Continue" disabled={!flow.name.trim()} onPress={() => flow.go("kind")} /></Foot>
  </KeyboardAvoidingView>;
}

/* ---------- sign in, for people coming back ---------- */

const AnimatedPath = Animated.createAnimatedComponent(Path);

function FaceIdMark({ state }: { state: "idle" | "scan" | "done" }) {
  const blink = useSharedValue(1);
  const face = useSharedValue(1);
  const ok = useSharedValue(60);
  useEffect(() => {
    blink.value = state === "scan" ? withRepeat(withSequence(withTiming(0.35, { duration: 500 }), withTiming(1, { duration: 500 })), -1) : withTiming(1, { duration: 200 });
    face.value = withTiming(state === "done" ? 0 : 1, { duration: 300 });
    ok.value = state === "done" ? withTiming(0, { duration: 500, easing: EASE }) : 60;
  }, [state, blink, face, ok]);
  const corners = useAnimatedProps(() => ({ opacity: blink.value }));
  const faceP = useAnimatedProps(() => ({ opacity: face.value }));
  const okP = useAnimatedProps(() => ({ strokeDashoffset: ok.value }));
  const stroke = { fill: "none", stroke: "#dce8d3", strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <Svg width={92} height={92} viewBox="0 0 92 92" style={{ marginVertical: 14 }}>
    <AnimatedPath {...stroke} animatedProps={corners} d="M4 26V14a10 10 0 0110-10h12M66 4h12a10 10 0 0110 10v12M88 66v12a10 10 0 01-10 10H66M26 88H14A10 10 0 014 78V66" />
    <AnimatedPath {...stroke} animatedProps={faceP} d="M30 34v6M62 34v6M47 34v15h-4M34 62c7 6 17 6 24 0" />
    <AnimatedPath {...stroke} strokeDasharray={60} animatedProps={okP} d="M28 47l12 12 24-26" />
  </Svg>;
}

export function Signin() {
  const flow = useFlow();
  const active = useActive();
  const { user, current } = useApp();
  const [state, setState] = useState<"idle" | "scan" | "done">("idle");
  const firstName = user?.name.split(" ")[0];
  const go = async () => {
    if (flow.backendMode !== "demo") { flow.set({ returning: true }); void flow.finish(); return; }
    setState("scan");
    const [ok] = await Promise.all([unlock("Sign in to Commune"), new Promise((r) => setTimeout(r, 1100))]);
    if (!ok) { setState("idle"); return; }
    haptic.success();
    setState("done");
    setTimeout(() => { if (active) { flow.set({ returning: true }); flow.go("loading"); } }, 700);
  };
  return <View style={{ flex: 1, backgroundColor: O.frame }}>
    <TopBar onBack={flow.back} dark />
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 30 }}>
      <St i={0}><Wordmark size={34} color="#f5f1ea" /></St>
      <St i={1}><FaceIdMark state={state} /></St>
      <St i={2}><Text accessibilityRole="header" style={[type.h2, { color: "#f5f1ea", textAlign: "center" }]}>{firstName ? `Welcome back, ${firstName}.` : "Welcome back."}</Text></St>
      <St i={3}><Text style={[type.lede, { color: "rgba(245,241,234,0.62)", marginTop: 0, textAlign: "center" }]}>
        {current ? `${current.commune.name} is just as you left it.` : "Your communes are just as you left them."}
      </Text></St>
    </View>
    <Foot>
      <Pill label={flow.backendMode === "demo" ? "Sign in with Face ID" : "Sign in"} onPress={() => void go()} />
      <LinkBtn text="Use my number instead" color="#f5f1ea" onPress={() => flow.go("phone")} />
    </Foot>
  </View>;
}
