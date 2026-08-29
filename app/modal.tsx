import { View, Text } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/Button";

export default function Modal() {
  return (
    <View className="flex-1 bg-background p-6 items-center justify-center">
      <Text className="text-textPrimary text-xl font-bold mb-2">Modal Screen</Text>
      <Text className="text-textSecondary text-sm text-center mb-6">
        This is an example modal. Push to it with router.push("/modal").
      </Text>
      <Button label="Close" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}
