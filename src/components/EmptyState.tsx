import { View, Text } from "react-native";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
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
        {icon}
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
        {title}
      </Text>

      <Text
        style={{
          fontSize: 13,
          color: "#6B7280",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {description}
      </Text>

      {actionLabel && onAction && (
        <View style={{ marginTop: 20, width: "100%" }}>
          <Button label={actionLabel} size="sm" onPress={onAction} />
        </View>
      )}
    </View>
  );
}
