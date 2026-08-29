import { Tabs } from "expo-router";
import {
  Home,
  Compass,
  MessageCircle,
  Bell,
  User,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TabIcon from "@/components/navigation/TabIcon";
import { TAB_THEME } from "@/constants/tabBarTheme";

const tabs = [
  { name: "index",         title: "Home",         icon: Home },
  { name: "discover",      title: "Discover",     icon: Compass },
  { name: "messages",      title: "Messages",     icon: MessageCircle },
  { name: "notifications", title: "Alerts",        icon: Bell },
  { name: "profile",       title: "Profile",       icon: User },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: TAB_THEME.activeColor,
        tabBarInactiveTintColor: TAB_THEME.inactiveColor,

        tabBarStyle: {
          backgroundColor: TAB_THEME.backgroundColor,
          borderTopColor: TAB_THEME.borderColor,
          borderTopWidth: 1,
          height: TAB_THEME.baseHeight + insets.bottom + TAB_THEME.extraBottomSpace,
          paddingTop: 10,
          paddingBottom: insets.bottom + TAB_THEME.extraBottomSpace,
          // Subtle shadow instead of hard border
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 12,
        },

        tabBarLabelStyle: {
          fontSize: TAB_THEME.labelFontSize,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                Icon={tab.icon}
                color={color}
                size={size}
                focused={focused}
                indicatorColor={TAB_THEME.indicatorColor}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}