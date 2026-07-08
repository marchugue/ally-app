import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top + 12 }}
      className="flex-row items-center justify-between px-5 pb-3 border-b border-border bg-surface"
    >
      <View>
        <View className="flex-row items-center gap-1">
          {/* Amber accent mark */}
          <View
            style={{
              width: 4,
              height: 20,
              borderRadius: 2,
              backgroundColor: "#E8A838",
              marginRight: 6,
            }}
          />
          <Text
            className="text-textPrimary text-2xl font-bold"
            style={{ letterSpacing: -0.5 }}
          >
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text className="text-textSecondary text-xs mt-0.5 ml-[10px]">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}