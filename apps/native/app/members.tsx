import { activeMembers } from "../src/lib/derive";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Avatar, Panel, Row, T } from "../src/ui/kit";

export default function Members() {
  const { current, user } = useApp();
  const people = current ? activeMembers(current) : [];
  return <Body>
    <Pad>
      <Panel>{people.map((member, index) => <Row key={member.userId} first={index === 0} left={<Avatar name={member.name} size={40} />}
        title={member.userId === user?.id ? "You" : member.name}
        meta={<T kind="label" muted>{member.role === "admin" ? "Admin" : "Member"}{member.email ? ` · ${member.email}` : ""}</T>} />)}</Panel>
      <T kind="note" muted>Invite people from the web app for now.</T>
    </Pad>
  </Body>;
}
