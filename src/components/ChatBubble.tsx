import { View, Text, Pressable, Image } from "react-native";
import type { Message, MessageReaction } from "@/types/conversation";
import { resolveImageUri } from "./UserAvatar";

interface ChatBubbleProps {
  message: Message;
  isMine: boolean;
  onLongPress?: (message: Message) => void;
  onReply?: (message: Message) => void;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function ChatBubble({ message, isMine, onLongPress, onReply }: ChatBubbleProps) {
  const imageUri = resolveImageUri(message.image_url);
  const hasImage = !!imageUri;
  const hasReply = !!message.replied_message;
  const hasReactions = message.reactions && message.reactions.length > 0;

  return (
    <View
      style={{
        alignSelf: isMine ? "flex-end" : "flex-start",
        maxWidth: "78%",
        marginVertical: 3,
        marginHorizontal: 16,
      }}
    >
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

      {/* Main bubble */}
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        style={{
          backgroundColor: isMine ? "#1A6B3C" : "#FFFFFF",
          borderRadius: 18,
          borderBottomRightRadius: isMine ? 4 : 18,
          borderBottomLeftRadius: isMine ? 18 : 4,
          paddingHorizontal: hasImage ? 4 : 14,
          paddingTop: hasImage ? 4 : 10,
          paddingBottom: hasImage ? 4 : 8,
          borderWidth: isMine ? 0 : 1,
          borderColor: "#E2DED7",
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

        {/* Timestamp */}
        <Text
          style={{
            fontSize: 10,
            color: isMine ? "rgba(255,255,255,0.6)" : "#9CA3AF",
            alignSelf: "flex-end",
            marginTop: 2,
            paddingHorizontal: hasImage ? 10 : 0,
            paddingBottom: hasImage ? 4 : 0,
          }}
        >
          {formatTime(message.created_at)}
        </Text>
      </Pressable>

      {/* Reactions */}
      {hasReactions && (
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            marginTop: 2,
            alignSelf: isMine ? "flex-end" : "flex-start",
            paddingHorizontal: 4,
          }}
        >
          {groupReactions(message.reactions).map(({ emoji, count }) => (
            <View
              key={emoji}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                backgroundColor: "#F0EDE8",
                borderRadius: 12,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 12 }}>{emoji}</Text>
              {count > 1 && (
                <Text style={{ fontSize: 10, color: "#6B7280" }}>{count}</Text>
              )}
            </View>
          ))}
        </View>
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
