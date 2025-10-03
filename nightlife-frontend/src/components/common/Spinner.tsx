// src/components/common/Spinner.tsx
"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  color?: "primary" | "white" | "gray";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6", 
  lg: "h-8 w-8"
};

const colorClasses = {
  primary: "border-purple-600",
  white: "border-white",
  gray: "border-gray-400"
};

export function Spinner({ 
  size = "md", 
  className, 
  color = "primary" 
}: SpinnerProps) {
  return (
    <div
      className={[
        "animate-spin rounded-full border-2 border-transparent border-t-current",
        sizeClasses[size],
        colorClasses[color],
        className
      ].filter(Boolean).join(" ")}
    />
  );
}

// Overlay spinner for images
interface ImageSpinnerProps {
  className?: string;
}

export function ImageSpinner({ className }: ImageSpinnerProps) {
  return (
    <div className={[
      "absolute inset-0 flex items-center justify-center",
      "bg-black/20 backdrop-blur-sm",
      className
    ].filter(Boolean).join(" ")}>
      <Spinner size="lg" color="white" />
    </div>
  );
}
