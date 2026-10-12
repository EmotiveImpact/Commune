import { useEffect } from "react";
import { Alert, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, HandCoins, LogOut } from "lucide-react-native";
import { joinAnd } from "../src/lib/format";
import { PAY_PROVIDER_NAME } from "../src/lib/payLinks";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Avatar, Panel, Row, T } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";

export default function Account() {
  const { c } = useTheme();
  const router = useRouter();
  const { user, communes, myPayLinks, loadMyPayLinks, signOut, backend } = useApp();
  useEffect(() => { loadMyPayLinks().catch(() => undefined); }, [loadMyPayLinks]);
  function askSignOut() {
    const go = () => { void signOut().then(() => router.replace("/sign-in")); };
    if (Platform.OS === "web") { if (globalThis.confirm?.("Sign out of Commune on this phone?") ?? true) go(); return; }
    Alert.alert("Sign out?", "You’ll need your email and password to sign back in.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: go }]);
  }
  const icon = (node: React.ReactNode) => <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <Body>
      <Pad>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Avatar name={user?.name ?? "You"} size={48} />
          <View><T kind="section">{user?.name}</T><T kind="body" muted>{user?.email} · {communes.length} {communes.length === 1 ? "commune" : "communes"}</T></View>
        </View>
        <Panel>
          <Row first onPress={() => router.push("/pay-links")} left={icon(<HandCoins size={17} color={c.ink} />)} title="How people pay you"
            meta={<T kind="label" muted>{myPayLinks == null ? "Loading…" : myPayLinks.length ? joinAnd(myPayLinks.map((link) => PAY_PROVIDER_NAME[link.provider])) : "Not added yet"}</T>}
            right={<ChevronRight size={17} color={c.ink2} />} />
        </Panel>
        <Panel>
          <Row first onPress={askSignOut} left={icon(<LogOut size={17} color={c.late} />)} title={<T kind="body" color={c.late} style={{ fontWeight: "500" }}>Sign out</T>} />
        </Panel>
        {backend.mode === "demo" ? <T kind="note" muted style={{ paddingHorizontal: 4 }}>You’re looking at demo data kept on this phone. Nothing you do here reaches anyone.</T> : null}
      </Pad>
    </Body>
  </View>;
}
