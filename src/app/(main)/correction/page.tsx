import { safeStoredDestination } from "@/lib/directory-links";
export const metadata = { title: "更正或移除資料", alternates: { canonical: "/correction" } };
export default function Correction() {
  const value = process.env.DIRECTORY_SUPPORT_URL;
  const contact = value && safeStoredDestination(value) && /^(https:|mailto:)/.test(value) ? value : null;
  return <article className="container detail"><h1>更正或移除資料</h1>
    <p>如收錄資料有誤，或你希望提出移除要求，請提供該收錄的固定網址及需要更正的內容。請勿附上私人搜尋紀錄、密碼或不必要的個人資料。</p>
    {contact ? <a className="button" href={contact} rel="noreferrer">聯絡目錄管理員</a> : <p role="status">營運者尚未設定更正聯絡方式。目前此頁不接受提交。</p>}
    <p>管理員可核對修訂歷史、更正內容或停用收錄。本站沒有自動提交表單，亦不承諾處理時限。停用收錄不代表外部網站、日誌或備份中的資料同步刪除。</p>
  </article>;
}
