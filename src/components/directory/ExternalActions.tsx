import { presentListingLink } from "@/lib/directory-links";

export function ExternalActions({ links }: { links: Parameters<typeof presentListingLink>[0][] }) {
  return <div className="detail-links">{links.map(link => {
    const action = presentListingLink(link);
    if (!action) return null;
    return <a key={link.id} className="button" href={action.href} target={action.target} rel={action.rel}>
      {action.label}{action.value ? ` · ${action.value}` : " ↗"}
    </a>;
  })}</div>;
}
