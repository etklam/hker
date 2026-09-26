"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container page-heading">
      <h1>暫時無法載入目錄</h1>
      <p>請稍後重試。如問題持續，請聯絡管理員。</p>
      <button className="button" onClick={reset}>
        重試
      </button>
    </div>
  );
}
