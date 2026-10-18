import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page-heading">
      <h1>找不到這個頁面</h1>
      <p>
        這項收錄可能已下架，或網址已更改。目錄仍在，試試由搜尋或分類重新開始。
      </p>
      <div className="toolbar">
        <Link href="/search" className="button primary">
          搜尋目錄
        </Link>
        <Link href="/categories" className="button">
          瀏覽分類
        </Link>
        <Link href="/" className="button">
          返回首頁
        </Link>
      </div>
    </div>
  );
}
