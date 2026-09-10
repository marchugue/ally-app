import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Send, Camera, X } from "lucide-react-native";
import type { Message } from "@/types/conversation";

interface ChatInputProps {
  onSend: (content: string) => void;
  onAttach?: () => void;
  sending?: boolean;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  draftText?: string;
}

export function ChatInput({
  onSend,
  onAttach,
  sending = false,
  replyTo,
  onCancelReply,
  draftText,
}: ChatInputProps) {
  const [text, setText] = useState(draftText || "");
  const inputRef = useRef<TextInput>(null);

  // Sync draftText when external source updates it (e.g. icebreaker card tapped)
  React.useEffect(() => {
    if (draftText !== undefined) {
      setText(draftText);
      if (draftText) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [draftText]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setText("");
  };

  const canSend = text.trim().length > 0 && !sending;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: "#E2DED7",
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* Reply-to preview */}
      {replyTo && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 4,
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              borderLeftWidth: 3,
              borderLeftColor: "#1A6B3C",
              paddingLeft: 10,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#1A6B3C" }}>
              Replying
            </Text>
            <Text
              style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}
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

      {/* Input row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 8,
        }}
      >
        {/* Attachment button */}
        {onAttach && (
          <Pressable
            onPress={onAttach}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#F7F4EF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera size={18} color="#6B7280" />
          </Pressable>
        )}

        {/* Text input */}
        <View
          style={{
            flex: 1,
            backgroundColor: "#F7F4EF",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#E2DED7",
            paddingHorizontal: 16,
            paddingVertical: 8,
            maxHeight: 120,
          }}
        >
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor="#9CA3AF"
            multiline
            style={{
              fontSize: 15,
              color: "#111827",
              maxHeight: 100,
              lineHeight: 20,
            }}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
        </View>

        {/* Send button */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: canSend ? "#1A6B3C" : "#E2DED7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={16} color={canSend ? "#FFFFFF" : "#9CA3AF"} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
