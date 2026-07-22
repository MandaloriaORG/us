export interface SafeExternalUrl {
  href: string;
  label: string;
}

export function safeExternalUrl(value: string | null | undefined): SafeExternalUrl | null {
  if (!value || value.length > 2048) return null;

  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return null;
    }

    return { href: url.href, label: url.host };
  } catch {
    return null;
  }
}
