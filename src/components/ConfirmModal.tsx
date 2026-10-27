import { Modal, View, Text, Pressable } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 28,
        }}
        onPress={onCancel}
      >
        <Pressable
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 24,
            borderWidth: isDark ? 1 : 0,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: isDark ? 0.45 : 0.12,
            shadowRadius: 28,
            elevation: 16,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.textPrimary,
              marginBottom: 8,
              letterSpacing: -0.3,
            }}
          >
            {title}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {description}
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={onCancel}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textPrimary,
                }}
              >
                {cancelLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: destructive ? colors.danger : colors.primary,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#FFFFFF",
                }}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
