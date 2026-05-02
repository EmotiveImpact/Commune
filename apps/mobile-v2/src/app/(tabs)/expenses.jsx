import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Filter, Plus, TrendingUp, TrendingDown } from "lucide-react-native";

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();

  const expenses = [
    {
      id: 1,
      description: "Groceries - Whole Foods",
      group: "The Loft",
      paidBy: "Sarah M.",
      amount: "$142.50",
      yourShare: "-$47.50",
      date: "Apr 15, 2026",
      time: "3:45 PM",
      type: "owe",
      category: "🛒",
      avatar: "https://i.pravatar.cc/150?img=5",
      split: "3 people",
    },
    {
      id: 2,
      description: "Internet Bill",
      group: "The Loft",
      paidBy: "You",
      amount: "$89.99",
      yourShare: "+$60.00",
      date: "Apr 14, 2026",
      time: "10:00 AM",
      type: "owed",
      category: "📡",
      split: "4 people",
    },
    {
      id: 3,
      description: "Team Lunch - Chipotle",
      group: "Work Squad",
      paidBy: "Michael R.",
      amount: "$156.00",
      yourShare: "-$26.00",
      date: "Apr 13, 2026",
      time: "1:30 PM",
      type: "owe",
      category: "🍽️",
      avatar: "https://i.pravatar.cc/150?img=8",
      split: "6 people",
    },
    {
      id: 4,
      description: "Utilities - Electric",
      group: "The Loft",
      paidBy: "James K.",
      amount: "$230.00",
      yourShare: "-$57.50",
      date: "Apr 12, 2026",
      time: "9:15 AM",
      type: "owe",
      category: "⚡",
      avatar: "https://i.pravatar.cc/150?img=12",
      split: "4 people",
    },
    {
      id: 5,
      description: "Movie Night Snacks",
      group: "Weekend Warriors",
      paidBy: "You",
      amount: "$45.20",
      yourShare: "+$30.13",
      date: "Apr 11, 2026",
      time: "8:00 PM",
      type: "owed",
      category: "🎬",
      split: "3 people",
    },
  ];

  const filterOptions = ["All", "You Owe", "You Are Owed", "Settled"];
  const [selectedFilter, setSelectedFilter] = React.useState("All");

  return (
    <View style={{ flex: 1, backgroundColor: "#111827" }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <View>
              <Text style={{ fontSize: 32, fontWeight: "700", color: "#fff" }}>
                Expenses
              </Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}>
                Track all your shared costs
              </Text>
            </View>
            <TouchableOpacity
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#84CC16",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Plus size={24} color="#111827" strokeWidth={3} />
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: "#1F2937",
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: "#374151",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <TrendingDown size={16} color="#F87171" />
                <Text style={{ fontSize: 12, color: "#9CA3AF", marginLeft: 6 }}>
                  You Owe
                </Text>
              </View>
              <Text
                style={{ fontSize: 24, fontWeight: "700", color: "#F87171" }}
              >
                $131.00
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: "#1F2937",
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: "#374151",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <TrendingUp size={16} color="#84CC16" />
                <Text style={{ fontSize: 12, color: "#9CA3AF", marginLeft: 6 }}>
                  You're Owed
                </Text>
              </View>
              <Text
                style={{ fontSize: 24, fontWeight: "700", color: "#84CC16" }}
              >
                $90.13
              </Text>
            </View>
          </View>

          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 24 }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {filterOptions.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor:
                      selectedFilter === filter ? "#84CC16" : "#1F2937",
                    borderWidth: 1,
                    borderColor:
                      selectedFilter === filter ? "#84CC16" : "#374151",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: selectedFilter === filter ? "#111827" : "#9CA3AF",
                    }}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Expenses List */}
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
                Recent Expenses
              </Text>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#1F2937",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#374151",
                }}
              >
                <Filter size={14} color="#9CA3AF" />
                <Text style={{ fontSize: 13, color: "#9CA3AF", marginLeft: 6 }}>
                  Filter
                </Text>
              </TouchableOpacity>
            </View>

            {expenses.map((expense) => (
              <TouchableOpacity
                key={expense.id}
                style={{
                  backgroundColor: "#1F2937",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#374151",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "flex-start" }}
                >
                  {expense.avatar ? (
                    <Image
                      source={{ uri: expense.avatar }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: "#374151",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{expense.category}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: "#fff",
                          }}
                        >
                          {expense.description}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#9CA3AF",
                            marginTop: 4,
                          }}
                        >
                          {expense.group} · Paid by {expense.paidBy}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#6B7280",
                            marginTop: 2,
                          }}
                        >
                          {expense.date} at {expense.time}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#9CA3AF",
                            marginBottom: 4,
                          }}
                        >
                          {expense.amount}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {expense.type === "owe" ? (
                            <TrendingDown size={14} color="#F87171" />
                          ) : (
                            <TrendingUp size={14} color="#84CC16" />
                          )}
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "700",
                              color:
                                expense.type === "owe" ? "#F87171" : "#84CC16",
                            }}
                          >
                            {expense.yourShare}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            marginTop: 2,
                          }}
                        >
                          Split: {expense.split}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
