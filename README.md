# Bridgeway Admin

Bridgeway English 內部管理系統(雲端版)。

## 技術架構

- **Next.js 14** (App Router, Server Components, Server Actions)
- **Supabase** (Postgres + Auth + Row Level Security)
- **TypeScript** + **Tailwind CSS**
- **Vercel** 部署

## 本機執行(給 Lee 用的最簡單版)

### 前置條件

- 電腦有裝 **Node.js 20** 以上 → https://nodejs.org
- 電腦有裝 **npm**(裝完 Node.js 就有)

### 執行步驟

在終端機打:

```bash
cd bridgeway-admin
npm install          # 第一次要跑,會下載一堆套件,約 2-3 分鐘
npm run dev          # 啟動開發模式
```

看到:

```
▲ Next.js 14.2.15
- Local:        http://localhost:3000
```

打開瀏覽器,輸入:**http://localhost:3000**

會被導到登入頁,用你在 Supabase 建的 email + 密碼登入。

## 環境變數

`.env.local` 檔案(**不會進 git**):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

第一次 clone repo 時要 `cp .env.local.example .env.local`,然後填入。

## 部署到 Vercel

之後會有詳細步驟。

## 專案結構

```
src/
├── app/
│   ├── (admin)/           ← 主要應用頁面(有側欄)
│   │   ├── page.tsx       ← 儀表板
│   │   ├── teachers/      ← 老師管理
│   │   ├── students/      ← 學生管理
│   │   ├── ...
│   ├── login/             ← 登入頁
│   └── auth/logout        ← 登出
├── components/
│   ├── Sidebar.tsx
│   └── ui/                ← Card, Btn, Modal 等基礎元件
├── lib/
│   ├── supabase/          ← Supabase 客戶端(browser + server)
│   ├── constants.ts       ← 顏色、常數
│   ├── utils.ts           ← 通用函式
│   └── domain.ts          ← 業務邏輯(期別、Hanne 抽成)
└── middleware.ts          ← 認證中介軟體
```
