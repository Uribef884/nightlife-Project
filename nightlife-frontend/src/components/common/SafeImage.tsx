// src/components/common/SafeImage.tsx
"use client";
import Image, { ImageProps } from "next/image";

const ALLOW = [/^https:\/\/nightlife-files\.s3\.amazonaws\.com\//, /^https?:\/\/images\.unsplash\.com\//];

export function SafeImage(props: ImageProps) {
  const ok = ALLOW.some((r) => typeof props.src === "string" && r.test(props.src));
  if (!ok) {
    return <div className="bg-white/10 text-white/50 grid place-items-center" style={{ width: props.width, height: props.height }}>img</div>;
  }
  return <Image {...props} />;
}
