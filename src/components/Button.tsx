import { useRef } from "react";
import {
  Pressable,
  Text,
  PressableProps,
  ActivityIndicator,
  Animated,
} from "react-native";
import { cssInterop } from "nativewind";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "inverse";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   "bg-primary active:bg-primaryDark",
  secondary: "bg-surfaceMuted border border-border active:bg-surface",
  ghost:     "bg-transparent active:bg-surfaceMuted",
  danger:    "bg-danger active:opacity-80",
  accent:    "bg-accent active:opacity-80",
  inverse:   "bg-white active:bg-surfaceMuted",
};

const textStyles: Record<ButtonVariant, string> = {
  primary:   "text-white",
  secondary: "text-textPrimary",
  ghost:     "text-textPrimary",
  danger:    "text-white",
  accent:    "text-white",
  inverse:   "text-primary",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2.5",
  md: "px-5 py-3.5",
  lg: "px-6 py-4",
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Tell NativeWind to resolve `className` -> `style` on this wrapped
// component, since Animated.createAnimatedComponent() produces a new
// component that NativeWind's default interop doesn't recognize.
cssInterop(AnimatedPressable, {
  className: "style",
});

export function Button({
  label,
  variant = "primary",
  size = "md",
  pill = false,
  icon,
  loading = false,
  disabled,
  className,
  style,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <AnimatedPressable
      disabled={disabled || loading}
      onPressIn={(e) => {
        animateTo(0.96);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      style={[{ transform: [{ scale }] }, style as object]}
      className={cn(
        pill ? "rounded-full" : "rounded-xl",
        "items-center justify-center flex-row gap-2",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-40",
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "inverse" || variant === "secondary" || variant === "ghost" ? "#1A6B3C" : "#FFFFFF"}
        />
      ) : (
        <>
          <Text
            className={cn("font-semibold tracking-wide", textStyles[variant], textSizeStyles[size])}
          >
            {label}
          </Text>
          {icon}
        </>
      )}
    </AnimatedPressable>
  );
}