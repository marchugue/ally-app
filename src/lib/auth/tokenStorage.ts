import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ACCESS_TOKEN_KEY = "ally_access_token";
export const REFRESH_TOKEN_KEY = "ally_refresh_token";
export const USER_CACHE_KEY = "ally_user_data";
export const SESSION_CACHE_KEY = "ally_auth_session_data";

/**
 * Resilient multi-layer storage getter:
 * 1. Checks hardware-backed SecureStore
 * 2. Falls back to AsyncStorage
 */
export async function getPersistedItem(key: string): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val) return val;
  } catch {}

  try {
    const val = await AsyncStorage.getItem(key);
    if (val) return val;
  } catch {}

  return null;
}

/**
 * Persists data to both SecureStore and AsyncStorage to guarantee
 * that sessions survive device restarts, app updates, and platform quirks.
 */
export async function setPersistedItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {}

  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

/**
 * Removes data from both storage layers.
 */
export async function removePersistedItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}

  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}
