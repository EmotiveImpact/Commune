import { useCallback, useEffect, useState } from "react";
import { ImageBackground, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Clock, ShieldCheck } from "lucide-react-native";
import type { JoinCodePreview } from "../../src/lib/joinCodes";
import { requestId } from "../../src/lib/format";
import { failure, useApp } from "../../src/state";
import { Button, ErrorText, T, TextLink } from "../../src/ui/kit";
import { Rise } from "../../src/ui/motion";
import { Text } from "../../src/ui/text";
import { KIND_NAME, KIND_PHOTO, radius, useTheme } from "../../src/ui/theme";
import { Head, SignInStep } from "../join/[token]";

type Step = "preview" | "signin" | "waiting";

/**
 * Joining from a QR code, which needs no email. The preview shows only the
 * commune's name, kind and size; then "Ask to join"; then a calm wait until
 * an admin approves. A commune set to "Join straight away" opens at once.
 * Opened by commune://join-code/<code> or https://app.ourcommune.io/j/<code>.
 */
export default function JoinCode() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();
  const app = useApp();
  const [preview, setPreview] = useState<JoinCodePreview | null | undefined>(undefined);
  const [step, setStep] = useState<Step>(app.status === "signed-out" ? "signin" : "preview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One id for this screen's ask, so a retry after a dropped connection cannot ask twice.
  const [ask] = useState(requestId);

  const look = useCallback(async () => {
    try {
      const found = await app.backend.previewJoinCode(token);
      setPreview(found);
      if (found?.waiting) setStep("waiting");
      return found;
    } catch { setPreview(null); return null; }
  }, [app.backend, token]);

  useEffect(() => {
    if (app.status === "signed-out") { setStep("signin"); return; }
    if (app.status === "ready") void look();
  }, [app.status, look]);

  async function open(communeId?: string | null) {
    await app.refresh();
    if (communeId) app.setCurrent(communeId);
    router.replace("/hub");
  }
  async function requestJoin() {
    setBusy(true); setError("");
    try {
      const result = await app.backend.requestToJoin(token, ask);
      if (result.status === "joined" || result.status === "already_member") { await open(result.communeId); return; }
      if (result.status === "pending") { setStep("waiting"); return; }
      setError("An admin has already said no to this request.");
    } catch (cause) {
      setError(failure(cause, "Couldn’t ask to join. Try again."));
    } finally { setBusy(false); }
  }
  async function checkAgain() {
    setBusy(true);
    const found = await look();
    setBusy(false);
    if (found?.alreadyMember) await open(null);
  }
  const leave = () => router.replace(app.status === "signed-out" ? "/sign-in" : "/");
  const name = preview?.communeName ?? "a commune";

  if (step === "signin") {
    return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: insets.bottom + 24, gap: 18 }}>
        <SignInStep name="the group" error={error} busy={busy} onSignedIn={() => setStep("preview")} />
        <T kind="label" muted style={{ paddingHorizontal: 4 }}>Someone shared a Commune QR code with you. Sign in to see which group it’s for and ask to join.</T>
        <TextLink label="Not now" centred onPress={leave} />
      </ScrollView>
    </View>;
  }

  if (step === "waiting") {
    return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top + 24 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 20 }}>
        <Rise index={0} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Clock size={26} color={c.ink} /></Rise>
        <Head over={name} title="Waiting for an admin to approve" body={`You’ve asked to join ${name}. An admin will look at it soon. You’ll see the group in your communes once they approve.`} />
        <Rise index={1} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.surface, backgroundColor: c.settled }}>
          <ShieldCheck size={16} color={c.onSettled} style={{ marginTop: 2 }} />
          <T kind="body" style={{ flex: 1 }}>Until then you see nothing of the group, and they see only your name and email.</T>
        </Rise>
        <Rise index={2} style={{ gap: 8, alignItems: "center" }}>
          <Button size="lg" block label="Done" onPress={() => router.replace("/")} />
          <TextLink label={busy ? "Checking…" : "Check again"} centred onPress={() => void checkAgain()} />
        </Rise>
      </ScrollView>
    </View>;
  }

  const kind = preview?.communeKind ?? "household";
  const dead = preview === null;
  const instant = preview?.joinMode === "instant";
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}>
      <ImageBackground source={dead ? undefined : { uri: KIND_PHOTO[kind] }} style={{ minHeight: 320 + insets.top, paddingTop: insets.top + 4, justifyContent: "flex-end", backgroundColor: c.frame }}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
          <Defs><LinearGradient id="codeScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0e1018" stopOpacity={0.45} /><Stop offset="0.35" stopColor="#0e1018" stopOpacity={0.05} />
            <Stop offset="1" stopColor="#0e1018" stopOpacity={0.86} />
          </LinearGradient></Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#codeScrim)" />
        </Svg>
        <Rise index={0} style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 4 }}>
          <Text style={{ color: "rgba(255,255,255,0.86)", fontSize: 12.5, fontWeight: "500" }}>{dead ? "QR code" : `${KIND_NAME[kind]} · ${preview ? `${preview.memberCount} ${preview.memberCount === 1 ? "person" : "people"}` : " "}`}</Text>
          <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.5 }}>{preview === undefined ? " " : dead ? "This code no longer works" : name}</Text>
          <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{dead ? "It may have expired or been turned off." : preview?.alreadyMember ? "You’re already in this group." : "You scanned a code to join"}</Text>
        </Rise>
      </ImageBackground>
      <View style={{ padding: 16, paddingTop: 18, gap: 18 }}>
        <Rise index={1}><T kind="body" muted>{dead
          ? "Ask whoever shared it for a new one."
          : preview?.alreadyMember ? `Open ${name} to see its bills, chores and notes.`
          : instant ? `You join ${name} as soon as you tap. Commune is where everyone records bills, chores and notes. You’ll see only what you share from the day you join.`
          : `Ask to join and an admin of ${name} approves you. You see nothing of the group until they do.`}</T></Rise>
        <ErrorText>{error}</ErrorText>
        <Rise index={2} style={{ gap: 8, alignItems: "center" }}>
          {dead ? <Button size="lg" block label="Done" onPress={leave} />
            : preview?.alreadyMember ? <Button size="lg" block label={`Open ${name}`} busy={busy} onPress={() => void open(null)} />
            : <Button size="lg" block label={instant ? `Join ${name}` : "Ask to join"} busy={busy} disabled={preview === undefined} onPress={() => void requestJoin()} />}
          {dead ? null : <TextLink label="Not now" centred onPress={leave} />}
        </Rise>
      </View>
    </ScrollView>
  </View>;
}
