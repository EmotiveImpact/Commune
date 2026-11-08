import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Linking, Platform, ScrollView, Share, View, type TextInput as RNTextInput } from "react-native";
import * as Contacts from "expo-contacts";
import { Text, TextInput } from "../src/ui/text";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { ChevronLeft, ChevronRight, Link2, Mail, MessageSquare, QrCode, Share2, StickyNote, UserRound } from "lucide-react-native";
import type { WaitingInvite } from "../src/lib/backend";
import {
  defaultCallingCode, inviteFirstName, inviteMessage, sentViaWords, textLink, whatsAppLink, whatsAppNumber, withInviteLink,
  type InviteChannel,
} from "../src/lib/contactInvite";
import { feedTime, todayIso } from "../src/lib/format";
import { inviteToken, shareLink } from "../src/lib/inviteLink";
import {
  INSTANT_WARNING, JOIN_MODES, expiryWords, isLive, joinCodeUrl,
  type JoinCode, type JoinCodeKind, type JoinMode,
} from "../src/lib/joinCodes";
import { failure, useApp } from "../src/state";
import { Avatar, Badge, Button, ErrorText, FITTED, Panel, Row, T, TextLink } from "../src/ui/kit";
import { WhatsAppMark } from "../src/ui/whatsappMark";
import { haptic, PressScale, useCalm } from "../src/ui/motion";
import { photoOf } from "../src/ui/chrome";
import { QrCode as QrImage } from "../src/ui/qr";
import { Sheet } from "../src/ui/sheet";
import { useConfirm } from "../src/ui/confirm";
import { useToast } from "../src/ui/toast";
import { radius, useTheme } from "../src/ui/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite someone to the current commune: by email, a QR to show now, or a sticker for the fridge. */
export default function Invite() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><InviteBody close={() => setClosing(true)} /></Sheet>;
}

type Made = { email: string; url: string };

/** "today", or "on Mon" / "on 3 Nov", after "Sent on WhatsApp". */
function whenSent(iso: string): string {
  const when = feedTime(iso, todayIso());
  return when === "Today" ? "today" : `on ${when}`;
}
type Step = "start" | "now" | "sticker" | "person";
/** The one person picked from contacts (or typed). Their numbers stay on the phone. */
type Person = { name: string; phones: string[]; picked: boolean };

/**
 * Three ways in. An email invitation is for one person and lasts seven days.
 * A QR code needs no email: shown now, it stops working after an hour; as a
 * sticker, it works until an admin turns it off. What a scan does is the
 * commune's join setting, which admins choose at the bottom.
 */
function InviteBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const calm = useCalm();
  const { backend, current, user, joinOf, makeJoinCode, revokeJoinCode, setJoinMode } = useApp();
  const input = useRef<RNTextInput>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [emailed, setEmailed] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [shown, setShown] = useState<JoinCode | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [waiting, setWaiting] = useState<WaitingInvite[]>([]);
  const name = current?.commune.name ?? "your commune";
  const communeId = current?.commune.id ?? "";
  const admin = current?.commune.role === "admin";
  const join = joinOf(communeId);
  const sticker = join.codes.find((code) => code.kind === "sticker" && isLive(code)) ?? null;
  const members = (current?.members ?? []).filter((member) => member.active !== false);
  const valid = EMAIL.test(email.trim());
  const message = (url: string) => `Join ${name} on Commune, where we keep track of shared bills and chores: ${url}`;
  const scanLine = join.joinMode === "instant" ? "Scan to join" : "Scan to ask to join";

  /** Invitations nobody has used yet, so nobody sends Maya a second one. */
  const loadWaiting = useCallback(async () => {
    if (!communeId || !admin) return;
    try { setWaiting(await backend.waitingInvites(communeId)); } catch { /* the list is a convenience; the sheet still works */ }
  }, [admin, backend, communeId]);
  useEffect(() => { void loadWaiting(); }, [loadWaiting]);

  /**
   * Opens the phone's own contact list for one person. On an iPhone this
   * needs no permission; Android asks once. If there is no picker or they
   * say no, they type the name instead. Nothing is uploaded.
   */
  async function pickContact() {
    if (busy) return;
    setCodeError("");
    const typed = () => { setPerson({ name: "", phones: [], picked: false }); setStep("person"); };
    try {
      if (Platform.OS === "web") {
        const picker = (globalThis.navigator as { contacts?: { select: (props: string[], options: object) => Promise<Array<{ name?: string[]; tel?: string[] }>> } } | undefined)?.contacts;
        if (!picker) { typed(); return; }
        const [chosen] = await picker.select(["name", "tel"], { multiple: false });
        if (!chosen) return;
        setPerson({ name: (chosen.name?.[0] ?? "").trim(), phones: chosen.tel ?? [], picked: true });
        setStep("person");
        return;
      }
      if (Platform.OS === "android") {
        const { granted } = await Contacts.requestPermissionsAsync();
        if (!granted) { typed(); toast("No problem. Type their name instead."); return; }
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const name = (contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ")).trim();
      // Mobiles first: that is where WhatsApp and texts go.
      const numbers = (contact.phoneNumbers ?? [])
        .slice().sort((a, b) => Number(/mobile|cell|iphone/i.test(b.label ?? "")) - Number(/mobile|cell|iphone/i.test(a.label ?? "")))
        .map((entry) => entry.number ?? "").filter(Boolean);
      haptic.light();
      setPerson({ name, phones: numbers, picked: true });
      setStep("person");
    } catch {
      typed();
    }
  }

  /** The link for the email typed in, made once and kept while the email stays the same. */
  async function link(): Promise<string | null> {
    const address = email.trim();
    if (made && made.email === address) return made.url;
    if (!valid) {
      setError(address ? "That email doesn’t look right." : admin ? "Type their email for this one. For no email, use the QR or join link above." : "Type their email first. Each invitation is for one person.");
      input.current?.focus();
      return null;
    }
    if (!current) return null;
    setBusy(true); setError("");
    try {
      const { url } = await backend.invite(current.commune.id, address);
      const next = { email: address, url: shareLink(url) };
      setMade(next);
      haptic.success();
      return next.url;
    } catch (cause) {
      setError(failure(cause, "Couldn’t make the invitation. Try again."));
      return null;
    } finally {
      setBusy(false);
    }
  }
  /** Commune emails the invitation itself: a Join button for phones and a QR code to scan from a computer. */
  async function sendEmail() {
    const url = await link();
    const token = url ? inviteToken(url) : null;
    if (!token) return;
    setBusy(true); setError("");
    try {
      await backend.emailInvitation(token);
      setEmailed(email.trim());
      void loadWaiting();
      haptic.success();
      toast(`Emailed ${email.trim()}, with a link and a QR code.`);
    } catch (cause) {
      setError(failure(cause, "Couldn’t send the email. Share the link instead."));
    } finally { setBusy(false); }
  }
  async function shareUrl(url: string, text = message(url)) {
    if (Platform.OS === "web") { await copyText(url); return; }
    try { await Share.share({ message: text }); } catch { /* closed the share sheet */ }
  }
  async function copy() {
    const url = await link();
    if (url) await copyText(url);
  }
  async function copyText(url: string) {
    await Clipboard.setStringAsync(url);
    haptic.light();
    toast("Link copied.");
  }

  /**
   * QR codes, the join link and the sticker all need joining by code on. When
   * an admin has turned it off, tapping any of them offers to turn it back on
   * with Ask, then approve, instead of doing nothing.
   */
  async function codesOn(): Promise<boolean> {
    if (join.joinMode !== "off") return true;
    if (!(await confirm({ title: "Turn on QR codes?", message: `Joining by code is off for ${name}. Turn it on so anyone who scans asks to join and an admin approves them?`, yes: "Turn on" }))) return false;
    setBusy(true); setCodeError("");
    try {
      await setJoinMode(communeId, "approve");
      return true;
    } catch (cause) {
      setCodeError(failure(cause, "Couldn’t turn QR codes on. Try again."));
      return false;
    } finally { setBusy(false); }
  }

  /** Opens a QR: the working one when there is one, otherwise a new one. */
  async function openCode(kind: JoinCodeKind, fresh = false) {
    if (!communeId || busy) return;
    if (!(await codesOn())) return;
    setCodeError("");
    // A code shown now is reused only while it has ten minutes or more left.
    const soon = new Date(Date.now() + 10 * 60000);
    const reuse = fresh ? null : kind === "sticker" ? sticker : join.codes.find((code) => code.kind === "now" && isLive(code, soon)) ?? null;
    if (reuse) { setShown(reuse); setStep(kind); return; }
    setBusy(true);
    try {
      const code = await makeJoinCode(communeId, kind);
      setShown(code);
      setStep(kind);
      haptic.success();
    } catch (cause) {
      setCodeError(failure(cause, "Couldn’t make the code. Try again."));
    } finally { setBusy(false); }
  }
  /**
   * The join link: the standing code (the same one the sticker carries), so it
   * keeps working in a group chat. No email needed; with "Scan and approve" an
   * admin still lets each person in.
   */
  async function joinLink(): Promise<string | null> {
    if (!communeId || busy) return null;
    if (!(await codesOn())) return null;
    setCodeError("");
    if (sticker) return joinCodeUrl(sticker.token);
    setBusy(true);
    try {
      const code = await makeJoinCode(communeId, "sticker");
      haptic.success();
      return joinCodeUrl(code.token);
    } catch (cause) {
      setCodeError(failure(cause, "Couldn’t make the link. Try again."));
      return null;
    } finally { setBusy(false); }
  }
  async function shareJoin() {
    const url = await joinLink();
    if (url) await shareUrl(url, `${join.joinMode === "instant" ? "Join" : "Ask to join"} ${name} on Commune, where we keep track of shared bills and chores: ${url}`);
  }
  async function copyJoin() {
    const url = await joinLink();
    if (url) await copyText(url);
  }
  async function newSticker() {
    if (!(await confirm({ title: "Make a new code?", message: "The sticker and join link you have now stop working. Print and share the new ones.", yes: "Make a new code" }))) return;
    await openCode("sticker", true);
    toast("New code made. The old sticker no longer works.");
  }
  async function turnOff() {
    if (!shown) return;
    if (!(await confirm({ title: "Turn off this code?", message: "Scanning it will stop working. Nobody already in loses anything.", yes: "Turn off", destructive: true }))) return;
    setBusy(true);
    try {
      await revokeJoinCode(communeId, shown.id);
      setShown(null); setStep("start");
      toast("That code no longer works.");
    } catch (cause) {
      setCodeError(failure(cause, "Couldn’t turn it off. Try again."));
    } finally { setBusy(false); }
  }
  async function chooseMode(mode: JoinMode) {
    if (mode === join.joinMode || busy) return;
    // Turning codes off throws away every code, so a stray tap must not do it.
    if (mode === "off" && !(await confirm({ title: "Turn off QR codes?", message: `Every QR code, join link and sticker for ${name} stops working. Turning them on again makes new ones.`, yes: "Turn off", destructive: true }))) return;
    setBusy(true); setCodeError("");
    try {
      await setJoinMode(communeId, mode);
      haptic.light();
    } catch (cause) {
      setCodeError(failure(cause, "Couldn’t change that. Try again."));
    } finally { setBusy(false); }
  }
  const fade = calm ? undefined : FadeIn.duration(220);
  const back = <View style={{ alignSelf: "stretch", flexDirection: "row", alignItems: "center" }}>
    <PressScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => { setStep("start"); setCodeError(""); }} style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 36, paddingRight: 8 }}>
      <ChevronLeft size={20} color={c.ink} /><T kind="body" style={{ fontWeight: "500" }}>Back</T>
    </PressScale>
  </View>;

  if (step === "person" && person) {
    return <Animated.View entering={fade} style={FITTED}>
      <PersonStep person={person} communeName={name} kind={current?.commune.kind ?? "household"} currency={current?.commune.currency ?? null}
        back={back}
        send={async (personName, channel) => {
          if (!communeId) throw new Error("Choose a commune first.");
          const { url } = await backend.invitePerson(communeId, personName, channel);
          return shareLink(url);
        }}
        done={(personName, channel) => {
          void loadWaiting();
          setStep("start"); setPerson(null);
          toast(channel === "link" ? `Link for ${inviteFirstName(personName)} copied.` : `${inviteFirstName(personName)}’s invite is ready in ${channel === "whatsapp" ? "WhatsApp" : "Messages"}.`);
        }} />
    </Animated.View>;
  }

  if (step === "now" && shown) {
    const url = joinCodeUrl(shown.token);
    return <Animated.View entering={fade} style={[FITTED, { padding: 20, paddingTop: 8, gap: 16, alignItems: "center" }]}>
      {back}
      <View style={{ alignItems: "center", gap: 4 }}>
        <T kind="title" accessibilityRole="header" style={{ textAlign: "center" }}>{scanLine} {name}</T>
        <T kind="body" muted style={{ textAlign: "center" }}>{join.joinMode === "instant" ? "They join as soon as they scan." : "They ask to join. You approve them before they see anything."}</T>
      </View>
      <View style={{ padding: 14, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: c.outline2 }}>
        <QrImage value={url} size={248} label={`QR code to join ${name}`} />
      </View>
      <View style={{ alignItems: "center", gap: 2 }}>
        <T kind="body" style={{ fontWeight: "600" }}>{expiryWords(shown)}</T>
        <T kind="label" muted style={{ textAlign: "center" }}>No email needed. After an hour, make another.</T>
      </View>
      <ErrorText>{codeError}</ErrorText>
      <View style={{ alignSelf: "stretch", flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button block size="lg" variant="secondary" label="Done" onPress={close} /></View>
        <View style={{ flex: 1 }}><Button block size="lg" label="Share link" icon={<Share2 size={17} color={c.onAction} />} onPress={() => void shareUrl(url)} /></View>
      </View>
    </Animated.View>;
  }

  if (step === "sticker" && shown) {
    const url = joinCodeUrl(shown.token);
    return <Animated.View entering={fade} style={FITTED}>
      <ScrollView style={FITTED} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 16, alignItems: "center" }}>
        {back}
        <View style={{ alignItems: "center", gap: 4 }}>
          <T kind="title" accessibilityRole="header" style={{ textAlign: "center" }}>Sticker for the fridge</T>
          <T kind="body" muted style={{ textAlign: "center" }}>Print it or save it. It works until you turn it off.</T>
        </View>
        <StickerCard name={name} line={scanLine} url={url} />
        <ErrorText>{codeError}</ErrorText>
        <View style={{ alignSelf: "stretch", gap: 10 }}>
          <Button block size="lg" label={Platform.OS === "web" ? "Copy link" : "Share"} icon={<Share2 size={17} color={c.onAction} />}
            onPress={() => void shareUrl(url, `${scanLine} ${name} on Commune: ${url}`)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button block variant="secondary" label="Make a new code" busy={busy} onPress={() => void newSticker()} /></View>
            <View style={{ flex: 1 }}><Button block variant="secondary" label="Turn off this code" disabled={busy} onPress={() => void turnOff()} /></View>
          </View>
        </View>
      </ScrollView>
    </Animated.View>;
  }

  const icon = (node: ReactNode) => <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  const chevron = <ChevronRight size={18} color={c.ink2} />;
  const codesOff = join.joinMode === "off";

  return <Animated.View entering={step === "start" && (made || shown) ? fade : undefined} style={FITTED}>
    <ScrollView keyboardShouldPersistTaps="handled" style={FITTED} contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {current ? <Image source={{ uri: photoOf(current.commune.kind) }} accessibilityIgnoresInvertColors
          style={{ width: 52, height: 52, borderRadius: 13, backgroundColor: c.recessed }} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T kind="title" accessibilityRole="header">Invite to {name}</T>
          <T kind="label" muted>{members.length === 1 ? "Just you so far" : `${members.length} people`}</T>
        </View>
      </View>

      {admin ? <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>No email needed</T>
        <Panel>
          <Row first onPress={busy ? undefined : () => void pickContact()} left={icon(<UserRound size={17} color={c.ink} />)} title="From your contacts"
            meta={<T kind="label" muted>Pick one person. Send it on WhatsApp or by text.</T>} right={chevron} />
          <Row onPress={busy ? undefined : () => void openCode("now")} left={icon(<QrCode size={17} color={c.ink} />)} title="Show a QR now"
            meta={<T kind="label" muted>For someone next to you. Stops working after an hour.</T>} right={chevron} />
          <Row onPress={busy ? undefined : () => void shareJoin()} left={icon(<Share2 size={17} color={c.ink} />)} title="Share a join link"
            meta={<T kind="label" muted>{join.joinMode === "instant" ? "Messages, WhatsApp. They join when they tap it." : "Messages, WhatsApp. They ask, you approve."}</T>} right={chevron} />
          <Row onPress={busy ? undefined : () => void copyJoin()} left={icon(<Link2 size={17} color={c.ink} />)} title="Copy join link"
            meta={<T kind="label" muted>Paste it anywhere</T>} right={chevron} />
          <Row onPress={busy ? undefined : () => void openCode("sticker")} left={icon(<StickyNote size={17} color={c.ink} />)} title="Sticker for the fridge"
            meta={<T kind="label" muted>{sticker ? "Working, with the same code as the join link. Tap to show, share or turn it off." : "A card to print. Works until you turn it off."}</T>} right={chevron} />
        </Panel>
        {codeError ? <ErrorText>{codeError}</ErrorText>
          : codesOff ? <T kind="label" muted style={{ paddingHorizontal: 4 }}>QR codes are off for {name}. Tap any of these to turn them back on.</T> : null}
      </View> : null}

      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>{admin ? "Or invite one person by email" : "Invite by email"}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 50, borderRadius: radius.control, borderWidth: 1, borderColor: error ? c.late : c.outline, backgroundColor: c.surface, paddingHorizontal: 14 }}>
          <Mail size={17} color={c.ink2} />
          <TextInput ref={input} accessibilityLabel="Their email" value={email} onChangeText={(text) => { setEmail(text); setError(""); }}
            placeholder="name@example.com" placeholderTextColor={c.ink2}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
            returnKeyType="done" editable={!busy} selectionColor={c.action}
            style={[{ flex: 1, height: 48, fontSize: 16.5, color: c.ink }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
        </View>
        {error ? <ErrorText>{error}</ErrorText>
          : <T kind="label" muted style={{ paddingHorizontal: 4 }}>For one person. It works for 7 days, once they sign in with this email.</T>}
        <Button block size="lg" label="Email the invitation" busy={busy} disabled={!valid} icon={<Mail size={17} color={valid ? c.onAction : c.ink2} />} onPress={() => void sendEmail()} />
        {emailed && emailed === email.trim() ? <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <T kind="label" style={{ fontWeight: "500" }}>Sent to {emailed}. It has a Join button for their phone and a QR code for a computer.</T>
          <TextLink label="Copy their link instead" onPress={() => void copy()} />
        </View> : <T kind="label" muted style={{ paddingHorizontal: 4 }}>The email has a Join button for their phone and a QR code to scan if they open it on a computer.</T>}
      </View>
      {busy ? <T kind="label" muted style={{ textAlign: "center" }}>Working on it…</T> : null}

      {admin ? <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>How a scan joins</T>
        <Panel>{JOIN_MODES.map((option, index) => {
          const on = option.mode === join.joinMode;
          return <PressScale key={option.mode} scaleTo={0.99} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${option.label}. ${option.line}`}
            onPress={() => void chooseMode(option.mode)}
            style={{ flexDirection: "row", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.outline2 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, marginTop: 1, borderWidth: on ? 6 : 1.5, borderColor: on ? c.action : c.outline, backgroundColor: c.surface }} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T kind="body" style={{ fontWeight: on ? "600" : "400" }}>{option.label}</T>
              <T kind="label" muted>{option.line}</T>
              {option.mode === "instant" && on ? <T kind="label" style={{ color: c.late, marginTop: 4 }}>{INSTANT_WARNING}</T> : null}
            </View>
          </PressScale>;
        })}</Panel>
        <T kind="label" muted style={{ paddingHorizontal: 4 }}>This is for QR codes only. Email and contact invitations work the same whichever you choose. People who join by code are members, never admins.</T>
      </View> : <T kind="label" muted style={{ paddingHorizontal: 4 }}>Only an admin can make a QR code for {name}.</T>}

      {waiting.length ? <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>Invited</T>
        <Panel>
          {waiting.map((invite, index) => <Row key={invite.id} first={index === 0}
            left={invite.email ? <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: c.outline, alignItems: "center", justifyContent: "center" }}><Mail size={14} color={c.ink2} /></View> : <Avatar name={invite.name} size={32} />}
            title={invite.name}
            meta={<T kind="label" muted>{invite.email ? "Emailed" : sentViaWords(invite.sentVia)} {whenSent(invite.createdAt)}</T>}
            right={<Badge text="Waiting" tone="attention" />} />)}
        </Panel>
      </View> : null}

      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>Already in</T>
        <Panel>
          {members.map((member, index) => <Row key={member.userId} first={index === 0} left={<Avatar name={member.name} size={32} />}
            title={member.userId === user?.id ? "You" : member.name} meta={<T kind="label" muted>{member.role === "admin" ? "Admin" : "Member"}</T>} />)}
        </Panel>
      </View>
      <Button block variant="quiet" label="Done" onPress={close} />
    </ScrollView>
  </Animated.View>;
}

/**
 * The printable card: always black on white, whatever the theme, so it
 * prints cleanly and any camera reads it.
 */
function StickerCard({ name, line, url }: { name: string; line: string; url: string }) {
  return <View accessibilityLabel={`Sticker: ${line} ${name}`} style={{ width: 300, paddingTop: 22, paddingBottom: 18, paddingHorizontal: 22, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e1da", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
    <Text numberOfLines={2} style={{ color: "#111", fontSize: 22, lineHeight: 27, fontWeight: "600", letterSpacing: -0.4, textAlign: "center" }}>{name}</Text>
    <QrImage value={url} size={220} label={`QR code: ${line} ${name}`} />
    <Text style={{ color: "#111", fontSize: 16, lineHeight: 21, fontWeight: "500" }}>{line}</Text>
    <View style={{ alignSelf: "stretch", height: 1, backgroundColor: "#ece9e2" }} />
    <Text accessibilityLabel="Commune" style={{ color: "#111", fontSize: 22, fontFamily: "CommuneWordmark25", letterSpacing: -1.2 }}>commune.</Text>
  </View>;
}

/**
 * The one person picked from contacts, as in the mock: who they are, the
 * message in a bubble they can change, and two small buttons side by side.
 * The link is made on the first send and reused for the other buttons, so
 * one person gets one link. Their number is used here to open the right chat
 * and is never sent to Commune.
 */
function PersonStep({ person, communeName, kind, currency, back, send, done }: {
  person: Person; communeName: string; kind: "household" | "workspace" | "trip"; currency: string | null; back: ReactNode;
  send: (name: string, channel: InviteChannel) => Promise<string>;
  done: (name: string, channel: InviteChannel) => void;
}) {
  const { c } = useTheme();
  const [name, setName] = useState(person.name);
  const [phoneAt, setPhoneAt] = useState(0);
  const [message, setMessage] = useState(() => inviteMessage({ name: person.name, communeName, kind }));
  const [edited, setEdited] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<InviteChannel | null>(null);
  const [error, setError] = useState("");
  const nameInput = useRef<RNTextInput>(null);
  const phone = person.phones[phoneAt] ?? null;
  const number = whatsAppNumber(phone, defaultCallingCode(currency));
  const first = inviteFirstName(name);
  const ready = name.trim().length > 0;
  const canText = Platform.OS !== "web";

  function rename(next: string) {
    setName(next); setError("");
    // Until they change the message themselves, it greets whoever is named.
    if (!edited) setMessage(inviteMessage({ name: next, communeName, kind }));
  }
  async function go(channel: InviteChannel) {
    if (busy) return;
    if (!ready) { setError("Type their name first."); nameInput.current?.focus(); return; }
    setBusy(channel); setError("");
    try {
      const link = url ?? await send(name.trim(), channel);
      setUrl(link);
      const text = withInviteLink(message, link);
      if (channel === "link") await Clipboard.setStringAsync(link);
      else if (channel === "whatsapp") await Linking.openURL(whatsAppLink(number, text));
      else await Linking.openURL(textLink(phone, text, Platform.OS === "ios"));
      haptic.success();
      done(name.trim(), channel);
    } catch (cause) {
      setError(failure(cause, url ? "Couldn’t open that app. Try the other button or copy the link." : "Couldn’t make the invite. Try again."));
    } finally { setBusy(null); }
  }

  return <ScrollView keyboardShouldPersistTaps="handled" style={FITTED} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }}>
    {back}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Avatar name={name.trim() || "?"} size={46} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {person.picked && person.name ? <T kind="title" accessibilityRole="header" lines={1}>{name}</T>
          : <TextInput ref={nameInput} autoFocus accessibilityLabel="Their name" value={name} onChangeText={rename}
            placeholder="Their name" placeholderTextColor={c.ink2} maxLength={80} autoCapitalize="words" autoComplete="name" textContentType="name"
            returnKeyType="done" selectionColor={c.action}
            style={[{ height: 44, borderRadius: radius.control, borderWidth: 1, borderColor: error && !ready ? c.late : c.outline, backgroundColor: c.surface, paddingHorizontal: 12, fontSize: 16.5, color: c.ink },
              Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />}
        {phone ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <T kind="label" muted>{phone}</T>
          {person.phones.length > 1 ? <TextLink label="Other number" onPress={() => setPhoneAt((at) => (at + 1) % person.phones.length)} /> : null}
        </View> : person.picked ? <T kind="label" muted>No number saved. WhatsApp will ask who to send it to.</T> : null}
      </View>
    </View>

    <View style={{ gap: 6 }}>
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline2, borderRadius: 16, borderBottomLeftRadius: 6, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 11, gap: 6 }}>
        <TextInput multiline accessibilityLabel="Message" value={message} maxLength={400}
          onChangeText={(text) => { setMessage(text); setEdited(true); }} selectionColor={c.action}
          style={[{ fontSize: 15, lineHeight: 21, color: c.ink, padding: 0, minHeight: 42, textAlignVertical: "top" },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Link2 size={13} color={c.action} />
          <T kind="label" style={{ color: c.action, fontWeight: "500" }}>{url ? url.replace(/^https:\/\//, "") : `${first ? `${first}’s` : "Their"} invite link goes here`}</T>
        </View>
      </View>
      <T kind="label" muted style={{ paddingHorizontal: 4 }}>Tap the message to change it.</T>
    </View>

    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Button size="sm" label="WhatsApp" busy={busy === "whatsapp"} disabled={busy !== null && busy !== "whatsapp"}
        accessibilityLabel={`Send ${first || "their"} invite on WhatsApp`}
        icon={<WhatsAppMark size={15} color={c.onAction} />} onPress={() => void go("whatsapp")} />
      {canText ? <Button size="sm" variant="secondary" label="Text" busy={busy === "text"} disabled={busy !== null && busy !== "text"}
        accessibilityLabel={`Send ${first || "their"} invite by text`}
        icon={<MessageSquare size={15} color={c.ink} />} onPress={() => void go("text")} /> : null}
      <View style={{ flex: 1 }} />
      <TextLink label="Copy link" onPress={() => void go("link")} />
    </View>
    <ErrorText>{error}</ErrorText>
    <T kind="label" muted style={{ paddingHorizontal: 4 }}>
      The link works once, for {first || "them"} only, for 7 days. Commune doesn’t keep their number.
    </T>
  </ScrollView>;
}
