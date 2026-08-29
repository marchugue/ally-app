import { View, Text, Pressable, Image } from "react-native";
import { Heart, MessageCircle, MoreHorizontal } from "lucide-react-native";
import { UserAvatar, resolveImageUri } from "./UserAvatar";
import type { FeedPost } from "@/types/feed";

interface PostCardProps {
  post: FeedPost;
  onToggleLike: (post: FeedPost) => void;
  onComment?: (post: FeedPost) => void;
  onMore?: (post: FeedPost) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w`;
}

export function PostCard({ post, onToggleLike, onComment, onMore }: PostCardProps) {
  const hasMedia = post.media && post.media.length > 0;

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2DED7",
      }}
    >
      {/* Author header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          gap: 10,
        }}
      >
        <UserAvatar avatar={post.author.avatar_url} size="md" />

        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}
            numberOfLines={1}
          >
            {post.author.full_name || `@${post.author.username}`}
          </Text>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
            @{post.author.username} · {timeAgo(post.created_at)}
          </Text>
        </View>

        {onMore && (
          <Pressable onPress={() => onMore(post)} hitSlop={10}>
            <MoreHorizontal size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* Content */}
      {post.content ? (
        <Text
          style={{
            fontSize: 15,
            color: "#111827",
            lineHeight: 22,
            paddingHorizontal: 16,
            paddingBottom: hasMedia ? 10 : 0,
          }}
        >
          {post.content}
        </Text>
      ) : null}

      {/* Media grid */}
      {hasMedia && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {post.media.length === 1 ? (
            (() => {
              const uri = resolveImageUri(post.media[0]);
              return uri ? (
                <Image
                  source={{ uri }}
                  style={{
                    width: "100%",
                    height: 220,
                    borderRadius: 14,
                  }}
                  resizeMode="cover"
                />
              ) : null;
            })()
          ) : (
            <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
              {post.media.slice(0, 4).map((url, idx) => {
                const uri = resolveImageUri(url);
                if (!uri) return null;
                return (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={{
                      width: "48%",
                      height: 140,
                      borderRadius: 10,
                      flexGrow: 1,
                    }}
                    resizeMode="cover"
                  />
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Action row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 20,
        }}
      >
        <Pressable
          onPress={() => onToggleLike(post)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
          hitSlop={6}
        >
          <Heart
            size={18}
            color={post.liked_by_me ? "#1A6B3C" : "#9CA3AF"}
            fill={post.liked_by_me ? "#1A6B3C" : "none"}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: post.liked_by_me ? "#1A6B3C" : "#6B7280",
            }}
          >
            {post.likes_count > 0 ? post.likes_count : ""}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onComment?.(post)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
          hitSlop={6}
        >
          <MessageCircle size={18} color="#9CA3AF" />
          <Text style={{ fontSize: 13, fontWeight: "500", color: "#6B7280" }}>
            {post.comments_count > 0 ? post.comments_count : ""}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
