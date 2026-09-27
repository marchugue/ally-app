import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Image,
  Share,
  StyleSheet,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronLeft, ChevronRight, Reply, Share2 } from "lucide-react-native";
import type { Message } from "@/types/conversation";
import { resolveImageUri } from "./UserAvatar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface MessageImageViewerProps {
  visible: boolean;
  message: Message | null;
  initialIndex?: number;
  onClose: () => void;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
}

function formatMessageDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (date.toDateString() === now.toDateString()) {
    return time;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${time}`;
  }

  const datePart = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  return `${datePart}, ${time}`;
}

export function MessageImageViewer({
  visible,
  message,
  initialIndex = 0,
  onClose,
  onReply,
  onForward,
}: MessageImageViewerProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<string>>(null);
  const thumbnailScrollRef = useRef<ScrollView>(null);

  // Parse images from message
  const images = useMemo<string[]>(() => {
    if (!message) return [];
    const raw =
      message.image_url ||
      (message as any).imageUrl ||
      (message as any).images ||
      (message as any).media;
    if (!raw) {
      if (message.content && typeof message.content === "string") {
        const trimmed = message.content.trim();
        if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(trimmed)) {
          const uri = resolveImageUri(trimmed);
          if (uri) return [uri];
        }
      }
      return [];
    }

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
    return [];
  }, [message]);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (visible && images.length > 0) {
      const targetIndex = Math.max(0, Math.min(images.length - 1, initialIndex));
      setCurrentIndex(targetIndex);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex, images.length]);

  const handleScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < images.length && index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const goToIndex = (index: number) => {
    if (index < 0 || index >= images.length) return;
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleShare = async () => {
    if (!message) return;
    const currentImg = images[currentIndex];
    try {
      if (onForward) {
        onForward(message);
      } else {
        await Share.share({
          message: message.content ? `${message.content}\n${currentImg || ""}` : (currentImg || ""),
          url: currentImg || undefined,
        });
      }
    } catch (err) {
      console.warn("Failed to share image", err);
    }
  };

  if (!visible || !message || images.length === 0) {
    return null;
  }

  const timestamp = message.created_at;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Top Header Bar */}
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={22} color="#FFFFFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTime} numberOfLines={1}>
                {formatMessageDateTime(timestamp)}
              </Text>
              {images.length > 1 && (
                <Text style={styles.headerCounter}>
                  {currentIndex + 1} / {images.length}
                </Text>
              )}
            </View>

            {/* Spacer for symmetry */}
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        {/* Main Swiper / Carousel View */}
        <View style={styles.mainViewer}>
          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => `${item}-${idx}`}
            onMomentumScrollEnd={handleScrollEnd}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={styles.slide}>
                <Image
                  source={{ uri: item }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          {/* Left Arrow Button */}
          {images.length > 1 && currentIndex > 0 && (
            <TouchableOpacity
              onPress={() => goToIndex(currentIndex - 1)}
              activeOpacity={0.8}
              style={[styles.arrowButton, styles.leftArrow]}
            >
              <ChevronLeft size={26} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Right Arrow Button */}
          {images.length > 1 && currentIndex < images.length - 1 && (
            <TouchableOpacity
              onPress={() => goToIndex(currentIndex + 1)}
              activeOpacity={0.8}
              style={[styles.arrowButton, styles.rightArrow]}
            >
              <ChevronRight size={26} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Caption overlay if text exists */}
          {Boolean(message.content?.trim()) && (
            <View style={styles.captionContainer}>
              <Text style={styles.captionText}>{message.content}</Text>
            </View>
          )}
        </View>

        {/* Bottom Thumbnail Carousel Strip */}
        {images.length > 1 && (
          <View style={styles.thumbnailStripContainer}>
            <ScrollView
              ref={thumbnailScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailListContent}
            >
              {images.map((img, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => goToIndex(idx)}
                    style={[
                      styles.thumbnailWrapper,
                      isActive && styles.thumbnailWrapperActive,
                    ]}
                  >
                    <Image
                      source={{ uri: img }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Bottom Actions Bar (Reply / Share) */}
        <SafeAreaView edges={["bottom"]} style={styles.bottomActionsSafeArea}>
          <View style={styles.bottomActions}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                onClose();
                onReply?.(message);
              }}
              style={styles.actionButton}
            >
              <Reply size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleShare}
              style={styles.actionButton}
            >
              <Share2 size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
  },
  headerSafeArea: {
    backgroundColor: "transparent",
  },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTime: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "500",
  },
  headerCounter: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  headerSpacer: {
    width: 68,
  },
  mainViewer: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  slide: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  fullImage: {
    width: "100%",
    height: "85%",
    borderRadius: 16,
  },
  arrowButton: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  leftArrow: {
    left: 14,
  },
  rightArrow: {
    right: 14,
  },
  captionContainer: {
    position: "absolute",
    bottom: 12,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  captionText: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  thumbnailStripContainer: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailListContent: {
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  thumbnailWrapper: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    opacity: 0.5,
    backgroundColor: "#1F2937",
  },
  thumbnailWrapperActive: {
    borderColor: "#1A6B3C",
    borderWidth: 2.5,
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  bottomActionsSafeArea: {
    backgroundColor: "transparent",
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
