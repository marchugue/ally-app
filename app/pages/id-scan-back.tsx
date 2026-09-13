import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { ArrowLeft, Camera, ImageIcon, RefreshCw, Check, RotateCw } from "lucide-react-native";
import { cropToGuideAndMakeLandscape, ensureLandscape } from "@/lib/cameraCrop";

const { width: W, height: H } = Dimensions.get("window");
const GREEN = "#1A6B3C";

// ── Guide overlay dimensions (viewfinder) ────────────────────────────────────
// When phone is in portrait mode:
// The rectangle sides (height) are higher than the upper and lower side (width),
// framing a landscape ID oriented vertically on portrait screens.
const MAX_GUIDE_H = Math.round(H * 0.54);
const GUIDE_H = Math.min(Math.round(W * 0.72 * 1.586), MAX_GUIDE_H);
const GUIDE_W = Math.round(GUIDE_H / 1.586);
const GUIDE_TOP = Math.round((H - GUIDE_H) / 2 - 25);
const GUIDE_LEFT = Math.round((W - GUIDE_W) / 2);

// ── Landscape format preview card dimensions (after capture) ─────────────────
// The captured ID is displayed and saved in true landscape format (width > height).
const PREVIEW_CARD_W = Math.round(W * 0.88);
const PREVIEW_CARD_H = Math.round(PREVIEW_CARD_W / 1.586);

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

export default function IdScanBackScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const frontUri = cleanUri(params.frontUri || params.studentIdFrontUri);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [facing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        skipProcessing: false,
      });
      if (photo?.uri) {
        const croppedLandscapeUri = await cropToGuideAndMakeLandscape(
          photo.uri,
          W,
          H,
          {
            left: GUIDE_LEFT,
            top: GUIDE_TOP,
            width: GUIDE_W,
            height: GUIDE_H,
          }
        );
        setCapturedUri(croppedLandscapeUri);
      }
    } catch (err) {
      console.warn("[IdScanBack] capture error:", err);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleUploadFromGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1586, 1000],
        quality: 0.88,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const landscapeUri = await ensureLandscape(res.assets[0].uri);
        setCapturedUri(landscapeUri);
      }
    } catch (err) {
      console.warn("[IdScanBack] gallery error:", err);
    }
  };

  const handleRotate = async () => {
    if (!capturedUri) return;
    try {
      const manipulated = await manipulateAsync(
        capturedUri,
        [{ rotate: 90 }],
        { compress: 0.88, format: SaveFormat.JPEG }
      );
      setCapturedUri(manipulated.uri);
    } catch (err) {
      console.warn("[handleRotate] error:", err);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
  };

  const handleUseThis = () => {
    // Navigate directly to id-upload-success with captured back image
    router.replace({
      pathname: "/pages/id-upload-success" as any,
      params: {
        ...params,
        frontUri,
        backUri: capturedUri,
      },
    });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({
        pathname: "/pages/id-upload" as any,
        params: { ...params, frontUri, step: "back" },
      });
    }
  };

  // ── Permission pending / denied ─────────────────────────────────────────────
  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Camera size={52} color="#fff" style={{ marginBottom: 16 }} />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permBody}>
          Grant camera access to scan the back of your Student ID, or upload from gallery.
        </Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </Pressable>
        <Pressable style={[styles.permBtn, styles.permBtnSecondary]} onPress={handleUploadFromGallery}>
          <ImageIcon size={18} color={GREEN} style={{ marginRight: 8 }} />
          <Text style={[styles.permBtnText, { color: GREEN }]}>Upload from Gallery</Text>
        </Pressable>
        <Pressable style={styles.backBtnPermScreen} onPress={handleBack} hitSlop={12}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
      </View>
    );
  }

  // ── Preview mode ─────────────────────────────────────────────────────────────
  if (capturedUri) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={20} />
        <View style={styles.previewOverlay} />

        {/* Top bar with reminder on top */}
        <View style={[styles.topBarPreview, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topBarRow}>
            <Pressable onPress={handleRetake} style={styles.iconBtn} hitSlop={12}>
              <ArrowLeft size={24} color="#fff" />
            </Pressable>
            <Text style={styles.topBarTitle}>Back of ID</Text>
            <Pressable onPress={handleRotate} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Rotate image">
              <RotateCw size={20} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.topReminderText}>
            Check your image. Make sure text and barcode are clearly visible.
          </Text>
        </View>

        {/* Preview card in landscape format */}
        <View style={styles.previewCard}>
          <Image source={{ uri: capturedUri }} style={styles.previewImgLandscape} resizeMode="cover" />
        </View>

        {/* Bottom actions: only retry and confirm */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.previewActions}>
            <Pressable style={styles.retakeBtn} onPress={handleRetake}>
              <RefreshCw size={18} color="#fff" />
              <Text style={styles.retakeBtnText}>Retry</Text>
            </Pressable>
            <Pressable style={styles.useThisBtn} onPress={handleUseThis}>
              <Check size={18} color="#fff" />
              <Text style={styles.useThisBtnText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Camera viewfinder ───────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <CameraView ref={cameraRef}     style={StyleSheet.absoluteFill} facing={facing} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleBack} style={styles.iconBtn} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={styles.topBarTitle}>Scan Back of ID</Text>
        <Pressable
          onPress={() => {
            router.replace({
              pathname: "/pages/id-upload-success" as any,
              params: {
                ...params,
                frontUri,
                backUri: "",
              },
            });
          }}
          style={styles.skipTopBtn}
          hitSlop={12}
        >
          <Text style={styles.skipTopBtnText}>Skip</Text>
        </Pressable>
      </View>

      {/* Overlay strips */}
      <View style={[styles.overlayStrip, { top: 0, left: 0, right: 0, height: GUIDE_TOP }]} />
      <View style={[styles.overlayStrip, { top: GUIDE_TOP + GUIDE_H, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.overlayStrip, { top: GUIDE_TOP, left: 0, width: (W - GUIDE_W) / 2, height: GUIDE_H }]} />
      <View style={[styles.overlayStrip, { top: GUIDE_TOP, right: 0, width: (W - GUIDE_W) / 2, height: GUIDE_H }]} />

      {/* Guide border */}
      <View
        style={[
          styles.guideRect,
          { top: GUIDE_TOP, left: (W - GUIDE_W) / 2, width: GUIDE_W, height: GUIDE_H },
        ]}
      >
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      <Text style={[styles.guideLabel, { top: GUIDE_TOP + GUIDE_H + 16 }]}>
        Place the back of your Student ID inside the frame
      </Text>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 32) }]}>
        <Pressable style={styles.uploadBtn} onPress={handleUploadFromGallery}>
          <ImageIcon size={20} color="#fff" />
          <Text style={styles.uploadBtnText}>Upload Photo</Text>
        </Pressable>

        <Pressable
          style={[styles.shutterOuter, isCapturing && { opacity: 0.6 }]}
          onPress={handleCapture}
          disabled={isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        <View style={{ width: 80 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  permRoot: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  permTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 10, textAlign: "center" },
  permBody: { fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 20, marginBottom: 28 },
  permBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN,
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginBottom: 12,
    width: "100%",
    justifyContent: "center",
  },
  permBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  permBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  backBtnPermScreen: {
    position: "absolute",
    top: 56,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topBarTitle: { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0.2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarPreview: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
    alignItems: "center",
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  topReminderText: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
    fontWeight: "500",
  },
  overlayStrip: { position: "absolute", backgroundColor: "rgba(0,0,0,0.58)", zIndex: 2 },
  guideRect: { position: "absolute", borderRadius: 12, zIndex: 3 },
  corner: { position: "absolute", width: 24, height: 24, borderColor: GREEN, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  guideLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "500",
    zIndex: 4,
    letterSpacing: 0.2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  uploadBtn: { width: 80, alignItems: "center", gap: 6 },
  uploadBtnText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "600", textAlign: "center" },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff" },
  previewOverlay: {     ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  previewCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewImg: {
    width: GUIDE_W,
    height: GUIDE_H,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GREEN,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  previewImgLandscape: {
    width: PREVIEW_CARD_W,
    height: PREVIEW_CARD_H,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: GREEN,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  previewActions: { flexDirection: "row", gap: 14, width: "100%", justifyContent: "center" },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 50,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  retakeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  useThisBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 50,
    paddingVertical: 14,
  },
  useThisBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  skipTopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipTopBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
