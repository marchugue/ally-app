import { View, Text } from "react-native";
import { Link } from "expo-router";

export default function NotFoundScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center p-6">
      <Text className="text-textPrimary text-xl font-bold mb-2">Page not found</Text>
      <Link href="/" className="text-primary text-sm mt-2">
        Go back home
      </Link>
    </View>
  );
}
