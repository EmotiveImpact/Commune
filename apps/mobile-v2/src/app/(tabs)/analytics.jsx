import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ChevronDown } from "lucide-react-native";

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();

  const weekData = [
    { day: "S", value: 0.3 },
    { day: "M", value: 0.5 },
    { day: "T", value: 0.4 },
    { day: "W", value: 0.7 },
    { day: "T", value: 1.0 },
    { day: "F", value: 0.6 },
    { day: "S", value: 0.5 },
  ];

  const categories = [
    { name: "Groceries", amount: "$450.00", color: "#84CC16", percentage: 35 },
    { name: "Utilities", amount: "$275.00", color: "#3B82F6", percentage: 21 },
    {
      name: "Entertainment",
      amount: "$250.00",
      color: "#A855F7",
      percentage: 19,
    },
    {
      name: "Transportation",
      amount: "$150.00",
      color: "#F59E0B",
      percentage: 12,
    },
    { name: "Other", amount: "$96.18", color: "#6B7280", percentage: 7 },
  ];

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
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "700",
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Analytics
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
              Track your group spending patterns
            </Text>
          </View>

          {/* My Spending Card */}
          <View
            style={{
              backgroundColor: "#1F2937",
              borderRadius: 24,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#374151",
            }}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <View>
                <Text
                  style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 8 }}
                >
                  Total Group Spending
                </Text>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "700",
                    color: "#fff",
                    marginBottom: 4,
                  }}
                >
                  $1,221.18
                </Text>
                <Text style={{ fontSize: 12, color: "#84CC16" }}>
                  ▲ 4.9% From last week
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 2,
                    alignItems: "flex-end",
                    height: 60,
                  }}
                >
                  {weekData.map((item, index) => (
                    <View key={index} style={{ alignItems: "center", flex: 1 }}>
                      <View
                        style={{
                          width: 8,
                          height: item.value * 48,
                          backgroundColor:
                            item.value === 1.0 ? "#84CC16" : "#374151",
                          borderRadius: 4,
                          marginBottom: 4,
                        }}
                      />
                      <Text style={{ fontSize: 10, color: "#6B7280" }}>
                        {item.day}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Your Net Balance */}
          <View
            style={{
              backgroundColor: "#1F2937",
              borderRadius: 24,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#374151",
            }}
          >
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 8 }}>
              Your Net Balance
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "700",
                color: "#F87171",
                marginBottom: 4,
              }}
            >
              -$40.87
            </Text>
            <Text style={{ fontSize: 13, color: "#9CA3AF" }}>
              You owe more than you're owed
            </Text>
          </View>

          {/* Spending by Category */}
          <View
            style={{
              backgroundColor: "#1F2937",
              borderRadius: 24,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#374151",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
                Spending by Category
              </Text>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#111827",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#374151",
                }}
              >
                <Text
                  style={{ fontSize: 13, color: "#9CA3AF", marginRight: 4 }}
                >
                  This Month
                </Text>
                <ChevronDown size={14} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {categories.map((category, index) => (
              <View
                key={index}
                style={{
                  marginBottom: index < categories.length - 1 ? 16 : 0,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: category.color,
                        marginRight: 10,
                      }}
                    />
                    <Text
                      style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}
                    >
                      {category.name}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
                      {category.percentage}%
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#fff",
                        minWidth: 80,
                        textAlign: "right",
                      }}
                    >
                      {category.amount}
                    </Text>
                  </View>
                </View>
                {/* Progress Bar */}
                <View
                  style={{
                    height: 6,
                    backgroundColor: "#111827",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${category.percentage}%`,
                      height: "100%",
                      backgroundColor: category.color,
                      borderRadius: 3,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Group Breakdown */}
          <View
            style={{
              backgroundColor: "#1F2937",
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: "#374151",
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#fff",
                marginBottom: 16,
              }}
            >
              Spending by Group
            </Text>
            {[
              { name: "The Loft", amount: "$789.50", color: "#84CC16" },
              { name: "Work Squad", amount: "$298.20", color: "#3B82F6" },
              { name: "Weekend Warriors", amount: "$89.48", color: "#A855F7" },
              { name: "Family House", amount: "$44.00", color: "#EF4444" },
            ].map((group, index, arr) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: index < arr.length - 1 ? 1 : 0,
                  borderBottomColor: "#374151",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: group.color,
                      marginRight: 12,
                    }}
                  />
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}
                  >
                    {group.name}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}
                >
                  {group.amount}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
