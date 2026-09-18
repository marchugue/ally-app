import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { X, ChevronLeft, ChevronRight, ShieldAlert, CheckCircle2 } from "lucide-react-native";
import { COMMUNITY_STANDARDS, ReportCategory, ReportViolation } from "@/constants/communityStandards";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitReport: (reason: string, details?: string) => Promise<void>;
  targetType?: "post" | "user" | "comment";
}

export function ReportModal({
  visible,
  onClose,
  onSubmitReport,
  targetType = "post",
}: ReportModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<ReportViolation | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resetState = () => {
    setSelectedCategory(null);
    setSelectedViolation(null);
    setAdditionalDetails("");
    setSubmitting(false);
    setSubmitted(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !selectedViolation) return;
    const fullReason = `${selectedCategory.label} - ${selectedViolation.label}`;
    
    setSubmitting(true);
    try {
      await onSubmitReport(fullReason, additionalDetails.trim());
      setSubmitted(true);
    } catch (err) {
      console.warn("Failed to submit report", err);
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "85%",
            paddingBottom: 24,
          }}
        >
          {/* Grabber Handle */}
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D1D5DB",
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#F3F4F6",
            }}
          >
            {selectedCategory && !submitted ? (
              <Pressable
                onPress={() => setSelectedCategory(null)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                hitSlop={8}
              >
                <ChevronLeft size={20} color="#374151" />
                <Text style={{ fontSize: 14, color: "#374151", fontWeight: "600" }}>Back</Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={20} color="#DC2626" />
                <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
                  Report {targetType.charAt(0).toUpperCase() + targetType.slice(1)}
                </Text>
              </View>
            )}

            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Content Body */}
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            keyboardDismissMode="on-drag"
          >
            {submitted ? (
              /* Success State */
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <CheckCircle2 size={54} color="#1A6B3C" style={{ marginBottom: 14 }} />
                <Text style={{ fontSize: 19, fontWeight: "700", color: "#111827", marginBottom: 8, textAlign: "center" }}>
                  Report Submitted
                </Text>
                <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20, paddingHorizontal: 16, marginBottom: 24 }}>
                  Thank you for keeping our community safe. Our moderation team will review this report against our Community Standards.
                </Text>

                <Pressable
                  onPress={handleClose}
                  style={{
                    backgroundColor: "#1A6B3C",
                    paddingVertical: 12,
                    paddingHorizontal: 32,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>Done</Text>
                </Pressable>
              </View>
            ) : !selectedCategory ? (
              /* Step 1: Select Category */
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 }}>
                  Why are you reporting this {targetType}?
                </Text>
                <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
                  Select an issue that violates our Community Standards.
                </Text>

                {COMMUNITY_STANDARDS.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => {
                      setSelectedCategory(category);
                      setSelectedViolation(null);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                      marginBottom: 10,
                      backgroundColor: "#FAFAFA",
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 2 }}>
                        {category.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>
                        {category.description}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#9CA3AF" />
                  </Pressable>
                ))}
              </View>
            ) : (
              /* Step 2: Select Violation & Additional Details */
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 }}>
                  {selectedCategory.label}
                </Text>
                <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
                  Please select the specific issue:
                </Text>

                {selectedCategory.violations.map((violation) => {
                  const isSelected = selectedViolation?.id === violation.id;
                  return (
                    <Pressable
                      key={violation.id}
                      onPress={() => setSelectedViolation(violation)}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? "#1A6B3C" : "#E5E7EB",
                        backgroundColor: isSelected ? "#F0FDF4" : "#FFFFFF",
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "600", color: isSelected ? "#1A6B3C" : "#111827", marginBottom: 2 }}>
                        {violation.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>
                        {violation.description}
                      </Text>
                    </Pressable>
                  );
                })}

                {/* Optional Additional Details */}
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 12, marginBottom: 6 }}>
                  Additional details (optional)
                </Text>
                <TextInput
                  value={additionalDetails}
                  onChangeText={setAdditionalDetails}
                  placeholder="Provide any additional context for moderators..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    color: "#111827",
                    textAlignVertical: "top",
                    minHeight: 70,
                    marginBottom: 20,
                  }}
                />

                {/* Submit Button */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!selectedViolation || submitting}
                  style={{
                    backgroundColor: selectedViolation && !submitting ? "#DC2626" : "#F3F4F6",
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: selectedViolation ? "#FFFFFF" : "#9CA3AF",
                      }}
                    >
                      Submit Report
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
