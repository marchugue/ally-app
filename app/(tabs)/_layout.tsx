import { Tabs } from "expo-router";
import { Pressable } from "react-native";
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
  {
    name: "index",
    title: "Home",
    icon: Home,
    lottie: require("../../assets/icons/lottie/home.json"),
  },
  {
    name: "discover",
    title: "Discover",
    icon: Compass,
    lottie: require("../../assets/icons/lottie/compass.json"),
  },
  {
    name: "messages",
    title: "Messages",
    icon: MessageCircle,
    lottie: require("../../assets/icons/lottie/messages.json"),
  },
  {
    name: "notifications",
    title: "Alerts",
    icon: Bell,
    lottie: require("../../assets/icons/lottie/bell.json"),
  },
  {
    name: "profile",
    title: "Profile",
    icon: User,
    lottie: require("../../assets/icons/lottie/profile.json"),
  },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  const barHeight = 58 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarActiveTintColor: TAB_THEME.activeColor,
        tabBarInactiveTintColor: TAB_THEME.inactiveColor,

        tabBarButton: (props) => {
          const { ref: _ref, ...rest } = props as any;
          return (
            <Pressable
              {...rest}
              android_ripple={null}
              style={props.style}
            />
          );
        },

        tabBarStyle: {
          backgroundColor: TAB_THEME.backgroundColor,
          borderTopColor: TAB_THEME.borderColor,
          borderTopWidth: 1,
          height: barHeight,
          paddingTop: 6,
          paddingBottom: bottomInset,
          // Subtle shadow instead of hard border
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 12,
        },

        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
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
                lottieSource={tab.lottie}
                label={tab.title}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}