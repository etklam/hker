import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page-heading">
      <h1>找不到這個頁面</h1>
      <p>這項收錄可能已下架，或網址已更改。</p>
      <Link href="/" className="button">
        返回首頁
      </Link>
    </div>
  );
}
