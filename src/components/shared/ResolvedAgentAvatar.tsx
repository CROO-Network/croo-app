"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { getObjectDownloadUrl, isStoredObjectKey, resolveAvatarImgUrl } from "@/lib/api/object";
import { agentPlaceholderAvatarSrc, localInitialsAvatarSrc } from "@/lib/avatar-display";

type Props = {
  avatar: string | undefined;
  name: string;
  className?: string;
  alt?: string;
};

type DownloadAvatarSrc = {
  objectKey: string;
  src: string;
};

/**
 * Avatar string is a full URL from backend when possible; for raw object keys, uses object download API (`publicUrl` or presigned `downloadUrl`).
 */
export function ResolvedAgentAvatar({ avatar, name, className, alt }: Props) {
  const seed = name || "agent";
  const resolvedAvatar = resolveAvatarImgUrl(avatar);
  const trimmedAvatar = (avatar ?? "").trim();
  const fallbackSrc = agentPlaceholderAvatarSrc(seed);
  const localFallbackSrc = localInitialsAvatarSrc(seed);
  const [useLocalFallback, setUseLocalFallback] = useState(false);
  const needsDownload =
    !resolvedAvatar.url &&
    resolvedAvatar.needsObjectDownloadApi &&
    isStoredObjectKey(trimmedAvatar);
  const [downloadSrc, setDownloadSrc] = useState<DownloadAvatarSrc | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setUseLocalFallback(false);
    setFailedSrc(null);
  }, [trimmedAvatar, seed]);

  useEffect(() => {
    if (!needsDownload) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getObjectDownloadUrl(trimmedAvatar);
        const display = (res.publicUrl && res.publicUrl.trim()) || res.downloadUrl;
        if (!cancelled) setDownloadSrc({ objectKey: trimmedAvatar, src: display });
      } catch {
        if (!cancelled) setDownloadSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsDownload, trimmedAvatar]);

  const activeDownloadSrc = downloadSrc?.objectKey === trimmedAvatar ? downloadSrc.src : null;
  const candidateSrc = resolvedAvatar.url || activeDownloadSrc || fallbackSrc;
  const src = useLocalFallback
    ? localFallbackSrc
    : failedSrc === candidateSrc
      ? fallbackSrc
      : candidateSrc;

  return (
    <img
      src={src}
      alt={alt ?? name}
      className={className}
      onError={() => {
        if (src === localFallbackSrc) return;
        if (src === fallbackSrc) {
          setUseLocalFallback(true);
          return;
        }
        setFailedSrc(src);
      }}
    />
  );
}
