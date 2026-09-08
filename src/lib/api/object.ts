import { authedRequest } from "@/lib/http/client";
import { isBrandAssetAvatar } from "@/lib/avatar-display";

/** Protobuf JSON (camelCase) for object.GetUploadURLResponse */
export type GetUploadUrlResponseJson = {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number | string;
  publicUrl?: string;
};

export type GetDownloadUrlResponseJson = {
  downloadUrl: string;
  expiresIn: number | string;
  publicUrl?: string;
};

/** Matches backend `object.ObjectUploadPrefix` (JSON: `object_prefix`). */
export const ObjectUploadPrefix = {
  Unspecified: 0,
  Deliveries: 1,
  Images: 2,
} as const;

export type ObjectUploadPrefixValue = (typeof ObjectUploadPrefix)[keyof typeof ObjectUploadPrefix];

export async function getObjectUploadUrl(body: {
  fileName: string;
  contentType: string;
  /** Optional: default is deliveries. Use `ObjectUploadPrefix.Images` for avatars / UI uploads. */
  objectPrefix?: ObjectUploadPrefixValue;
}) {
  const payload: Record<string, string | number> = {
    file_name: body.fileName,
    content_type: body.contentType,
  };
  if (body.objectPrefix !== undefined) {
    payload.object_prefix = body.objectPrefix;
  }
  return authedRequest<GetUploadUrlResponseJson>(`/backend/v1/objects/upload-url`, {
    method: "POST",
    body: payload,
  });
}

export async function getObjectDownloadUrl(objectKey: string) {
  return authedRequest<GetDownloadUrlResponseJson>(`/backend/v1/objects/download-url`, {
    method: "POST",
    body: { object_key: objectKey.trim() },
  });
}

/**
 * Upload bytes to COS using the presigned PUT URL (no Croo auth on this request).
 */
export async function putFileToPresignedUrl(uploadUrl: string, file: Blob, contentType: string) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload failed (${res.status})`);
  }
}

/** True when `avatar` is a COS object key (not a URL or data URL). */
export function isStoredObjectKey(avatar: string | undefined | null): boolean {
  const t = (avatar ?? "").trim();
  if (!t || isBrandAssetAvatar(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (t.startsWith("data:")) return false;
  return true;
}

/**
 * Absolute URLs come from backend (`avatar` on agents, `publicUrl` on object APIs).
 * Raw object keys need `/backend/v1/objects/download-url` (returns `publicUrl` when configured).
 */
export function resolveAvatarImgUrl(avatar: string | undefined | null): {
  url: string | null;
  needsObjectDownloadApi: boolean;
} {
  const t = (avatar ?? "").trim();
  if (!t || isBrandAssetAvatar(t)) return { url: null, needsObjectDownloadApi: false };
  if (/^https?:\/\//i.test(t)) return { url: t, needsObjectDownloadApi: false };
  if (t.startsWith("data:")) return { url: t, needsObjectDownloadApi: false };
  return { url: null, needsObjectDownloadApi: isStoredObjectKey(t) };
}
