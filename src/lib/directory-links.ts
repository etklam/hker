// Shared validation for stored destinations and their public presentation.
export function safeStoredDestination(value: string): boolean {
  if (!value || value.length > 2000 || /[\u0000-\u0020\u007f]/.test(value))
    return false;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (["http:", "https:"].includes(url.protocol))
      return Boolean(url.hostname);
    if (!["tel:", "mailto:"].includes(url.protocol)) return false;
    const control = /[\u0000-\u001f\u007f]/;
    if (url.protocol === "tel:") {
      const phone = decodeURIComponent(value.slice(4));
      return (
        !control.test(phone) &&
        /^\+?[0-9().-]+(?:;[a-z0-9-]+=[a-z0-9+().-]+)*$/i.test(phone)
      );
    }
    const recipient = decodeURIComponent(url.pathname);
    if (
      control.test(recipient) ||
      !/^[^\s@?]+@[^\s@?]+$/.test(recipient) ||
      url.hash
    )
      return false;
    for (const [key, entry] of url.searchParams) {
      if (!["subject", "body", "cc", "bcc"].includes(key.toLowerCase()))
        return false;
      // RFC 6068 body newlines are content, never mail headers.
      const content =
        key.toLowerCase() === "body" ? entry.replace(/[\r\n]/g, "") : entry;
      if (control.test(content) || /%0[ad]/i.test(content)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function presentListingLink(link: {
  id: number;
  label: string;
  url: string;
  enabled?: boolean;
}) {
  if (link.enabled === false || !safeStoredDestination(link.url)) return null;
  const protocol = new URL(link.url).protocol;
  const contact = protocol === "tel:" || protocol === "mailto:";
  return {
    label: link.label,
    href: contact ? link.url : `/out/${link.id}?source=web`,
    target: contact ? undefined : "_blank",
    rel: contact ? undefined : "noopener noreferrer",
    value: contact
      ? decodeURIComponent(link.url.slice(protocol.length).split("?")[0])
      : null,
    observable: !contact,
  };
}
