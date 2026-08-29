import { useRef, useCallback } from "react";
import { View, Text } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Reply } from "lucide-react-native";
import { ChatBubble } from "./ChatBubble";
import type { Message } from "@/types/conversation";

interface SwipeableChatBubbleProps {
  message: Message;
  isMine: boolean;
  onLongPress?: (message: Message) => void;
  onReply?: (message: Message) => void;
}

/** Reply arrow indicator shown during swipe */
function ReplyIndicator() {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#E8F5EE",
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
      }}
    >
      <Reply size={18} color="#1A6B3C" />
    </View>
  );
}

export function SwipeableChatBubble({
  message,
  isMine,
  onLongPress,
  onReply,
}: SwipeableChatBubbleProps) {
  const swipeRef = useRef<any>(null);

  const handleSwipeOpen = useCallback(() => {
    // Close the swipe immediately, then trigger reply
    swipeRef.current?.close();
    onReply?.(message);
  }, [message, onReply]);

  // My messages → swipe LEFT to reply (renderRightActions)
  // Their messages → swipe RIGHT to reply (renderLeftActions)

  if (isMine) {
    return (
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={2}
        overshootRight={false}
        rightThreshold={40}
        onSwipeableOpen={handleSwipeOpen}
        renderRightActions={() => (
          <View
            style={{
              justifyContent: "center",
              paddingLeft: 8,
              paddingRight: 4,
            }}
          >
            <ReplyIndicator />
          </View>
        )}
      >
        <ChatBubble
          message={message}
          isMine={isMine}
          onLongPress={onLongPress}
          onReply={onReply}
        />
      </ReanimatedSwipeable>
    );
  }

  // Their message → swipe RIGHT to reply
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      overshootLeft={false}
      leftThreshold={40}
      onSwipeableOpen={handleSwipeOpen}
      renderLeftActions={() => (
        <View
          style={{
            justifyContent: "center",
            paddingRight: 8,
            paddingLeft: 4,
          }}
        >
          <ReplyIndicator />
        </View>
      )}
    >
      <ChatBubble
        message={message}
        isMine={isMine}
        onLongPress={onLongPress}
        onReply={onReply}
      />
    </ReanimatedSwipeable>
  );
}
