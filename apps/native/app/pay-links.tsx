import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Landmark, Star } from "lucide-react-native";
import { formatSortCode, payLinkLabel, PAY_PROVIDER_NAME, PAY_PROVIDERS, type PayLink, type PayLinkInput, type PayProvider } from "../src/lib/payLinks";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, Panel, Row, T, tap } from "../src/ui/kit";
import { radius, useTheme } from "../src/ui/theme";

const EMPTY: Record<PayProvider, PayLinkInput> = {
  monzo: { handle: "" }, paypal: { handle: "" }, revolut: { handle: "" },
  bank: { accountName: "", sortCode: "", accountNumber: "" },
};
function inputFrom(link: PayLink | undefined, provider: PayProvider): PayLinkInput {
  if (!link) return { ...EMPTY[provider] };
  return provider === "bank"
    ? { accountName: link.accountName ?? "", sortCode: formatSortCode(link.sortCode), accountNumber: link.accountNumber ?? "" }
    : { handle: link.handle ?? "" };
}

/** Your own pay links: saved in Commune and shown to people in your communes when they owe you. */
export default function PayLinks() {
  const { c } = useTheme();
  const { myPayLinks, loadMyPayLinks, savePayLink, removePayLink, setPreferredPayLink } = useApp();
  const [editing, setEditing] = useState<PayProvider | null>(null);
  const [draft, setDraft] = useState<PayLinkInput>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { loadMyPayLinks().catch((cause) => setError(failure(cause, "Couldn’t load your pay links."))); }, [loadMyPayLinks]);

  async function save() {
    if (!editing) return;
    setBusy(true); setError("");
    try {
      await savePayLink(editing, draft);
      tap("success");
      setMessage(`${PAY_PROVIDER_NAME[editing]} saved. People in your communes see it when they owe you.`);
      setEditing(null);
    } catch (cause) { setError(failure(cause, "Couldn’t save it.")); } finally { setBusy(false); }
  }
  async function remove(provider: PayProvider) {
    setBusy(true); setError(""); setMessage("");
    try {
      await removePayLink(provider);
      setMessage(`${PAY_PROVIDER_NAME[provider]} removed.`);
    } catch (cause) { setError(failure(cause, "Couldn’t remove it.")); } finally { setBusy(false); }
  }

  async function favourite(provider: PayProvider | null) {
    setBusy(true); setError(""); setMessage("");
    try {
      await setPreferredPayLink(provider);
      tap("success");
      setMessage(provider ? `${PAY_PROVIDER_NAME[provider]} is your favourite. People who owe you get one button that opens it.` : "No favourite. People who owe you see all your ways.");
    } catch (cause) { setError(failure(cause, "Couldn’t change your favourite.")); } finally { setBusy(false); }
  }

  const input = { height: 46, borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 12, fontSize: 16, color: c.ink };
  const field = (label: string, value: string, set: (text: string) => void, extra: object = {}) => <View style={{ gap: 6 }}>
    <T kind="label" style={{ fontWeight: "600" }}>{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={set} editable={!busy} style={input} autoCapitalize="none" autoCorrect={false} {...extra} />
  </View>;
  const mark = (provider: PayProvider) => <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center",
    backgroundColor: provider === "monzo" ? c.monzo : provider === "paypal" ? c.paypal : provider === "revolut" ? c.revolut : c.recessed }}>
    {provider === "bank" ? <Landmark size={17} color={c.ink} /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{PAY_PROVIDER_NAME[provider][0]}</Text>}
  </View>;

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <T kind="body" muted>When someone owes you, they see these with the amount filled in. Only people in your communes can see them. Star one to make it your favourite.</T>
      {myPayLinks == null ? <T kind="body" muted>Loading your pay links…</T> : <Panel>
        {PAY_PROVIDERS.map((provider, index) => {
          const link = myPayLinks.find((item) => item.provider === provider);
          if (editing === provider) {
            return <View key={provider} style={{ padding: 16, gap: 12, borderTopWidth: index ? 1 : 0, borderTopColor: c.outline }}>
              <T kind="strong">{PAY_PROVIDER_NAME[provider]}</T>
              {provider === "bank" ? <>
                {field("Name on the account", draft.accountName ?? "", (text) => setDraft({ ...draft, accountName: text }), { autoCapitalize: "words", maxLength: 60 })}
                {field("Sort code", draft.sortCode ?? "", (text) => setDraft({ ...draft, sortCode: text }), { keyboardType: "number-pad", placeholder: "20-45-77", placeholderTextColor: c.ink2, maxLength: 8 })}
                {field("Account number", draft.accountNumber ?? "", (text) => setDraft({ ...draft, accountNumber: text }), { keyboardType: "number-pad", maxLength: 8 })}
              </> : <>
                {field(`${PAY_PROVIDER_NAME[provider]} username`, draft.handle ?? "", (text) => setDraft({ handle: text }), { maxLength: 120 })}
                <T kind="note" muted>Your {provider === "paypal" ? "PayPal.me" : provider === "monzo" ? "Monzo.me" : "Revolut.me"} name. A pasted link works too.</T>
              </>}
              <ErrorText>{error}</ErrorText>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Button label="Save" busy={busy} onPress={() => void save()} />
                <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => { setEditing(null); setError(""); }} />
                <View style={{ flex: 1 }} />
                {link ? <Button label="Remove" variant="danger" accessibilityLabel={`Remove ${PAY_PROVIDER_NAME[provider]}`} disabled={busy}
                  onPress={() => { setEditing(null); void remove(provider); }} /> : null}
              </View>
            </View>;
          }
          return <Row key={provider} first={index === 0} left={mark(provider)} title={PAY_PROVIDER_NAME[provider]}
            meta={<T kind="label" muted>{link ? `${link.preferred ? "Your favourite · " : ""}${payLinkLabel(link)}` : "Not added"}</T>}
            right={<View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>{link ? <Pressable accessibilityRole="button"
              accessibilityLabel={`${link.preferred ? "Unfavourite" : "Make favourite"} ${PAY_PROVIDER_NAME[provider]}`} accessibilityState={{ selected: !!link.preferred, disabled: busy || editing !== null }}
              disabled={busy || editing !== null} onPress={() => void favourite(link.preferred ? null : provider)}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Star size={20} color={link.preferred ? c.action : c.ink2} fill={link.preferred ? c.action : "transparent"} />
            </Pressable> : null}<Button size="sm" variant="secondary" label={link ? "Change" : "Add"} accessibilityLabel={`${link ? "Change" : "Add"} ${PAY_PROVIDER_NAME[provider]}`}
              disabled={busy || editing !== null} onPress={() => { setEditing(provider); setDraft(inputFrom(link, provider)); setError(""); setMessage(""); }} /></View>} />;
        })}
      </Panel>}
      {!editing ? <ErrorText>{error}</ErrorText> : null}
      {message ? <T kind="body" accessibilityRole="text">{message}</T> : null}
      <T kind="note" muted>Commune never moves money and never sees your bank login. These are only links and details you choose to share.</T>
    </ScrollView>
  </KeyboardAvoidingView>;
}
