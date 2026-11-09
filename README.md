# Calorie-tracking-app

毎日食べたもののカロリーを入力・編集し、日ごとの合計をグラフで見るだけのアプリ。
Next.js 16 (App Router) + Supabase。Vercel にデプロイする前提。

## 機能

- 日付ごとに「食べたもの / kcal」を追加・編集・削除
- 料理の写真から品ごとのカロリーを Claude で推定 → 内容を確認・修正して登録
- 日ごとの合計カロリーを棒グラフ表示（7 / 30 / 90 日）。バーをタップするとその日を表示
- Supabase Auth のメール+パスワードでログイン（他アプリと同じユーザーでログイン可）

## 共有 Supabase への影響について

Salary-Management などと同じ Supabase プロジェクトを使う前提で、他アプリに影響しないようにしています。

- 作成するのは `calorie_app_entries` テーブルとそのインデックスだけ（`calorie_app_` プレフィックス）。既存テーブル・関数・ポリシーには触れません
- データはユーザーごと（`user_id`）に分離
- RLS を有効にしてポリシーは作っていないので、anon キーからはこのテーブルを読み書きできません。
  アクセスは API ルートからのみで、リクエストの Supabase アクセストークンを検証した上で service role key を使います

## セットアップ

1. Supabase ダッシュボードの SQL Editor で
   [`supabase/migrations/001_create_calorie_app_entries.sql`](supabase/migrations/001_create_calorie_app_entries.sql) を実行
2. Vercel のプロジェクトに環境変数を設定（値は他アプリと同じ Supabase のもの）

   | 変数 | 内容 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key（サーバー専用） |
   | `ANTHROPIC_API_KEY` | Claude API キー（写真からの推定に使用、サーバー専用） |

3. デプロイ

## ローカル開発

```bash
cp .env.example .env.local   # 値を埋める
npm install
npm run dev
```
