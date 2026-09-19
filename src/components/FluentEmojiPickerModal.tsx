import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { Search, X } from "lucide-react-native";
import catalogData from "@/lib/fluentEmojiCatalog.json";

export interface FluentEmojiItem {
  id: string;
  name: string;
  emoji: string;
  url: string;
  keywords: string[];
}

export interface FluentEmojiCategory {
  id: string;
  name: string;
  emojis: FluentEmojiItem[];
}

interface FluentEmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_SIZE = Math.floor((SCREEN_WIDTH - 32) / 6);

export function FluentEmojiPickerModal({
  visible,
  onClose,
  onSelect,
}: FluentEmojiPickerModalProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("people");

  const categories = catalogData as FluentEmojiCategory[];

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;

    const results: FluentEmojiItem[] = [];
    for (const cat of categories) {
      for (const em of cat.emojis) {
        if (
          em.name.toLowerCase().includes(q) ||
          em.id.toLowerCase().includes(q) ||
          em.emoji.includes(q) ||
          em.keywords.some((k) => k.toLowerCase().includes(q))
        ) {
          results.push(em);
        }
      }
    }
    return results;
  }, [search, categories]);

  const activeEmojis = useMemo(() => {
    if (searchResults !== null) return searchResults;
    const cat = categories.find((c) => c.id === activeCategory);
    return cat ? cat.emojis : [];
  }, [searchResults, activeCategory, categories]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      >
        {/* Backdrop dismiss */}
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
        />

        {/* Bottom Sheet Container */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            height: SCREEN_HEIGHT * 0.65,
            paddingTop: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 16,
          }}
        >
          {/* Handle bar */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#E5E7EB",
              alignSelf: "center",
              marginBottom: 12,
            }}
          />

          {/* Search bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F3F4F6",
              borderRadius: 14,
              marginHorizontal: 16,
              paddingHorizontal: 10,
              height: 38,
            }}
          >
            <Search size={16} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search Microsoft Fluent emojis…"
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 13,
                color: "#111827",
                paddingVertical: 0,
              }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <X size={14} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {/* Category Tabs (hidden during search) */}
          {!search && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 6,
              }}
            >
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setActiveCategory(cat.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: isActive ? "#E8F5E9" : "#F9FAFB",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? "700" : "500",
                        color: isActive ? "#1A6B3C" : "#6B7280",
                      }}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Emoji Grid */}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 32,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
            showsVerticalScrollIndicator={false}
          >
            {activeEmojis.length === 0 ? (
              <View style={{ width: "100%", paddingVertical: 48, alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: "#9CA3AF" }}>
                  No emojis found
                </Text>
              </View>
            ) : (
              activeEmojis.map((em) => (
                <Pressable
                  key={em.id + em.emoji}
                  onPress={() => {
                    onSelect(em.emoji);
                    onClose();
                  }}
                  style={{
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                  }}
                  android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
                >
                  <Image
                    source={{ uri: em.url }}
                    style={{ width: 34, height: 34 }}
                    resizeMode="contain"
                  />
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
