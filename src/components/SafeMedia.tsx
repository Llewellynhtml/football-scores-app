function isSupportedMedia(src: string | null | undefined) {
  if (!src) return false;

  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === "media.api-sports.io";
  } catch {
    return false;
  }
}

export function SafeMedia({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  if (!isSupportedMedia(src)) return null;

  return (
    <object
      className="safeMediaObject"
      data={src!}
      aria-label={alt}
      title={alt}
    >
      <span className="safeMediaFallback">{alt}</span>
    </object>
  );
}
