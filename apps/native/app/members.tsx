import { useLocalSearchParams, useRouter } from "expo-router";
import { activeMembers } from "../src/lib/derive";
import { useApp } from "../src/state";
import { useTheme } from "../src/ui/theme";
import { Body, Pad } from "../src/ui/chrome";
import { Avatar, Button, Drop, Panel, Row, T, useNewKeys } from "../src/ui/kit";
import { UserPlus } from "lucide-react-native";
import { JoinRequests } from "../src/ui/joins";

export default function Members() {
  const { current, user } = useApp();
  const { c } = useTheme();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  // A person opened from search comes first and is marked.
  const people = (current ? activeMembers(current) : []).sort((a, b) => Number(b.userId === focus) - Number(a.userId === focus));
  // Someone just approved drops into the list where they land.
  const isNew = useNewKeys(people.map((member) => member.userId));
  return <Body>
    <Pad>
      {current ? <JoinRequests communeId={current.commune.id} /> : null}
      <Panel>{people.map((member, index) => <Drop key={member.userId} drop={isNew(member.userId)} style={member.userId === focus ? { backgroundColor: c.settled } : null}><Row first={index === 0} left={<Avatar name={member.name} size={40} />}
        title={member.userId === user?.id ? "You" : member.name}
        meta={<T kind="label" muted>{member.role === "admin" ? "Admin" : "Member"}{member.email ? ` · ${member.email}` : ""}</T>} /></Drop>)}</Panel>
      <Button block size="lg" label="Invite someone" icon={<UserPlus size={17} color={c.onAction} />} onPress={() => router.push("/invite")} />
    </Pad>
  </Body>;
}
