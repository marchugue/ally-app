import "../global.css";

import { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { View, ActivityIndicator, Platform } from "react-native";
import Constants from "expo-constants";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { PresenceProvider } from "@/context/PresenceContext";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, accessToken, isLoading } = useAuth();
  const segments = useSegments() as string[];

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
        router.push({ pathname: "/pages/conversation", params: { id: conversationId } } as any);
      });

      return () => {
        unsubscribe?.();
      };
    } catch (err) {
      console.warn("[PushNotifications] Could not load push notification listener:", err);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isLoading) return;

    const onAuthPages =
    segments[0] === "pages" &&
    (segments[1] === "landing" ||
      segments[1] === "login" ||
      segments[1] === "register" ||
      segments[1] === "forgot-password" ||
      segments.length === 1);

    const onPendingPage = segments[0] === "pages" && segments[1] === "pending-approval";

    // Is the user a non-CHMSU student waiting for admin approval?
    const isPendingApproval = Boolean(
      user?.user_metadata?.pending_student_verification &&
      user?.user_metadata?.student_verification_status !== 'approved'
    );

    // If user lands at root with no auth: go to landing
    const atRoot = segments.length === 0;

    if (!user && !onAuthPages && !atRoot) {
      router.replace("/pages/landing" as any);
    } else if (!user && atRoot) {
      router.replace("/pages/landing" as any);
    } else if (user && isPendingApproval && !onPendingPage) {
      // Non-CHMSU student, ID pending review — lock to pending-approval screen
      router.replace("/pages/pending-approval" as any);
    } else if (user && !isPendingApproval && onPendingPage) {
      // Already approved — push them back to main tabs
      router.replace("/(tabs)");
    } else if (user && onAuthPages) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade",  }}>
      {/* Auth / onboarding flow */}
      <Stack.Screen name="pages/landing" options={{ headerShown: false }} />
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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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