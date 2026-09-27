# HKER 整合完成報告

本報告取代分開的 cleanup／product completion 執行清單。PRODUCT.md 仍是產品定義；release checklist 是重跑程序，Phase 7–10 文件是歷史證據。這是本機候選版本驗收，並非正式發布或真實商戶驗證。

## 狀態與範圍

**IMPLEMENTED / LOCALLY VERIFIED**：目錄 Public、Admin、mock Telegram 的修正與清理。**CI VERIFIED：尚無新版本遠端結果。LIVE VERIFIED：未執行。** 未 push、部署、發送真實訊息、變更正式資料／權限／密鑰。

起點為 `main` 的 `a7e9ca62a5f3d2daaf3760f84546918e87a2a111`。遠端 run `36333542829` 的失敗已重新核對，不能用更早的綠燈認證本次變更。既有 Dockerfile `NEXT_PHASE` build guard 保留在工作目錄，刻意不納入本次提交；因此驗收對象是 manifest 記錄的工作樹，不是僅憑 HEAD 就能重建的正式映像檔。

本機為 macOS arm64、Node 24.15.0、PostgreSQL 16.15；Docker 為 Linux arm64、Node 24.21.0。所有資料為隔離的虛構測試資料，Telegram 使用 mock。沒有改寫任何 applied migration、ledger、retained schema 或 legacy rows。

## Findings／acceptance matrix

| 要求 | 起點發現與實作 | 本機證據與邊界 |
| --- | --- | --- |
| CI-01 | Analytics fixture 混用資料庫日期及香港報表日期；獨立 fixture、明確時鐘、日界線與 scoped cap 斷言 | UTC／香港、16:00 UTC 前後、2,000 distinct keys＋overflow、並行／dedupe 分別通過；未放寬 cap |
| CI-02 | 150ms 等待不是 readiness；改用唯一 health file、精確 PID、close barrier 與有界 kill | 整合測試與 Linux cold-start 三次通過；各加入 500ms 初始化延遲，readiness 約 775–1,193ms，SIGTERM 均 code 0、signal null、stopped true |
| CI-03 | 冒號 artifact 名稱不相容 | 共用 ASCII allowlist、長度限制、stage/hash helper；Node 回歸 1/1。workflow 僅允許指定 JSON/log/PNG/YAML，包含巢狀截圖；真實 GitHub upload **NOT RUN** |
| DEL-01/02/03 | 舊 Bills／Spaces／Marketplace 等 executable closure 殘留 | 移除清單 229 files，root-specific 410/no-store handlers 支援 root/deep/methods；direct-handler 與 compiled-route 測試通過；完整 migration model 保留 |
| LINK-01/02/03 | tel/mailto 被錯送 HTTP-only redirect | 共用 presenter；HTTP(S) 保持 stored-ID redirect，tel/mailto 原生且顯示可讀值；URI controls／header injection 拒絕，合法 body/subject 參數保留；無實際聯絡動作 |
| ERR-01 | storage outage 被顯示成限流 | 429＋Retry-After 與 503 分開，保持 fail closed；invalid、zero-results、expired session、stale draft 有不同恢復文字；SSR 錯誤畫面不宣稱能事後改已送出的 HTTP status |
| NAV-01/02 | 詳細頁返回遺失搜尋條件 | bounded relative `/search` allowlist；sort/page/price/tags 保留，直接開啟有 fallback；canonical 不含 return context；現有 Back/Forward 與 portable search 回歸保留 |
| PUB-01 / DATA-01 | Root AuthProvider 觸發匿名 session fetch，metadata/body 重讀 | 無 consumer 的 provider 移除；React request cache 共用 public DTO loader；built-image 每 request 10→5 SQL，後續 request 仍重新檢查 visibility |
| AUTH-01/02/03 | malformed hash callback 比較及 unknown-account 快速退出需加固 | 嚴格 compatible hex/length、固定 scrypt N=65536/r=8/p=1、同成本 dummy、4KiB password byte limit；banned user 拒絕；保留 limiter、CSRF、roles、session controls。不宣稱網路 timing 相等或 DDoS 保證 |
| AUTH-04/05 | lastSeen stale read 可能並行重寫；缺少狹窄 recovery | conditional update：12 個並行讀取只有 1 次 timestamp UPDATE；offline recovery 僅既有 active Admin，無升級／新建，撤銷 sessions；虛構帳號測試通過 |
| MAINT-01 | request-time 隨機 global limiter cleanup | 移到現有 maintenance；最大 window 24h、有界批次與 SKIP LOCKED；expired sessions／舊 login failures 清理；失敗時間窗更新加 row lock，並行 cleanup＋10 次 failure 不漏鎖定 |
| WRITE-01 | 單筆新增 response loss 無身份可重試 | 重用 catalogPlans 24h actor-owned receipt，同交易保存 listing＋receipt，UUID mandatory；Editor 相同草稿重試保留 key，5xx／失聯不顯示成功；stale revision／穩定 link ID／import/bulk status recovery 回歸保留 |
| SEARCH-01 / CONTENT-01 | 搜尋語意需保持 | 新增 32 個 deterministic corpus cases，保留 Web/Bot、hierarchy、hidden tags、AND/OR、零／未知／外幣／open range 回歸。公開 attrs 可用價格說明，未知不當免費，updatedAt 不當核實日期 |
| INFO-01 | 缺少 discoverable disclosures | About／Privacy／correction footer；聯絡點只讀 `DIRECTORY_SUPPORT_URL`。未配置時明示不接受提交；真實聯絡驗收 **OWNER APPROVAL REQUIRED** |
| SEO-01/02 | 無完整 sitemap | published canonical slug 專用 query、45,000 entries 分段、index；不輸出 aliases/drafts/returnTo、不捏造 lastmod；search/protected noindex、staging disallow 與 sitemap 404 |
| HEADER-01 | 檢查有效 headers，收窄 referrer/HSTS | production per-request nonce CSP（無 unsafe-eval）、no-referrer、HSTS 不涵蓋未確認 subdomains；production browser hydration/forms/dialogs 通過。真實 ingress **NOT RUN** |
| A11Y-01 | reduced-JS search 原被 streaming loading fallback 阻擋 | 移除共用 loading boundary 後 native no-JS search 通過；skip link、focus return、320/390/768/1440 reflow、dialog/unsaved checks 通過；實體手機／Telegram client **NOT RUN** |
| PERF-01 | 保留 bounded hydration 與 fairness | 1/20/200 bulk preview 固定 16 statements、export 15；worker fairness／lease／recovery 回歸保留；未新增猜測性索引 |
| IMAGE-01 / OPS-01 | standalone 又複製完整 prod node_modules | 使用 Next 內建 NFT 追蹤 operational entry dependencies 並合併 standalone；image-only bootstrap/migration/doctor/cleanup/mock worker/restore/predecessor rehearsal，見下方最終證據 |

## 刪除與保留

完整路徑在 [directory-removal-manifest.json](directory-removal-manifest.json)。移除 Bills、Spaces/Todos、Collections、舊 Marketplace、subscription/fork、invite/collaboration、retired tools，以及失去 consumer 的卡片、modal、hooks、theme、i18n、AuthProvider、API client、舊測試。另移除一個影響 no-JS 的共用 loading 檔。

移除 6 個 direct dependencies：`@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`、`i18next`、`react-i18next`、`lucide-react`，lockfile 共少 10 packages。TypeScript、esbuild、Tailwind/PostCSS、React types 共 6 項建置工具移到 devDependencies。未以人工 runtime package allowlist 取代動態依賴追蹤。

保留 `src/db/schema` 全部 migration ownership、drizzle snapshots/migrations、內部原子 register/bootstrap、密碼格式、auth/session、directory search/transactions/import/export/bulk/history/analytics/durable worker。runtime schema registration 只載入 auth/users/rateLimit/directory/operations。隔離 schema generation 回報 **No schema changes, nothing to migrate**（`/tmp/hker-schema-check-2.log`）；fresh 10 migrations、upgrade 4→10、reviewed schema 9→10 均保留 Listing/link identities、plan 與 pending job。

單元測試 602→221 是移除舊產品測試後再加回新回歸，**不代表較少測試就是更強覆蓋**。

## 驗收證據與重跑

使用 `.nvmrc` 的 Node 24、獨立 loopback `hker_directory_test`、`ALLOW_DIRECTORY_TEST_RESET=1`。命令與退出碼／source tree／lockfile／platform hash 均在各 manifest；不得對一般 development 或 production DB 跑。

- 首次本機 baseline `acceptance/20260927180233-7708b9`：602 unit 通過，85 integration 通過／1 failed（2020 vs 2001）；worker timing 問題未在此 macOS 重現。
- repaired baseline `acceptance/20260927180859-be44f6`：602 unit、88 integration、38 Chromium、typecheck/lint/migrations/build 全通過。
- 最終完整 `acceptance/20260927183442-b7bb80`：`npm run test:acceptance` exit 0；221 unit＋獨立 Node helper 1、124 integration、56 Chromium 全通過、無 required skips；typecheck/lint/fresh/upgrade/build/fixture 全成功。
- `npm run test:e2e:webkit` exit 0：WebKit 26.6，4/4 supported journeys，20.9s；`artifacts/release-candidate/webkit.json`。
- Linux exact-process cold worker：`artifacts/release-candidate/linux-worker-readiness.json`，3/3 passed；測試 harness 同目錄 `.mjs`，只用 mock。
- 最終 `npm run ops:rehearsal` exit 0，`phase10/20260927183940-dd9869` 的 candidate/deployment 為 **LOCALLY_VERIFIED**、runtime 為 passed；image `hker:phase10-48cc6078-2a6ae4de-dd9869`，ID `sha256:9b4aedcbb45db0a2e0f9629c37043ddcec7db32531af2b66d9840f197a36c88c`。有獨立 DB/restore、missing configuration/schema/migration failures、rollback compatibility、worker heartbeat、owned resource teardown 證據。舊成功 `phase10/20260927182500-e367b1` 只證明較早 tree；`phase10/20260927183534-c1e65c` 因共用 restore caller 缺 requestKey 失敗，已保留 failure manifest 並修正 caller，不能當綠燈。

所有相對 artifact 路徑以上述 repository 的 `artifacts/release-candidate/` 為根；generated evidence 不提交到 Git，避免 dumps／session state／大型檔案進入 repository。更早的失敗記錄保留：並行20個 analytics writers 觸發既有 lock timeout、suite 間 fairness global rows 污染、測試不合法 sort、實際 no-JS loading 問題、未等待導頁 assertion；各項修正後重新完整執行。

## 實測（非容量保證）

相同 Linux arm64 base/runtime 的 before image `hker-completion-baseline:20260928` 與候選 image。baseline 為 repaired CI commit＋使用者既有 Docker guard。前後各 30 次 detail requests、單一用戶，DB 為同一隔離 PostgreSQL。SQL 以 DB statement logs 計數，僅儲存數量，完畢關閉 logging；第一次 preload instrumentation 量到 0 屬無效測量，不列入結論。

| 指標 | Before | After |
| --- | ---: | ---: |
| Image bytes（最終候選） | 667,052,314 | 231,588,519 |
| Shipped package.json files（相同計法，非 unique package identities） | 330 | 142 |
| 詳細頁 metadata＋body SELECT／request | 10 | 5 |
| 五個匿名 Public journeys session requests | 5 | 0 |
| 五頁 unique JS response bytes（未壓縮） | 545,220 | 462,648 |
| unique JS chunks | 16 | 14 |
| detail HTTP p50／p95 ms | 16.23／53.19 | 12.93／46.77 |
| idle Web RSS/container memory 單次 snapshot MiB | 86.33 | 66.42 |
| unit stage wall time 秒 | 17.36 | 6.89 |
| production build stage 秒 | 17.07 | 15.19 |

來源 `runtime-comparison.json`、`detail-statements.json`；query count 使用先前 image（相關 Public code 與最終相同）。HTTP timing、memory 為開發機觀察，未控制 Docker build contention，不主張統計顯著 latency／memory speedup。SQL 去重和 session request 消除有直接計數證據；測試時間受 suite retirement 影響。

`benchmark:catalog`：3,000 fictional records、30 samples、concurrency 8、零 errors。暖查詢 p50/p95 ms：home 2.15/3.69、empty 2.46/4.03、中文 426.49/654.12、tag alias 654.90/1154.82、AND 15.01/105.75、OR 15.24/23.83、parent area 7.99/12.34、price 6.58/11.39、detail 2.57/4.50、Admin filter 96.42/159.24、Bot planning 1347.02/2106.87。`/tmp/hker-completion-benchmark.log` 含計畫。這輪與 build 有競爭，沒有可比 before latency，不推論效能提升或吞吐容量。

`acceptance/20260927183442-b7bb80/rc05-statements.json`：1/20/200 bulk preview 為16/16/16 statements，24.58/9.47/37.60ms；export 15/15/15，4.52/4.78/8.93ms。單次延遲不是 p95。未變更 worker idle polling，不宣稱 event-loop/CPU 容量改善。

`npm audit`：4 moderate，均為 dev-only drizzle-kit／esbuild transitive chain，0 high/critical；建議強制 downgrade 不採用。正式 shipping closure 以 NFT＋image rehearsal 驗證，沒有宣稱零供應鏈風險。

## 視覺與操作檢查

實際開啟 `.impeccable/review/release/detail-320.png`、`editor-390.png`、`search-768.png`、`public-1440.png`：沒有橫向裁切、正文／關閉／儲存不可達問題；長文字輸入保持原生水平滾動。保留現有藍白設計，沒有重設產品視覺。其他 widths/long-text/error 截圖由同輪 browser 測試生成。Impeccable detector 22 項皆為既有 palette/type-ramp advisory，無 blocking finding；此判斷不代替 screenshot/interaction。桌面 viewport 模擬不是實體裝置驗收。

## Operator 最小操作與限制

- Recovery：先用 `npm run ops:build`，在有權接觸該環境的 operator shell 以受保護 JSON stdin 執行 `node .ops/recover-admin.cjs < /protected/recovery.json`（image：`node ops/recover-admin.cjs`）。JSON 僅 `email`、`password`；檔案限 operator 可讀，不用 shell argument/history 傳密碼，完成後依既有秘密管理流程移除。只接受既有未 banned Admin/superadmin 且 exactly one password identity；成功撤銷該帳號所有 sessions。正式操作仍需指定目標授權。
- Maintenance：沿用 `analytics:cleanup`／既有 maintenance runner，觀察實際 deleted counts／last success；不是設定排程就當成功。保留至少24h limiter history及活躍 lock；批次有界。
- Worker：heartbeat 缺失先查 process/schema readiness；heartbeat 活但 backlog 增長則查 queue progress、retry/dead counts與供應商狀態；不要把 Public 200 當 worker 健康。
- Recovery/backup：本機 dump/restore/predecessor 演練僅在獨立 mock DB；同 host dump 不能證明 host-loss recovery。正式 restore 必須保持 outbound quarantine，不能用 mock 把真實工作標記完成。
- Listing replay receipt 保留24h；Editor 未確認結果超過23h或修改原草稿後阻擋盲目 replay，提示另一分頁核對。Receipt 不等於跨永久時間的 exactly-once 保證。
- Session revocation 阻擋後續 request；已開始的 request 仍可能完成，不宣稱線性化即時撤回。已送出的 Telegram 內容亦不會因 unpublish 自動消失。

## 有界 supervised beta 與 owner gates

Public：找別名 → 點已配置快捷入口 → refine tags/price → 開啟網站／聯絡動作（測試只攔截）→ 返回完整條件 → no-results reset → 查看更正入口。Admin：reviewed import、兩分頁 conflict 保留草稿、publish/unpublish 即時 visibility、selected export、未知儲存結果以原 operation identity 核對。任何資料遺失、未授權寫入／洩漏、錯誤 visibility、primary action 中斷或 required acceptance failure 均阻擋 beta。

**OWNER APPROVAL REQUIRED / NOT RUN**：owner-approved support contact、真實目錄內容、正式 origin/host及ingress、獨立 backup target與核准 restore、live Bot＋專用 chat、實體手機／Telegram client、push/deploy 授權。沒有為此新增付費服務、live notification、平台或自動監控。下一個 operational gate 是 owner 提供具體環境與授權後，在該目標執行既有 release checklist；目前沒有正式發布聲明。

## 本機提交與收尾

- `48cc607`：CI fixtures、exact-process readiness、portable evidence。
- `b1b0209`：Public actions、錯誤／導航、request-scoped detail、disclosures/SEO/CSP/a11y。
- `5876c50`：password/session/recovery/maintenance、Admin receipt 與草稿恢復。
- `3d0fd08`：229-file retirement closure、410 handlers、migration ownership 分離。
- `d39325d`：dependencies／standalone operational trace、修正並驗證 image rehearsal callers。
- 本報告與 README/release checklist 指向更新另以 documentation commit 保存。

完整 acceptance 後僅再改驗收呼叫端、teardown heartbeat assertion 及文件；最終 image rehearsal、lint、`git diff --check` 再次成功。額外 Linux harness 改用 ESM 後亦在最終 image 重跑成功。所有 task-owned 程式變更已提交，僅保留原有 Dockerfile build guard 為未提交使用者變更。測試 DB 容器停止並保留其隔離資料供重現，probe containers 移除；未動其他容器或資料卷。
