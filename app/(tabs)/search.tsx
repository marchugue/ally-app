import { View, Text, TextInput } from "react-native";
import { useState } from "react";
import { Search as SearchIcon, X } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";

export default function SearchScreen() {
  const [query, setQuery] = useState("");

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Search" />

      {/* Search input */}
      <View className="px-5 pt-4 pb-2">
        <View
          className="flex-row items-center bg-surface border border-border rounded-xl px-3"
          style={{ paddingVertical: 12 }}
        >
          <SearchIcon size={17} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people, posts, tags…"
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2 text-textPrimary text-sm"
          />
          {query.length > 0 && (
            <X size={16} color="#9CA3AF" onPress={() => setQuery("")} />
          )}
        </View>
      </View>

      {/* Empty state */}
      {!query && (
        <View className="flex-1 items-center justify-center px-8">
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: "#1A6B3C10",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <SearchIcon size={28} color="#1A6B3C" />
          </View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 6,
              textAlign: "center",
              letterSpacing: -0.3,
            }}
          >
            Find people
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: "#6B7280",
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Search for classmates by name or username.
          </Text>
        </View>
      )}

      {/* No results state */}
      {query.length > 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>
            No results for "{query}"
          </Text>
        </View>
      )}
    </View>
  );
}