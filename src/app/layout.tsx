import type { Metadata } from "next";
import Providers from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "HKER 香港生活目錄", template: "%s · HKER" },
  description: "發掘香港的商店、服務、社群及實用資訊。",
  metadataBase: new URL(process.env.APP_BASE_URL ?? "http://localhost:3000"),
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
