# HKER 部署到 CapRover（可重複流程）

本文記錄本次在 `https://captain.rnsj.913555.xyz` 的實際部署流程與下次直接可用的步驟。

## 本次建立的資源

- App: `hker`（主程式）
- App: `hker-db`（PostgreSQL）
- DB 連線:
  - Host: `srv-captain--hker-db`
  - Port: `5432`
  - DB: `hker`
  - User: `postgres`
  - Password: `Ihave2jj`

## 下次部署前提

- 本機已安裝 `caprover` CLI
- 已可登入目標機器：
  - `caprover login -n ntd -u https://captain.rnsj.913555.xyz -p <CAPROVER_PASSWORD>`
- 專案 branch 已包含要部署的 commit（本專案是 `main`）

## 一次性初始化（只做一次）

### 1) 建立 DB App（必須一開始就用 persistent）

`hker-db` 需要 persistent data，不能先建 non-persistent 再補 volume。

```bash
caprover api -n ntd -t /user/apps/appDefinitions/register -m POST
# data:
# {"appName":"hker-db","hasPersistentData":true}
```

### 2) 設定 DB app

```bash
caprover api -n ntd -t /user/apps/appDefinitions/update -m POST
# data:
# {
#   "appName":"hker-db",
#   "instanceCount":1,
#   "notExposeAsWebApp":true,
#   "forceSsl":false,
#   "envVars":[
#     {"key":"POSTGRES_DB","value":"hker"},
#     {"key":"POSTGRES_USER","value":"postgres"},
#     {"key":"POSTGRES_PASSWORD","value":"Ihave2jj"}
#   ],
#   "volumes":[{"containerPath":"/var/lib/postgresql/data","volumeName":"hker-db-data"}],
#   "ports":[{"hostPort":54322,"containerPort":5432}]
# }
```

### 3) 部署 DB image

```bash
caprover deploy -n ntd -a hker-db -i postgres:16-alpine
```

### 4) 建立主 App

```bash
caprover api -n ntd -t /user/apps/appDefinitions/register -m POST
# data:
# {"appName":"hker"}
```

### 5) 設定主 App 環境變數 + container port

重點：`containerHttpPort` 必須是 `3000`，不然會 502。

```bash
caprover api -n ntd -t /user/apps/appDefinitions/update -m POST
# data:
# {
#   "appName":"hker",
#   "instanceCount":1,
#   "notExposeAsWebApp":false,
#   "forceSsl":false,
#   "containerHttpPort":3000,
#   "envVars":[
#     {"key":"DATABASE_URL","value":"postgresql://postgres:Ihave2jj@srv-captain--hker-db:5432/hker"},
#     {"key":"APP_BASE_URL","value":"https://hker.rnsj.913555.xyz"},
#     {"key":"AUTH_SESSION_SECRET","value":"<請換成隨機 32+ bytes secret>"},
#     {"key":"AUTH_SESSION_COOKIE_NAME","value":"hker_session"},
#     {"key":"AUTH_SESSION_TTL_DAYS","value":"30"}
#   ]
# }
```

### 6) 部署主程式

```bash
caprover deploy -n ntd -a hker -b main
```

## 日常更新（之後每次）

只要 DB 設定不變，下次只要：

```bash
git push origin main
caprover deploy -n ntd -a hker -b main
```

## 已踩過的坑

### 坑 1：`public/` 空資料夾導致 Docker COPY 失敗

錯誤：
`COPY failed: stat app/public: file does not exist`

解法：確保 repo 有 `public/.gitkeep`（或任何檔案）。

### 坑 2：部署成功但 502

原因：CapRover 預設 `containerHttpPort=80`，但 Next app 在 `3000`。

解法：更新 app definition 把 `containerHttpPort` 設成 `3000`。

### 坑 3：SSL 申請失敗（No such authorization）

這通常是 DNS / ACME 驗證暫時問題。先確保 HTTP 可通，再過一段時間重試：

```bash
caprover api -n ntd -t /user/apps/appDefinitions/enablebasedomainssl -m POST
# data:
# {"appName":"hker"}
```

