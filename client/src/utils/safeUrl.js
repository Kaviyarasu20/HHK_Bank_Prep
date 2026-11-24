/**
 * Frontend external URL guard.
 * Never trusts URLs merely because they came from the database.
 * Allows only valid http:// and https:// URLs without embedded credentials.
 */
export function getSafeExternalUrl(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
