# Minerva Community

早稲田大学の科目ごとに、BBSとテスト情報を共有する非公式コミュニティです。
GitHub Pages上の静的Reactアプリから、別プロジェクトのSupabaseへ接続します。

## 公開データの方針

`scripts/build_catalog.py` は既存の `waseda-classes/scraper/*.csv` をローカルで読み、次のメタデータだけを `public/data` へ出力します。

- 科目名、教員名、学部、年度、学期、曜日時限
- 科目コード、単位数、授業方法区分
- 元のキーをSHA-256で変換した公開ID

授業概要、授業計画、到達目標、成績評価、教科書、参考文献などのシラバス本文は出力しません。元CSV自体もこのリポジトリへ追加しません。

```powershell
npm run catalog
```

既定では隣の `waseda-classes/scraper` を読みます。別の場所から読む場合は次のように実行します。

```powershell
python scripts/build_catalog.py --source C:\path\to\waseda-classes\scraper
```

## ローカル開発

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local` に新しいBBS用Supabaseプロジェクトの値を設定します。

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

`supabase/migrations/20260719_initial_bbs.sql` を新しいSupabaseプロジェクトのSQL Editorで実行し、AuthenticationのAnonymous Sign-Insを有効にしてください。`service_role`キーはブラウザやGitHubへ絶対に設定しません。

## GitHub Pages

リポジトリのSecretsに以下を登録します。

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Settings > Pages > Source を `GitHub Actions` にすると、`main`へのpushで自動公開されます。
