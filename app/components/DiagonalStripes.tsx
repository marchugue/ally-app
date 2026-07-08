

import { View } from "react-native";

export function DiagonalStripes({ count = 7 }: { count?: number }) {
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}
      pointerEvents="none"
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: 3,
            height: 900,
            backgroundColor: "rgba(255,255,255,0.07)",
            left: i * 65 - 60,
            top: -150,
            transform: [{ rotate: "18deg" }],
          }}
        />
      ))}
    </View>
  );
}