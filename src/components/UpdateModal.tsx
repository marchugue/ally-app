import { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, Linking, ActivityIndicator } from 'react-native';
import { Sparkles, Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react-native';
import * as Updates from 'expo-updates';

export interface VersionInfo {
  version: string;
  minVersion?: string;
  downloadUrl: string;
  apkUrl?: string;
  releaseNotes?: string;
}

export type UpdateProgressState = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

interface UpdateModalProps {
  visible: boolean;
  currentVersion: string;
  versionInfo: VersionInfo | null;
  onClose: () => void;
}

export function UpdateModal({
  visible,
  currentVersion,
  versionInfo,
  onClose,
}: UpdateModalProps) {
  const [progressState, setProgressState] = useState<UpdateProgressState>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setProgressState('idle');
      setProgressPercent(0);
      setErrorMessage('');
    }
  }, [visible]);

  if (!versionInfo) return null;

  const downloadUrl = versionInfo.downloadUrl || 'https://ally-jis.xyz/download';

  // Handle OTA In-App Update download & reload
  const handleStartInAppUpdate = async () => {
    try {
      setProgressState('downloading');
      setProgressPercent(15);

      // Simulate smooth progress steps for user feedback
      const progressTimer = setInterval(() => {
        setProgressPercent(prev => (prev < 85 ? prev + 15 : prev));
      }, 300);

      // Check if expo-updates is enabled in current runtime
      if (Updates.isEnabled) {
        const updateResult = await Updates.fetchUpdateAsync();
        clearInterval(progressTimer);
        setProgressPercent(100);

        if (updateResult.isNew) {
          setProgressState('ready');
        } else {
          // No OTA patch, open web download fallback
          await handleWebFallback();
        }
      } else {
        // Running in dev or standalone without OTA enabled, use web download
        clearInterval(progressTimer);
        setProgressPercent(100);
        await handleWebFallback();
      }
    } catch (err: any) {
      console.warn('In-app update error:', err);
      // Fallback gracefully
      setProgressState('error');
      setErrorMessage(err?.message || 'In-app update failed. You can download the latest APK directly.');
    }
  };

  const handleApplyRestart = async () => {
    try {
      if (Updates.isEnabled) {
        await Updates.reloadAsync();
      } else {
        await handleWebFallback();
      }
    } catch (err) {
      await handleWebFallback();
    }
  };

  const handleWebFallback = async () => {
    try {
      const canOpen = await Linking.canOpenURL(downloadUrl);
      if (canOpen) {
        await Linking.openURL(downloadUrl);
      } else {
        await Linking.openURL('https://ally-jis.xyz/download');
      }
    } catch (err) {
      console.warn('Failed to open URL:', err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (progressState !== 'downloading') onClose();
      }}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* Badge Icon */}
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 22,
              backgroundColor: progressState === 'ready' ? '#DCFCE7' : progressState === 'error' ? '#FEF2F2' : '#1A6B3C15',
              justifyContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}
          >
            {progressState === 'ready' ? (
              <CheckCircle2 size={32} color="#16A34A" />
            ) : progressState === 'error' ? (
              <AlertCircle size={32} color="#EF4444" />
            ) : (
              <Sparkles size={30} color="#1A6B3C" />
            )}
          </View>

          {/* Header Title */}
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A6B3C', textAlign: 'center', marginBottom: 6 }}>
            {progressState === 'ready'
              ? 'Update Ready!'
              : progressState === 'downloading'
              ? 'Downloading Update…'
              : progressState === 'error'
              ? 'Update Notice'
              : 'New Update Available!'}
          </Text>

          {/* Version Pills */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F0EDE8', borderRadius: 12 }}>
              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600' }}>v{currentVersion}</Text>
            </View>
            <Text style={{ color: '#1A6B3C', fontWeight: '700' }}>→</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1A6B3C', borderRadius: 12 }}>
              <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '700' }}>v{versionInfo.version}</Text>
            </View>
          </View>

          {/* Progression Bar UI when downloading */}
          {progressState === 'downloading' ? (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600' }}>Installing update package…</Text>
                <Text style={{ fontSize: 13, color: '#1A6B3C', fontWeight: '700' }}>{progressPercent}%</Text>
              </View>

              {/* Progress Bar Container */}
              <View style={{ width: '100%', height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    backgroundColor: '#1A6B3C',
                    borderRadius: 5,
                  }}
                />
              </View>

              <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 10 }}>
                Please keep the app open while downloading.
              </Text>
            </View>
          ) : progressState === 'ready' ? (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#BBF7D0' }}>
              <Text style={{ fontSize: 13, color: '#15803D', textAlign: 'center', fontWeight: '600', lineHeight: 18 }}>
                🎉 The update was downloaded successfully. Tap below to restart and apply changes!
              </Text>
            </View>
          ) : (
            /* Release Notes */
            <View style={{ backgroundColor: '#F7F4EF', borderRadius: 16, padding: 14, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A6B3C', marginBottom: 4, letterSpacing: 0.5 }}>
                WHAT'S NEW
              </Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>
                {versionInfo.releaseNotes || 'New features, real-time enhancements, and bug fixes for Ally-jis.'}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ gap: 10 }}>
            {progressState === 'ready' ? (
              <Pressable
                onPress={handleApplyRestart}
                style={{
                  backgroundColor: '#16A34A',
                  borderRadius: 18,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: '#16A34A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <RefreshCw size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Restart & Apply Update</Text>
              </Pressable>
            ) : progressState === 'downloading' ? (
              <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1A6B3C" />
              </View>
            ) : (
              <>
                <Pressable
                  onPress={handleStartInAppUpdate}
                  style={{
                    backgroundColor: '#1A6B3C',
                    borderRadius: 18,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    shadowColor: '#1A6B3C',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Download size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Update Now (In-App)</Text>
                </Pressable>

                <Pressable
                  onPress={onClose}
                  style={{
                    backgroundColor: 'transparent',
                    borderRadius: 18,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>Later</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
