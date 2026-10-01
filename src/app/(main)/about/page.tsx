export const metadata = { title: "關於目錄", alternates: { canonical: "/about" } };
export default function About() {
  return <article className="container prose"><h1>關於 HKER</h1>
    <p>HKER 是由管理員整理的香港生活目錄，收錄商店、服務、網上資源、社群及活動。收錄不表示官方認可、合作關係或保證；資料亦未必完整或即時更新。</p>
    <p>首頁精選及導覽由管理員設定。搜尋會按你選擇的條件及排序顯示；精選並非使用者評分。</p>
    <h2>參考價格與外部資料</h2><p>價格範圍僅供參考，請閱讀收錄中的公開說明以了解按件、按次或其他計價方式。未填價格代表未知，不代表免費。最終收費、服務內容及供應情況請向資料提供者確認。</p>
    <p>技術更新時間不代表商戶或價格已核實。外部連結由各目的網站管理。</p>
  </article>;
}
