import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { firstName, joinAnd } from "../lib/format";
import { askedWords } from "../lib/joinCodes";
import { failure, useApp } from "../state";
import { Avatar, Button, ErrorText, Panel, Row, T } from "./kit";
import { haptic } from "./motion";
import { useToast } from "./toast";
import { useTheme } from "./theme";

/**
 * Someone scanned a QR code and is waiting for an admin. Shown on Hub
 * Overview (for that commune) and on Home (for all of yours), and only to
 * admins, who are the only ones the server tells.
 */
export function JoinWaitingCard({ communeId }: { communeId?: string }) {
  const { c } = useTheme();
  const router = useRouter();
  const { joinWaiting, setCurrent } = useApp();
  const list = joinWaiting.filter((item) => !communeId || item.communeId === communeId);
  if (!list.length) return null;
  const first = list[0];
  const names = joinAnd(list.slice(0, 2).map((item) => firstName(item.request.name)).concat(list.length > 2 ? [`${list.length - 2} more`] : []));
  const places = [...new Set(list.map((item) => item.communeName))];
  const title = list.length === 1 ? `${first.request.name} wants to join ${first.communeName}` : `${names} want to join ${places.length === 1 ? places[0] : "your communes"}`;
  const open = () => { setCurrent(first.communeId); router.push("/members"); };
  return <View accessibilityLabel="Wants to join" style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline2 }}>
    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><UserPlus size={17} color={c.ink} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <View style={{ gap: 2 }}>
        <T kind="body" style={{ fontSize: 15, fontWeight: "600" }}>{title}</T>
        <T kind="label" muted>They scanned your QR code. They see nothing until you approve.</T>
      </View>
      <View style={{ alignSelf: "flex-start" }}><Button size="sm" label={list.length === 1 ? "Review" : `Review ${list.length}`} onPress={open} /></View>
    </View>
  </View>;
}

/** Members' "Wants to join": each person with Approve and Decline. Admins only. */
export function JoinRequests({ communeId }: { communeId: string }) {
  const toast = useToast();
  const { joinOf, decideJoinRequest } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requests = joinOf(communeId).requests;
  if (!requests.length) return null;
  async function decide(id: string, name: string, decision: "approve" | "decline") {
    setBusy(id + decision); setError("");
    try {
      await decideJoinRequest(communeId, id, decision);
      if (decision === "approve") haptic.success();
      toast(decision === "approve" ? `${firstName(name)} is in.` : `You declined ${firstName(name)}.`);
    } catch (cause) {
      setError(failure(cause, "Couldn’t save that. Try again."));
    } finally { setBusy(null); }
  }
  return <View style={{ gap: 8 }}>
    <T kind="label" style={{ fontWeight: "600", paddingHorizontal: 4 }}>Wants to join</T>
    <Panel>{requests.map((request, index) => <Row key={request.id} first={index === 0} left={<Avatar name={request.name} size={40} />}
      title={request.name}
      meta={<View style={{ gap: 8, marginTop: 2 }}>
        <View>
          {request.email ? <T kind="label" muted>{request.email}</T> : null}
          <T kind="label" muted>Scanned the {request.codeKind === "sticker" ? "sticker" : "QR code"} {askedWords(request.createdAt)}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button size="sm" label="Approve" busy={busy === request.id + "approve"} disabled={!!busy} onPress={() => void decide(request.id, request.name, "approve")} />
          <Button size="sm" variant="secondary" label="Decline" busy={busy === request.id + "decline"} disabled={!!busy} onPress={() => void decide(request.id, request.name, "decline")} />
        </View>
      </View>} />)}</Panel>
    {error ? <ErrorText>{error}</ErrorText> : <T kind="label" muted style={{ paddingHorizontal: 4 }}>Approving adds them as a member. They see the group’s names, bills and balances from then on.</T>}
  </View>;
}
