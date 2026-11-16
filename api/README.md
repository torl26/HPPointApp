# API サーバー（@hp-point/api）

鳥栖市 健康ポイントアプリのバックエンド API サーバーです。  
Next.js（App Router / Route Handlers）と Prisma（PostgreSQL / `@prisma/adapter-pg`）で構築され、さくらのクラウド AppRun にデプロイされます。

---

## 目次

- [開発環境のセットアップ](#開発環境のセットアップ)
- [共通モジュール hpDbConnect（共通 41）の使い方](#共通モジュール-hpdbconnect共通-41の使い方)
  - [提供関数一覧](#提供関数一覧)
  - [エントリ呼び出しパターン（Init 〜 Dispose）](#エントリ呼び出しパターンinit--dispose)
  - [実装コード例](#実装コード例)
  - [制約事項と安全設計](#制約事項と安全設計)
  - [エラーコード一覧](#エラーコード一覧)
- [ディレクトリ構成](#ディレクトリ構成)
- [各種コマンド](#各種コマンド)

---

## 開発環境のセットアップ

1. **環境変数の準備**
   ```bash
   cp .env.example .env.local
   ```
   `.env.local` に PostgreSQL の接続情報（`DATABASE_URL`）を設定します。

2. **Prisma Client の生成・マイグレーション**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

3. **開発サーバーの起動**
   ```bash
   npm run dev    # http://localhost:3001
   ```

---

## 共通モジュール hpDbConnect（共通 41）の使い方

`hpDbConnect` は、DB接続・切断およびトランザクション制御（開始・確定・取り消し）を提供する共通モジュールです。

### 提供関数一覧

インポート元: `@/lib/hp-db-connect`（または `@/lib/hpDbConnect`）

| 関数名 | 形式 | 役割 |
|---|---|---|
| `hpDbConnect(ctx)` | `async (ctx: HPContext) => Promise<HPErrorCode>` | DBへ接続し `ctx.db` に格納する。接続済みの場合は参照カウントを +1 する。 |
| `hpDbBegin(ctx)` | `async (ctx: HPContext) => Promise<HPErrorCode>` | トランザクションを開始する。二重開始はエラー（`0xC041_0003`）。 |
| `hpDbCommit(ctx)` | `async (ctx: HPContext) => Promise<HPErrorCode>` | トランザクションを確定（コミット）する。未開始時の確定はエラー。 |
| `hpDbRollback(ctx)` | `async (ctx: HPContext) => Promise<HPErrorCode>` | トランザクションを取り消し（ロールバック）する。 |
| `hpDbClose(ctx)` | `async (ctx: HPContext) => Promise<HPErrorCode>` | 参照カウントを -1 し、0 になった場合のみ接続をプールへ返却する。未接続でもエラーにしない。 |

---

### エントリ呼び出しパターン（Init 〜 Dispose）

各業務モジュール（5エントリ構造）では、以下の順序で呼び出します。

```text
[上位関数]
  │
  ├── Init    : hpDbConnect(ctx) で接続
  ├── Set     : （DBアクセスなし・入力値検証）
  ├── Read    : hpDbBegin(ctx) でトランザクション開始（行ロック読み取り等）
  ├── Body    : 登録・更新・確定（成功時は hpDbCommit、失敗時は hpDbRollback）
  └── Dispose : 成否にかかわらず必ず hpDbClose(ctx) を実行
```

---

### 実装コード例

#### 1. 基本的なトランザクション更新処理
```typescript
import {
  hpDbConnect,
  hpDbBegin,
  hpDbCommit,
  hpDbRollback,
  hpDbClose,
} from "@/lib/hp-db-connect";
import { HP_OK, type HPContext, type HPErrorCode } from "@hp-point/shared";

// 【Init】DB接続
export async function hpSampleInit(ctx: HPContext): Promise<HPErrorCode> {
  const code = await hpDbConnect(ctx);
  if (code !== HP_OK) {
    return code;
  }
  return HP_OK;
}

// 【Body】更新と確定
export async function hpSampleBody(ctx: HPContext): Promise<HPErrorCode> {
  // トランザクション開始
  const beginCode = await hpDbBegin(ctx);
  if (beginCode !== HP_OK) {
    return beginCode;
  }

  try {
    // ctx.db 経由で Prisma のモデル操作を直接実行（Proxy経由でトランザクション内で実行）
    await ctx.db.event.update({
      where: { eventId: 1 },
      data: { status: "公開" },
    });

    // コミット
    const commitCode = await hpDbCommit(ctx);
    if (commitCode !== HP_OK) {
      await hpDbRollback(ctx);
      return commitCode;
    }

    return HP_OK;
  } catch (error) {
    await hpDbRollback(ctx);
    return 0xC001_0004; // DBエラー
  }
}

// 【Dispose】接続解放（成否にかかわらず必ず実行）
export async function hpSampleDispose(ctx: HPContext): Promise<HPErrorCode> {
  await hpDbClose(ctx);
  return HP_OK;
}
```

---

### 制約事項と安全設計

1. **参照カウントによる接続共有**
   - 参加受付（`hpAttendance`）からポイント付与（`hpPointGrant`）を呼び出すような親子関係の場合でも、同一の `ctx.db` を共有します。
   - 子モジュールの `Dispose` で `hpDbClose` が呼ばれても参照カウントが減るだけで、親の接続は切断されません。最上位の `Dispose` でカウントが `0` に達したときのみ切断されます。

2. **未接続時の安全なクローズ**
   - `Init` での接続失敗時や、未接続のまま `Dispose` が呼ばれた場合でも、`hpDbClose` はエラーをスロー・返却せず `HP_OK` で正常終了します。

3. **未確定トランザクションの自動ロールバック**
   - `Body` の途中で例外が発生し `hpDbRollback` が漏れた場合でも、`hpDbClose`（参照カウントが `0` のタイミング）で未確定トランザクションを自動的にロールバックします。

4. **環境変数の厳格管理**
   - 接続先と認証情報は `DATABASE_URL` 環境変数から取得し、コードやログに平文を残しません。

---

### エラーコード一覧

モジュール番号 `41`（`0xC041_xxxx`）の定義です。定数は `@hp-point/shared` から利用できます。

| 定数名 | 値 | 内容 | 呼び出し元の対応 |
|---|---|---|---|
| `HP_OK` | `0x0000_0000` | 成功 | 正常終了 |
| `HP_ERR_DB_ARG` | `0xC041_0001` | 引数エラー（`ctx` が未指定など） | プログラム修正 |
| `HP_ERR_DB_CONNECT` | `0xC041_0002` | DB接続失敗 | 自身のDBエラーへ読み替えて返却 |
| `HP_ERR_DB_TRANSACTION` | `0xC041_0003` | トランザクション操作エラー（二重開始、開始前の確定など） | プログラム修正 / ロールバック |
| `HP_ERR_DB_TIMEOUT` | `0xC041_0004` | 接続またはトランザクションのタイムアウト | 自身のDBエラーへ読み替えて返却 |

---

## ディレクトリ構成

```text
api/
├── prisma/
│   ├── schema.prisma       # テーブル定義
│   └── migrations/         # マイグレーションファイル
├── src/
│   ├── app/                # Next.js App Router（API Route Handlers）
│   │   └── api/            # API エンドポイント（/api/...）
│   ├── generated/prisma/   # 自動生成された Prisma Client
│   ├── lib/                # 共通処理・モジュール
│   │   ├── hp-db-connect.ts # DB接続・トランザクション管理
│   │   ├── hpDbConnect.ts  # re-export用
│   │   ├── hpEventQrIssue.ts
│   │   └── password.ts
│   └── types/              # バックエンド内部型定義
│       └── context.ts      # HPApiContext 定義
└── prisma.config.ts        # Prisma 7 設定ファイル
```

---

## 各種コマンド

```bash
# 型チェック
npm run typecheck -w api

# リント実行
npm run lint -w api

# Prisma スキーマ同期（DB反映）
npx prisma db push

# マイグレーション作成・適用
npx prisma migrate dev --name <変更内容>
```
