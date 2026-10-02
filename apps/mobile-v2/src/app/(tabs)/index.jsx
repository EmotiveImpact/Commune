import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  Menu,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  BarChart3,
  MessageCircle,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const recentExpenses = [
    {
      id: 1,
      description: "Groceries - Whole Foods",
      group: "The Loft",
      paidBy: "Sarah",
      amount: "$142.50",
      yourShare: "-$47.50",
      time: "Today, 3:45 PM",
      type: "owe",
      avatar: "https://i.pravatar.cc/150?img=5",
    },
    {
      id: 2,
      description: "Internet Bill",
      group: "The Loft",
      paidBy: "You",
      amount: "$89.99",
      yourShare: "+$60.00",
      time: "Yesterday",
      type: "owed",
      emoji: "📡",
    },
    {
      id: 3,
      description: "Team Lunch",
      group: "Work Squad",
      paidBy: "Michael",
      amount: "$156.00",
      yourShare: "-$26.00",
      time: "2 days ago",
      type: "owe",
      avatar: "https://i.pravatar.cc/150?img=8",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
          {/* Header with Profile */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#D1FAE5",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 20 }}>👤</Text>
              </View>
              <Text
                style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}
              >
                Jonathan
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push("/more")}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Menu size={20} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <View style={{ position: "relative" }}>
                  <Bell size={20} color="#111827" />
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      backgroundColor: "#84CC16",
                      borderRadius: 8,
                      width: 16,
                      height: 16,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 10,
                        fontWeight: "700",
                      }}
                    >
                      3
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F3F4F6",
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 20,
            }}
          >
            <Search size={20} color="#6B7280" />
            <TextInput
              placeholder="Search expenses, groups..."
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                marginLeft: 12,
                fontSize: 16,
                color: "#111827",
              }}
            />
            <TouchableOpacity>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: "#fff",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 18 }}>📷</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Featured Balance Card */}
          <TouchableOpacity
            onPress={() => router.push("/groups")}
            style={{
              backgroundColor: "#1F2937",
              borderRadius: 24,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <View
              style={{
                backgroundColor: "#D9F99D",
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#365314" }}
              >
                ACTIVE GROUP
              </Text>
            </View>

            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#fff",
                marginBottom: 4,
              }}
            >
              The Loft · Shared Living
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 16 }}>
              4 members · Est. Apr 2026
            </Text>

            {/* Progress Bar */}
            <View
              style={{
                height: 4,
                backgroundColor: "#374151",
                borderRadius: 2,
                marginBottom: 16,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: "65%",
                  height: "100%",
                  backgroundColor: "#D9F99D",
                }}
              />
            </View>

            <Text style={{ fontSize: 14, color: "#9CA3AF" }}>Your Balance</Text>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#F87171" }}>
              You owe $245.00
            </Text>
          </TouchableOpacity>

          {/* Quick Actions */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 32,
            }}
          >
            {[
              { icon: DollarSign, label: "Settle" },
              { icon: Users, label: "Groups" },
              { icon: BarChart3, label: "Analytics" },
              { icon: MessageCircle, label: "Activity" },
            ].map((item, index) => (
              <TouchableOpacity
                key={index}
                style={{ alignItems: "center" }}
                onPress={() => {
                  if (item.label === "Groups") router.push("/groups");
                  if (item.label === "Analytics") router.push("/analytics");
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: "#F3F4F6",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <item.icon size={28} color="#111827" />
                </View>
                <Text style={{ fontSize: 14, color: "#6B7280" }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Commune Tagline */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#84CC16",
                textAlign: "center",
              }}
            >
              Commune
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#6B7280",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              for people who do life, together.
            </Text>
          </View>

          {/* Recent Activity */}
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{ fontSize: 22, fontWeight: "700", color: "#111827" }}
              >
                Recent Activity
              </Text>
              <TouchableOpacity onPress={() => router.push("/expenses")}>
                <Text style={{ fontSize: 14, color: "#6B7280" }}>
                  See all →
                </Text>
              </TouchableOpacity>
            </View>

            {recentExpenses.map((expense) => (
              <TouchableOpacity
                key={expense.id}
                style={{
                  backgroundColor: "#F3F4F6",
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    {expense.avatar ? (
                      <Image
                        source={{ uri: expense.avatar }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          marginRight: 12,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: "#fff",
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ fontSize: 24 }}>{expense.emoji}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "700",
                          color: "#111827",
                          marginBottom: 4,
                        }}
                      >
                        {expense.description}
                      </Text>
                      <Text style={{ fontSize: 14, color: "#6B7280" }}>
                        {expense.group} · {expense.paidBy}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#6B7280",
                        marginBottom: 4,
                      }}
                    >
                      {expense.amount}
                    </Text>
                    <View
                      style={{
                        backgroundColor:
                          expense.type === "owe" ? "#FEE2E2" : "#D1FAE5",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: expense.type === "owe" ? "#DC2626" : "#059669",
                        }}
                      >
                        {expense.yourShare}
                      </Text>
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
