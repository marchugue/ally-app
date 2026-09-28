import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { Send, Plus, X, Camera, Image as ImageIcon } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { Message } from "@/types/conversation";
import type { LocalFile } from "@/lib/api/media";

interface ChatInputProps {
  onSend: (content: string, images?: LocalFile[]) => void;
  onAttach?: () => void;
  onPickMedia?: () => void;
  onTakePhoto?: () => void;
  sending?: boolean;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  draftText?: string;
  placeholder?: string;
  maxLength?: number;
  canUploadImages?: boolean;
}

function ChatInputComponent({
  onSend,
  onAttach,
  onPickMedia,
  onTakePhoto,
  sending = false,
  replyTo,
  onCancelReply,
  draftText,
  placeholder = "Type a message…",
  maxLength = 1000,
  canUploadImages = true,
}: ChatInputProps) {
  const [text, setText] = useState(draftText || "");
  const [showMenu, setShowMenu] = useState(false);
  const [pendingImages, setPendingImages] = useState<LocalFile[]>([]);
  const inputRef = useRef<TextInput>(null);

  // Sync draftText when external source updates it (e.g. icebreaker card tapped)
  useEffect(() => {
    if (draftText !== undefined) {
      setText(draftText);
      if (draftText) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [draftText]);

  const hasText = text.length > 0 && text.trim().length > 0;
  const canSend = hasText || pendingImages.length > 0;

  const handleSend = () => {
    if (!canSend) return;
    const trimmed = text.trim();
    const imgs = pendingImages.length > 0 ? pendingImages : undefined;

    // 1. Immediately reset input field and pending images (0ms synchronous UI update)
    setText("");
    setPendingImages([]);
    setShowMenu(false);

    // 2. Dispatch sending action in next tick to avoid blocking the input UI clear
    setTimeout(() => {
      onSend(trimmed, imgs);
    }, 0);
  };

  const handlePickMedia = async () => {
    setShowMenu(false);
    if (!canUploadImages) {
      Alert.alert(
        "Feature Locked",
        "Photo and media sharing unlocks at Stage 3 of your roadmap."
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Photo library permission is required to select photos.");
        return;
      }
      const remaining = 6 - pendingImages.length;
      if (remaining <= 0) {
        Alert.alert("Limit Reached", "You can select up to 6 photos per message.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      const newFiles: LocalFile[] = result.assets.slice(0, remaining).map((asset) => {
        const filename = asset.fileName || asset.uri.split("/").pop() || `photo_${Date.now()}.jpg`;
        const mime = asset.mimeType || (/\.png$/i.test(filename) ? "image/png" : "image/jpeg");
        return { uri: asset.uri, name: filename, type: mime };
      });
      setPendingImages((prev) => [...prev, ...newFiles].slice(0, 6));
    } catch (err: any) {
      console.warn("Failed to pick media", err);
    }
  };

  const handleTakePhoto = async () => {
    setShowMenu(false);
    if (!canUploadImages) {
      Alert.alert(
        "Feature Locked",
        "Photo and media sharing unlocks at Stage 3 of your roadmap."
      );
      return;
    }
    if (pendingImages.length >= 6) {
      Alert.alert("Limit Reached", "You can select up to 6 photos per message.");
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const filename = asset.fileName || asset.uri.split("/").pop() || `camera_${Date.now()}.jpg`;
      const mime = asset.mimeType || (/\.png$/i.test(filename) ? "image/png" : "image/jpeg");
      setPendingImages((prev) => [...prev, { uri: asset.uri, name: filename, type: mime }].slice(0, 6));
    } catch (err: any) {
      console.warn("Failed to take photo", err);
    }
  };

  const handleRemovePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <View
      style={{
        borderTopWidth: 0,
        backgroundColor: "transparent",
        position: "relative",
        zIndex: 20,
      }}
    >
      {/* Reply-to preview */}
      {replyTo && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingTop: 8,
            paddingBottom: 6,
            marginHorizontal: 10,
            marginBottom: 4,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#E2DED7",
            gap: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <View
            style={{
              flex: 1,
              borderLeftWidth: 3,
              borderLeftColor: "#1A6B3C",
              paddingLeft: 8,
              paddingVertical: 1,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#1A6B3C" }}>
              Replying
            </Text>
            <Text
              style={{ fontSize: 12, color: "#6B7280" }}
              numberOfLines={1}
            >
              {replyTo.content || "📷 Photo"}
            </Text>
          </View>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <X size={16} color="#9CA3AF" />
          </Pressable>
        </View>
      )}

      {/* Media Upload Carousel Preview Strip (up to 6) — mirrors web MessageInput */}
      {pendingImages.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginHorizontal: 10,
            marginBottom: 6,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E2DED7",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center", gap: 10, paddingRight: 6 }}
          >
            {pendingImages.map((file, idx) => (
              <View
                key={`${file.uri}-${idx}`}
                style={{
                  position: "relative",
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    backgroundColor: "#F3F4F6",
                  }}
                >
                  <Image
                    source={{ uri: file.uri }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => handleRemovePendingImage(idx)}
                  hitSlop={8}
                  activeOpacity={0.8}
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#EF4444",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: "#FFFFFF",
                    zIndex: 20,
                    elevation: 3,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                  }}
                >
                  <X size={11} color="#FFFFFF" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ))}

            {pendingImages.length < 6 && (
              <TouchableOpacity
                onPress={handlePickMedia}
                activeOpacity={0.7}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: "#D1D5DB",
                  backgroundColor: "#FAF9F5",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                }}
              >
                <ImageIcon size={20} color="#1A6B3C" />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color: "#6B7280",
                    marginTop: 3,
                    textAlign: "center",
                  }}
                >
                  Add (max 6)
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Small popup menu vertically aligned above the plus button */}
      {showMenu && (
        <>
          {/* Dismiss backdrop */}
          <Pressable
            onPress={() => setShowMenu(false)}
            style={{
              position: "absolute",
              top: -2000,
              left: -200,
              right: -200,
              bottom: 0,
              zIndex: 90,
            }}
          />

          <View
            style={{
              position: "absolute",
              bottom: "100%",
              left: 10,
              marginBottom: 8,
              width: 150,
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#E2DED7",
              padding: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 8,
              zIndex: 100,
            }}
          >
            {/* Option 1: Media */}
            <TouchableOpacity
              onPress={handlePickMedia}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 9,
                paddingHorizontal: 10,
                borderRadius: 12,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#E8F5EE",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ImageIcon size={16} color="#1A6B3C" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
                Media
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: "#F3F0EA",
                marginHorizontal: 8,
                marginVertical: 1,
              }}
            />

            {/* Option 2: Camera */}
            <TouchableOpacity
              onPress={handleTakePhoto}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 9,
                paddingHorizontal: 10,
                borderRadius: 12,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#E8F5EE",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera size={16} color="#1A6B3C" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
                Camera
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Input row — hugs keyboard snugly */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          paddingHorizontal: 10,
          paddingVertical: 6,
          gap: 8,
        }}
      >
        {/* Plus button on the left */}
        <TouchableOpacity
          onPress={() => {
            if (!canUploadImages) {
              Alert.alert(
                "Feature Locked",
                "Photo and media sharing unlocks at Stage 3 of your roadmap."
              );
              return;
            }
            setShowMenu((prev) => !prev);
          }}
          hitSlop={6}
          activeOpacity={0.75}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: !canUploadImages
              ? "#F3F4F6"
              : showMenu
                ? "#E8F5EE"
                : "#FFFFFF",
            borderWidth: 1,
            borderColor: showMenu && canUploadImages ? "#1A6B3C" : "#E2DED7",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 2,
            opacity: !canUploadImages ? 0.6 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          {showMenu ? (
            <X size={18} color="#1A6B3C" />
          ) : (
            <Plus size={20} color={!canUploadImages ? "#9CA3AF" : "#1A6B3C"} />
          )}
        </TouchableOpacity>

        {/* Message input and send button in unified container */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            minHeight: 40,
            maxHeight: 120,
            backgroundColor: "#FFFFFF",
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "#E2DED7",
            paddingLeft: 14,
            paddingRight: 5,
            paddingVertical: Platform.OS === "ios" ? 3 : 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={maxLength}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 15,
              color: "#111827",
              lineHeight: 20,
              paddingTop: Platform.OS === "ios" ? 7 : 5,
              paddingBottom: Platform.OS === "ios" ? 7 : 5,
              paddingRight: 6,
              maxHeight: 110,
            }}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            hitSlop={6}
            activeOpacity={0.85}
            style={{
              width: 50,
              marginTop: 1,
              height: 29,
              borderRadius: 99,
              flexShrink: 0,
              backgroundColor: canSend ? "#1A6B3C" : "#A7D0B8",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "flex-end",
              marginBottom: 3,
            }}
          >
            <Send size={15} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export const ChatInput = React.memo(ChatInputComponent);
