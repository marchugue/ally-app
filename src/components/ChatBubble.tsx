import { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { Clock, Check, AlertCircle } from "lucide-react-native";
import type { Message, MessageReaction, MessageGroupPosition } from "@/types/conversation";
import { resolveImageUri } from "./UserAvatar";

interface ChatBubbleProps {
  message: Message;
  isMine: boolean;
  groupPosition?: MessageGroupPosition;
  senderName?: string;
  onLongPress?: (message: Message) => void;
  onReply?: (message: Message) => void;
  onRetry?: (message: Message) => void;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function getBorderRadii(isMine: boolean, groupPosition: MessageGroupPosition = "single") {
  const R_LARGE = 18;
  const R_SMALL = 4;

  if (isMine) {
    switch (groupPosition) {
      case "first":
        return {
          borderTopLeftRadius: R_LARGE,
          borderTopRightRadius: R_LARGE,
          borderBottomRightRadius: R_SMALL,
          borderBottomLeftRadius: R_LARGE,
        };
      case "middle":
        return {
          borderTopLeftRadius: R_LARGE,
          borderTopRightRadius: R_SMALL,
          borderBottomRightRadius: R_SMALL,
          borderBottomLeftRadius: R_LARGE,
        };
      case "last":
        return {
          borderTopLeftRadius: R_LARGE,
          borderTopRightRadius: R_SMALL,
          borderBottomRightRadius: R_LARGE,
          borderBottomLeftRadius: R_LARGE,
        };
      case "single":
      default:
        return {
          borderTopLeftRadius: R_LARGE,
          borderTopRightRadius: R_LARGE,
          borderBottomRightRadius: R_LARGE,
          borderBottomLeftRadius: R_LARGE,
        };
    }
  } else {
    switch (groupPosition) {
      case "first":
        return {
          borderTopLeftRadius: R_LARGE,
          borderTopRightRadius: R_LARGE,
          borderBottomRightRadius: R_LARGE,
          borderBottomLeftRadius: R_SMALL,
        };
      case "middle":
        return {
          borderTopLeftRadius: R_SMALL,
          borderTopRightRadius: R_LARGE,
          borderBottomRightRadius: R_LARGE,
          borderBottomLeftRadius: R_SMALL,
        };
      case "last":
        return {
          borderTopLeftRadius: R_SMALL,
          borderTopRightRadius: R_LARGE,
          borderBottomRightRadius: R_LARGE,
          borderBottomLeftRadius: R_LARGE,
        };
      case "single":
      default:
        return {
          borderTopLeftRadius: R_LARGE,
          borderTopRightRadius: R_LARGE,
          borderBottomRightRadius: R_LARGE,
          borderBottomLeftRadius: R_LARGE,
        };
    }
  }
}

function getBubbleMargins(groupPosition: MessageGroupPosition = "single") {
  switch (groupPosition) {
    case "first":
      return { marginTop: 4, marginBottom: 1 };
    case "middle":
      return { marginTop: 1, marginBottom: 1 };
    case "last":
      return { marginTop: 1, marginBottom: 4 };
    case "single":
    default:
      return { marginTop: 4, marginBottom: 4 };
  }
}

export function ChatBubble({
  message,
  isMine,
  groupPosition = "single",
  senderName,
  onLongPress,
  onReply,
  onRetry,
}: ChatBubbleProps) {
  const [showTime, setShowTime] = useState(false);
  const imageUri = resolveImageUri(message.image_url);
  const hasImage = !!imageUri;
  const hasReply = !!message.replied_message;
  const hasReactions = message.reactions && message.reactions.length > 0;

  const isSending = isMine && (message.status === "sending" || (message.id?.startsWith("temp-") && message.status !== "failed"));
  const isFailed = isMine && message.status === "failed";
  const isSent = isMine && !isSending && !isFailed;

  const radii = getBorderRadii(isMine, groupPosition);
  const margins = getBubbleMargins(groupPosition);
  const showSenderName = Boolean(senderName && (groupPosition === "single" || groupPosition === "first"));

  const extraBottom = hasReactions ? 10 : 0;

  return (
    <View
      style={{
        alignSelf: isMine ? "flex-end" : "flex-start",
        maxWidth: "78%",
        marginTop: margins.marginTop,
        marginBottom: margins.marginBottom + extraBottom,
        marginHorizontal: 16,
      }}
    >
      {/* Sender name for the upper message only */}
      {showSenderName && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: "#9CA3AF",
            alignSelf: isMine ? "flex-end" : "flex-start",
            marginBottom: 3,
            marginHorizontal: 4,
          }}
          numberOfLines={1}
        >
          {senderName}
        </Text>
      )}

      {/* Reply-to indicator */}
      {hasReply && message.replied_message && (
        <View
          style={{
            backgroundColor: isMine ? "rgba(26,107,60,0.08)" : "rgba(0,0,0,0.04)",
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginBottom: 4,
            borderLeftWidth: 3,
            borderLeftColor: isMine ? "#1A6B3C" : "#9CA3AF",
          }}
        >
          <Text
            style={{ fontSize: 11, color: "#6B7280", fontWeight: "500" }}
            numberOfLines={1}
          >
            {message.replied_message.content || "📷 Photo"}
          </Text>
        </View>
      )}

      {/* Main bubble + overlapping reactions */}
      <View style={{ position: "relative" }}>
        <Pressable
        onPress={() => setShowTime((prev) => !prev)}
        onLongPress={() => !isSending && !isFailed && onLongPress?.(message)}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        style={{
          backgroundColor: isMine ? (isFailed ? "#8A2A2A" : "#1A6B3C") : "#FFFFFF",
          opacity: isSending ? 0.85 : 1,
          ...radii,
          paddingHorizontal: hasImage ? 4 : 14,
          paddingTop: hasImage ? 4 : 10,
          paddingBottom: (hasImage || showTime || isSending) ? (hasImage ? 4 : 8) : 10,
          borderWidth: isMine ? (isFailed ? 1 : 0) : 1,
          borderColor: isFailed ? "#EF4444" : "#E2DED7",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        {/* Image attachment */}
        {hasImage && imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={{
              width: 220,
              height: 180,
              borderRadius: 14,
              marginBottom: message.content ? 6 : 0,
            }}
            resizeMode="cover"
          />
        )}

        {/* Text content */}
        {message.content ? (
          <View style={{ paddingHorizontal: hasImage ? 10 : 0, paddingBottom: hasImage ? 6 : 0 }}>
            <Text
              style={{
                fontSize: 15,
                color: isMine ? "#FFFFFF" : "#111827",
                lineHeight: 21,
              }}
            >
              {message.content}
            </Text>
          </View>
        ) : null}

        {/* Timestamp & Status — interactive: tap to expand, or while sending */}
        {(showTime || isSending) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-end",
              marginTop: 3,
              gap: 3,
              paddingHorizontal: hasImage ? 10 : 0,
              paddingBottom: hasImage ? 4 : 0,
            }}
          >
            {isSending ? (
              <>
                <Clock size={10} color="rgba(255,255,255,0.7)" />
                <Text
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.7)",
                    fontWeight: "500",
                  }}
                >
                  Sending…
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 10,
                    color: isMine ? "rgba(255,255,255,0.6)" : "#9CA3AF",
                  }}
                >
                  {formatTime(message.created_at)}
                </Text>
                {isSent && !message.id.startsWith("temp-") && (
                  <Check size={11} color="rgba(255,255,255,0.7)" />
                )}
              </>
            )}
          </View>
        )}
      </Pressable>

        {/* Reactions sitting on the edge of the message */}
        {hasReactions && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -9,
              ...(isMine ? { right: 12 } : { left: 12 }),
              flexDirection: isMine ? "row-reverse" : "row",
              alignItems: "center",
              gap: 2,
              zIndex: 10,
              elevation: 3,
            }}
          >
            {groupReactions(message.reactions).map(({ emoji, count }) => (
              <View
                key={emoji}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    lineHeight: 19,
                    textShadowColor: "rgba(0, 0, 0, 0.22)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  {emoji}
                </Text>
                {count > 1 && (
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: isMine ? "#FFFFFF" : "#374151",
                      marginLeft: 2,
                      textShadowColor: "rgba(0, 0, 0, 0.3)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 1,
                    }}
                  >
                    {count}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Failed indicator & retry action */}
      {isFailed && (
        <Pressable
          onPress={() => onRetry?.(message)}
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
            alignSelf: "flex-end",
            paddingHorizontal: 4,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <AlertCircle size={12} color="#EF4444" />
          <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600" }}>
            Failed to send · Tap to retry
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function groupReactions(reactions: MessageReaction[]): { emoji: string; count: number }[] {
  const map = new Map<string, number>();
  reactions.forEach((r) => {
    map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
  });
  return Array.from(map, ([emoji, count]) => ({ emoji, count }));
}
