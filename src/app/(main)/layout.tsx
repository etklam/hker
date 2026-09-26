import Link from "next/link";
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
      <main>{children}</main>
      <footer className="site-footer">
        <div className="container">
          <span>HKER · 發掘香港值得去、值得用的地方與服務</span>
          <Link href="/admin">管理目錄</Link>
        </div>
      </footer>
    </>
  );
}
