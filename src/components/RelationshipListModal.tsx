// src/components/RelationshipListModal.tsx

import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { X, Search, Users, ArrowUpDown } from "lucide-react-native";
import { router } from "expo-router";
import { UserAvatar } from "./UserAvatar";
import { listFollowers, listFollowing } from "@/lib/api/follow";
import { listAllies } from "@/lib/api/interaction";
import { useAuth } from "@/lib/auth/AuthContext";
import type { FollowListItem } from "@/types/follow";
import type { AllyListItem } from "@/types/interaction";

type RelationshipKind = "followers" | "following" | "allies";
type ListItem = (FollowListItem | AllyListItem) & {
  department?: string | null;
  year_level?: string | null;
};

interface RelationshipListModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialKind?: RelationshipKind;
  userName?: string;
}

const TITLES: Record<RelationshipKind, string> = {
  followers: "Followers",
  following: "Following",
  allies: "Allies",
};

export function RelationshipListModal({
  visible,
  onClose,
  userId,
  initialKind = "allies",
  userName,
}: RelationshipListModalProps) {
  const { accessToken } = useAuth();
  const [activeKind, setActiveKind] = useState<RelationshipKind>(initialKind);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name">("recent");
  const [items, setItems] = useState<ListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setActiveKind(initialKind);
      setSearchQuery("");
      setSortBy("recent");
    }
  }, [visible, initialKind]);

  const loadData = useCallback(
    async (reset = true, nextCursor: string | null = null, query = searchQuery, sort = sortBy) => {
      if (!accessToken || !userId) return;
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const filterParams = {
          search: query.trim() || undefined,
          sortBy: sort,
          cursor: nextCursor,
        };

        let result: { items: ListItem[]; nextCursor: string | null };
        if (activeKind === "followers") {
          result = await listFollowers(userId, accessToken, filterParams);
        } else if (activeKind === "following") {
          result = await listFollowing(userId, accessToken, filterParams);
        } else {
          result = await listAllies(userId, accessToken, filterParams);
        }

        if (reset) {
          setItems(result.items || []);
        } else {
          setItems((prev) => [...prev, ...(result.items || [])]);
        }
        setCursor(result.nextCursor);
      } catch (err) {
        console.warn("[RelationshipListModal] load failed", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, userId, activeKind, searchQuery, sortBy]
  );

  // Trigger search on kind, query, or sort change
  useEffect(() => {
    if (!visible) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      void loadData(true, null, searchQuery, sortBy);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [visible, activeKind, searchQuery, sortBy, loadData]);

  const handleLoadMore = () => {
    if (!cursor || loading || loadingMore) return;
    void loadData(false, cursor, searchQuery, sortBy);
  };

  const handleSelectMember = (memberId: string) => {
    onClose();
    router.push({
      pathname: "/pages/user-profile",
      params: { userId: memberId },
    } as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#F3F4F6",
          }}
        >
          <View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
              {TITLES[activeKind]}
            </Text>
            {Boolean(userName) && (
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                @{userName}
              </Text>
            )}
          </View>

          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "#F3F4F6",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} color="#4B5563" />
          </Pressable>
        </View>

        {/* Tab Switcher */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#F3F4F6",
            borderRadius: 12,
            marginHorizontal: 16,
            marginTop: 12,
            padding: 4,
            gap: 4,
          }}
        >
          {(
            [
              { key: "allies", label: "Allies" },
              { key: "followers", label: "Followers" },
              { key: "following", label: "Following" },
            ] as const
          ).map((tab) => {
            const isSelected = activeKind === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveKind(tab.key)}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 9,
                  backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                  alignItems: "center",
                  shadowColor: isSelected ? "rgba(0,0,0,0.08)" : "transparent",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 1,
                  shadowRadius: 2,
                  elevation: isSelected ? 1 : 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isSelected ? "700" : "500",
                    color: isSelected ? "#1A6B3C" : "#6B7280",
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search & Sort Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F9FAFB",
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              paddingHorizontal: 12,
              height: 40,
              gap: 8,
            }}
          >
            <Search size={16} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${TITLES[activeKind].toLowerCase()}...`}
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                fontSize: 13.5,
                color: "#111827",
                padding: 0,
              }}
            />
            {Boolean(searchQuery) && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                <X size={14} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {/* Sort Pill */}
          <Pressable
            onPress={() => setSortBy((prev) => (prev === "recent" ? "name" : "recent"))}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 12,
              height: 40,
              borderRadius: 12,
              backgroundColor: "#F3F4F6",
            }}
          >
            <ArrowUpDown size={14} color="#4B5563" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151" }}>
              {sortBy === "recent" ? "Recent" : "Name A-Z"}
            </Text>
          </Pressable>
        </View>

        {/* Content List */}
        {loading && items.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#1A6B3C" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectMember(item.id)}
                android_ripple={{ color: "rgba(0,0,0,0.04)" }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F3F4F6",
                  gap: 12,
                }}
              >
                <UserAvatar avatar={item.avatarUrl} size="md" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
                    {item.fullName || `@${item.username}`}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }} numberOfLines={1}>
                    {item.course ? `${item.course}` : `@${item.username}`}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: 48, alignItems: "center", paddingHorizontal: 32 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "rgba(26,107,60,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Users size={24} color="#1A6B3C" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827", textAlign: "center" }}>
                  {searchQuery ? "No matches found" : `No ${TITLES[activeKind].toLowerCase()} yet`}
                </Text>
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4, textAlign: "center" }}>
                  {searchQuery
                    ? "Try adjusting your search keywords."
                    : `Students who connect as ${TITLES[activeKind].toLowerCase()} will show up here.`}
                </Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator color="#1A6B3C" size="small" />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}
