import { ImageBackground, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Plus } from "lucide-react-native";
import { activeMembers, oweTotals, owedTotals } from "../../src/lib/derive";
import { money } from "../../src/lib/format";
import { useApp } from "../../src/state";
import { Body, Pad, ScopeRow, TopBar, photoOf } from "../../src/ui/chrome";
import { Avatar, Button, Empty, Faces, Panel, Row, SectionHead, T } from "../../src/ui/kit";
import { NeedsList } from "../../src/ui/parts";
import { KIND_NAME, useTheme } from "../../src/ui/theme";

export default function Hub() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, needs, waiting, user } = useApp();
  if (!current) return <View style={{ flex: 1 }}><TopBar title="This Hub" /><Body><Pad><T kind="body" muted>You’re not in a commune yet.</T></Pad></Body></View>;
  const { commune } = current;
  const people = activeMembers(current);
  const owe = oweTotals(needs, commune.id)[commune.currency] ?? 0;
  const owed = owedTotals(waiting, commune.id)[commune.currency] ?? 0;
  const mine = needs.filter((need) => need.communeId === commune.id);
  const standing = owe > 0 ? `You owe ${money(owe, commune.currency)}` : owed > 0 ? `You’re owed ${money(owed, commune.currency)}` : "You’re all square";
  const place = commune.address || commune.destination || "";
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="This Hub" />
    <Body>
      <Pad>
        <ScopeRow />
        <ImageBackground source={{ uri: photoOf(commune.kind) }} imageStyle={{ borderRadius: 15 }} style={{ minHeight: 220, borderRadius: 15, overflow: "hidden", justifyContent: "flex-end", backgroundColor: c.frameRaised }}>
          <View style={{ padding: 18, gap: 4, backgroundColor: "rgba(14,16,24,0.5)" }}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>{KIND_NAME[commune.kind]}</Text>
            <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.5 }}>{commune.name}</Text>
            {place ? <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5 }}>{place}</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
              <Faces names={people.map((member) => member.name)} size={28} ring="rgba(255,255,255,0.9)" />
              <Text style={{ color: "#fff", fontSize: 13 }}>{people.length} {people.length === 1 ? "person" : "people"}</Text>
            </View>
          </View>
        </ImageBackground>
        <Panel pad>
          <T kind="section">{standing}</T>
          {owe > 0 && owed > 0 ? <T kind="body" muted>You’re also owed {money(owed, commune.currency)} here.</T> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Button label="Add expense" icon={<Plus size={16} color={c.onAction} />} onPress={() => router.push("/add-expense")} />
            <Button variant="quiet" label="View settlement" onPress={() => router.push("/settle")} />
          </View>
        </Panel>
        <View style={{ gap: 12 }}>
          <SectionHead title="Needs you here" count={mine.length} />
          <Panel>{mine.length ? <NeedsList items={mine} /> : <Empty icon={<Check size={18} color={c.onSettled} />} title="Nothing needs you here" body="You’ll see it here when something does." />}</Panel>
        </View>
        <View style={{ gap: 12 }}>
          <SectionHead title="People" />
          <Panel>{people.map((member, index) => <Row key={member.userId} first={index === 0}
            left={<Avatar name={member.name} size={40} />}
            title={member.userId === user?.id ? "You" : member.name}
            meta={<T kind="label" muted>{member.role === "admin" ? "Admin" : "Member"}</T>} />)}</Panel>
        </View>
      </Pad>
    </Body>
  </View>;
}
