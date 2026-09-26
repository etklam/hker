import Link from "next/link";
import { CatalogSearchService } from "@/server/catalog/service";
export const dynamic = "force-dynamic";
export default async function AdminHome() {
  const result = await CatalogSearchService.search({ pageSize: 1 }, "admin");
  return (
    <>
      <h1>目錄管理</h1>
      <p className="muted">整理香港的地方、服務與實用資源。</p>
      <section className="empty">
        <h2>{result.total} 項收錄</h2>
        <p>先設定分類、地區及標籤，再新增及發佈收錄。</p>
        <Link className="button primary" href="/admin/listings">
          管理收錄
        </Link>
      </section>
    </>
  );
}
