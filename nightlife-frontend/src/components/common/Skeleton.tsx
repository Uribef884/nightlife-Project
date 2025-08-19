// src/components/common/Skeleton.tsx
export function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-white/10 ${className}`} />;
  }
  