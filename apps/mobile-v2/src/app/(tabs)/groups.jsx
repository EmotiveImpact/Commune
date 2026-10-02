import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Search,
  Plus,
  Users,
  Home,
  Briefcase,
  Heart,
} from "lucide-react-native";
import { useRouter } from "expo-router";

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const groups = [
    {
      id: 1,
      name: "The Loft",
      emoji: "🏠",
      members: 4,
      balance: "You owe $245",
      type: "owe",
      color: "#84CC16",
      memberAvatars: [
        "https://i.pravatar.cc/150?img=5",
        "https://i.pravatar.cc/150?img=12",
        "https://i.pravatar.cc/150?img=3",
      ],
    },
    {
      id: 2,
      name: "Work Squad",
      emoji: "💼",
      members: 6,
      balance: "You are owed $120",
      type: "owed",
      color: "#3B82F6",
      memberAvatars: [
        "https://i.pravatar.cc/150?img=8",
        "https://i.pravatar.cc/150?img=15",
        "https://i.pravatar.cc/150?img=20",
      ],
    },
    {
      id: 3,
      name: "Weekend Warriors",
      emoji: "⚡",
      members: 3,
      balance: "Settled up",
      type: "settled",
      color: "#9CA3AF",
      memberAvatars: [
        "https://i.pravatar.cc/150?img=11",
        "https://i.pravatar.cc/150?img=25",
      ],
    },
    {
      id: 4,
      name: "Family House",
      emoji: "❤️",
      members: 5,
      balance: "You owe $89",
      type: "owe",
      color: "#EF4444",
      memberAvatars: [
        "https://i.pravatar.cc/150?img=1",
        "https://i.pravatar.cc/150?img=2",
        "https://i.pravatar.cc/150?img=6",
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
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "700",
                color: "#fff",
                marginBottom: 8,
              }}
            >
              My Groups
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
              Manage your shared living spaces
            </Text>
          </View>

          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1F2937",
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#374151",
            }}
          >
            <Search size={20} color="#6B7280" />
            <TextInput
              placeholder="Search groups..."
              placeholderTextColor="#6B7280"
              style={{ flex: 1, marginLeft: 12, fontSize: 16, color: "#fff" }}
            />
          </View>

          {/* Create New Group */}
          <TouchableOpacity
            style={{
              backgroundColor: "#84CC16",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 32,
            }}
          >
            <Plus size={24} color="#111827" strokeWidth={3} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#111827",
                marginLeft: 8,
              }}
            >
              Create New Group
            </Text>
          </TouchableOpacity>

          {/* Groups List */}
          <View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#fff",
                marginBottom: 16,
              }}
            >
              All Groups ({groups.length})
            </Text>

            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={{
                  backgroundColor: "#1F2937",
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: "#374151",
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
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: group.color + "20",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 16,
                      }}
                    >
                      <Text style={{ fontSize: 32 }}>{group.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "700",
                          color: "#fff",
                          marginBottom: 4,
                        }}
                      >
                        {group.name}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <Users size={14} color="#6B7280" />
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#9CA3AF",
                            marginLeft: 4,
                          }}
                        >
                          {group.members} members
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color:
                            group.type === "owed"
                              ? "#84CC16"
                              : group.type === "owe"
                                ? "#F87171"
                                : "#9CA3AF",
                        }}
                      >
                        {group.balance}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Member Avatars */}
                <View
                  style={{
                    flexDirection: "row",
                    marginTop: 16,
                    alignItems: "center",
                  }}
                >
                  {group.memberAvatars.slice(0, 3).map((avatar, index) => (
                    <Image
                      key={index}
                      source={{ uri: avatar }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        marginLeft: index > 0 ? -12 : 0,
                        borderWidth: 2,
                        borderColor: "#1F2937",
                      }}
                    />
                  ))}
                  {group.members > 3 && (
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "#374151",
                        justifyContent: "center",
                        alignItems: "center",
                        marginLeft: -12,
                        borderWidth: 2,
                        borderColor: "#1F2937",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#9CA3AF",
                        }}
                      >
                        +{group.members - 3}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
