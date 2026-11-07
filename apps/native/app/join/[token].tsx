import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import * as Notifications from "expo-notifications";
import { Check, ChevronLeft, Info, Plus, SquareCheck } from "lucide-react-native";
import type { InvitePreview } from "../../src/lib/backend";
import { firstName, money, shortDate, word } from "../../src/lib/format";
import { PAY_PROVIDERS, PAY_PROVIDER_NAME } from "../../src/lib/payLinks";
import { usePrefs } from "../../src/prefs";
import { failure, useApp } from "../../src/state";
import { Avatar, Button, Cal, ErrorText, Panel, Row, T, TextLink } from "../../src/ui/kit";
import { PayMark } from "../../src/ui/marks";
import { PressScale, Rise } from "../../src/ui/motion";
import { Text, TextInput } from "../../src/ui/text";
import { KIND_NAME, KIND_PHOTO, radius, useTheme } from "../../src/ui/theme";

type Step = "welcome" | "signin" | "part" | "pay" | "notify";
const ORDER: Step[] = ["welcome", "signin", "part", "pay", "notify"];

/**
 * Joining a commune from an invitation, as in v7: welcome over the commune's
 * photo, sign in if needed, your part, how people pay you, notifications.
 * Each step's lines rise in 70 ms apart; there is no bounce and no morph.
 * Opened by commune://join/<token>, or from Help's "Preview joining" (demo).
 */
export default function Join() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();
  const app = useApp();
  const { setFirstDay } = usePrefs();
  const [step, setStep] = useState<Step>("welcome");
  const [invite, setInvite] = useState<InvitePreview | null | undefined>(undefined);
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    app.backend.previewInvite(token).then((found) => { if (live) setInvite(found); }).catch(() => { if (live) setInvite(null); });
    return () => { live = false; };
  }, [app.backend, token]);

  const leave = () => router.replace(app.status === "signed-out" ? "/sign-in" : "/");
  const accept = async () => {
    setBusy(true); setError("");
    try {
      const id = await app.backend.acceptInvite(token);
      await app.refresh();
      app.setCurrent(id);
      setCommuneId(id);
      setStep("part");
    } catch (cause) {
      setError(failure(cause, "Couldn’t join. The invitation may have expired; ask for a new one."));
    } finally { setBusy(false); }
  };
  const join = () => (app.status === "signed-out" ? setStep("signin") : void accept());
  const finish = (notifications: boolean) => {
    const name = (communeId && app.snapshotOf(communeId)?.commune.name) || invite?.communeName || "your commune";
    if (communeId) setFirstDay({ communeId, communeName: name, partSeen: true, notifications, dismissed: false });
    router.replace("/");
  };

  const name = invite?.communeName ?? "a commune";
  const kind = invite?.kind ?? "household";
  const at = ORDER.indexOf(step);
  const progress = (light?: boolean) => <View accessibilityLabel={`Step ${at + 1} of 5`} style={{ flexDirection: "row", gap: 5 }}>
    {ORDER.map((item, index) => <View key={item} style={{ width: 22, height: 4, borderRadius: 2,
      backgroundColor: index <= at ? (light ? "#fff" : c.ink) : light ? "rgba(255,255,255,0.42)" : c.outline }} />)}
  </View>;
  const top = (light: boolean, right?: ReactNode) => <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: 8 }}>
    <View style={{ flex: 1, alignItems: "flex-start" }}>
      {at > 0 && step !== "part" ? <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(ORDER[at - 1] === "signin" && app.status !== "signed-out" ? "welcome" : ORDER[at - 1])}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ChevronLeft size={22} color={light ? "#fff" : c.ink} /></PressScale> : null}
    </View>
    {progress(light)}
    <View style={{ flex: 1, alignItems: "flex-end", paddingRight: 8 }}>{right}</View>
  </View>;

  if (step === "welcome") {
    return <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}>
        <ImageBackground source={{ uri: KIND_PHOTO[kind] }} style={{ minHeight: 340 + insets.top, paddingTop: insets.top + 4, justifyContent: "space-between", backgroundColor: c.frame }}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
            <Defs><LinearGradient id="joinScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0e1018" stopOpacity={0.5} /><Stop offset="0.3" stopColor="#0e1018" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#0e1018" stopOpacity={0.1} /><Stop offset="1" stopColor="#0e1018" stopOpacity={0.86} />
            </LinearGradient></Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#joinScrim)" />
          </Svg>
          {top(true)}
          <Rise index={0} style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 4 }}>
            <Text style={{ color: "rgba(255,255,255,0.86)", fontSize: 12.5, fontWeight: "500" }}>{KIND_NAME[kind]}</Text>
            <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.5 }}>{invite === undefined ? " " : name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
              {invite?.inviterName ? <Avatar name={invite.inviterName} size={28} /> : null}
              <Text style={{ color: "#fff", fontSize: 14 }}>
                {invite?.inviterName ? <><Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{firstName(invite.inviterName)}</Text> invited you to join</> : invite === null ? "This invitation has expired or been used" : "You’ve been invited to join"}
              </Text>
            </View>
          </Rise>
        </ImageBackground>
        <View style={{ padding: 16, paddingTop: 18, gap: 18 }}>
          {invite?.people?.length ? <Rise index={1} style={{ gap: 10 }}>
            <T kind="note" muted style={{ fontSize: 12, lineHeight: 16, fontWeight: "500", paddingHorizontal: 4 }}>Who’s in it</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {invite.people.slice(0, 4).map((person) => <View key={person} style={{ flex: 1, alignItems: "center", gap: 4, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 4, borderRadius: radius.surface, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline2 }}>
                <Avatar name={person} size={52} />
                <T kind="body" style={{ fontWeight: "600", marginTop: 2 }}>{firstName(person)}</T>
                <T kind="note" muted style={{ fontSize: 11.5, lineHeight: 14, textAlign: "center" }}>{person === invite.inviterName ? "Invited you" : kind === "workspace" ? "Teammate" : kind === "trip" ? "Travelling" : "Housemate"}</T>
              </View>)}
            </View>
          </Rise> : null}
          <Rise index={2}><T kind="body" muted>Commune is where {kind === "household" ? "the house records" : "everyone records"} bills, chores and the notes. You’ll see only what you share from the day you join.</T></Rise>
          <ErrorText>{error}</ErrorText>
          <Rise index={3} style={{ gap: 8, alignItems: "center" }}>
            <Button size="lg" block label={invite?.communeName ? `Join ${invite.communeName}` : "Join"} busy={busy} disabled={invite === null} onPress={join} />
            <TextLink label="Not now" centred onPress={leave} />
          </Rise>
        </View>
      </ScrollView>
    </View>;
  }

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
    {top(false, step === "pay" ? <TextLink label="Skip" onPress={() => setStep("notify")} /> : undefined)}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: insets.bottom + 24, gap: 18 }}>
      {step === "signin" ? <SignInStep name={name} error={error} busy={busy} onSignedIn={() => void accept()} /> : null}
      {step === "part" && communeId ? <PartStep communeId={communeId} inviter={invite?.inviterName} onNext={() => setStep("pay")} /> : null}
      {step === "pay" ? <PayStep onNext={() => setStep("notify")} /> : null}
      {step === "notify" ? <NotifyStep name={name} onDone={finish} /> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Head({ over, title, body }: { over: string; title: string; body: string }) {
  return <Rise index={0} style={{ gap: 8 }}>
    <T kind="label" muted style={{ fontSize: 12.5, fontWeight: "600" }}>{over}</T>
    <T kind="display" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 33 }}>{title}</T>
    <T kind="bodyL" muted>{body}</T>
  </Rise>;
}

function SignInStep({ name, error, busy, onSignedIn }: { name: string; error: string; busy: boolean; onSignedIn(): void }) {
  const { c } = useTheme();
  const { signIn, backend } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState("");
  async function go() {
    setWorking(true); setProblem("");
    try { await signIn(email.trim(), password); onSignedIn(); } catch (cause) { setProblem(failure(cause, "Couldn’t sign in.")); } finally { setWorking(false); }
  }
  const input = { height: 48, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline, paddingHorizontal: 14, fontSize: 16, color: c.ink };
  return <>
    <Head over="Sign in" title={`Sign in to join ${name}`} body={backend.mode === "demo" ? "This build runs on demo data kept on this phone." : "Use your Commune account, or create one on the web app first."} />
    {backend.mode === "demo" ? <Rise index={1}><Button size="lg" block label="Open the demo" busy={working || busy} onPress={() => void go()} /></Rise> : <Rise index={1} style={{ gap: 12 }}>
      <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.ink2} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={input} />
      <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={c.ink2} secureTextEntry autoComplete="current-password" textContentType="password" style={input} onSubmitEditing={() => void go()} />
      <Button size="lg" block label="Sign in and join" busy={working || busy} disabled={!email || !password} onPress={() => void go()} />
    </Rise>}
    <ErrorText>{problem || error}</ErrorText>
  </>;
}

function PartStep({ communeId, inviter, onNext }: { communeId: string; inviter?: string; onNext(): void }) {
  const { c } = useTheme();
  const { needs, snapshotOf, user, today } = useApp();
  const snapshot = snapshotOf(communeId);
  const shares = needs.filter((need) => need.communeId === communeId && need.kind === "share");
  const chores = (snapshot?.operations ?? []).filter((item) => item.status === "open" && item.assigneeId === user?.id);
  const dueNow = shares.filter((need) => need.dueOn && need.dueOn <= today);
  const title = dueNow.length ? `${word(dueNow.length)[0].toUpperCase()}${word(dueNow.length).slice(1)} ${dueNow.length === 1 ? "bill is" : "bills are"} due now.` : "You owe nothing today.";
  const body = shares.length
    ? `From today you share ${word(shares.length)} ${shares.length === 1 ? "bill" : "bills"} with ${snapshot?.commune.name ?? "everyone"}.`
    : `Nothing is shared with you in ${snapshot?.commune.name ?? "it"} yet.`;
  return <>
    <Head over="Your part" title={title} body={body} />
    {shares.length ? <Rise index={1}><Panel>{shares.map((need, index) => need.kind === "share" ? <Row key={need.key} first={index === 0}
      left={<Cal iso={need.dueOn} today={today} small />} title={need.title}
      meta={<T kind="label" muted>{money(need.totalMinor, need.currency)} in all · {firstName(need.payerName)} pays it</T>}
      right={<T kind="amount" style={{ fontSize: 17 }}>{money(need.amountMinor, need.currency)}</T>} /> : null)}</Panel></Rise> : null}
    <Rise index={2} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.surface, backgroundColor: c.settled }}>
      <Info size={16} color={c.onSettled} style={{ marginTop: 2 }} />
      <T kind="body" style={{ flex: 1 }}>Nothing from before you joined is yours.{inviter ? ` ${firstName(inviter)} set that when inviting you.` : ""}</T>
    </Rise>
    {chores.length ? <Rise index={3} style={{ gap: 10 }}>
      <T kind="note" muted style={{ fontWeight: "500", paddingHorizontal: 4 }}>Chores</T>
      <Panel>{chores.map((item, index) => <Row key={item.id} first={index === 0}
        left={<View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><SquareCheck size={17} color={c.ink} /></View>}
        title={item.title}
        meta={<T kind="label" muted>{item.rotationIds?.length ? "You’re on the rota. " : ""}Your first turn is {shortDate(item.date)}</T>} />)}</Panel>
    </Rise> : null}
    <Rise index={4} style={{ gap: 8, alignItems: "center" }}>
      <Button size="lg" block label="That looks right" onPress={onNext} />
      {inviter ? <T kind="label" muted style={{ textAlign: "center" }}>Something looks wrong? Ask {firstName(inviter)}.</T> : null}
    </Rise>
  </>;
}

function PayStep({ onNext }: { onNext(): void }) {
  const { c } = useTheme();
  const router = useRouter();
  const { myPayLinks, loadMyPayLinks } = useApp();
  // Coming back from "How people pay you" shows what was added.
  useFocusEffect(useCallback(() => { void loadMyPayLinks(); }, [loadMyPayLinks]));
  const links = myPayLinks ?? [];
  return <>
    <Head over="Getting paid" title="How should people pay you?" body="When someone owes you, they see these with the amount filled in. Add as many as you like." />
    <Rise index={1}><Panel>{PAY_PROVIDERS.map((provider, index) => {
      const added = links.find((link) => link.provider === provider);
      return <Row key={provider} first={index === 0} onPress={() => router.push("/pay-links")}
        left={<PayMark provider={provider} />}
        title={provider === "bank" ? "Bank details" : PAY_PROVIDER_NAME[provider]}
        meta={<T kind="label" muted lines={1}>{added ? (added.handle ?? added.accountName ?? "Added") : provider === "bank" ? "Name, sort code and account number" : `Add your ${PAY_PROVIDER_NAME[provider]} link`}</T>}
        right={added
          ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.settled }}>
            <Check size={14} color={c.onSettled} /><Text style={{ fontSize: 13, fontWeight: "600", color: c.onSettled }}>Added</Text></View>
          : <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Plus size={16} color={c.ink} /></View>} />;
    })}</Panel></Rise>
    <Rise index={2}><T kind="label" muted style={{ paddingHorizontal: 4 }}>Only people in your communes see these. Commune never moves money and never sees your bank login.</T></Rise>
    <Rise index={3}><Button size="lg" block label={links.length ? "Continue" : "Continue without"} onPress={onNext} /></Rise>
  </>;
}

function NotifyStep({ name, onDone }: { name: string; onDone(notifications: boolean): void }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  async function turnOn() {
    setBusy(true);
    try {
      if (Platform.OS === "web") { onDone(true); return; }
      const { status } = await Notifications.requestPermissionsAsync();
      onDone(status === "granted");
    } catch { onDone(false); } finally { setBusy(false); }
  }
  return <>
    <Head over="Staying in the loop" title="Hear when something is yours." body="Commune tells you when a bill you share is added, when someone says they’ve paid you, and when it’s your turn for a chore. Nothing else." />
    <Rise index={1} style={{ flexDirection: "row", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline2,
      shadowColor: "#0a0c12", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }}>
      <View style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: c.frame, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c.onFrame, fontSize: 17, fontFamily: "CommuneWordmark25", letterSpacing: -0.8 }}>c.</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T kind="body" style={{ fontWeight: "600" }}>Commune</T><T kind="note" muted style={{ fontSize: 12.5 }}>now</T>
        </View>
        <T kind="body" style={{ marginTop: 2, lineHeight: 19 }}><Text style={{ fontWeight: "600", color: c.ink, fontSize: 14 }}>A bill was added in {name}.</Text> Your share and its due date are on Home.</T>
      </View>
    </Rise>
    <Rise index={2}><T kind="label" muted style={{ paddingHorizontal: 4 }}>You can turn them off in your phone’s Settings. Quiet hours follow your phone’s Focus.</T></Rise>
    <Rise index={3} style={{ gap: 8, alignItems: "center" }}>
      <Button size="lg" block label="Turn on notifications" busy={busy} onPress={() => void turnOn()} />
      <TextLink label="Not now" centred onPress={() => onDone(false)} />
    </Rise>
  </>;
}
