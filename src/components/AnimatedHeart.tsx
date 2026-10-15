import React, { useRef, useEffect, useState } from "react";
import { View } from "react-native";
import LottieView from "lottie-react-native";
import { Heart } from "lucide-react-native";

interface AnimatedHeartProps {
  isLiked: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}

const HEART_LOTTIE = require("../../assets/icons/lottie/heart.json");

export const AnimatedHeart: React.FC<AnimatedHeartProps> = ({
  isLiked,
  size = 18,
  activeColor = "#1A6B3C",
  inactiveColor = "#9CA3AF",
}) => {
  const lottieRef = useRef<LottieView>(null);
  const [justLiked, setJustLiked] = useState(false);
  const wasLikedRef = useRef(isLiked);

  useEffect(() => {
    // Only play full Lottie animation when transitioning from false -> true
    if (isLiked && !wasLikedRef.current) {
      setJustLiked(true);
      requestAnimationFrame(() => {
        lottieRef.current?.reset();
        lottieRef.current?.play(0, 70);
      });
    } else if (!isLiked) {
      setJustLiked(false);
    }
    wasLikedRef.current = isLiked;
  }, [isLiked]);

  if (!isLiked) {
    return <Heart size={size} color={inactiveColor} />;
  }

  if (justLiked) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <LottieView
          ref={lottieRef}
          source={HEART_LOTTIE}
          autoPlay={true}
          loop={false}
          renderMode="AUTOMATIC"
          style={{ width: size * 1.5, height: size * 1.5 }}
          colorFilters={[
            { keypath: "**", color: activeColor },
            { keypath: ".primary", color: activeColor },
          ]}
        />
      </View>
    );
  }

  // Already liked on initial load: clean static solid green heart
  return <Heart size={size} color={activeColor} fill={activeColor} />;
};

export default AnimatedHeart;
