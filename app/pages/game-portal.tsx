import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Linking,
  BackHandler,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  Gamepad2,
  CircleAlert,
  Sparkles,
  Info,
} from "lucide-react-native";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Safely resolve WebView component at runtime without crashing if
 * RNCWebViewModule native binary is missing from the installed APK.
 */
function getNativeWebView() {
  try {
    // Dynamic require so TurboModuleRegistry does not throw at bundle load
    const lib = require("react-native-webview");
    return lib.WebView || lib.default || null;
  } catch (err) {
    return null;
  }
}

function resolveGamePortalUrl(token?: string | null): string {
  // 1. Explicit env variable
  let baseUrl = process.env.EXPO_PUBLIC_GAME_URL;

  // 2. Production detection
  if (!baseUrl) {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
    if (
      apiUrl.includes("railway.app") ||
      apiUrl.includes("ally-jis.com") ||
      apiUrl.includes("ally-jis.xyz") ||
      !__DEV__
    ) {
      baseUrl = "https://game.ally-jis.com";
    }
  }

  // 3. Auto-detect host IP from Expo bundler if testing over LAN/Wi-Fi
  if (!baseUrl) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).debuggerHost;
    if (hostUri && typeof hostUri === "string") {
      const hostIp = hostUri.split(":")[0];
      if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
        baseUrl = `http://${hostIp}:5174`;
      }
    }
  }

  // 4. Default: localhost on port 5174 (runs via `run-local-game.sh` and `adb reverse tcp:5174 tcp:5174`)
  if (!baseUrl) {
    baseUrl = "http://localhost:5174";
  }

  if (token) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
  }
  return baseUrl;
}

export default function GamePortalScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, user } = useAuth();
  const webViewRef = useRef<any>(null);

  // Safely resolve native WebView module
  const WebViewComponent = useMemo(() => getNativeWebView(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [progress, setProgress] = useState(0);

  const gameUrl = useMemo(
    () => resolveGamePortalUrl(accessToken),
    [accessToken]
  );

  // Injected JavaScript to ensure session is stored in localStorage before page scripts mount
  const injectedJavaScriptBeforeContentLoaded = useMemo(() => {
    if (!accessToken) return undefined;
    return `
      try {
        localStorage.setItem('allyjis-auth-token', ${JSON.stringify(accessToken)});
        localStorage.setItem('ally_auth_token', ${JSON.stringify(accessToken)});
        localStorage.setItem('ally_game_token', ${JSON.stringify(accessToken)});
      } catch (e) {}
      true;
    `;
  }, [accessToken]);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [canGoBack]);

  const handleOpenBrowser = async () => {
    try {
      await Linking.openURL(gameUrl);
    } catch (err: any) {
      console.warn("Could not open external browser:", err);
    }
  };

  const handleReload = () => {
    setHasError(false);
    setErrorMessage(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#121212", paddingTop: insets.top }}>
      {/* ═══ Header Bar ═══ */}
      <View
        style={{
          height: 52,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#181818",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.08)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => {
              if (canGoBack && webViewRef.current) {
                webViewRef.current.goBack();
              } else {
                router.back();
              }
            }}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: "#F59E0B",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Gamepad2 size={16} color="#FFFFFF" />
            </View>
            <Text
              style={{
                fontFamily: "Fraunces-Bold",
                fontSize: 15,
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              Game Portal
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {WebViewComponent && (
            <Pressable
              onPress={handleReload}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RotateCcw size={16} color="#D1D5DB" />
            </Pressable>
          )}

          <Pressable
            onPress={handleOpenBrowser}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ExternalLink size={16} color="#D1D5DB" />
          </Pressable>
        </View>
      </View>

      {/* ═══ Fallback Screen if RNCWebViewModule is not linked in current APK ═══ */}
      {!WebViewComponent ? (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#121212",
          }}
        >
          {/* Gamepad Glow Icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              borderWidth: 1.5,
              borderColor: "rgba(245, 158, 11, 0.35)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Gamepad2 size={40} color="#F59E0B" />
          </View>

          <Text
            style={{
              fontFamily: "Fraunces-Bold",
              fontSize: 22,
              fontWeight: "700",
              color: "#FFFFFF",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            ALLY-JIS Game Portal
          </Text>

          <Text
            style={{
              fontFamily: "PlusJakartaSans",
              fontSize: 13,
              color: "#9CA3AF",
              textAlign: "center",
              lineHeight: 20,
              maxWidth: 320,
              marginBottom: 24,
            }}
          >
            Play campus games with CHMSU friends! Your mobile session is pre-authenticated and synced automatically.
          </Text>

          {/* Big Launch in Browser Button */}
          <Pressable
            onPress={handleOpenBrowser}
            style={{
              width: "100%",
              maxWidth: 320,
              backgroundColor: "#1A6B3C",
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              shadowColor: "#1A6B3C",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
              marginBottom: 20,
            }}
          >
            <Sparkles size={16} color="#FFFFFF" />
            <Text
              style={{
                fontFamily: "PlusJakartaSans",
                fontSize: 14,
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              Open Game Portal
            </Text>
            <ExternalLink size={15} color="#FFFFFF" />
          </Pressable>

          {/* Dev Notice Card */}
          <View
            style={{
              width: "100%",
              maxWidth: 320,
              backgroundColor: "#1E1E1E",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Info size={16} color="#F59E0B" />
              <Text
                style={{
                  fontFamily: "PlusJakartaSans",
                  fontSize: 12,
                  fontWeight: "700",
                  color: "#F59E0B",
                }}
              >
                In-App WebView Note
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "PlusJakartaSans",
                fontSize: 11,
                color: "#9CA3AF",
                lineHeight: 16,
              }}
            >
              Your currently installed development APK was compiled before `react-native-webview` was added. Rebuilding your development APK (`eas build --platform android --profile development`) will enable the embedded in-app browser!
            </Text>
          </View>
        </ScrollView>
      ) : (
        /* ═══ In-App Native WebView Component (When binary has RNCWebViewModule) ═══ */
        <View style={{ flex: 1, position: "relative" }}>
          {isLoading && (
            <View style={{ height: 2, backgroundColor: "rgba(255, 255, 255, 0.1)" }}>
              <View
                style={{
                  height: "100%",
                  width: `${Math.max(10, Math.min(progress * 100, 100))}%`,
                  backgroundColor: "#10B981",
                }}
              />
            </View>
          )}

          <WebViewComponent
            ref={webViewRef}
            source={{ uri: gameUrl }}
            style={{ flex: 1, backgroundColor: "#121212" }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={["*"]}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
            injectedJavaScript={injectedJavaScriptBeforeContentLoaded}
            onNavigationStateChange={(navState: any) => {
              setCanGoBack(navState.canGoBack);
            }}
            onLoadProgress={({ nativeEvent }: any) => {
              setProgress(nativeEvent.progress);
              if (nativeEvent.progress >= 1) {
                setIsLoading(false);
              }
            }}
            onLoadStart={() => {
              setIsLoading(true);
              setHasError(false);
            }}
            onLoadEnd={() => {
              setIsLoading(false);
            }}
            onError={(syntheticEvent: any) => {
              const { nativeEvent } = syntheticEvent;
              setHasError(true);
              setIsLoading(false);
              setErrorMessage(nativeEvent.description || "Failed to load game portal.");
            }}
            renderLoading={() => (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "#121212",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <ActivityIndicator size="large" color="#10B981" />
                <Text
                  style={{
                    fontFamily: "PlusJakartaSans",
                    fontSize: 13,
                    color: "#9CA3AF",
                  }}
                >
                  Loading ALLY-JIS Game Portal...
                </Text>
              </View>
            )}
          />

          {/* ═══ Error / Offline View Fallback ═══ */}
          {hasError && (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "#121212",
                padding: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <CircleAlert size={32} color="#F59E0B" />
              </View>

              <Text
                style={{
                  fontFamily: "Fraunces-Bold",
                  fontSize: 20,
                  fontWeight: "700",
                  color: "#FFFFFF",
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Unable to load Game Portal
              </Text>

              <Text
                style={{
                  fontFamily: "PlusJakartaSans",
                  fontSize: 13,
                  color: "#9CA3AF",
                  textAlign: "center",
                  marginBottom: 20,
                  lineHeight: 18,
                  maxWidth: 300,
                }}
              >
                {errorMessage ||
                  "Make sure your game portal is running on port 5174 or start it with ./run-local-game.sh."}
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={handleReload}
                  style={{
                    backgroundColor: "#1A6B3C",
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RotateCcw size={16} color="#FFFFFF" />
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    Retry Connection
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleOpenBrowser}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ExternalLink size={16} color="#FFFFFF" />
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    Browser
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
