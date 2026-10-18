import { presentListingLink } from "@/lib/directory-links";

export function ExternalActions({
  links,
}: {
  links: Parameters<typeof presentListingLink>[0][];
}) {
  return (
    <div className="detail-links">
      {links.map((link) => {
        const action = presentListingLink(link);
        if (!action) return null;
        return (
          <a
            key={link.id}
            className="button"
            href={action.href}
            target={action.target}
            rel={action.rel}
          >
            <span className="action-label">{action.label}</span>
            {action.value && (
              <span className="action-value num">{action.value}</span>
            )}
            {action.target === "_blank" && (
              <>
                <span className="vh">（於新視窗開啟）</span>
                <span className="action-ext" aria-hidden="true">
                  ↗
                </span>
              </>
            )}
          </a>
        );
      })}
    </div>
  );
}
