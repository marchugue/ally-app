import React from "react";
import { View, Text, Image, Pressable, Platform, Alert, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Lock } from "lucide-react-native";

interface LockedMediaThumbnailProps {
  uri?: string | null;
  count?: number;
  unlockStage?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function LockedMediaThumbnail({
  uri,
  count = 1,
  unlockStage = 3,
  style,
  onPress,
}: LockedMediaThumbnailProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    Alert.alert(
      "Media Locked",
      `Photo sharing is locked because your streak ended. Rebuild your streak to Level ${unlockStage} to view this media again.`
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, style]}
    >
      {Boolean(uri) && (
        <Image
          source={{ uri: uri! }}
          blurRadius={Platform.OS === "ios" ? 25 : 18}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}

      {/* Dark frosted overlay */}
      <View style={styles.overlay} />

      {/* Centered Lock & Text */}
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Lock size={18} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        <Text style={styles.title}>
          {count > 1 ? `${count} photos locked` : "Photo locked"}
        </Text>
        <Text style={styles.subtitle}>
          Reach Lv.{unlockStage} to unlock
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 10.5,
    fontWeight: "500",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
