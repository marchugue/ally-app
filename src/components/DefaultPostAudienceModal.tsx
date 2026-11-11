import React, { useState } from "react";
import { Alert, Modal, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { updateMyPreferences } from "@/lib/api/profiles";
import { useTheme } from "@/context/ThemeContext";
import { PostAudienceCard, normalizePostAudience } from "@/components/PostAudienceCard";
import type { PostAudience } from "@/types/feed";

interface DefaultPostAudienceModalProps {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  value?: unknown;
  onSaved: (nextAudience: PostAudience) => void;
}

export function DefaultPostAudienceModal({
  visible,
  onClose,
  accessToken,
  value,
  onSaved,
}: DefaultPostAudienceModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const currentAudience = normalizePostAudience(value);

  const handleDone = async (selected: PostAudience) => {
    if (!accessToken) {
      onSaved(selected);
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateMyPreferences({ default_post_audience: selected }, accessToken);
      onSaved(selected);
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not update default post audience.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: Math.max(insets.top + 16, 32),
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            height: 490,
            maxHeight: "88%",
            backgroundColor: colors.surface,
            borderRadius: 24,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <PostAudienceCard
            value={currentAudience}
            showDefaultOption={false}
            saving={saving}
            bottomInset={16}
            onBack={onClose}
            onDone={handleDone}
          />
        </View>
      </View>
    </Modal>
  );
}

