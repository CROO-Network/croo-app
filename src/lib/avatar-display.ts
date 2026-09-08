const PLACEHOLDER_BACKGROUNDS = [
  "b6e3f4",
  "d1d4f9",
  "ffd5dc",
  "c0aede",
  "b6f4d0",
  "fff3b0",
  "ffceb4",
  "b4f0ff",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Brand wordmark is not an agent avatar — treat it as missing. */
export function isBrandAssetAvatar(avatar: string | undefined | null): boolean {
  return /(?:^|\/)logo-croo\.png(?:\?|$)/i.test((avatar ?? "").trim());
}

/** Local last resort when Dicebear is blocked. Never the CROO wordmark. */
export function localInitialsAvatarSrc(seed: string): string {
  const words = (seed || "A").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/);
  const initials = (words.slice(0, 2).map((word) => word[0] || "").join("") || "A").toUpperCase();
  const bg = PLACEHOLDER_BACKGROUNDS[hashSeed(seed || "agent") % PLACEHOLDER_BACKGROUNDS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#${bg}"/><text x="40" y="46" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" font-weight="600" fill="#0F0F0F">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Empty / unusable avatars: square bottts PNG so 32px rows don't crop into the brand mark. */
export function agentPlaceholderAvatarSrc(seed: string): string {
  const value = seed || "agent";
  const bg = PLACEHOLDER_BACKGROUNDS[hashSeed(value) % PLACEHOLDER_BACKGROUNDS.length];
  return `https://api.dicebear.com/9.x/bottts/png?size=80&seed=${encodeURIComponent(value)}&backgroundColor=${bg}`;
}

/**
 * Unauthenticated pages: only `https` / `data:` work as raw `img` src.
 * Empty values and the old wordmark stub use the same agent placeholder as cards/detail.
 */
export function publicPageAvatarSrc(avatar: string | undefined, seed = "agent"): string {
  const t = (avatar ?? "").trim();
  if (isBrandAssetAvatar(t)) return agentPlaceholderAvatarSrc(seed);
  if (/^https?:\/\//i.test(t) || t.startsWith("data:")) return t;
  return agentPlaceholderAvatarSrc(seed);
}

function validImgSrc(value: string | undefined): string {
  const t = (value ?? "").trim();
  if (t.startsWith("data:") || /^https?:\/\//i.test(t)) return t;
  return "";
}

/** Logged-in user avatar: backend pixel identicon, then Dicebear fallback. */
export function userAvatarSrc(avatar: string | undefined, userId: string): string {
  const t = validImgSrc(avatar);
  if (t) return t;
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(userId || "guest")}`;
}

export function loggedInUserAvatarSrc(input: {
  avatar: string | undefined;
  googlePicture: string | undefined;
  isGoogleLogin: boolean;
  userId: string;
}): string {
  const googlePicture = input.isGoogleLogin ? validImgSrc(input.googlePicture) : "";
  if (googlePicture) return googlePicture;
  return userAvatarSrc(input.avatar, input.userId);
}
