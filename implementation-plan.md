# HKER — Implementation Plan

> **Version**: 1.0 · **Date**: 2026-04-19
> 基於 dev-plan.md 和 design.md 的綜合分析，制定的具體實施計劃。

---

## 0. 前置分析摘要

### 整體可行性：✅ 可行

三份獨立分析（架構、設計、安全）的結論一致：**項目可行，但需要在開工前修正若干問題**。

### 需優先解決的問題

| 類別 | 問題 | 嚴重度 | 處理時機 |
|------|------|--------|---------|
| 🎨 設計 | design.md 與 dev-plan.md 的色彩系統衝突（粉紅 vs 鼠尾草綠） | 高 | Phase 0 |
| 🔒 安全 | Cookie 未明確設定 `SameSite`, `Secure`, `HttpOnly` | 嚴重 | Phase 1 |
| 🔒 安全 | 無 Email 驗證 → SSO 帳號綁定會變成接管漏洞 | 嚴重 | 延後 SSO 綁定邏輯 |
| 🔒 安全 | 無帳號鎖定機制（可暴力猜密碼） | 高 | Phase 2 |
| 🔒 安全 | scrypt 參數偏低（N=16384 → 建議 N=65536） | 高 | Phase 1 |
| 🏗️ 架構 | 缺少 DB 索引（links.collection_id, todos.list_id 等） | 高 | Phase 1 |
| 🏗️ 架構 | forks 表缺少 UNIQUE 約束 | 中 | Phase 1 |
| 🏗️ 架構 | updatedAt 不會自動更新 | 中 | Phase 1 |

---

## 1. 設計系統統一方案（Phase 0 — 開工前）

### 決策：以 design.md 為視覺真相，dev-plan.md 為工程規格

| 維度 | 採用來源 | 原因 |
|------|---------|------|
| 色彩 / 圓角 / 動畫 | design.md (Mochi Starry Night) | 產品差異化；鼠尾草綠太通用 |
| 3 主題架構 | dev-plan.md | 技術合理，保留 eye/mint 主題作「專注模式」 |
| 字體 | 兩者一致 | M PLUS Rounded 1c + Zen Kaku Gothic New |
| CSS 實作方式 | dev-plan.md (`html[data-theme]` + CSS vars) | 成熟方案 |
| 元件 Props / API | dev-plan.md | 完整且正確 |

### 統一後的 CSS 變數

```css
/* Light — Mochi Light */
html[data-theme='light'] {
  --bg:             #FFFBF7;
  --bg-elevated:    #FFFFFF;
  --text:           #334155;
  --muted:          #94A3B8;
  --accent:         #F472B6;
  --accent-hover:   #EC4899;
  --accent-strong:  #DB2777;
  --accent-soft:    rgba(244, 114, 182, 0.1);
  --cta:            #F472B6;
  --cta-hover:      #EC4899;
  --surface:        rgba(255, 255, 255, 0.8);
  --surface-strong: #FFFFFF;
  --border:         rgba(244, 114, 182, 0.1);
  --border-strong:  rgba(244, 114, 182, 0.25);
}

/* Dark — Starry Night */
html[data-theme='dark'] {
  --bg:             #0F172A;
  --bg-elevated:    #1E293B;
  --text:           #F8FAFC;
  --muted:          #94A3B8;
  --accent:         #A78BFA;
  --accent-hover:   #8B5CF6;
  --accent-strong:  #C4B5FD;
  --accent-soft:    rgba(167, 139, 250, 0.14);
  --cta:            #A78BFA;
  --cta-hover:      #8B5CF6;
  --surface:        rgba(30, 41, 59, 0.6);
  --surface-strong: #334155;
  --border:         rgba(255, 255, 255, 0.1);
  --border-strong:  rgba(167, 139, 250, 0.4);
}

/* Eye — Focus Mode (低刺激模式) */
html[data-theme='eye'] {
  --bg:             #F0FDF4;
  --bg-elevated:    #F7FEF9;
  --text:           #334155;
  --muted:          #6B7280;
  --accent:         #7c9a86;
  --accent-hover:   #6b8875;
  --accent-strong:  #516558;
  --accent-soft:    #edf3ee;
  --cta:            #7c9a86;
  --cta-hover:      #6b8875;
  --surface:        rgba(248, 253, 250, 0.88);
  --surface-strong: #fcfffd;
  --border:         rgba(153, 176, 162, 0.28);
  --border-strong:  rgba(114, 156, 126, 0.5);
}

/* 通用 Token */
:root {
  --radius-card:    32px;
  --spring-ease:    cubic-bezier(0.34, 1.56, 0.64, 1);
  --font-sans:      'Zen Kaku Gothic New', 'Segoe UI', 'Noto Sans TC', sans-serif;
  --font-heading:   'M PLUS Rounded 1c', 'Zen Kaku Gothic New', sans-serif;
}
```

### 效能注意事項

- `backdrop-blur` 限制同時顯示 ≤ 5 個（列表頁用不透明背景替代）
- 動畫只用 `transform` + `opacity`（GPU 加速）
- 必須加 `prefers-reduced-motion` 支援
- 裝飾性 blob 用 `opacity` 動畫取代 `filter` 動畫

---

## 2. 實施階段

### Phase 1 — 基建與安全基石（順序執行）

**目標**：可登入、可切換主題/語言的空殼應用。

| # | 任務 | 產出 | 注意事項 |
|---|------|------|---------|
| 1.1 | 初始化 Next.js + 調整至 `src/` 結構 | 可跑的空項目 | `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir` 後重組 |
| 1.2 | `next.config.ts` 設定 `output: 'standalone'` | 構建配置 | |
| 1.3 | Drizzle 設定 + 6 個 schema 檔案 + 遷移 | 15 張表 | **修正項**：加缺失索引、forks 加 UNIQUE、familyTodos.list_id 索引 |
| 1.4 | 全局樣式：統一後的 CSS vars + Tailwind v4 + `postcss.config.mjs` | globals.css | 使用上方統一色彩；加 `mochi-spring` + `mochi-card` 元件層 |
| 1.5 | Google Fonts 載入（`next/font/google`） | layout.tsx | M PLUS Rounded 1c (400,500,700,800) + Zen Kaku Gothic New (400,500,700) |
| 1.6 | Auth 基建 | server/auth.ts, lib/auth.tsx | **安全修正**：Cookie 明確設 `SameSite=Lax; Secure; HttpOnly; Path=/`；scrypt 參數 `{ N: 65536, r: 8, p: 1 }` |
| 1.7 | i18n 設定 + 兩個 locale 檔 | i18n/index.ts | 只在 `'use client'` 內 import |
| 1.8 | 共用工具：types.ts, errors.ts, toast.ts, api-client.ts, theme.ts | lib/ 目錄 | theme.ts 用 `useSyncExternalStore` |
| 1.9 | providers.tsx + root layout + 防閃爍腳本 | 可渲染的 shell | `suppressHydrationWarning` |
| 1.10 | 安全 Headers Middleware | middleware.ts | `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` |

**Phase 1 完成標準**：`npm run build` 零錯誤，瀏覽器可看到空白頁面帶主題切換。

---

### Phase 2 — Server-Side API 層（部分可並行）

**目標**：全部 API 端點可用。

#### 2A — 阻塞層（必須順序）

| # | 任務 | 產出 | 依賴 |
|---|------|------|------|
| 2.1 | Drizzle DB singleton (`server/db.ts`) | 資料庫連接 | Phase 1 |
| 2.2 | User / Auth / Session services | 使用者註冊、登入、登出 | 2.1 |
| 2.3 | Auth API routes (`/api/auth/*`) | 4 個端點 | 2.2 |
| 2.4 | Permission service | `requireAtLeast()`, `requireSpaceAtLeast()` | 2.1 |
| 2.5 | API helpers: `withAuth`, `withOptionalAuth`, 錯誤格式化, Rate limiting | 中間件層 | 2.2, 2.4 |

**安全修正（加入 2.5）**：
- Per-account 登入失敗追蹤 + 5 次失敗鎖定 15 分鐘
- Rate limit `Map` 加 TTL 清理（防記憶體洩漏）
- `Origin`/`Referer` Header 驗證（CSRF 防禦層）
- 資源查詢統一返回 `NOT_FOUND`（不區分「不存在」和「無權限」以防枚舉）

#### 2B — 並行層（各模組獨立）

| # | 任務 | 端點數 | 依賴 |
|---|------|--------|------|
| 2.6 | Collection CRUD API | 6 | 2.5 |
| 2.7 | Link CRUD API + SSRF 保護 | 5 | 2.6 |
| 2.8 | Invite & Member API（Collections） | 7 | 2.6 |
| 2.9 | Marketplace API + 去規範化計數器 | 8 | 2.5 |
| 2.10 | Family Todo — Space / List / Member API | ~10 | 2.5 |
| 2.11 | Family Todo — Task API | ~6 | 2.10 |
| 2.12 | Family Todo — Invite API | 4 | 2.10 |
| 2.13 | Health endpoint | 1 | 2.5 |

**補充端點**（dev-plan 遺漏）：
- `PATCH /api/me/collections/:id/members/:memberId` — 修改成員角色
- `GET /api/family-todo/spaces/:sid/invites` — 列出空間邀請
- `DELETE /api/family-todo/spaces/:sid/invites/:iid` — 撤銷空間邀請

**架構修正**：
- `updatedAt` 更新策略：在所有 `UPDATE` 的 service 方法中手動設值，或建立 PostgreSQL trigger
- Marketplace 計數器加定期校驗邏輯（admin API 或啟動時執行）

**Phase 2 完成標準**：所有 API 端點可透過 `curl` / Postman 測試通過。

---

### Phase 3 — 前端頁面與元件（部分可與 Phase 2 並行）

**目標**：所有頁面可互動。

#### 3A — 基底（順序）

| # | 任務 | 依賴 |
|---|------|------|
| 3.1 | `(main)/layout.tsx` — 導航列、主題/語言切換 | Phase 1 |
| 3.2 | UI 元件：`Glyphs`, `CollectionAvatar`, `ToastHost` | 3.1 |

#### 3B — 頁面（並行，但各自依賴對應 API）

| # | 任務 | 頁面 | 元件 |
|---|------|------|------|
| 3.3 | Home Page | `(main)/page.tsx` | Health check + Hero |
| 3.4 | Auth Pages | `(auth)/login`, `(auth)/register` | 登入/註冊表單 |
| 3.5 | My Collections | `me/collections/page.tsx` | `CollectionCard`, `CollectionFormModal` |
| 3.6 | Collection Detail | `me/collections/[id]/page.tsx` | `LinkCard`, `LinkFormModal`, `InviteManagePanel`, `MemberList` |
| 3.7 | Marketplace 列表 | `marketplace/page.tsx` (Server Component) | `MarketplaceCard`, `SearchBar` |
| 3.8 | Marketplace 詳情 | `marketplace/[listingId]/page.tsx` (Server Component) | `generateMetadata()` |
| 3.9 | Family Todo Spaces | `family-todo/page.tsx` | Space 列表 + CRUD |
| 3.10 | Family Todo Board | `family-todo/spaces/[sid]/page.tsx` | `TodoBoard`, `TodoColumn`, `TodoCard`, `TodoFormModal`, `AddListButton` |
| 3.11 | Invite Join Pages | `invite/[token]`, `family-todo/invite/[token]` | 邀請預覽 + 加入按鈕 |

**設計適配**（來自 design.md）：

| 元件 | Mochi 設計處理 |
|------|---------------|
| 所有卡片 | `rounded-[32px]` + `backdrop-blur` (light) / `bg-slate-800/60 border-white/10` (dark) |
| 卡片懸浮 | `hover:-translate-y-2 hover:shadow-2xl` + `mochi-spring` |
| 按鈕點擊 | `active:scale-95` + `hover:scale-105` |
| LinkCard | 手帳風格，`hover:rotate-1` 微旋轉 |
| TodoCard | 便利貼風格，優先級使用不同背景色（低=淺黃, 中=淺綠, 高=淺粉, 緊急=淺紅） |
| Marketplace | Hero Banner 漸變背景，訂閱/Fork 數用 `yellow-300` |
| 完成勾選 | 粉筆感橫線 `line-through decoration-pink-300 decoration-2` |

**Kanban DnD 注意事項**（最高風險前端功能）：
- 使用 optimistic update + rollback on error
- 跨列移動需同時更新源列和目標列的 sortOrder
- `reorder` API 要求發送所有 ID → 確保客戶端在操作前有最新資料
- 建議先實現列表內拖動，再加跨列拖動

**Phase 3 完成標準**：所有頁面可渲染，互動功能正常。

---

### Phase 4 — 基建與部署

| # | 任務 |
|---|------|
| 4.1 | 多階段 Dockerfile（builder + runner） |
| 4.2 | `docker-compose.yml`（DB + App） |
| 4.3 | `captain-definition` |
| 4.4 | `.env.example` |
| 4.5 | DB 遷移執行文檔（生產環境用 `npm run db:migrate`） |

**Phase 4 完成標準**：`docker compose up` 可完整啟動應用並連接資料庫。

---

### Phase 5 — 驗證與冒煙測試

| 檢查項 | 方法 |
|--------|------|
| TypeScript 編譯 | `npm run build` 零錯誤 |
| Docker 啟動 | `docker compose up` 可連接 DB |
| Auth 流程 | 註冊 → 登出 → 登入 → 存取受保護 API |
| 收藏 CRUD | 新增 → 編輯 → 刪除 → 連結管理 |
| Marketplace | 發布 → 搜尋 → 訂閱 → Fork |
| Invite 流程 | 建立邀請 → 分享連結 → 新用戶加入 |
| Kanban DnD | 列表拖動 + 卡片拖動 + 跨列移動 |
| SSR | `curl /marketplace` 返回含 HTML 內容的頁面 |
| 主題切換 | 三主題切換無閃爍 |
| 語言切換 | zh-HK ↔ en 切換後刷新保持 |
| 安全 Headers | 檢查回應 Headers 包含 CSP、HSTS、X-Frame-Options |

---

## 3. 具體檔案建立順序

以下是建議的精確檔案建立順序，每個步驟都可以在前一步完成後立即驗證：

```
Phase 1 (16 個檔案):
 1. package.json
 2. next.config.ts
 3. tsconfig.json
 4. postcss.config.mjs
 5. drizzle.config.ts
 6. src/db/schema/users.ts
 7. src/db/schema/auth.ts
 8. src/db/schema/collections.ts
 9. src/db/schema/marketplace.ts
10. src/db/schema/collaboration.ts
11. src/db/schema/familyTodo.ts
12. src/app/globals.css           ← 統一後的 Mochi 色彩
13. src/i18n/index.ts + locales/
14. src/lib/types.ts, errors.ts, toast.ts, api-client.ts, theme.ts
15. src/components/providers.tsx
16. src/app/layout.tsx

Phase 2A (8 個檔案):
17. src/server/db.ts
18. src/server/services/user-service.ts
19. src/server/services/auth-service.ts
20. src/server/services/session-service.ts
21. src/server/auth.ts
22. src/server/services/permission-service.ts
23. src/server/api-helpers.ts
24. src/app/api/auth/ (4 route files)

Phase 2B (並行，~20 個 route files + ~8 個 service files)
Phase 3A (3 個檔案)
Phase 3B (並行，~11 頁面 + ~15 元件)
Phase 4 (5 個檔案)
```

**總檔案數**：~80 個檔案

---

## 4. 風險管理

### 技術風險 Top 5

| 風險 | 影響 | 緩解方案 |
|------|------|---------|
| Kanban DnD 的 optimistic update 複雜度 | 前端 bug 多、調試耗時 | 先做列內拖動（簡單），再做跨列（複雜）。每步有獨立可測試點。 |
| 自建 Auth 的安全表面 | 可能有漏洞 | 嚴格按照 Phase 1 安全修正；Phase 5 前做 Auth 流程冒煙測試 |
| i18next 在 Server Component 中不可用 | Marketplace SSR 頁面的文字不能國際化 | Marketplace 頁面用硬編碼中/英文 prop 傳入，或用輕量 server-side i18n helper |
| In-memory Rate Limiting 單實例限制 | 擴展時失效 | 文件中標注限制；Phase 5 後如需擴展再遷移至 Redis |
| 去規範化計數器漂移 | 數字不準確 | 實現 admin 校驗 endpoint；定期跑 reconciliation |

### 已知技術債

| 項目 | 優先級 | 計劃解決時機 |
|------|--------|-------------|
| 無自動化測試 | 高 | 穩定後第一優先 |
| 無 Email 驗證 | 高 | SSO 加入前必須完成 |
| 無密碼重設 | 中 | Beta 前 |
| 無審計日誌 | 中 | 有真實使用者前 |
| 搜尋用 ILIKE | 低 | 數據量大後遷移至 pg_trgm / tsvector |
| serial (int4) 主鍵 | 低 | 目前足夠；可在需要時遷移至 bigserial |

---

## 5. 建議的開發節奏

```
Week 1:  Phase 0 (設計統一) + Phase 1 (基建)
Week 2:  Phase 2A (Auth API) + Phase 2B 開始
Week 3:  Phase 2B 完成 + Phase 3A + 3B 開始
Week 4:  Phase 3B 完成 + Phase 4 + Phase 5
```

> 以上為一位熟練開發者的節奏。如果是兩人分工，一人專注 Phase 2 (API)、一人專注 Phase 3 (前端)，可壓縮至 2.5–3 週。
