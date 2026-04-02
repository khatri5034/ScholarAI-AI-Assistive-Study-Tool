/**
 * Validates `next` query values so post-auth redirects stay in-app (no open redirects).
 */
export function getSafeInternalPath(raw: string | null): string | null {
  if (raw == null) return null;
  let t = raw.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    return null;
  }
  t = t.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("://") || t.includes("..")) return null;
  return t;
}
