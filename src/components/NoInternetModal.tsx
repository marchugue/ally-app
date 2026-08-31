import { useState } from 'react';
import { View, Text, Modal, Pressable, BackHandler, ActivityIndicator } from 'react-native';
import { WifiOff, RotateCw, LogOut } from 'lucide-react-native';

interface NoInternetModalProps {
  visible: boolean;
  onReconnect: () => Promise<boolean>;
}

export function NoInternetModal({ visible, onReconnect }: NoInternetModalProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleReconnect = async () => {
    setIsChecking(true);
    setToastMessage('');
    try {
      const isOnlineNow = await onReconnect();
      if (!isOnlineNow) {
        setToastMessage('Still offline. Please check your connection.');
      }
    } catch (err) {
      setToastMessage('Still offline. Please check your connection.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleExit = () => {
    BackHandler.exitApp();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Prevent hardware back button from closing modal when offline
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.82)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
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
            elevation: 12,
            alignItems: 'center',
          }}
        >
          {/* Animated/Glowing WifiOff Icon */}
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FEF2F2',
              borderWidth: 2,
              borderColor: '#FECACA',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <WifiOff size={32} color="#EF4444" />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              fontWeight: '800',
              color: '#111827',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            No Internet Connection
          </Text>

          {/* Body description */}
          <Text
            style={{
              fontSize: 14,
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            You are currently offline. Please check your network connection and try again.
          </Text>

          {/* Error toast message if reconnect fails */}
          {toastMessage ? (
            <View
              style={{
                width: '100%',
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#FECACA',
              }}
            >
              <Text style={{ color: '#EF4444', fontSize: 12, textAlign: 'center', fontWeight: '600' }}>
                ⚠️ {toastMessage}
              </Text>
            </View>
          ) : null}

          {/* Reconnect & Exit Buttons */}
          <View style={{ width: '100%', gap: 10 }}>
            <Pressable
              onPress={handleReconnect}
              disabled={isChecking}
              style={{
                backgroundColor: '#1A6B3C',
                borderRadius: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: isChecking ? 0.7 : 1,
                shadowColor: '#1A6B3C',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <RotateCw size={18} color="#FFFFFF" />
              )}
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                {isChecking ? 'Reconnecting…' : 'Reconnect'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleExit}
              disabled={isChecking}
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 16,
                paddingVertical: 13,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <LogOut size={18} color="#4B5563" />
              <Text style={{ color: '#374151', fontWeight: '700', fontSize: 15 }}>Exit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
