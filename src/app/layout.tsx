import { siteOrigin } from "@/lib/site-origin";
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "HKER 香港生活目錄", template: "%s · HKER" },
  description: "發掘香港的商店、服務、社群及實用資訊。",
  metadataBase: siteOrigin(),
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const deployment = (await headers()).get("x-hker-deployment-environment");
  return (
    <html lang="zh-HK">
      <body>
        {deployment === "staging" && (
          <div className="deploy-banner" role="status">
            測試環境 · 資料可能會重設，內容不代表正式目錄
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
