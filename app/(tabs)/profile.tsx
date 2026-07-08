import { View, Text, ScrollView, Pressable } from "react-native";
import { Settings, Bookmark, LogOut, ChevronRight } from "lucide-react-native";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { useAuth } from "@/lib/auth/AuthContext";

const MENU_ITEMS = [
  { icon: Settings, label: "Settings" },
  { icon: Bookmark, label: "Saved posts" },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.username ||
    "Student";
  const username = user?.user_metadata?.username
    ? `@${user.user_metadata.username}`
    : user?.email ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView>
      <View>
        <text>
          hi
        </text>
      </View>
    </ScrollView>
  );
}