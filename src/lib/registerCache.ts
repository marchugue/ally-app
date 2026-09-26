/**
 * Registration & Verification caching for Mobile.
 *
 * Persists registration form fields, sub-step progress, uploaded ID local URIs,
 * and pending verification states (showOtpView, registeredUserId, otpDigits)
 * in AsyncStorage so users can safely switch apps (to check email/Gmail),
 * navigate back/forward, or restart the app without losing their verification
 * process or pending account state.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOBILE_REGISTER_CACHE_KEY = 'ally_mobile_register_cache_v1';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface MobileRegisterForm {
  username: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  department: string;
  course: string;
  yearLevel: string;
  organizations: string[];
  interests: string[];
  avatar: string;
  bio: string;
}

export interface MobileRegisterCachedData {
  emailType: 'chmsu' | 'external';
  step: number; // 1 to 4
  registeredUserId: string | null;
  showOtpView: boolean;
  otpDigits: string[];
  form: MobileRegisterForm;
  studentIdFrontUri?: string | null;
  studentIdBackUri?: string | null;
  avatarTab?: 'presets' | 'emojis';
  agreedToTerms?: boolean;
  savedAt: number;
}

export type MobileRegisterSaveInput = Partial<Omit<MobileRegisterCachedData, 'form'>> & {
  form?: Partial<MobileRegisterForm>;
};

export async function getMobileRegisterCache(): Promise<MobileRegisterCachedData | null> {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_REGISTER_CACHE_KEY);
    if (!raw) return null;
    const data: MobileRegisterCachedData = JSON.parse(raw);
    if (!data.savedAt || Date.now() - data.savedAt > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(MOBILE_REGISTER_CACHE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[MobileRegisterCache] Failed to read cache:', e);
    return null;
  }
}

export async function saveMobileRegisterCache(data: MobileRegisterSaveInput): Promise<void> {
  try {
    const existing = await getMobileRegisterCache();
    const updated: MobileRegisterCachedData = {
      emailType: data.emailType ?? existing?.emailType ?? 'chmsu',
      step: data.step ?? existing?.step ?? 1,
      registeredUserId: data.registeredUserId !== undefined ? data.registeredUserId : (existing?.registeredUserId ?? null),
      showOtpView: data.showOtpView !== undefined ? data.showOtpView : (existing?.showOtpView ?? false),
      otpDigits: data.otpDigits ?? existing?.otpDigits ?? ['', '', '', '', '', ''],
      form: {
        username: data.form?.username ?? existing?.form?.username ?? '',
        email: data.form?.email ?? existing?.form?.email ?? '',
        password: data.form?.password ?? existing?.form?.password ?? '',
        confirmPassword: data.form?.confirmPassword ?? existing?.form?.confirmPassword ?? '',
        department: data.form?.department ?? existing?.form?.department ?? '',
        course: data.form?.course ?? existing?.form?.course ?? '',
        yearLevel: data.form?.yearLevel ?? existing?.form?.yearLevel ?? '',
        organizations: data.form?.organizations ?? existing?.form?.organizations ?? [],
        interests: data.form?.interests ?? existing?.form?.interests ?? [],
        avatar: data.form?.avatar ?? existing?.form?.avatar ?? '😊',
        bio: data.form?.bio ?? existing?.form?.bio ?? '',
      },
      studentIdFrontUri: data.studentIdFrontUri !== undefined ? data.studentIdFrontUri : (existing?.studentIdFrontUri ?? null),
      studentIdBackUri: data.studentIdBackUri !== undefined ? data.studentIdBackUri : (existing?.studentIdBackUri ?? null),
      avatarTab: data.avatarTab ?? existing?.avatarTab ?? 'presets',
      agreedToTerms: data.agreedToTerms ?? existing?.agreedToTerms ?? false,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(MOBILE_REGISTER_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[MobileRegisterCache] Failed to save cache:', e);
  }
}

export async function clearMobileRegisterCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MOBILE_REGISTER_CACHE_KEY);
  } catch (e) {
    console.warn('[MobileRegisterCache] Failed to clear cache:', e);
  }
}
