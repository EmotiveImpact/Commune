import { useState } from "react";
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../src/ui/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, T } from "../src/ui/kit";
import { Rise } from "../src/ui/motion";
import { KIND_PHOTO, radius, useTheme } from "../src/ui/theme";

export default function SignIn() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, backend } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true); setError("");
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (cause) { setError(failure(cause, "Couldn’t sign in.")); } finally { setBusy(false); }
  }
  const input = { height: 50, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline, paddingHorizontal: 14, fontSize: 16, color: c.ink };
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <ImageBackground source={{ uri: KIND_PHOTO.trip }} style={{ height: 300, backgroundColor: c.frame, justifyContent: "flex-end" }}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(14,16,24,0.45)" }]} />
        <Rise index={0} style={{ padding: 24, paddingTop: insets.top + 24, gap: 6 }}>
          <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 40, fontFamily: "CommuneWordmark36", letterSpacing: -2 }}>commune.</Text>
          <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, lineHeight: 23 }}>Bills, chores and the house notes, shared.</Text>
        </Rise>
      </ImageBackground>
      <View style={{ padding: 24, gap: 14, maxWidth: 460, width: "100%", alignSelf: "center" }}>
        <Rise index={1} style={{ gap: 6 }}>
          <T kind="title">Sign in to Commune</T>
          <T kind="body" muted>{backend.mode === "demo" ? "This build runs on demo data kept on this phone. Nothing you do reaches anyone." : "Use the account you use on the web. Your communes and records are already there."}</T>
        </Rise>
        {backend.mode === "demo" ? <Rise index={2}><Button size="lg" block label="Open the demo" busy={busy} onPress={() => void go()} /></Rise> : <Rise index={2} style={{ gap: 12 }}>
          <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.ink2} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={input} />
          <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={c.ink2} secureTextEntry autoComplete="current-password" textContentType="password" style={input} onSubmitEditing={() => void go()} />
          <ErrorText>{error}</ErrorText>
          <Button size="lg" block label="Sign in" busy={busy} disabled={!email || !password} onPress={() => void go()} />
          <T kind="label" muted>New to Commune? Create your account on the web app, then sign in here.</T>
        </Rise>}
        <T kind="note" muted style={{ textAlign: "center", marginTop: 8 }}>Commune never moves money and never sees your bank login.</T>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
