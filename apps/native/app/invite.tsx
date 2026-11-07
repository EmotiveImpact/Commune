import { useState } from "react";
import { Platform, Share, View } from "react-native";
import { TextInput } from "../src/ui/text";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Link2, Share2 } from "lucide-react-native";
import { failure, useApp } from "../src/state";
import { Button, FITTED, T } from "../src/ui/kit";
import { haptic } from "../src/ui/motion";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";
import { radius, useTheme } from "../src/ui/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite someone to the current commune, in a sheet only as tall as it needs. */
export default function Invite() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><InviteBody close={() => setClosing(true)} /></Sheet>;
}

/**
 * Type their email, then send the link however you like (Messages, WhatsApp,
 * email) from the share sheet, or copy it. The link works only for that
 * address, and they join once they sign in with it.
 */
function InviteBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { backend, current } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const name = current?.commune.name ?? "your commune";
  const valid = EMAIL.test(email.trim());
  const message = (url: string) => `Join ${name} on Commune, where we keep track of shared bills and chores: ${url}`;

  async function create() {
    if (!current || !valid) return;
    setBusy(true);
    try {
      const { url } = await backend.invite(current.commune.id, email.trim());
      setLink(url);
      haptic.success();
      await send(url);
    } catch (cause) {
      toast(failure(cause, "Couldn’t make the invitation. Try again."));
    } finally {
      setBusy(false);
    }
  }
  async function send(url: string) {
    if (Platform.OS === "web") { await copy(url); return; }
    try { await Share.share({ message: message(url) }); } catch { /* closed the share sheet */ }
  }
  async function copy(url: string) {
    await Clipboard.setStringAsync(url);
    haptic.light();
    toast("Invitation link copied.");
  }

  return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 14 }]}>
    <View style={{ gap: 4 }}>
      <T kind="title" accessibilityRole="header">Invite to {name}</T>
      <T kind="body" muted>{link ? `Send this link to ${email.trim()}. It works for that address only, once they sign in with it.` : "Type their email, then send them the link however you like."}</T>
    </View>
    {link ? <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46, borderRadius: radius.control, backgroundColor: c.recessed, paddingHorizontal: 12 }}>
        <Link2 size={17} color={c.ink2} />
        <T kind="label" muted lines={1} style={{ flex: 1 }}>{link}</T>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button block size="lg" variant="secondary" label="Copy link" onPress={() => void copy(link)} /></View>
        <View style={{ flex: 1 }}><Button block size="lg" label="Share" icon={<Share2 size={17} color={c.onAction} />} onPress={() => void send(link)} /></View>
      </View>
      <Button block variant="quiet" label="Invite someone else" onPress={() => { setLink(null); setEmail(""); }} />
    </> : <>
      <TextInput accessibilityLabel="Their email" value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={c.ink2}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
        returnKeyType="send" onSubmitEditing={() => void create()} editable={!busy} selectionColor={c.action}
        style={{ height: 50, borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 14, fontSize: 16.5, color: c.ink }} />
      <Button block size="lg" label="Create invitation link" busy={busy} disabled={!valid} onPress={() => void create()} />
      <Button block variant="quiet" label="Not now" onPress={close} />
    </>}
  </View>;
}
