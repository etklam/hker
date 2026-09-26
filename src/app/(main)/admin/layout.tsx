import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/server/auth";
const sections = [
  ["", "概覽"],
  ["listings", "收錄管理"],
  ["categories", "分類"],
  ["areas", "地區"],
  ["tags", "標籤"],
  ["groups", "標籤群組"],
  ["navigation", "導覽"],
  ["imports", "匯入"],
  ["analytics", "統計"],
  ["settings", "設定"],
];
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!["admin", "superadmin"].includes(user.role)) redirect("/");
  const nav = (
    <nav aria-label="管理導覽">
      {sections.map(([path, name]) => (
        <Link key={path} href={`/admin${path ? `/${path}` : ""}`}>
          {name}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">{nav}</aside>
      <details className="admin-menu">
        <summary>管理選單</summary>
        {nav}
      </details>
      <div className="admin-content">{children}</div>
    </div>
  );
}
