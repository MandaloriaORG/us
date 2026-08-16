/**
 * Defense-in-depth check for proposal source links.
 *
 * The database already constrains `external_url` to `https?://` (migration
 * 0015), so a source label reaching this helper is safe today. This guard keeps
 * that property even if the migration constraint ever loosens: the same
 * scheme/credential/control-character rules the Markdown renderer applies.
 */
export function isSafeExternalUrl(value: string): boolean {
  const url = value.trim();
  if (url.length === 0 || url.length > 2048) return false;
  if (/[\u0000-\u0020\u007f]/.test(url)) return false;
  if (url.startsWith("/")) return false;

  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
