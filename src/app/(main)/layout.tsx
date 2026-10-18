import Link from "next/link";
import { CatalogEvents } from "@/components/directory/CatalogEvents";
import { SiteNav } from "@/components/directory/SiteNav";
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        跳到主要內容
      </a>
      <CatalogEvents />
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand">
            <span className="brand-plate">HKER</span>
            <span className="brand-name">香港生活目錄</span>
          </Link>
          <SiteNav />
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container">
          <p className="footer-mark">
            <span className="brand-plate">HKER</span>
            發掘香港值得去、值得用的地方與服務
          </p>
          <nav aria-label="網站資訊">
            <Link href="/about">關於</Link>
            <Link href="/privacy">私隱</Link>
            <Link href="/correction">更正或移除</Link>
            <Link href="/admin">管理目錄</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
