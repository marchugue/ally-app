import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { VersionInfo, UpdateModal } from '@/components/UpdateModal';
import { NoInternetModal } from '@/components/NoInternetModal';

interface NetworkContextType {
  isOffline: boolean;
  isUpdateAvailable: boolean;
  versionInfo: VersionInfo | null;
  currentVersion: string;
  checkForUpdates: (manual?: boolean) => Promise<{ isAvailable: boolean; info: VersionInfo | null; message?: string }>;
  recheckConnectivity: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isOffline: false,
  isUpdateAvailable: false,
  versionInfo: null,
  currentVersion: '1.0.0',
  checkForUpdates: async () => ({ isAvailable: false, info: null }),
  recheckConnectivity: async () => true,
});

export const useNetwork = () => useContext(NetworkContext);

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);

  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const [isOffline, setIsOffline] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Monitor Network connection state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // Offline if explicitly connected is false or isInternetReachable is false
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  const recheckConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      return !offline;
    } catch (err) {
      setIsOffline(true);
      return false;
    }
  }, []);

  // Check for App Updates against domain endpoint & Expo OTA updates
  const checkForUpdates = useCallback(async (manual = false) => {
    try {
      // 1. Check Expo OTA updates if enabled in native build
      if (Updates.isEnabled && !__DEV__) {
        const otaCheck = await Updates.checkForUpdateAsync();
        if (otaCheck.isAvailable) {
          setIsUpdateAvailable(true);
          setShowUpdateModal(true);
          const otaInfo: VersionInfo = {
            version: 'OTA Update Available',
            downloadUrl: 'https://ally-jis.xyz/download',
            releaseNotes: 'An instant Over-The-Air performance and feature patch is ready to download.',
          };
          setVersionInfo(otaInfo);
          return { isAvailable: true, info: otaInfo };
        }
      }

      // 2. Check domain version manifest (ally-jis.xyz/version.json)
      const endpoint = 'https://ally-jis.xyz/version.json';
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch version info (${response.status})`);
      }
      const data: VersionInfo = await response.json();
      setVersionInfo(data);

      const hasNewerVersion = compareVersions(data.version, currentVersion) > 0;
      setIsUpdateAvailable(hasNewerVersion);

      if (hasNewerVersion) {
        setShowUpdateModal(true);
        return { isAvailable: true, info: data };
      } else {
        return {
          isAvailable: false,
          info: data,
          message: manual ? 'You are on the latest version of Ally-jis.' : undefined,
        };
      }
    } catch (err: any) {
      console.log('Update check skipped/failed:', err?.message);
      return { isAvailable: false, info: null, message: 'Could not connect to update server.' };
    }
  }, [currentVersion]);

  // Initial update check on startup
  useEffect(() => {
    if (!isOffline) {
      checkForUpdates(false);
    }
  }, [isOffline, checkForUpdates]);

  return (
    <NetworkContext.Provider
      value={{
        isOffline,
        isUpdateAvailable,
        versionInfo,
        currentVersion,
        checkForUpdates,
        recheckConnectivity,
      }}
    >
      {children}

      {/* Offline Modal (Reconnect, Exit) */}
      <NoInternetModal
        visible={isOffline}
        onReconnect={recheckConnectivity}
      />

      {/* App Update Available Modal */}
      <UpdateModal
        visible={showUpdateModal}
        currentVersion={currentVersion}
        versionInfo={versionInfo}
        onClose={() => setShowUpdateModal(false)}
      />
    </NetworkContext.Provider>
  );
}
