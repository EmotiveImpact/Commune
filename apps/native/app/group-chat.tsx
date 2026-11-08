import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, TextInput, View } from "react-native";
import { groupLink, tidyGroupLink } from "../src/lib/whatsapp";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, Panel, T, tap } from "../src/ui/kit";
import { radius, useTheme } from "../src/ui/theme";

/**
 * The commune's WhatsApp group. Commune leaves the chatting to the group the
 * house already has: an admin pastes its invite link here and everyone gets
 * "Open group chat" on the Hub.
 */
export default function GroupChat() {
  const { c } = useTheme();
  const { current, setChatLink } = useApp();
  const saved = groupLink(current?.commune.chatLink);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (!current) return null;
  const { commune } = current;
  const canEdit = commune.role === "admin";
  const value = draft ?? saved;

  async function save(next: string) {
    setError(""); setMessage("");
    const tidy = tidyGroupLink(next);
    if (tidy === null) { setError("Paste a WhatsApp group invite link. It starts with https://chat.whatsapp.com/"); return; }
    setBusy(true);
    try {
      const stored = await setChatLink(commune.id, tidy);
      tap("success");
      setDraft(null);
      setMessage(stored ? "Group chat linked for everyone." : "Group chat link removed.");
    } catch (cause) { setError(failure(cause, "Couldn’t save the link.")); } finally { setBusy(false); }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <T kind="body" muted>Keep chatting where you already do. Link {commune.name}’s WhatsApp group and everyone here gets one tap to it from the Hub. Only people in this commune see the link.</T>
      <Panel pad>
        {canEdit ? <View style={{ gap: 6 }}>
          <T kind="label" style={{ fontWeight: "600" }}>WhatsApp group link</T>
          <TextInput accessibilityLabel="WhatsApp group link" value={value} onChangeText={(text) => { setDraft(text); setError(""); setMessage(""); }}
            editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://chat.whatsapp.com/…" placeholderTextColor={c.ink2}
            style={{ height: 46, borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 12, fontSize: 16, color: c.ink }} />
          <T kind="note" muted>In WhatsApp, open the group, tap its name, then Invite via link, and copy the link here.</T>
        </View> : <T kind="body" muted>{saved ? "Your admin has linked this commune’s WhatsApp group." : "No group chat linked yet. An admin can add one."}</T>}
        <ErrorText>{error}</ErrorText>
        {message ? <T kind="label" color={c.action}>{message}</T> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {canEdit ? <Button label={saved ? "Save link" : "Link group chat"} busy={busy} disabled={value.trim() === saved} onPress={() => void save(value)} /> : null}
          {saved ? <Button variant="secondary" label="Open group chat" onPress={() => void Linking.openURL(saved)} /> : null}
          {canEdit && saved ? <Button variant="quiet" label="Remove link" disabled={busy} onPress={() => void save("")} /> : null}
        </View>
      </Panel>
    </ScrollView>
  </KeyboardAvoidingView>;
}
