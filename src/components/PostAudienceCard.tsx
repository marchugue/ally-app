import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, Check, Globe, Lock, UserCheck, Users } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import type { PostAudience } from "@/types/feed";

export interface MobilePostAudienceOption {
  value: PostAudience;
  label: string;
  description: string;
  Icon: typeof Globe;
}

/** Ordered by reach / importance: Public -> Followers -> Allies -> Only Me */
export const POST_AUDIENCE_OPTIONS: MobilePostAudienceOption[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone on Ally-jis can see this post",
    Icon: Globe,
  },
  {
    value: "followers",
    label: "Followers",
    description: "Only people who follow you",
    Icon: UserCheck,
  },
  {
    value: "connections",
    label: "Allies",
    description: "Only your confirmed campus allies",
    Icon: Users,
  },
  {
    value: "only_me",
    label: "Only Me",
    description: "Only you can see this post",
    Icon: Lock,
  },
];

export function normalizePostAudience(value: unknown): PostAudience {
  if (typeof value !== "string") return "public";
  const v = value.trim().toLowerCase();
  if (v === "followers") return "followers";
  if (v === "connections" || v === "allies") return "connections";
  if (v === "only_me") return "only_me";
  return "public";
}

export function getPostAudienceMeta(value: PostAudience): MobilePostAudienceOption {
  return (
    POST_AUDIENCE_OPTIONS.find((opt) => opt.value === value) ??
    POST_AUDIENCE_OPTIONS[0]
  );
}

interface PostAudienceCardProps {
  value: PostAudience;
  showDefaultOption?: boolean;
  initialSetAsDefault?: boolean;
  saving?: boolean;
  bottomInset?: number;
  onBack: () => void;
  onDone: (selected: PostAudience, setAsDefault: boolean) => void | Promise<void>;
}

export function PostAudienceCard({
  value,
  showDefaultOption = false,
  initialSetAsDefault = false,
  saving = false,
  bottomInset = 12,
  onBack,
  onDone,
}: PostAudienceCardProps) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState<PostAudience>(normalizePostAudience(value));
  const [setAsDefault, setSetAsDefault] = useState(initialSetAsDefault);

  useEffect(() => {
    setSelected(normalizePostAudience(value));
  }, [value]);

  useEffect(() => {
    setSetAsDefault(initialSetAsDefault);
  }, [initialSetAsDefault]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header: bare back arrow (no label, no pill bg), centered title, empty right slot */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          disabled={saving}
          hitSlop={10}
          accessibilityLabel="Back"
          style={{ width: 28, alignItems: "flex-start" }}
        >
          <ArrowLeft size={21} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: colors.textPrimary,
            textAlign: "center",
          }}
        >
          Audience
        </Text>

        <View style={{ width: 28 }} />
      </View>

      {/* Radio List ordered by importance */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {POST_AUDIENCE_OPTIONS.map((option) => {
          const Icon = option.Icon;
          const isSelected = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.75}
              disabled={saving}
              onPress={() => setSelected(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected
                  ? colors.primarySoft
                  : isDark
                  ? "rgba(255,255,255,0.03)"
                  : "#FFFFFF",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(56,193,133,0.2)"
                        : "rgba(26,107,60,0.12)"
                      : colors.surfaceMuted,
                  }}
                >
                  <Icon
                    size={18}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: colors.textPrimary,
                    }}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {option.description}
                  </Text>
                </View>
              </View>

              {/* Radio Circle */}
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.textMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && (
                  <View
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 5.5,
                      backgroundColor: colors.primary,
                    }}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer: Optional default checkbox + Full-bleed Done button */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(bottomInset, 16),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 12,
        }}
      >
        {showDefaultOption && (
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={saving}
            onPress={() => setSetAsDefault((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: setAsDefault }}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: setAsDefault ? colors.primary : colors.textMuted,
                backgroundColor: setAsDefault ? colors.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {setAsDefault && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.textPrimary }}>
              Set as default audience
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={saving}
          onPress={() => void onDone(selected, setAsDefault)}
          style={{
            width: "100%",
            height: 46,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving && <ActivityIndicator size="small" color="#FFFFFF" />}
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

