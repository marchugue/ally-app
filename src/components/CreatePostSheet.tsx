import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Image as ImageIcon, Globe, Users } from "lucide-react-native";
import { Button } from "./Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { createPost } from "@/lib/api/feed";
import type { PostAudience } from "@/types/feed";

const MAX_LENGTH = 280;

interface CreatePostSheetProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export function CreatePostSheet({
  visible,
  onClose,
  onPostCreated,
}: CreatePostSheetProps) {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<PostAudience>("public");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const remaining = MAX_LENGTH - content.length;

  const handlePost = async () => {
    if (!content.trim() || !accessToken || posting) return;
    setPosting(true);
    setError("");
    try {
      await createPost({ content: content.trim(), audience }, accessToken);
      setContent("");
      setAudience("public");
      onPostCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#FDFCFB",
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
            borderBottomColor: "#E2DED7",
          }}
        >
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={22} color="#6B7280" />
          </Pressable>

          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
            Create Post
          </Text>

          <Button
            label="Post"
            size="sm"
            onPress={handlePost}
            loading={posting}
            disabled={!content.trim()}
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

        {/* Content */}
        <View style={{ flex: 1, padding: 16 }}>
          <TextInput
            value={content}
            onChangeText={(t) => setContent(t.slice(0, MAX_LENGTH))}
            placeholder="What's happening on campus?"
            placeholderTextColor="#9CA3AF"
            multiline
            autoFocus
            style={{
              flex: 1,
              fontSize: 17,
              color: "#111827",
              lineHeight: 24,
              textAlignVertical: "top",
            }}
          />
        </View>

        {/* Bottom toolbar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: "#E2DED7",
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable hitSlop={8}>
              <ImageIcon size={22} color="#1A6B3C" />
            </Pressable>

            {/* Audience toggle */}
            <Pressable
              onPress={() =>
                setAudience((a) => (a === "public" ? "connections" : "public"))
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "#F0EDE8",
                borderRadius: 14,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              {audience === "public" ? (
                <Globe size={13} color="#1A6B3C" />
              ) : (
                <Users size={13} color="#1A6B3C" />
              )}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: "#1A6B3C",
                }}
              >
                {audience === "public" ? "Public" : "Connections"}
              </Text>
            </Pressable>
          </View>

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
    </Modal>
  );
}
