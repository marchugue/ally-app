import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboard } from "@/hooks/useKeyboard";
import { X, Image as ImageIcon, Globe, Users } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Button } from "./Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { createPost } from "@/lib/api/feed";
import { uploadPostFiles, LocalFile } from "@/lib/api/media";
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
  const { isKeyboardVisible } = useKeyboard();
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<PostAudience>("public");
  const [selectedImages, setSelectedImages] = useState<LocalFile[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const remaining = MAX_LENGTH - content.length;

  const handlePickImages = async () => {
    if (selectedImages.length >= 4) {
      Alert.alert("Limit Reached", "You can attach up to 4 photos per post.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to add photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4 - selectedImages.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newFiles: LocalFile[] = result.assets.map((asset, index) => {
        const uri = asset.uri;
        const filename = uri.split("/").pop() || `photo_${Date.now()}_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";
        return { uri, name: filename, type };
      });

      setSelectedImages((prev) => [...prev, ...newFiles].slice(0, 4));
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if ((!content.trim() && selectedImages.length === 0) || !accessToken || posting) return;
    setPosting(true);
    setError("");
    try {
      let mediaUrls: string[] = [];
      if (selectedImages.length > 0) {
        const uploadRes = await uploadPostFiles(selectedImages, accessToken);
        mediaUrls = uploadRes.urls || [];
      }

      await createPost(
        {
          content: content.trim(),
          audience,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        },
        accessToken
      );

      setContent("");
      setSelectedImages([]);
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            label={posting ? "Posting..." : "Post"}
            size="sm"
            onPress={handlePost}
            loading={posting}
            disabled={(!content.trim() && selectedImages.length === 0) || posting}
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <TextInput
            value={content}
            onChangeText={(t) => setContent(t.slice(0, MAX_LENGTH))}
            placeholder="What's happening on campus?"
            placeholderTextColor="#9CA3AF"
            multiline
            autoFocus
            style={{
              minHeight: 120,
              fontSize: 17,
              color: "#111827",
              lineHeight: 24,
              textAlignVertical: "top",
            }}
          />

          {/* Attached Images Grid */}
          {selectedImages.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 16,
              }}
            >
              {selectedImages.map((file, index) => (
                <View
                  key={`${file.uri}-${index}`}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Image
                    source={{ uri: file.uri }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => handleRemoveImage(index)}
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      backgroundColor: "rgba(0, 0, 0, 0.65)",
                      borderRadius: 12,
                      width: 22,
                      height: 22,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

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
            paddingBottom:
              Platform.OS === "ios"
                ? isKeyboardVisible
                  ? 10
                  : Math.max(insets.bottom + 8, 12)
                : 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable
              onPress={handlePickImages}
              hitSlop={8}
              disabled={selectedImages.length >= 4}
              style={{ opacity: selectedImages.length >= 4 ? 0.4 : 1 }}
            >
              <ImageIcon size={24} color="#1A6B3C" />
            </Pressable>

            {selectedImages.length > 0 && (
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#1A6B3C" }}>
                {selectedImages.length}/4 photo{selectedImages.length > 1 ? "s" : ""}
              </Text>
            )}

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
    </KeyboardAvoidingView>
  </Modal>
  );
}
