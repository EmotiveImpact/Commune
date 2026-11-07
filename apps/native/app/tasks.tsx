import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { memberName, statusFor } from "../src/lib/derive";
import { firstName } from "../src/lib/format";
import { useApp } from "../src/state";
import { useTheme } from "../src/ui/theme";
import { Body, Pad } from "../src/ui/chrome";
import { Button, Cal, Panel, Row, State, T } from "../src/ui/kit";
import { useClaimTask, useCompleteTask } from "../src/ui/parts";
import { useRemind } from "../src/ui/remind";
import { SwipeRow } from "../src/ui/swipe";

export default function Tasks() {
  const { current, user, today } = useApp();
  const task = useCompleteTask();
  const claimer = useClaimTask();
  const { c } = useTheme();
  const router = useRouter();
  const remindFor = useRemind();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  // A chore opened from search comes first and is marked, even when it is done.
  const items = (current?.operations ?? []).filter((item) => item.status === "open" || item.id === focus)
    .sort((a, b) => Number(b.id === focus) - Number(a.id === focus) || a.date.localeCompare(b.date));
  return <Body>
    <Pad>
      <T kind="body" muted>{current?.commune.name}</T>
      {items.length ? <Panel>{items.map((item, index) => {
        const mine = item.kind === "task" && item.assigneeId === user?.id;
        const who = !item.assigneeId ? "Nobody yet" : mine ? "Your turn" : `${firstName(memberName(current!, item.assigneeId))}’s turn`;
        const status = statusFor(item.date, today, "task");
        const remind = remindFor(`task:${item.id}`);
        return <SwipeRow key={item.id} label={item.title} onRemind={remind} background={item.id === focus ? c.settled : c.surface}>{(guard) => <Row first={index === 0} onLongPress={guard(remind)} left={<Cal iso={item.date} today={today} small />} title={item.title}
          meta={<><T kind="label" muted>{who}{item.repeat !== "none" ? ` · every ${item.repeat === "weekly" ? "week" : "month"}` : ""}</T>{mine && item.date <= today ? <State text={status.text} tone={status.tone} /> : null}</>}
          right={!item.assigneeId ? <Button size="sm" variant="secondary" label="I’ll do it" busy={claimer.busy === item.id}
            onPress={() => void claimer.claim(current!.commune.id, item.id, item.date, item.title)} />
            : mine && item.date <= today ? <Button size="sm" variant="secondary" label="Mark done" busy={task.busy === `task:${item.id}`}
            onPress={() => void task.run({ kind: "task", key: `task:${item.id}`, communeId: current!.commune.id, operationId: item.id, date: item.date, title: item.title, dueOn: item.date, band: "Today", status })} /> : null} />}</SwipeRow>;
      })}</Panel> : <Panel pad><T kind="body" muted>Nothing on the list for {current?.commune.name}.</T></Panel>}
      <Button variant="secondary" block label="Add a chore" icon={<Plus size={16} color={c.ink} />} onPress={() => router.push("/add-chore")} />
    </Pad>
  </Body>;
}
