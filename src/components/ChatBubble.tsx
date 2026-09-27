import { useState, useMemo, useRef } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { Clock, Check, AlertCircle } from "lucide-react-native";
import { router } from "expo-router";
import type { Message, MessageReaction, MessageGroupPosition } from "@/types/conversation";
import { resolveImageUri } from "./UserAvatar";
import { getFluentEmojiUrl } from "@/lib/fluentEmoji";
import { OfflineAnimatedEmoji } from "@/components/OfflineAnimatedEmoji";

export interface BubbleLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMOJI_ONLY_REGEX = /^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]+$/u;
export function isOnlyEmoji(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed || /[a-zA-Z0-9]/.test(trimmed)) return false;
  return EMOJI_ONLY_REGEX.test(trimmed);
}

interface ChatBubbleProps {
  message: Message;
  isMine: boolean;
  groupPosition?: MessageGroupPosition;
  senderName?: string;
  onLongPress?: (message: Message, layout?: BubbleLayout) => void;
  onReply?: (message: Message) => void;
  onRetry?: (message: Message) => void;
  onImagePress?: (message: Message, index: number) => void;
  isActiveTime?: boolean;
  onToggleTime?: (messageId: string) => void;
}

export function formatMessageTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const now = new Date();

  // If year has passed (different year) -> display month and year, e.g. "Sep 2025"
  if (d.getFullYear() !== now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  // Check if same calendar day
  const isSameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isSameDay) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  // Days have passed (within current year) -> display date and month, e.g. "19 Sep"
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${day} ${month}`;
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
  onImagePress,
  isActiveTime = false,
  onToggleTime,
}: ChatBubbleProps) {
  // Parse images (supports single URL, JSON array string, camelCase, snake_case, images array, media, content URL)
  const images: string[] = useMemo(() => {
    const raw =
      message.image_url ||
      (message as any).imageUrl ||
      (message as any).images ||
      (message as any).media;
    if (raw) {
      if (Array.isArray(raw)) {
        return raw.map(resolveImageUri).filter((u): u is string => Boolean(u));
      }
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              return parsed.map(resolveImageUri).filter((u): u is string => Boolean(u));
            }
          } catch {}
        }
        const uri = resolveImageUri(trimmed);
        if (uri) return [uri];
      }
    }
    // Fallback: check if content itself is a direct image URL
    if (message.content && typeof message.content === "string") {
      const trimmed = message.content.trim();
      if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(trimmed)) {
        const uri = resolveImageUri(trimmed);
        if (uri) return [uri];
      }
    }
    return [];
  }, [message.image_url, (message as any).imageUrl, (message as any).images, (message as any).media, message.content]);

  const hasImage = images.length > 0;
  const isImageOnly = hasImage && !message.content?.trim();
  const isEmojiOnly = !hasImage && isOnlyEmoji(message.content);
  const hasReply = !!message.replied_message;
  const hasReactions = message.reactions && message.reactions.length > 0;
  const bubbleRef = useRef<View>(null);

  const handleBubbleLongPress = () => {
    if (isSending || isFailed) return;
    try {
      if (bubbleRef.current && typeof bubbleRef.current.measureInWindow === "function") {
        bubbleRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(width) &&
            Number.isFinite(height) &&
            width > 0 &&
            height > 0
          ) {
            onLongPress?.(message, { x, y, width, height });
          } else {
            onLongPress?.(message);
          }
        });
      } else {
        onLongPress?.(message);
      }
    } catch {
      onLongPress?.(message);
    }
  };

  const handleImagePress = (index: number = 0) => {
    if (images.length === 0) return;
    if (onImagePress) {
      onImagePress(message, index);
      return;
    }
    router.push({
      pathname: "/pages/media-preview" as any,
      params: {
        mediaUrls: JSON.stringify(images),
        initialIndex: String(index),
        caption: message.content || "",
        authorName: senderName || (isMine ? "You" : "Friend"),
        createdAt: message.created_at || "",
      },
    });
  };

  const isSending = isMine && (message.status === "sending" || (message.id?.startsWith("temp-") && message.status !== "failed"));
  const isFailed = isMine && message.status === "failed";
  const isSent = isMine && !isSending && !isFailed;

  const radii = getBorderRadii(isMine, groupPosition);
  const margins = getBubbleMargins(groupPosition);
  const showSenderName = Boolean(senderName && (groupPosition === "single" || groupPosition === "first"));

  const extraBottom = hasReactions ? 18 : 0;

  // ── Tombstone: deleted for everyone ──────────────────────────────────────
  if (message.is_deleted || (message as any).isDeleted) {
    return (
      <View
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "78%",
          marginTop: margins.marginTop,
          marginBottom: margins.marginBottom,
          marginHorizontal: 16,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "#D1D5DB",
          backgroundColor: "#F9FAFB",
        }}
      >
        <Text style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
          This message was deleted
        </Text>
      </View>
    );
  }

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
      <View ref={bubbleRef} collapsable={false} style={{ position: "relative" }}>
        <Pressable
          onPress={() => {
          if (!isImageOnly && !isEmojiOnly) {
            onToggleTime?.(message.id);
          }
        }}
        onLongPress={handleBubbleLongPress}
        delayLongPress={300}
        android_ripple={isImageOnly || isEmojiOnly ? undefined : { color: "rgba(0,0,0,0.06)" }}
        style={{
          backgroundColor: isImageOnly || isEmojiOnly
            ? "transparent"
            : isMine
              ? isFailed
                ? "#8A2A2A"
                : "#1A6B3C"
              : "#FFFFFF",
          opacity: isSending ? 0.85 : 1,
          ...(isImageOnly || isEmojiOnly ? {} : radii),
          paddingHorizontal: isImageOnly || isEmojiOnly ? 0 : hasImage ? 4 : 14,
          paddingTop: isImageOnly || isEmojiOnly ? 0 : hasImage ? 4 : 10,
          paddingBottom: isImageOnly || isEmojiOnly
            ? 0
            : (hasImage || isActiveTime || isSending)
              ? hasImage ? 4 : 8
              : 10,
          borderWidth: isImageOnly || isEmojiOnly ? 0 : isMine ? (isFailed ? 1 : 0) : 1,
          borderColor: isImageOnly || isEmojiOnly ? "transparent" : isFailed ? "#EF4444" : "#E2DED7",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isImageOnly || isEmojiOnly ? 0 : 0.04,
          shadowRadius: isImageOnly || isEmojiOnly ? 0 : 4,
          elevation: isImageOnly || isEmojiOnly ? 0 : 1,
        }}
      >
        {/* Image attachment / Stacked cards UI */}
        {hasImage && images.length === 1 && (
          <Pressable
            onPress={() => handleImagePress(0)}
            onLongPress={handleBubbleLongPress}
            delayLongPress={300}
          >
            <Image
              source={{ uri: images[0] }}
              style={{
                width: 220,
                height: 180,
                borderRadius: 14,
                marginBottom: message.content ? 6 : 0,
              }}
              resizeMode="cover"
            />
          </Pressable>
        )}

        {hasImage && images.length > 1 && (
          <View
            style={{
              position: "relative",
              width: 216,
              height: 176,
              marginVertical: 4,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Card 2 (Bottom card, peeking out to the right) */}
            {images.length >= 3 && (
              <Pressable
                onPress={() => handleImagePress(2)}
                onLongPress={handleBubbleLongPress}
                delayLongPress={300}
                style={{
                  position: "absolute",
                  width: 216,
                  height: 176,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: "#D1D5DB",
                  transform: [{ rotate: "5deg" }, { translateX: 8 }, { translateY: -4 }, { scale: 0.94 }],
                  zIndex: 1,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.4)",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Image
                  source={{ uri: images[2] }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </Pressable>
            )}

            {/* Card 1 (Middle card, peeking out to the left) */}
            {images.length >= 2 && (
              <Pressable
                onPress={() => handleImagePress(1)}
                onLongPress={handleBubbleLongPress}
                delayLongPress={300}
                style={{
                  position: "absolute",
                  width: 216,
                  height: 176,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: "#E5E7EB",
                  transform: [{ rotate: "-4.5deg" }, { translateX: -8 }, { translateY: -2 }, { scale: 0.97 }],
                  zIndex: 2,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.5)",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 5,
                  elevation: 3,
                }}
              >
                <Image
                  source={{ uri: images[1] }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </Pressable>
            )}

            {/* Card 0 (Top / Upper card) */}
            <Pressable
              onPress={() => handleImagePress(0)}
              onLongPress={handleBubbleLongPress}
              delayLongPress={300}
              style={{
                width: 216,
                height: 176,
                borderRadius: 14,
                overflow: "hidden",
                backgroundColor: "#F3F4F6",
                zIndex: 10,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.6)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Image
                source={{ uri: images[0] }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              {/* Badge showing photo count */}
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                  {images.length} photos
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Text content */}
        {message.content ? (
          <View style={{ paddingHorizontal: hasImage ? 10 : 0, paddingBottom: hasImage ? 6 : 0 }}>
            {isEmojiOnly ? (
              <OfflineAnimatedEmoji
                emoji={message.content.trim()}
                size={44}
                fallbackText={message.content}
                preferLottie={true}
              />
            ) : (
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 21,
                  color: isMine ? "#FFFFFF" : "#111827",
                }}
              >
                {message.content}
              </Text>
            )}
          </View>
        ) : null}

        {/* Timestamp & Status — interactive: single active message, or while sending */}
        {(isActiveTime || isSending) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-end",
              marginTop: isImageOnly ? 4 : 3,
              gap: 3,
              paddingHorizontal: isImageOnly ? 8 : hasImage ? 10 : 0,
              paddingVertical: isImageOnly ? 3 : 0,
              paddingBottom: isImageOnly ? 3 : hasImage ? 4 : 0,
              backgroundColor: isImageOnly ? "rgba(0,0,0,0.6)" : "transparent",
              borderRadius: isImageOnly ? 10 : 0,
            }}
          >
            {isSending ? (
              <>
                <Clock size={10} color={isImageOnly ? "#FFFFFF" : isMine ? "rgba(255,255,255,0.7)" : "#9CA3AF"} />
                <Text
                  style={{
                    fontSize: 10,
                    color: isImageOnly ? "#FFFFFF" : isMine ? "rgba(255,255,255,0.7)" : "#9CA3AF",
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
                    color: isImageOnly ? "#FFFFFF" : isMine ? "rgba(255,255,255,0.7)" : "#9CA3AF",
                    fontWeight: isImageOnly ? "600" : "400",
                  }}
                >
                  {formatMessageTime(message.created_at)}
                </Text>
                {isSent && !message.id.startsWith("temp-") && (
                  <Check size={11} color={isImageOnly ? "#FFFFFF" : isMine ? "rgba(255,255,255,0.7)" : "#9CA3AF"} />
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
              bottom: -18,
              ...(isMine ? { right: 12 } : { left: 12 }),
              flexDirection: isMine ? "row-reverse" : "row",
              alignItems: "center",
              backgroundColor: isMine ? (isFailed ? "#8A2A2A" : "#1A6B3C") : "#FFFFFF",
              borderRadius: 9999,
              borderWidth: 2,
              borderColor: "#FFFFFF",
              minHeight: 28,
              paddingHorizontal: 6,
              paddingVertical: 2,
              gap: 3,
              zIndex: 10,
              elevation: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 3,
            }}
          >
            {groupReactions(message.reactions).map(({ emoji, count }) => {
              return (
                <View
                  key={emoji}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <OfflineAnimatedEmoji
                    emoji={emoji}
                    size={18}
                    preferLottie={true}
                    fallbackText={emoji}
                  />
                  {count > 1 && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isMine ? "#FFFFFF" : "#374151",
                        marginLeft: 1,
                      }}
                    >
                      {count}
                    </Text>
                  )}
                </View>
              );
            })}
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
