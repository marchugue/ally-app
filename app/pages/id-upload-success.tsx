import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Image,
  StatusBar,
  Animated,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckCircle2,
  Lock,
  ChevronRight,
  AlertCircle,
  RotateCw,
  Maximize2,
  X,
} from "lucide-react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useAuth, ApiError } from "@/lib/auth/AuthContext";
import { uploadStudentIdFile } from "@/lib/api/media";

const { width: W } = Dimensions.get("window");
const GREEN = "#1A6B3C";

const DUAL_CARD_W = Math.round((W - 64) / 2);
const DUAL_CARD_H = Math.round(DUAL_CARD_W / 1.586);

const SINGLE_CARD_W = Math.min(Math.round(W * 0.76), 300);
const SINGLE_CARD_H = Math.round(SINGLE_CARD_W / 1.586);

function cleanUri(val: unknown): string {
  if (!val) return "";
  if (Array.isArray(val)) {
    for (let i = val.length - 1; i >= 0; i--) {
      if (typeof val[i] === "string" && val[i].trim().length > 0) {
        return val[i].trim();
      }
    }
    return "";
  }
  if (typeof val === "string") return val.trim();
  return String(val);
}

export default function IdUploadSuccessScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { signUp } = useAuth();

  // Extract clean string URIs
  const initialFront = cleanUri(params.frontUri || params.studentIdFrontUri);
  const initialBack = cleanUri(params.backUri || params.studentIdBackUri);

  const [frontUri, setFrontUri] = useState<string>(initialFront);
  const [backUri, setBackUri] = useState<string>(initialBack);
  const [isRotatingFront, setIsRotatingFront] = useState(false);
  const [isRotatingBack, setIsRotatingBack] = useState(false);
  const [enlargedUri, setEnlargedUri] = useState<{ uri: string; title: string } | null>(null);

  const username = (params.username as string) || "";
  const email = (params.email as string) || "";
  const password = (params.password as string) || "";
  const emailType = (params.emailType as "chmsu" | "external") || "external";

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Entrance animation
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRotateFront = async () => {
    if (!frontUri || isRotatingFront) return;
    setIsRotatingFront(true);
    try {
      const res = await manipulateAsync(
        frontUri,
        [{ rotate: 90 }],
        { compress: 0.88, format: SaveFormat.JPEG }
      );
      setFrontUri(res.uri);
    } catch (e) {
      console.warn("[IdUploadSuccess] rotate front error:", e);
    } finally {
      setIsRotatingFront(false);
    }
  };

  const handleRotateBack = async () => {
    if (!backUri || isRotatingBack) return;
    setIsRotatingBack(true);
    try {
      const res = await manipulateAsync(
        backUri,
        [{ rotate: 90 }],
        { compress: 0.88, format: SaveFormat.JPEG }
      );
      setBackUri(res.uri);
    } catch (e) {
      console.warn("[IdUploadSuccess] rotate back error:", e);
    } finally {
      setIsRotatingBack(false);
    }
  };

  const handleContinue = async () => {
    if (isRegistering) return;
    setIsRegistering(true);
    setRegisterError("");

    try {
      // Create the account now that IDs are captured
      const result = await signUp({
        email,
        password,
        username: username.toLowerCase(),
        email_type: emailType,
        interests: [],
        organizations: [],
      });

      const userId = result.userId;

      // Upload ID files in background
      if (frontUri) {
        uploadStudentIdFile(userId, frontUri, "front").catch((e) =>
          console.warn("[IdUploadSuccess] front upload error:", e)
        );
      }
      if (backUri) {
        uploadStudentIdFile(userId, backUri, "back").catch((e) =>
          console.warn("[IdUploadSuccess] back upload error:", e)
        );
      }

      // Navigate to standalone OTP verification
      router.replace({
        pathname: "/pages/verify-otp" as any,
        params: {
          userId,
          email,
          studentIdFrontUri: frontUri,
          studentIdBackUri: backUri,
          idUploadCompleted: "1",
        },
      });
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err?.message || "Registration failed. Please try again.";
      setRegisterError(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const hasBack = Boolean(backUri);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={[styles.animContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Top Success Badge */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconCircleBg}>
              <CheckCircle2 size={44} color={GREEN} />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>ID Successfully Uploaded!</Text>
          <Text style={styles.subtitle}>
            {hasBack
              ? "Both sides of your Student ID have been captured and framed for verification."
              : "Your Student ID has been captured and framed for verification."}
          </Text>

          {/* ID Previews Section */}
          {hasBack ? (
            /* Dual cards: Front and Back side-by-side */
            <View style={styles.previewsRow}>
              {/* Front Card */}
              <View style={[styles.cardBlock, { width: DUAL_CARD_W }]}>
                <Pressable
                  style={[styles.cardFrame, { width: DUAL_CARD_W, height: DUAL_CARD_H }]}
                  onPress={() => frontUri && setEnlargedUri({ uri: frontUri, title: "Front of ID" })}
                  accessibilityLabel="Enlarge front ID"
                >
                  {frontUri ? (
                    <Image source={{ uri: frontUri }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.placeholderBg} />
                  )}
                  <View style={styles.enlargeOverlayIcon}>
                    <Maximize2 size={13} color="#fff" />
                  </View>
                </Pressable>

                <View style={styles.cardMetaRow}>
                  <View style={styles.previewLabelBadge}>
                    <CheckCircle2 size={12} color={GREEN} />
                    <Text style={styles.previewLabelText}>Front</Text>
                  </View>
                  <Pressable
                    style={styles.rotateIconBtn}
                    onPress={handleRotateFront}
                    hitSlop={8}
                    disabled={isRotatingFront}
                    accessibilityLabel="Rotate front ID 90 degrees"
                  >
                    <RotateCw size={14} color="#4B5563" />
                  </Pressable>
                </View>
              </View>

              {/* Back Card */}
              <View style={[styles.cardBlock, { width: DUAL_CARD_W }]}>
                <Pressable
                  style={[styles.cardFrame, { width: DUAL_CARD_W, height: DUAL_CARD_H }]}
                  onPress={() => backUri && setEnlargedUri({ uri: backUri, title: "Back of ID" })}
                  accessibilityLabel="Enlarge back ID"
                >
                  {backUri ? (
                    <Image source={{ uri: backUri }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.placeholderBg} />
                  )}
                  <View style={styles.enlargeOverlayIcon}>
                    <Maximize2 size={13} color="#fff" />
                  </View>
                </Pressable>

                <View style={styles.cardMetaRow}>
                  <View style={styles.previewLabelBadge}>
                    <CheckCircle2 size={12} color={GREEN} />
                    <Text style={styles.previewLabelText}>Back</Text>
                  </View>
                  <Pressable
                    style={styles.rotateIconBtn}
                    onPress={handleRotateBack}
                    hitSlop={8}
                    disabled={isRotatingBack}
                    accessibilityLabel="Rotate back ID 90 degrees"
                  >
                    <RotateCw size={14} color="#4B5563" />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            /* Single centered card when back was skipped */
            <View style={styles.singleCardWrapper}>
              <View style={[styles.cardBlock, { width: SINGLE_CARD_W }]}>
                <Pressable
                  style={[styles.cardFrame, { width: SINGLE_CARD_W, height: SINGLE_CARD_H }]}
                  onPress={() => frontUri && setEnlargedUri({ uri: frontUri, title: "Front of ID" })}
                  accessibilityLabel="Enlarge front ID"
                >
                  {frontUri ? (
                    <Image source={{ uri: frontUri }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.placeholderBg} />
                  )}
                  <View style={styles.enlargeOverlayIcon}>
                    <Maximize2 size={15} color="#fff" />
                  </View>
                </Pressable>

                <View style={styles.cardMetaRow}>
                  <View style={styles.previewLabelBadge}>
                    <CheckCircle2 size={13} color={GREEN} />
                    <Text style={styles.previewLabelText}>Front Side</Text>
                  </View>
                  <Pressable
                    style={styles.rotateIconBtn}
                    onPress={handleRotateFront}
                    hitSlop={8}
                    disabled={isRotatingFront}
                    accessibilityLabel="Rotate front ID 90 degrees"
                  >
                    <RotateCw size={15} color="#4B5563" />
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* What happens next */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>What's next?</Text>
            <Text style={styles.nextStepsBody}>
              We'll send a verification code to your email. An admin will also review your ID for campus enrollment confirmation.
            </Text>
          </View>

          {/* Security reminder */}
          <View style={styles.securityBox}>
            <Lock size={15} color="#6B7280" />
            <Text style={styles.securityText}>
              Your ID is encrypted and stored solely for campus enrollment verification. Never shared publicly.
            </Text>
          </View>

          {/* Error */}
          {registerError ? (
            <View style={styles.errorBox}>
              <AlertCircle size={15} color="#EF4444" />
              <Text style={styles.errorText}>{registerError}</Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Bottom CTA Button */}
      <View style={styles.bottomCtaArea}>
        <Pressable
          style={[styles.continueBtn, isRegistering && { opacity: 0.75 }]}
          onPress={handleContinue}
          disabled={isRegistering}
        >
          {isRegistering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueBtnText}>Continue to Verification</Text>
              <ChevronRight size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </View>

      {/* Full-screen Image Preview Modal */}
      <Modal visible={Boolean(enlargedUri)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>{enlargedUri?.title}</Text>
            <Pressable onPress={() => setEnlargedUri(null)} style={styles.modalCloseBtn} hitSlop={14}>
              <X size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.modalImageContainer}>
            {enlargedUri?.uri ? (
              <Image
                source={{ uri: enlargedUri.uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: "center",
  },
  animContainer: {
    width: "100%",
    alignItems: "center",
  },
  iconWrapper: {
    marginBottom: 16,
  },
  iconCircleBg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 20,
  },
  // Dual cards layout
  previewsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
    justifyContent: "center",
    width: "100%",
  },
  // Single card layout
  singleCardWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  cardBlock: {
    alignItems: "center",
    gap: 8,
  },
  cardFrame: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#BBF7D0",
    backgroundColor: "#111827",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#E5E7EB",
  },
  enlargeOverlayIcon: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 4,
    borderRadius: 6,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewLabelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  previewLabelText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },
  rotateIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nextStepsCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  nextStepsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  nextStepsBody: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
  },
  securityBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(107,114,128,0.07)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.13)",
    marginBottom: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    width: "100%",
    marginTop: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#EF4444",
    lineHeight: 16,
  },
  bottomCtaArea: {
    width: "100%",
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 50,
    paddingVertical: 15,
    width: "100%",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalImageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
});
