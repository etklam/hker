"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container page-heading">
      <h1>暫時無法載入目錄</h1>
      <p>請稍後重試。如問題持續，請聯絡管理員。</p>
      <div className="toolbar">
        <button className="button primary" onClick={reset}>
          重試
        </button>
        <Link href="/" className="button">
          返回首頁
        </Link>
      </div>
    </div>
  );
}
