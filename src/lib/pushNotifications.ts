import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { updatePushToken } from "./api/profiles";
import { markConversationRead, sendMessage } from "./api/conversation";

const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

export async function registerMessageNotificationCategory(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if (Notifications && typeof Notifications.setNotificationCategoryAsync === "function") {
      await Notifications.setNotificationCategoryAsync("message_actions", [
        {
          identifier: "reply",
          buttonTitle: "Reply",
          textInput: {
            submitButtonTitle: "Send",
            placeholder: "Type a reply...",
          },
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: "mark_as_read",
          buttonTitle: "Mark as Read",
          options: {
            opensAppToForeground: false,
          },
        },
      ]);
      console.log("[PushNotifications] Notification category 'message_actions' registered with Reply button.");
    }
  } catch (e) {
    console.warn("[PushNotifications] Could not set notification category:", e);
  }
}

// Configure notification handler & actions category safely
function initNotificationHandler() {
  if (Platform.OS === "web") return;
  try {
    if (Notifications && typeof Notifications.setNotificationHandler === "function") {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      registerMessageNotificationCategory().catch(() => null);
    }
  } catch (e) {
    console.warn("[PushNotifications] Could not set notification handler or category:", e);
  }
}

try {
  initNotificationHandler();
} catch (e) {
  // Defensive check to avoid top-level load errors in Expo Go or Web
}

/**
 * Registers for native push notifications and sends the Expo Push Token to the backend.
 */
export async function registerForPushNotificationsAsync(accessToken: string): Promise<string | null> {
  if (Platform.OS === "web" || isExpoGo) {
    console.log(
      "[PushNotifications] Expo Go or Web platform detected. Push notifications are active in standalone / APK builds."
    );
    return null;
  }

  if (!Notifications || typeof Notifications.getPermissionsAsync !== "function") {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[PushNotifications] Permission not granted for push notifications.");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Ally Messages",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1F663C",
      }).catch(() => null);
    }

    await registerMessageNotificationCategory().catch(() => null);

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData?.data;
    console.log("[PushNotifications] Expo push token retrieved:", token);

    if (token) {
      await updatePushToken(token, accessToken);
    }

    return token;
  } catch (error: any) {
    console.warn("[PushNotifications] Failed to get push token:", error?.message || error);
    return null;
  }
}

/**
 * Sets up notification listeners for incoming messages, notification actions (Mark as Read, Reply), and taps.
 */
export function setupNotificationListeners(
  accessToken: string | null,
  onNavigateToConversation?: (conversationId: string) => void
) {
  if (Platform.OS === "web" || isExpoGo) {
    return () => {};
  }

  if (!Notifications || typeof Notifications.addNotificationResponseReceivedListener !== "function") {
    return () => {};
  }

  try {
    registerMessageNotificationCategory().catch(() => null);

    const defaultActionId = Notifications.DEFAULT_ACTION_IDENTIFIER;
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionIdentifier = response.actionIdentifier;
        const data = response.notification?.request?.content?.data;
        const conversationId = data?.conversationId as string | undefined;

        if (!conversationId) return;

        // 1. "Mark as Read" action tapped directly on notification banner
        if (actionIdentifier === "mark_as_read") {
          if (accessToken) {
            try {
              await markConversationRead(conversationId, new Date().toISOString(), accessToken);
              console.log(`[PushNotifications] Conversation ${conversationId} marked as read via notification action.`);
            } catch (err) {
              console.warn("[PushNotifications] Failed to mark as read from notification:", err);
            }
          }
          return;
        }

        // 2. "Reply" action with inline text input directly on notification banner
        if (actionIdentifier === "reply") {
          const userText =
            (response as any)?.userText ||
            (response as any)?.text ||
            (response as any)?.notification?.request?.content?.data?.userText;

          if (userText && typeof userText === "string" && userText.trim() && accessToken) {
            try {
              await sendMessage(conversationId, { content: userText.trim() }, accessToken);
              await markConversationRead(conversationId, new Date().toISOString(), accessToken);
              console.log(`[PushNotifications] Sent quick reply & marked conversation ${conversationId} as read.`);
            } catch (err) {
              console.warn("[PushNotifications] Failed to send quick reply from notification:", err);
            }
          } else {
            // Action tapped to reply without inline text or opened to foreground
            if (accessToken) {
              markConversationRead(conversationId, new Date().toISOString(), accessToken).catch(() => null);
            }
            if (onNavigateToConversation) {
              onNavigateToConversation(conversationId);
            }
          }
          return;
        }

        // 3. Default notification tap (opens full conversation screen & marks read)
        if (actionIdentifier === defaultActionId) {
          if (accessToken) {
            markConversationRead(conversationId, new Date().toISOString(), accessToken).catch(() => null);
          }
          if (onNavigateToConversation) {
            onNavigateToConversation(conversationId);
          }
        }
      }
    );

    return () => {
      responseSubscription?.remove();
    };
  } catch (e) {
    console.warn("[PushNotifications] Could not attach response listener:", e);
    return () => {};
  }
}
