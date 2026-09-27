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

let activeConversationId: string | null = null;

export function setActiveConversationId(convId: string | null): void {
  activeConversationId = convId;
}

// Configure notification handler & actions category safely
function initNotificationHandler() {
  if (Platform.OS === "web") return;
  try {
    if (Notifications && typeof Notifications.setNotificationHandler === "function") {
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const data = notification.request?.content?.data;
          const convId = data?.conversationId as string | undefined;

          // If the user currently has this exact conversation open on screen, suppress tray banner
          if (convId && activeConversationId === convId) {
            return {
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: false,
              shouldShowList: false,
            };
          }

          return {
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        },
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
        showBadge: true,
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
    const errorMsg = error?.message || String(error);
    if (
      errorMsg.includes("Default FirebaseApp is not initialized") ||
      errorMsg.includes("googleServicesFile")
    ) {
      console.log(
        "[PushNotifications] Firebase (google-services.json) not configured for Android dev build. Push notifications will be disabled in local dev."
      );
    } else {
      console.warn("[PushNotifications] Failed to get push token:", errorMsg);
    }
    return null;
  }
}

/**
 * Sets the app icon badge count (0 removes the badge).
 */
export async function setAppBadgeCount(count: number): Promise<void> {
  if (Platform.OS === "web" || isExpoGo) return;
  try {
    if (Notifications && typeof Notifications.setBadgeCountAsync === "function") {
      await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(count)));
    }
  } catch (e) {
    console.warn("[PushNotifications] Could not set badge count:", e);
  }
}

/**
 * Clears the app icon badge count.
 */
export async function clearAppBadgeCount(): Promise<void> {
  return setAppBadgeCount(0);
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
          if (Notifications && typeof Notifications.getBadgeCountAsync === "function") {
            Notifications.getBadgeCountAsync().then((count) => {
              setAppBadgeCount(Math.max(0, count - 1));
            }).catch(() => null);
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
          if (Notifications && typeof Notifications.getBadgeCountAsync === "function") {
            Notifications.getBadgeCountAsync().then((count) => {
              setAppBadgeCount(Math.max(0, count - 1));
            }).catch(() => null);
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
          if (Notifications && typeof Notifications.getBadgeCountAsync === "function") {
            Notifications.getBadgeCountAsync().then((count) => {
              setAppBadgeCount(Math.max(0, count - 1));
            }).catch(() => null);
          }
        }
      }
    );

    const receivedSubscription = typeof Notifications.addNotificationReceivedListener === "function"
      ? Notifications.addNotificationReceivedListener(async (notification) => {
          const data = notification.request?.content?.data;
          const conversationId = data?.conversationId as string | undefined;
          const senderId = data?.senderId as string | undefined;
          const currentId = notification.request?.identifier;

          if (!conversationId && !senderId) return;

          // If the user currently has this exact conversation open, clear the incoming tray notification immediately
          if (conversationId && activeConversationId === conversationId) {
            if (currentId && typeof Notifications.dismissNotificationAsync === "function") {
              await Notifications.dismissNotificationAsync(currentId).catch(() => null);
            }
            return;
          }

          // Proactively prune any older notifications for the same user or conversation
          // so only the newest, updated notification card remains in the tray!
          try {
            if (typeof Notifications.getPresentedNotificationsAsync === "function") {
              const presented = await Notifications.getPresentedNotificationsAsync();
              for (const item of presented) {
                if (item.request?.identifier !== currentId) {
                  const itemData = item.request?.content?.data;
                  const itemId = item.request?.identifier || "";
                  const matchesConv = conversationId && (itemData?.conversationId === conversationId || itemId.includes(conversationId));
                  const matchesSender = senderId && (itemData?.senderId === senderId || itemId.includes(senderId));
                  if (matchesConv || matchesSender) {
                    if (typeof Notifications.dismissNotificationAsync === "function") {
                      await Notifications.dismissNotificationAsync(item.request.identifier).catch(() => null);
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.warn("[PushNotifications] Could not prune older notification for same user:", err);
          }
        })
      : null;

    return () => {
      responseSubscription?.remove();
      receivedSubscription?.remove();
    };
  } catch (e) {
    console.warn("[PushNotifications] Could not attach response listener:", e);
    return () => {};
  }
}

/**
 * Automatically clears presented notifications from the device notification tray
 * for a specific conversation or user when the user opens the chat (Facebook/Messenger style).
 */
export async function dismissPresentedNotificationByConversationId(conversationId: string, senderId?: string): Promise<void> {
  if (Platform.OS === "web" || isExpoGo) return;
  try {
    if (!Notifications || typeof Notifications.getPresentedNotificationsAsync !== "function") return;
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notif of presented) {
      const data = notif.request?.content?.data;
      const notifId = notif.request?.identifier || "";
      const matchesConv =
        data?.conversationId === conversationId ||
        data?.targetId === conversationId ||
        notifId === `conv_${conversationId}` ||
        notifId === conversationId ||
        notifId.includes(conversationId);
      const matchesSender =
        Boolean(senderId && (data?.senderId === senderId || notifId === `user_${senderId}` || notifId.includes(senderId)));
      const matchesTag =
        Boolean(typeof data?.tag === "string" && (data.tag.includes(conversationId) || (senderId && data.tag.includes(senderId))));

      if (matchesConv || matchesSender || matchesTag) {
        if (typeof Notifications.dismissNotificationAsync === "function") {
          await Notifications.dismissNotificationAsync(notif.request.identifier);
        }
      }
    }
  } catch (e) {
    console.warn("[PushNotifications] Could not dismiss notification by conversationId:", e);
  }
}

/**
 * Automatically clears presented notifications from the device notification tray
 * for a specific category or target (e.g. 'connections', 'ally', 'safety').
 */
export async function dismissPresentedNotificationsByCategory(category?: string, targetId?: string): Promise<void> {
  if (Platform.OS === "web" || isExpoGo) return;
  try {
    if (!Notifications || typeof Notifications.getPresentedNotificationsAsync !== "function") return;
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notif of presented) {
      const data = notif.request?.content?.data;
      const notifCategory = data?.category;
      const notifTarget = data?.targetId;

      const matchesCategory = category && (notifCategory === category || notif.request?.identifier?.startsWith(`${category}_`));
      const matchesTarget = targetId && (notifTarget === targetId || data?.conversationId === targetId || notif.request?.identifier === targetId);

      if (matchesCategory || matchesTarget) {
        if (typeof Notifications.dismissNotificationAsync === "function") {
          await Notifications.dismissNotificationAsync(notif.request.identifier);
        }
      }
    }
  } catch (e) {
    console.warn("[PushNotifications] Could not dismiss notification by category:", e);
  }
}
