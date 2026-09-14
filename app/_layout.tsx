import "../global.css";

import { useEffect, useState } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { View, ActivityIndicator, Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { PresenceProvider } from "@/context/PresenceContext";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, accessToken, isLoading } = useAuth();
  const segments = useSegments() as string[];
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  // Check first-launch onboarding flag
  useEffect(() => {
    AsyncStorage.getItem("onboarding_done")
      .then((val) => {
        setHasSeenOnboarding(Boolean(val));
      })
      .catch(() => {
        setHasSeenOnboarding(true);
      });
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    // Expo Go (Android SDK 53+) explicitly disables expo-notifications.
    // Guarding the require prevents Expo Go from throwing an UnavailabilityError screen.
    const isExpoGo = Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";
    if (isExpoGo && Platform.OS === "android") {
      console.log("[PushNotifications] Expo Go (Android) active. Push notifications operate in dev builds & production APKs.");
      return;
    }

    try {
      const { registerForPushNotificationsAsync, setupNotificationListeners } = require("@/lib/pushNotifications");

      registerForPushNotificationsAsync(accessToken).catch((err: any) =>
        console.warn("Failed to register push token:", err)
      );

      const unsubscribe = setupNotificationListeners(accessToken, (conversationId: string) => {
        router.push({ pathname: "/pages/conversation", params: { conversationId, id: conversationId } } as any);
      });

      return () => {
        unsubscribe?.();
      };
    } catch (err) {
      console.warn("[PushNotifications] Could not load push notification listener:", err);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isLoading && hasSeenOnboarding !== null) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, hasSeenOnboarding]);

  useEffect(() => {
    if (isLoading || hasSeenOnboarding === null) return;

    const atRoot = segments.length === 0;

    const onAuthPages =
      segments[0] === "pages" &&
      (segments[1] === "onboarding" ||
        segments[1] === "landing" ||
        segments[1] === "select-email" ||
        segments[1] === "id-upload" ||
        segments[1] === "id-scan-front" ||
        segments[1] === "id-scan-back" ||
        segments[1] === "id-upload-success" ||
        segments[1] === "verify-otp" ||
        segments[1] === "login" ||
        segments[1] === "register" ||
        segments[1] === "forgot-password" ||
        segments.length === 1);

    const onPendingPage = segments[0] === "pages" && segments[1] === "pending-approval";
    const onRegisterPage = segments[0] === "pages" && segments[1] === "register";

    // ── 1. Device has session ──
    if (user) {
      // Mark onboarding as completed in storage so onboarding is never shown again
      AsyncStorage.setItem("onboarding_done", "1").catch(() => {});

      // Authenticated but profile incomplete (Steps 2-4 not yet done)
      const needsOnboarding = Boolean(!user.user_metadata?.onboarding_complete);
      if (needsOnboarding) {
        if (!onRegisterPage) {
          router.replace({
            pathname: "/pages/register" as any,
            params: { startStep: "2" },
          });
        }
        return;
      }

      // Profile complete but non-CHMSU pending admin approval
      const isPendingApproval = Boolean(
        user.user_metadata?.email_type === "external" &&
        !user.user_metadata?.is_approved
      );
      if (isPendingApproval) {
        if (!onPendingPage) {
          router.replace("/pages/pending-approval" as any);
        }
        return;
      }

      // Authenticated user approved but currently on pending page
      if (onPendingPage) {
        router.replace("/(tabs)");
        return;
      }

      // Fully authenticated, onboarded & approved:
      // If at root or on ANY auth/entry page (including onboarding, landing, login, etc.),
      // route directly to dashboard with no need to go to Get Started or Login!
      if (atRoot || onAuthPages) {
        router.replace("/(tabs)");
      }
      return;
    }

    // ── 2. Device has no session (unauthenticated) ──
    // First launch: onboarding not yet completed
    if (!hasSeenOnboarding) {
      if (atRoot || !onAuthPages) {
        router.replace("/pages/onboarding" as any);
      }
      return;
    }

    // Subsequent launches / unauthenticated:
    // If at root or attempting to access protected screens, route to login
    if (atRoot || !onAuthPages) {
      router.replace("/pages/login" as any);
      return;
    }
  }, [user, isLoading, segments, hasSeenOnboarding]);

  if (isLoading || hasSeenOnboarding === null) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade", }}>
      {/* Auth / onboarding flow */}
      <Stack.Screen name="pages/onboarding" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="pages/landing" options={{ headerShown: false }} />
      <Stack.Screen name="pages/select-email" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/id-upload" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/id-scan-front" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/id-scan-back" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/id-upload-success" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/verify-otp" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/login" options={{ headerShown: false }} />
      <Stack.Screen name="pages/register" options={{ headerShown: false }} />
      <Stack.Screen name="pages/forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="pages/pending-approval" options={{ headerShown: false }} />

      {/* Main app */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* App screens */}
      <Stack.Screen name="pages/conversation" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/post-detail" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/media-preview" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="pages/user-profile" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/requests" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/settings" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/edit-profile" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="pages/blocked-users" options={{ headerShown: false, animation: "slide_from_right" }} />

      {/* Modals */}
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_800ExtraBold,
} from "@expo-google-fonts/fraunces";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { NetworkProvider } from "@/context/NetworkContext";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,

    // Convenient Aliases
    Fraunces: Fraunces_700Bold,
    "Fraunces-Bold": Fraunces_700Bold,
    "Fraunces-ExtraBold": Fraunces_800ExtraBold,
    "Fraunces-SemiBold": Fraunces_600SemiBold,
    "Fraunces-Regular": Fraunces_400Regular,
    PlusJakartaSans: PlusJakartaSans_400Regular,
    "PlusJakartaSans-Bold": PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <NetworkProvider>
          <AuthProvider>
            <PresenceProvider>
              <RootLayoutNav />
            </PresenceProvider>
          </AuthProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}