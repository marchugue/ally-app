import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardGestureArea } from "react-native-keyboard-controller";
import { useKeyboard } from "@/hooks/useKeyboard";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { X, Globe, Users } from "lucide-react-native";
import { Button } from "./Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { updatePost } from "@/lib/api/feed";
import type { FeedPost, PostAudience } from "@/types/feed";

const MAX_LENGTH = 280;

interface EditPostSheetProps {
  visible: boolean;
  onClose: () => void;
  post: FeedPost;
  onPostUpdated: (updatedPost: FeedPost) => void;
}

export function EditPostSheet({
  visible,
  onClose,
  post,
  onPostUpdated,
}: EditPostSheetProps) {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const { isKeyboardVisible } = useKeyboard();
  const [content, setContent] = useState(post.content || "");
  const [audience, setAudience] = useState<PostAudience>(post.audience || "public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setContent(post.content || "");
      setAudience(post.audience || "public");
      setError("");
    }
  }, [visible, post]);

  const remaining = MAX_LENGTH - content.length;
  const hasMedia = post.media && post.media.length > 0;

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed && !hasMedia) {
      setError("Post content cannot be empty.");
      return;
    }
    if (!accessToken || saving) return;

    setSaving(true);
    setError("");
    try {
      const updated = await updatePost(
        post.id,
        {
          content: trimmed,
          audience,
        },
        accessToken
      );

      const mergedPost: FeedPost = {
        ...post,
        ...(updated || {}),
        content: trimmed,
        audience,
        updated_at: updated?.updated_at || new Date().toISOString(),
      };

      onPostUpdated(mergedPost);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update post. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardHugView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            paddingTop: insets.top + 8,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable onPress={onClose} hitSlop={10} disabled={saving}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>

            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Edit Post
            </Text>

            <Button
              label={saving ? "Saving..." : "Save"}
              size="sm"
              onPress={handleSave}
              loading={saving}
              disabled={(!content.trim() && !hasMedia) || saving}
            />
          </View>

          {error ? (
            <View
              style={{
                margin: 16,
                padding: 12,
                backgroundColor: "#FEF2F2",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#FECACA",
              }}
            >
              <Text style={{ color: "#EF4444", fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          {/* Content & Media Previews */}
          <KeyboardGestureArea style={{ flex: 1 }} interpolator="ios">
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <TextInput
                value={content}
                onChangeText={(t) => setContent(t.slice(0, MAX_LENGTH))}
                placeholder="What's happening on campus?"
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
                style={{
                  minHeight: 120,
                  fontSize: 17,
                  color: colors.textPrimary,
                  lineHeight: 24,
                  textAlignVertical: "top",
                }}
              />

              {/* Attached Photos (Immutable) */}
              {hasMedia && (
                <View style={{ marginTop: 20 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: colors.textMuted,
                      marginBottom: 8,
                    }}
                  >
                    Attached photos (cannot be edited):
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    {post.media!.map((item, idx) => {
                      const uri = typeof item === "string" ? item : (item as any)?.url;
                      if (!uri || uri === "[removed]") return null;
                      return (
                        <View
                          key={`${uri}-${idx}`}
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 12,
                            overflow: "hidden",
                            backgroundColor: colors.surfaceMuted,
                          }}
                        >
                          <Image
                            source={{ uri }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </KeyboardGestureArea>

          {/* Bottom toolbar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingBottom: isKeyboardVisible
                ? (Platform.OS === "ios" ? 10 : 8)
                : Math.max(insets.bottom + 8, 12),
            }}
          >
            {/* Audience toggle */}
            <Pressable
              onPress={() =>
                setAudience((a) => (a === "public" ? "connections" : "public"))
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: colors.surfaceMuted,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              {audience === "public" ? (
                <Globe size={13} color={colors.primary} />
              ) : (
                <Users size={13} color={colors.primary} />
              )}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#1A6B3C",
                }}
              >
                {audience === "public" ? "Public" : "Connections"}
              </Text>
            </Pressable>

            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: remaining <= 30 ? "#EF4444" : "#9CA3AF",
              }}
            >
              {remaining}
            </Text>
          </View>
        </View>
      </KeyboardHugView>
    </Modal>
  );
}
