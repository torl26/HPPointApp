# 健康ポイントアプリ（hp-point）

## 構成

| フォルダ | 内容 |
|---|---|
| `client/` | 利用者向けアプリ（Next.js 静的エクスポート＋Capacitor） |
| `api/` | APIサーバー（Next.js Route Handlers、さくらのクラウド AppRun にデプロイ） |
| `shared/` | client と api で共有する型・スキーマ・定数 |

## 必要なもの

- Node.js（バージョンは `.nvmrc` を参照）
- Docker Desktop

## はじめての起動

```bash
git clone <このリポジトリのURL>
cd hp-point
npm install
cp api/.env.example api/.env.local
cp client/.env.example client/.env.local
docker compose up -d
```

## 開発サーバー

ターミナルを2つ開いて、それぞれで実行します。

```bash
npm run dev:client   # http://localhost:3000
npm run dev:api      # http://localhost:3001
```

## 作業の流れ

1. `main` から担当ごとにブランチを切る（例：`feature/points-grant`）
2. コミットしてpushし、PRを出す
3. レビューを受けてから `main` にマージする

`main` へ直接pushしないでください。

## パッケージの追加

ルートから、追加先を `-w` で指定します。

```bash
npm install zod -w api
```
sumgettan