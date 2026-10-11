import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { failure, useApp } from "../src/state";
import { Button, ErrorText } from "../src/ui/kit";
import { radius, useTheme } from "../src/ui/theme";

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
  const input = { height: 48, borderRadius: radius.control, backgroundColor: c.frameRaised, paddingHorizontal: 14, fontSize: 16, color: c.onFrame };
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.frame }}>
    <View style={{ flex: 1, justifyContent: "center", padding: 24, paddingTop: insets.top + 24, gap: 14, maxWidth: 460, width: "100%", alignSelf: "center" }}>
      <Text accessibilityRole="header" style={{ color: c.onFrame, fontSize: 40, fontWeight: "700", letterSpacing: -2.2 }}>commune.</Text>
      <Text style={{ color: c.onFrame2, fontSize: 15.5, lineHeight: 23, marginBottom: 12 }}>Shared money and chores, recorded fairly.</Text>
      {backend.mode === "demo" ? <Button size="lg" block label="Open the demo" busy={busy} onPress={() => void go()} /> : <>
        <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.onFrame2} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={input} />
        <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={c.onFrame2} secureTextEntry autoComplete="current-password" style={input} onSubmitEditing={() => void go()} />
        <ErrorText>{error}</ErrorText>
        <Button size="lg" block label="Sign in" busy={busy} disabled={!email || !password} onPress={() => void go()} />
        <Text style={{ color: c.onFrame2, fontSize: 12.5, lineHeight: 18 }}>New to Commune? Create your account on the web app, then sign in here.</Text>
      </>}
    </View>
  </KeyboardAvoidingView>;
}
