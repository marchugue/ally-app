import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, ChevronDown, Globe, Lock, Users, X } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { getMyPreferences, updateMyPreferences } from "@/lib/api/profiles";
import type { RelationshipAudience } from "@/types/profile";

export interface MobileRelationshipPrivacyState {
  allies: RelationshipAudience;
  following: RelationshipAudience;
  followers: RelationshipAudience;
}

interface EditRelationshipPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  initialPrivacy?: MobileRelationshipPrivacyState | null;
  onSaved?: (privacy: MobileRelationshipPrivacyState) => void;
}

const AUDIENCE_OPTIONS: Array<{
  value: RelationshipAudience;
  label: string;
  Icon: typeof Globe;
}> = [
  { value: "public", label: "Public", Icon: Globe },
  { value: "allies", label: "Allies", Icon: Users },
  { value: "only_me", label: "Only Me", Icon: Lock },
];

const ROWS: Array<{
  key: keyof MobileRelationshipPrivacyState;
  label: string;
  prefKey: "allies_visibility" | "following_visibility" | "followers_visibility";
}> = [
  { key: "allies", label: "Allies", prefKey: "allies_visibility" },
  { key: "following", label: "Following", prefKey: "following_visibility" },
  { key: "followers", label: "Followers", prefKey: "followers_visibility" },
];

export function EditRelationshipPrivacyModal({
  visible,
  onClose,
  accessToken,
  initialPrivacy,
  onSaved,
}: EditRelationshipPrivacyModalProps) {
  const { colors, isDark } = useTheme();
  const [privacy, setPrivacy] = useState<MobileRelationshipPrivacyState>({
    allies: initialPrivacy?.allies ?? "public",
    following: initialPrivacy?.following ?? "public",
    followers: initialPrivacy?.followers ?? "public",
  });
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof MobileRelationshipPrivacyState | null>(null);
  const [openPickerKey, setOpenPickerKey] = useState<keyof MobileRelationshipPrivacyState | null>(null);

  useEffect(() => {
    if (!visible) {
      setOpenPickerKey(null);
      return;
    }
    if (initialPrivacy) {
      setPrivacy(initialPrivacy);
    }
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);
    getMyPreferences(accessToken)
      .then((prefs) => {
        if (cancelled) return;
        setPrivacy({
          allies: prefs.allies_visibility ?? "public",
          following: prefs.following_visibility ?? "public",
          followers: prefs.followers_visibility ?? "public",
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, accessToken, initialPrivacy]);

  const handleSelect = async (
    rowKey: keyof MobileRelationshipPrivacyState,
    prefKey: "allies_visibility" | "following_visibility" | "followers_visibility",
    value: RelationshipAudience
  ) => {
    if (!accessToken) return;
    const prev = privacy;
    const next: MobileRelationshipPrivacyState = { ...privacy, [rowKey]: value };
    setPrivacy(next);
    setOpenPickerKey(null);
    setSavingKey(rowKey);
    try {
      const updated = await updateMyPreferences({ [prefKey]: value }, accessToken);
      const synced: MobileRelationshipPrivacyState = {
        allies: updated.allies_visibility ?? next.allies,
        following: updated.following_visibility ?? next.following,
        followers: updated.followers_visibility ?? next.followers,
      };
      setPrivacy(synced);
      onSaved?.(synced);
    } catch {
      setPrivacy(prev);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>
              Edit Privacy
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading && !initialPrivacy ? (
            <View style={{ paddingVertical: 28, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {ROWS.map((row) => {
                const value = privacy[row.key];
                const meta =
                  AUDIENCE_OPTIONS.find((opt) => opt.value === value) ?? AUDIENCE_OPTIONS[0];
                const isSaving = savingKey === row.key;
                const isExpanded = openPickerKey === row.key;
                const Icon = meta.Icon;

                return (
                  <View key={row.key}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
                        {row.label}
                      </Text>

                      <TouchableOpacity
                        disabled={isSaving}
                        onPress={() => setOpenPickerKey(isExpanded ? null : row.key)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          minWidth: 112,
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {isSaving ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Icon size={13} color={colors.primary} />
                          )}
                          <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.textPrimary }}>
                            {meta.label}
                          </Text>
                        </View>
                        <ChevronDown size={13} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    {isExpanded && (
                      <View
                        style={{
                          marginTop: 6,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          overflow: "hidden",
                        }}
                      >
                        {AUDIENCE_OPTIONS.map((option) => {
                          const OptionIcon = option.Icon;
                          const selected = option.value === value;
                          return (
                            <TouchableOpacity
                              key={option.value}
                              onPress={() => handleSelect(row.key, row.prefKey, option.value)}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                backgroundColor: selected
                                  ? colors.primarySoft
                                  : "transparent",
                              }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <OptionIcon
                                  size={14}
                                  color={selected ? colors.primary : colors.textSecondary}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: selected ? "700" : "500",
                                    color: selected ? colors.primary : colors.textPrimary,
                                  }}
                                >
                                  {option.label}
                                </Text>
                              </View>
                              {selected && <Check size={14} color={colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
