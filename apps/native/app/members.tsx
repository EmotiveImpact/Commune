import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { activeMembers } from "../src/lib/derive";
import { useApp } from "../src/state";
import { useTheme } from "../src/ui/theme";
import { Body, Pad } from "../src/ui/chrome";
import { Avatar, Panel, Row, T } from "../src/ui/kit";

export default function Members() {
  const { current, user } = useApp();
  const { c } = useTheme();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  // A person opened from search comes first and is marked.
  const people = (current ? activeMembers(current) : []).sort((a, b) => Number(b.userId === focus) - Number(a.userId === focus));
  return <Body>
    <Pad>
      <Panel>{people.map((member, index) => <View key={member.userId} style={member.userId === focus ? { backgroundColor: c.settled } : null}><Row first={index === 0} left={<Avatar name={member.name} size={40} />}
        title={member.userId === user?.id ? "You" : member.name}
        meta={<T kind="label" muted>{member.role === "admin" ? "Admin" : "Member"}{member.email ? ` · ${member.email}` : ""}</T>} /></View>)}</Panel>
      <T kind="note" muted>Invite people from the web app for now.</T>
    </Pad>
  </Body>;
}
