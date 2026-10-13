import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Plus, ReceiptText } from "lucide-react-native";
import { memberName, outstanding } from "../../src/lib/derive";
import { money, shortDate } from "../../src/lib/format";
import type { Expense } from "../../src/lib/types";
import { useApp } from "../../src/state";
import { Body, Pad, ScopeRow, TopBar } from "../../src/ui/chrome";
import { Badge, Button, Cal, Panel, T } from "../../src/ui/kit";
import { radius, useTheme } from "../../src/ui/theme";

type Filter = "all" | "open" | "settled";

export default function Expenses() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  if (!current) return <View style={{ flex: 1 }}><TopBar title="Expenses" /></View>;
  const currency = current.commune.currency;
  const isOpen = (expense: Expense) => expense.shares.some((share) => outstanding(share) > 0);
  const list = current.expenses
    .filter((expense) => !expense.voidedAt)
    .filter((expense) => filter === "all" || (filter === "open" ? isOpen(expense) : !isOpen(expense)))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const total = list.reduce((sum, expense) => sum + expense.amountMinor, 0);
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="Expenses" />
    <Body>
      <Pad gap={14}>
        <ScopeRow />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", padding: 3, gap: 2, borderRadius: radius.pill, backgroundColor: c.recessed }}>
            {(["all", "open", "settled"] as Filter[]).map((value) => {
              const on = filter === value;
              return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setFilter(value)}
                style={{ height: 32, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: "center", backgroundColor: on ? c.frame : "transparent" }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: on ? c.onFrame : c.ink2 }}>{value[0].toUpperCase() + value.slice(1)}</Text>
              </Pressable>;
            })}
          </View>
          <Button label="Add" icon={<Plus size={16} color={c.onAction} />} onPress={() => router.push("/add-expense")} />
        </View>
        <T kind="label" muted style={{ paddingHorizontal: 4 }}>{list.length} {list.length === 1 ? "expense" : "expenses"} · {money(total, currency)} recorded in this view</T>
        {list.map((expense) => {
          const mine = expense.shares.find((share) => share.userId === user?.id);
          const open = isOpen(expense);
          return <Pressable key={expense.id} accessibilityRole="button" onPress={() => router.push(`/expense/${expense.id}`)}>
            <Panel style={{ padding: 16, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><ReceiptText size={17} color={c.ink2} /></View>
                <T kind="strong" style={{ flex: 1 }} lines={1}>{expense.title}</T>
                {open ? <Badge text="Open" tone="attention" /> : <Badge text="Settled" tone="settled" icon={<Check size={13} color={c.onSettled} strokeWidth={2.2} />} />}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View><T kind="label" muted>Total paid</T><T kind="title" style={{ fontVariant: ["tabular-nums"] }}>{money(expense.amountMinor, currency)}</T></View>
                {mine ? <View style={{ alignItems: "flex-end" }}><T kind="label" muted>Your share</T><T kind="amount" style={{ marginTop: 4 }}>{money(mine.amountMinor, currency)}</T></View> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: c.outline, paddingTop: 12, borderRadius: radius.inner }}>
                <Cal iso={expense.dueOn} today={today} small />
                <View style={{ flex: 1 }}>
                  <T kind="body" style={{ fontWeight: "500" }}>Paid by {expense.paidByUserId === user?.id ? "you" : memberName(current, expense.paidByUserId)}</T>
                  <T kind="label" muted>{expense.category ?? "Other"}{expense.dueOn ? ` · due ${shortDate(expense.dueOn)}` : ""}</T>
                </View>
              </View>
            </Panel>
          </Pressable>;
        })}
        {!list.length ? <Panel pad><T kind="body" muted>{filter === "all" ? "Nothing recorded here yet. Add the first expense." : `No ${filter} expenses.`}</T></Panel> : null}
      </Pad>
    </Body>
  </View>;
}
