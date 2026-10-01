"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const entries = [
  ["/categories", "分類"],
  ["/tags", "標籤"],
  ["/search?sort=newest", "最新收錄"],
] as const;
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="主要導覽">
      {entries.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
