import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Send, Plus, X, Camera, Image as ImageIcon } from "lucide-react-native";
import type { Message } from "@/types/conversation";

interface ChatInputProps {
  onSend: (content: string) => void;
  onAttach?: () => void;
  onPickMedia?: () => void;
  onTakePhoto?: () => void;
  sending?: boolean;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  draftText?: string;
  placeholder?: string;
  maxLength?: number;
}

export function ChatInput({
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
}: ChatInputProps) {
  const [text, setText] = useState(draftText || "");
  const [showMenu, setShowMenu] = useState(false);
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

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    setShowMenu(false);
  };

  const handlePickMedia = () => {
    setShowMenu(false);
    if (onPickMedia) {
      onPickMedia();
    } else if (onAttach) {
      onAttach();
    }
  };

  const handleTakePhoto = () => {
    setShowMenu(false);
    if (onTakePhoto) {
      onTakePhoto();
    } else if (onAttach) {
      onAttach();
    }
  };

  const canSend = text.trim().length > 0;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: "#E2DED7",
        backgroundColor: "#FFFFFF",
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
            backgroundColor: "#FAF8F5",
            borderBottomWidth: 1,
            borderBottomColor: "#E2DED7",
            gap: 8,
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

      {/* Small overlay vertically aligned, anchored at bottom-left above the plus button */}
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
          onPress={() => setShowMenu((prev) => !prev)}
          hitSlop={6}
          activeOpacity={0.75}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: showMenu ? "#E8F5EE" : "#F7F4EF",
            borderWidth: showMenu ? 1 : 0,
            borderColor: "#1A6B3C",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 2,
          }}
        >
          {showMenu ? (
            <X size={18} color="#1A6B3C" />
          ) : (
            <Plus size={20} color="#1A6B3C" />
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
            backgroundColor: "#F7F4EF",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#E2DED7",
            paddingLeft: 14,
            paddingRight: 5,
            paddingVertical: Platform.OS === "ios" ? 3 : 2,
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
            disabled={!canSend || sending}
            hitSlop={6}
            activeOpacity={0.85}
            style={{
              width: 50,
              height: 30,
              borderRadius: 99,
              flexShrink: 0,
              backgroundColor: canSend ? "#1A6B3C" : "#A7D0B8",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "flex-end",
              marginBottom: 3,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={15} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
