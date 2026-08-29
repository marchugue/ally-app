import { Modal, View } from "react-native";
import LottieView from "lottie-react-native";

const size = 84

type LoadingOverlayProps = {
  visible: boolean;
};

export default function LoadingOverlay({
  visible,
}: LoadingOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: size,
            height: size,
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            justifyContent: "center",
            alignItems: "center",

            // Android
            elevation: 12,

            // iOS
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            shadowOffset: {
              width: 0,
              height: 4,
            },
          }}
        >
          <LottieView
            source={require("../../assets/loading/loading.json")}
            autoPlay
            loop
            style={{
              width: size - 24,
              height: size - 24,
            }}
          />
        </View>
      </View>
    </Modal>
  );
}