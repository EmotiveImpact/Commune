import { View } from "react-native";
import { memberName, statusFor } from "../src/lib/derive";
import { firstName } from "../src/lib/format";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Button, Cal, Panel, Row, State, T } from "../src/ui/kit";
import { useCompleteTask } from "../src/ui/parts";

export default function Tasks() {
  const { current, user, today } = useApp();
  const task = useCompleteTask();
  const items = (current?.operations ?? []).filter((item) => item.status === "open").sort((a, b) => a.date.localeCompare(b.date));
  return <Body>
    <Pad>
      <T kind="body" muted>{current?.commune.name}</T>
      {items.length ? <Panel>{items.map((item, index) => {
        const mine = item.kind === "task" && item.assigneeId === user?.id;
        const who = !item.assigneeId ? "Nobody yet" : mine ? "Your turn" : `${firstName(memberName(current!, item.assigneeId))}’s turn`;
        const status = statusFor(item.date, today, "task");
        return <Row key={item.id} first={index === 0} left={<Cal iso={item.date} today={today} small />} title={item.title}
          meta={<><T kind="label" muted>{who}{item.repeat !== "none" ? ` · every ${item.repeat === "weekly" ? "week" : "month"}` : ""}</T>{mine && item.date <= today ? <State text={status.text} tone={status.tone} /> : null}</>}
          right={mine && item.date <= today ? <Button size="sm" variant="secondary" label="Mark done" busy={task.busy === `task:${item.id}`}
            onPress={() => void task.run({ kind: "task", key: `task:${item.id}`, communeId: current!.commune.id, operationId: item.id, date: item.date, title: item.title, dueOn: item.date, band: "Today", status })} /> : null} />;
      })}</Panel> : <Panel pad><T kind="body" muted>Nothing on the list for {current?.commune.name}.</T></Panel>}
      <View><T kind="note" muted>Adding tasks, handovers and skips are on the web app for now.</T></View>
    </Pad>
  </Body>;
}
