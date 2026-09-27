import Link from "next/link";
import { CatalogEvents } from "@/components/directory/CatalogEvents";
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a href="#main-content" className="skip-link">跳到主要內容</a>
      <CatalogEvents />
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand">
            HKER<span>香港生活目錄</span>
          </Link>
          <nav className="site-nav" aria-label="主要導覽">
            <Link href="/categories">分類</Link>
            <Link href="/tags">標籤</Link>
            <Link href="/search?sort=newest">最新收錄</Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="container">
          <span>HKER · 發掘香港值得去、值得用的地方與服務</span>
          <nav aria-label="網站資訊"><Link href="/about">關於</Link> · <Link href="/privacy">私隱</Link> · <Link href="/correction">更正或移除</Link> · <Link href="/admin">管理目錄</Link></nav>
        </div>
      </footer>
    </>
  );
}
