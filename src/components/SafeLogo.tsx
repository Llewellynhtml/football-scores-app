"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

function initials(value: string) {
  const words = value
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function isSupportedLogo(src: string | null | undefined) {
  if (!src) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === "media.api-sports.io";
  } catch {
    return false;
  }
}

export function SafeLogo({
  src,
  alt,
  fallbackText,
  size = 24,
}: {
  src?: string | null;
  alt: string;
  fallbackText?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!isSupportedLogo(src) || failed) {
    return (
      <span
        className="safeLogoFallback"
        style={{ width: size, height: size }}
        aria-label={alt}
        title={alt}
      >
        {initials(fallbackText ?? alt)}
      </span>
    );
  }

  return (
    <Image
      className="safeLogoImage"
      src={src!}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      quality={50}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
