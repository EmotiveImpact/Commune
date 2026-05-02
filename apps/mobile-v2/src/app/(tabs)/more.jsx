import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Receipt,
  RefreshCw,
  FileText,
  DollarSign,
  CreditCard,
  TrendingUp,
  BarChart3,
  Users,
  Settings,
  Activity,
  ChevronRight,
  User,
  Bell,
  HelpCircle,
  LogOut,
} from "lucide-react-native";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();

  const menuSections = [
    {
      title: "MONEY",
      items: [
        { icon: Receipt, label: "Expenses", color: "#84CC16" },
        { icon: RefreshCw, label: "Recurring", color: "#3B82F6" },
        { icon: FileText, label: "Templates", color: "#A855F7" },
        { icon: DollarSign, label: "Funds", color: "#F59E0B" },
        { icon: CreditCard, label: "Billing", color: "#EF4444" },
      ],
    },
    {
      title: "INSIGHTS",
      items: [
        { icon: TrendingUp, label: "Command Centre", color: "#84CC16" },
        { icon: BarChart3, label: "Breakdown", color: "#3B82F6" },
        { icon: BarChart3, label: "Analytics", color: "#A855F7" },
      ],
    },
    {
      title: "TEAM",
      items: [
        { icon: Users, label: "Members", color: "#84CC16" },
        { icon: Settings, label: "Operations", color: "#3B82F6" },
        { icon: Activity, label: "Activity", color: "#F59E0B" },
      ],
    },
    {
      title: "ACCOUNT",
      items: [
        { icon: User, label: "Profile Settings", color: "#9CA3AF" },
        { icon: Bell, label: "Notifications", color: "#9CA3AF" },
        { icon: HelpCircle, label: "Help & Support", color: "#9CA3AF" },
      ],
    },
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
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "700",
                color: "#fff",
                marginBottom: 8,
              }}
            >
              More
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
              Manage your Commune settings
            </Text>
          </View>

          {/* Profile Card */}
          <TouchableOpacity
            style={{
              backgroundColor: "#1F2937",
              borderRadius: 20,
              padding: 20,
              marginBottom: 32,
              borderWidth: 1,
              borderColor: "#374151",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#84CC16",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              <Text
                style={{ fontSize: 28, fontWeight: "700", color: "#111827" }}
              >
                J
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                Jonathan
              </Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
                jonathan@example.com
              </Text>
            </View>
            <ChevronRight size={24} color="#6B7280" />
          </TouchableOpacity>

          {/* Menu Sections */}
          {menuSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={{ marginBottom: 32 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: "#6B7280",
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                {section.title}
              </Text>
              <View
                style={{
                  backgroundColor: "#1F2937",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#374151",
                  overflow: "hidden",
                }}
              >
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 16,
                      borderBottomWidth:
                        index < section.items.length - 1 ? 1 : 0,
                      borderBottomColor: "#374151",
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: item.color + "20",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 12,
                      }}
                    >
                      <item.icon size={20} color={item.color} />
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#fff",
                      }}
                    >
                      {item.label}
                    </Text>
                    <ChevronRight size={20} color="#6B7280" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Logout Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#1F2937",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#EF4444",
            }}
          >
            <LogOut size={20} color="#EF4444" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#EF4444",
                marginLeft: 8,
              }}
            >
              Log Out
            </Text>
          </TouchableOpacity>

          {/* App Version */}
          <Text
            style={{
              fontSize: 12,
              color: "#6B7280",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Commune v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
