import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { usePrefs } from "../src/prefs";
import { useApp } from "../src/state";
import { Avatar, Button, ErrorText, FITTED, T, tap } from "../src/ui/kit";
import { Field, SheetHead } from "../src/ui/form";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";

/** Edit profile: the name shown on this phone. The keyboard waits until you tap the field. */
export default function EditProfile() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/profile"));
  return <Sheet closing={closing} onClosed={leave}><Body close={() => setClosing(true)} /></Sheet>;
}

function Body({ close }: { close(): void }) {
  const toast = useToast();
  const { user } = useApp();
  const { setDisplayName } = usePrefs();
  const [name, setName] = useState(user?.name ?? "");
  const [error, setError] = useState("");
  function save() {
    const next = name.trim().replace(/\s+/g, " ");
    if (!next) { setError("Your name can’t be empty."); return; }
    setDisplayName(next);
    tap("success");
    toast("Your name is updated on this phone.");
    close();
  }
  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title="Edit profile" sub={user?.email ?? ""} onClose={close} />
    <View style={{ alignItems: "center", paddingVertical: 4 }}><Avatar name={name.trim() || user?.name || "You"} size={72} /></View>
    <Field label="Your name" value={name} onChange={(value) => { setName(value); setError(""); }} max={48} placeholder="Maya Chen" />
    <T kind="note" muted>Saved on this phone for now. People in your communes see the name on your account until profile changes sync.</T>
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label="Save" onPress={save} />
  </ScrollView>;
}
