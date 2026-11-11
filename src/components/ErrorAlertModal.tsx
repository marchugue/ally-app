import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { CircleAlert } from "lucide-react-native";

export interface ErrorAlertModalProps {
  visible: boolean;
  title?: string;
  message?: string | null;
  confirmLabel?: string;
  onClose: () => void;
}

const GREEN = "#1A6B3C";

/**
 * Centered alert modal for surfacing validation and API errors cleanly on mobile.
 */
export function ErrorAlertModal({
  visible,
  title = "Notice",
  message,
  confirmLabel = "OK",
  onClose,
}: ErrorAlertModalProps) {
  return (
    <Modal
      visible={visible && Boolean(message)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <CircleAlert size={26} color="#DC2626" />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.okBtn, pressed && styles.okBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            <Text style={styles.okBtnText}>{confirmLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 20,
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  okBtn: {
    width: "100%",
    backgroundColor: GREEN,
    borderRadius: 9999,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  okBtnPressed: {
    opacity: 0.9,
  },
  okBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
