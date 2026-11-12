import { useCallback } from "react";
import { View, Platform, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Reply } from "lucide-react-native";
import { ChatBubble, type BubbleLayout } from "./ChatBubble";
import { useTheme } from "@/context/ThemeContext";
import type { Message, MessageGroupPosition } from "@/types/conversation";
import type { AvatarRevealView } from "@/lib/api/matchmaking";

interface SwipeableChatBubbleProps {
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
  imagesLocked?: boolean;
  isAnonymous?: boolean;
  avatarReveal?: AvatarRevealView | null;
  partnerAvatar?: string | null;
  partnerProfileImage?: string | null;
}

const MAX_SLIDE_DISTANCE = 72;
const HALF_SLIDE_THRESHOLD = MAX_SLIDE_DISTANCE * 0.5; // 50% slide triggers reply & icon pill

/** Fully rounded pill reply icon indicator */
function ReplyIndicator({ isDark }: { isDark: boolean }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        backgroundColor: isDark ? "rgba(16, 185, 129, 0.22)" : "#E8F5EE",
        borderWidth: 1,
        borderColor: isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(26, 107, 60, 0.14)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Reply size={18} color={isDark ? "#34D399" : "#1A6B3C"} />
    </View>
  );
}

export function SwipeableChatBubble({
  message,
  isMine,
  groupPosition,
  senderName,
  onLongPress,
  onReply,
  onRetry,
  onImagePress,
  isActiveTime,
  onToggleTime,
  imagesLocked = false,
  isAnonymous = false,
  avatarReveal,
  partnerAvatar,
  partnerProfileImage,
}: SwipeableChatBubbleProps) {
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();
  const isMobileViewport = Platform.OS !== "web" || width < 768;

  const translateX = useSharedValue(0);
  const reachedHalf = useSharedValue(false);

  const triggerReply = useCallback(() => {
    onReply?.(message);
  }, [message, onReply]);

  const isDeleted = Boolean(message.is_deleted || (message as any).isDeleted);
  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";
  const canSwipe = isMobileViewport && !isDeleted && !isSending && !isFailed;

  const panGesture = Gesture.Pan()
    .enabled(canSwipe)
    .activeOffsetX(isMine ? [-12, 9999] : [-9999, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const clamped = isMine
        ? Math.max(-MAX_SLIDE_DISTANCE, Math.min(0, e.translationX))
        : Math.min(MAX_SLIDE_DISTANCE, Math.max(0, e.translationX));
      translateX.value = clamped;
      reachedHalf.value = Math.abs(clamped) >= HALF_SLIDE_THRESHOLD;
    })
    .onEnd(() => {
      if (reachedHalf.value) {
        runOnJS(triggerReply)();
      }
      reachedHalf.value = false;
      translateX.value = withSpring(0, { damping: 22, stiffness: 280 });
    })
    .onFinalize(() => {
      reachedHalf.value = false;
      translateX.value = withSpring(0, { damping: 22, stiffness: 280 });
    });

  // Slide message + attached reply pill together
  const rowSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Appear at >= 50% slide and reverse smoothly back out when released
  const pillAppearStyle = useAnimatedStyle(() => {
    const active = Math.abs(translateX.value) >= HALF_SLIDE_THRESHOLD;
    return {
      opacity: withTiming(active ? 1 : 0, { duration: 140 }),
      transform: [
        { scale: withSpring(active ? 1 : 0.4, { damping: 18, stiffness: 260 }) },
      ],
    };
  });

  const bubbleElement = (
    <ChatBubble
      message={message}
      isMine={isMine}
      groupPosition={groupPosition}
      senderName={senderName}
      onLongPress={isMobileViewport ? onLongPress : undefined}
      onReply={onReply}
      onRetry={onRetry}
      onImagePress={onImagePress}
      isActiveTime={isActiveTime}
      onToggleTime={onToggleTime}
      imagesLocked={imagesLocked}
      isAnonymous={isAnonymous}
      avatarReveal={avatarReveal}
      partnerAvatar={partnerAvatar}
      partnerProfileImage={partnerProfileImage}
    />
  );

  if (!canSwipe) {
    return bubbleElement;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[{ width: "100%", position: "relative" }, rowSlideStyle]}>
        {bubbleElement}

        {/* Reply pill anchored beside bubble edge so it slides & reverses together */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              justifyContent: "center",
              alignItems: "center",
              ...(isMine ? { right: -34 } : { left: -34 }),
            },
            pillAppearStyle,
          ]}
        >
          <ReplyIndicator isDark={isDark} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
