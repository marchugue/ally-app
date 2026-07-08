import { View, Text } from "react-native";
import { Bell } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";

export default function NotificationsScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Notifications" />
      <View className="flex-1 items-center justify-center px-8">
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: "#1A6B3C10",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Bell size={28} color="#1A6B3C" />
        </View>
        <Text
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: "#111827",
            marginBottom: 6,
            textAlign: "center",
            letterSpacing: -0.3,
          }}
        >
          No notifications yet
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: "#6B7280",
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          Likes, follows, and comments will appear here.
        </Text>
      </View>
    </View>
  );
}