import { useRef, useState, type ReactNode } from "react";
import { Image, Platform, ScrollView, Share, View, type TextInput as RNTextInput } from "react-native";
import { TextInput } from "../src/ui/text";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { ChevronLeft, ChevronRight, Link2, Mail, QrCode, Share2 } from "lucide-react-native";
import { shareLink } from "../src/lib/inviteLink";
import { failure, useApp } from "../src/state";
import { Avatar, Button, ErrorText, FITTED, Panel, Row, T } from "../src/ui/kit";
import { haptic, PressScale, useCalm } from "../src/ui/motion";
import { photoOf } from "../src/ui/chrome";
import { QrCode as QrImage } from "../src/ui/qr";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";
import { radius, useTheme } from "../src/ui/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite someone to the current commune: share a link, copy it, show a QR code, or start from their email. */
export default function Invite() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><InviteBody close={() => setClosing(true)} /></Sheet>;
}

type Made = { email: string; url: string };

/**
 * Each invitation is for one person's email, so the email comes first. Once
 * there is a link, it goes out however you like: the share sheet (Messages,
 * WhatsApp, email), a copied link, or a QR code for someone standing next to
 * you. The keyboard only opens when you tap the email field.
 */
function InviteBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const calm = useCalm();
  const { backend, current, user } = useApp();
  const input = useRef<RNTextInput>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [step, setStep] = useState<"start" | "qr">("start");
  const name = current?.commune.name ?? "your commune";
  const members = (current?.members ?? []).filter((member) => member.active !== false);
  const valid = EMAIL.test(email.trim());
  const message = (url: string) => `Join ${name} on Commune, where we keep track of shared bills and chores: ${url}`;

  /** The link for the email typed in, made once and kept while the email stays the same. */
  async function link(): Promise<string | null> {
    const address = email.trim();
    if (made && made.email === address) return made.url;
    if (!valid) {
      setError(address ? "That email doesn’t look right." : "Type their email first. Each invitation is for one person.");
      input.current?.focus();
      return null;
    }
    if (!current) return null;
    setBusy(true); setError("");
    try {
      const { url } = await backend.invite(current.commune.id, address);
      const next = { email: address, url: shareLink(url) };
      setMade(next);
      setSent((list) => (list.includes(address) ? list : [...list, address]));
      haptic.success();
      return next.url;
    } catch (cause) {
      setError(failure(cause, "Couldn’t make the invitation. Try again."));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = await link();
    if (!url) return;
    if (Platform.OS === "web") { await copyText(url); return; }
    try { await Share.share({ message: message(url) }); } catch { /* closed the share sheet */ }
  }
  async function copy() {
    const url = await link();
    if (url) await copyText(url);
  }
  async function copyText(url: string) {
    await Clipboard.setStringAsync(url);
    haptic.light();
    toast("Invitation link copied.");
  }
  async function showQr() {
    const url = await link();
    if (url) { input.current?.blur(); setStep("qr"); }
  }
  const fade = calm ? undefined : FadeIn.duration(220);

  if (step === "qr" && made) {
    return <Animated.View entering={fade} style={[FITTED, { padding: 20, paddingTop: 8, gap: 16, alignItems: "center" }]}>
      <View style={{ alignSelf: "stretch", flexDirection: "row", alignItems: "center" }}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep("start")} style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 36, paddingRight: 8 }}>
          <ChevronLeft size={20} color={c.ink} /><T kind="body" style={{ fontWeight: "500" }}>Back</T>
        </PressScale>
      </View>
      <View style={{ alignItems: "center", gap: 4 }}>
        <T kind="title" accessibilityRole="header" style={{ textAlign: "center" }}>Scan to join {name}</T>
        <T kind="body" muted style={{ textAlign: "center" }}>Point your camera here to join.</T>
      </View>
      <View style={{ padding: 14, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: c.outline2 }}>
        <QrImage value={made.url} size={248} label={`QR code to join ${name}`} />
      </View>
      <View style={{ alignItems: "center", gap: 2 }}>
        <T kind="body" style={{ fontWeight: "600" }}>{name}</T>
        <T kind="label" muted style={{ textAlign: "center" }}>For {made.email}. It works once they sign in with that email.</T>
      </View>
      <View style={{ alignSelf: "stretch", flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button block size="lg" variant="secondary" label="Done" onPress={close} /></View>
        <View style={{ flex: 1 }}><Button block size="lg" label="Share link" icon={<Share2 size={17} color={c.onAction} />} onPress={() => void share()} /></View>
      </View>
    </Animated.View>;
  }

  const icon = (node: ReactNode) => <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  const chevron = <ChevronRight size={18} color={c.ink2} />;
  const ready = made && made.email === email.trim();

  return <Animated.View entering={step === "start" && made ? fade : undefined} style={FITTED}>
    <ScrollView keyboardShouldPersistTaps="handled" style={FITTED} contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {current ? <Image source={{ uri: photoOf(current.commune.kind) }} accessibilityIgnoresInvertColors
          style={{ width: 52, height: 52, borderRadius: 13, backgroundColor: c.recessed }} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T kind="title" accessibilityRole="header">Invite to {name}</T>
          <T kind="label" muted>{members.length === 1 ? "Just you so far" : `${members.length} people`}</T>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>Their email</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 50, borderRadius: radius.control, borderWidth: 1, borderColor: error ? c.late : c.outline, backgroundColor: c.surface, paddingHorizontal: 14 }}>
          <Mail size={17} color={c.ink2} />
          <TextInput ref={input} accessibilityLabel="Their email" value={email} onChangeText={(text) => { setEmail(text); setError(""); }}
            placeholder="name@example.com" placeholderTextColor={c.ink2}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
            returnKeyType="done" editable={!busy} selectionColor={c.action}
            style={[{ flex: 1, height: 48, fontSize: 16.5, color: c.ink }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
        </View>
        {error ? <ErrorText>{error}</ErrorText>
          : <T kind="label" muted style={{ paddingHorizontal: 4 }}>Each invitation is for one person. It works once they sign in with this email.</T>}
      </View>

      <Panel>
        <Row first onPress={busy ? undefined : () => void share()} left={icon(<Share2 size={17} color={c.ink} />)} title="Share invite link"
          meta={<T kind="label" muted>Messages, WhatsApp, email</T>} right={chevron} />
        <Row onPress={busy ? undefined : () => void copy()} left={icon(<Link2 size={17} color={c.ink} />)} title="Copy link"
          meta={<T kind="label" muted>{ready ? made!.url.replace("https://", "") : "Paste it anywhere"}</T>} right={chevron} />
        <Row onPress={busy ? undefined : () => void showQr()} left={icon(<QrCode size={17} color={c.ink} />)} title="Show a QR code"
          meta={<T kind="label" muted>For someone standing next to you</T>} right={chevron} />
      </Panel>
      {busy ? <T kind="label" muted style={{ textAlign: "center" }}>Making the invitation…</T> : null}

      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>Already in</T>
        <Panel>
          {members.map((member, index) => <Row key={member.userId} first={index === 0} left={<Avatar name={member.name} size={32} />}
            title={member.userId === user?.id ? "You" : member.name} meta={<T kind="label" muted>{member.role === "admin" ? "Admin" : "Member"}</T>} />)}
          {sent.map((address) => <Row key={address} left={<View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: c.outline, alignItems: "center", justifyContent: "center" }}><Mail size={14} color={c.ink2} /></View>}
            title={address} meta={<T kind="label" muted>Invited just now</T>} />)}
        </Panel>
      </View>
      <Button block variant="quiet" label="Done" onPress={close} />
    </ScrollView>
  </Animated.View>;
}
