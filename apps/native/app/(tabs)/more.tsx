import type { ComponentType } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ChevronRight, FileText, Files, Repeat2, ShoppingBag, SquareCheck, UsersRound } from "lucide-react-native";
import { activeMembers } from "../../src/lib/derive";
import { joinAnd } from "../../src/lib/format";
import { useApp } from "../../src/state";
import { Body, Pad, ScopeRow, TopBar } from "../../src/ui/chrome";
import { Avatar, Badge, Panel, Row, T } from "../../src/ui/kit";
import { useTheme } from "../../src/ui/theme";

type Icon = ComponentType<{ size?: number; color?: string }>;

/** More: the rest of a commune, as a fifth tab (the panel's choice for iPhone). */
export default function More() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today, communes } = useApp();
  if (!current) return <View style={{ flex: 1 }}><TopBar title="More" /></View>;
  const ops = (current.operations ?? []).filter((item) => item.status === "open");
  const mineToday = ops.find((item) => item.kind === "task" && item.assigneeId === user?.id && item.date <= today);
  const bills = current.recurringBills ?? [];
  const funds = current.funds.filter((fund) => !fund.archivedAt);
  const notes = current.notes ?? [];
  const templates = (current.splitTemplates ?? []).filter((item) => !item.archivedAt);
  const people = activeMembers(current).length;
  const rows: Array<{ icon: Icon; label: string; sub: string; href: Href; badge?: string }> = [
    { icon: SquareCheck, label: "Chores and tasks", href: "/tasks", badge: mineToday ? "Today" : undefined,
      sub: mineToday ? `${mineToday.title} is yours today` : ops.length ? `${ops.length} on the list` : "Nothing on the list" },
    { icon: FileText, label: "Notes", href: "/notes", sub: notes.length ? joinAnd(notes.slice(0, 3).map((note) => note.title)) : "Nothing written down yet" },
    { icon: UsersRound, label: "Members", href: "/members", sub: `${people} ${people === 1 ? "person" : "people"}` },
    { icon: Repeat2, label: "Recurring", href: "/recurring", sub: bills.length ? joinAnd(bills.slice(0, 3).map((bill) => bill.title)) : "Nothing repeats here" },
    { icon: ShoppingBag, label: "Funds", href: "/funds", sub: funds.length ? `${funds.length} shared ${funds.length === 1 ? "pot" : "pots"}` : "No shared pots yet" },
    { icon: Files, label: "Templates", href: "/templates", sub: templates.length ? `${templates.length} saved ${templates.length === 1 ? "split" : "splits"}` : "None saved yet" },
  ];
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="More" />
    <Body>
      <Pad>
        <ScopeRow />
        <Panel>{rows.map((row, index) => <Row key={row.label} first={index === 0} onPress={() => router.push(row.href)}
          left={<View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><row.icon size={17} color={c.ink} /></View>}
          title={row.label}
          meta={<T kind="label" muted lines={1}>{row.sub}</T>}
          right={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{row.badge ? <Badge text={row.badge} tone="attention" /> : null}<ChevronRight size={17} color={c.ink2} /></View>} />)}
        </Panel>
        <Panel>
          <Row first onPress={() => router.push("/account")} left={<Avatar name={user?.name ?? "You"} size={40} />}
            title={user?.name ?? "You"} meta={<T kind="label" muted>Account, how people pay you and sign out</T>}
            right={<ChevronRight size={17} color={c.ink2} />} />
        </Panel>
        <T kind="note" muted style={{ textAlign: "center" }}>Commune · {communes.length} {communes.length === 1 ? "commune" : "communes"}</T>
      </Pad>
    </Body>
  </View>;
}
