"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AdminNav({ sections }: { sections: [string, string][] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="管理導覽">
      {sections.map(([path, name]) => {
        const href = `/admin${path ? `/${path}` : ""}`;
        return (
          <Link
            key={path}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
