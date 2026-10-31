# ダンジョンズ & ダンジョンズ！

3人の仲間を育て、「進む」「戻る」でダンジョン突破を目指すローグライト。Void + Reactで開発中。

```sh
vp install
portless dnd vp run dev
```

開発URL: https://dnd.localhost

- `pages/`: Voidのページとローダー
- `client/`: 画面・ブラウザ保存・プレビュー実行
- `lib/wiz/`: 作品データから独立したゲームエンジン
- `content/`・`concept/`: 作品固有のデータと組み立て
- `development/`: 開発画面のシナリオ・測定支援
- `tests/`: 横断・結合テストとE2E（単体テストは実装の隣）
- `builder/`: ブラウザなしのプレイ・バランス測定

```sh
vp check
vp test run
vp run typecheck
vp build
```

画像はGit管理外。元画像は `private/art/originals/`、表示用はR2移行まで `public/tmp/` に置く。

CLIは `vp run cli`、任意のBunスクリプトは `vp exec bun <file>` で実行する。CLIのimportは `@/` の絶対パスで統一する。依存は `pnpm-lock.yaml` で固定し、CIでは `vp install --frozen-lockfile` を使う。

仕様と設計は [[.docs/index|資料の入口]]、構造化した設定は [[concept/lore]]、公開プロンプトは [[concept/prompts]]。資料はWikiリンクを使う。画像本体・原画・ローカルの制作環境は含まれない。

資料を変更したら `vp run check:docs` と `vp run check:concept` で参照・設定・生活設備・配置の整合を確認する。

AI向けのグラフィック確認は `/dev/view?scene=battle&seed=77&at=2000`（入力無効）、動作確認は `/dev/play/town?seed=77`。指定可能な場面は `/dev/view?catalog=1`、詳しい手順は [[.docs/dev-preview]]。
