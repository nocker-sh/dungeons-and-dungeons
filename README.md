# ダンジョンズ & ダンジョンズ！

ゲーム本体は `apps/main`、開発アプリは `apps/studio` に置く。それぞれの `package.json` と Vite 設定を持ち、ルートは共通コード・資料・検証ツールとワークスペースの操作を管理する。

- 共通コード（エンジン `lib/`、データ `content/`・`concept/`）はルートに置き、両アプリが tsconfig の `@/` で読む。依存の向きは「スタジオ → ゲーム → 共通コード」の一方向で、ゲームはスタジオを読まない。
- 依存の版は `pnpm-workspace.yaml` の `catalog` で一度だけ決め、各 `package.json` は使う物だけを `catalog:` で宣言する。
- 本番ビルド（`vp run build`）は、配布物に開発用の入口が残っていないかを検査してから終わる。

## ゲームと開発ツール

- ゲームは`vp run dev` を実行して `https://dnd.localhost` を開く。
- 開発ツールは `vp run dev:studio` で起動し、`https://dev.dnd.localhost` を開く。ソース変更を即時反映する場合は `vp run dev:studio:watch`。
- 手元のセーブで試遊するには両方を起動し、スタジオの `https://dev.dnd.localhost/save` にセーブのJSONを貼り付ける。スタジオはゲームの `https://dnd.localhost/?save=message` をiframeで開いてセーブを送るだけで、ゲームは受け取ったセーブをメモリだけで遊ぶ（本来のセーブは変わらない）。


3人の仲間を育て、「進む」「戻る」でダンジョン突破を目指すローグライト。Void + Reactで開発中。

```sh
vp install
vp run dev
```

開発URL: https://dnd.localhost

- `apps/main/pages/`: Voidのページとローダー
- `apps/main/client/`: 画面・ブラウザ保存・プレビュー実行
- `lib/wiz/`: 作品データから独立したゲームエンジン
- `content/`・`concept/`: 作品固有のデータと組み立て
- `apps/studio/development/`: 開発画面のシナリオ・測定支援
- `tests/`: 横断・結合テストとE2E（単体テストは実装の隣）
- `builder/`: ブラウザなしのプレイ・バランス測定

```sh
vp check
vp test run
vp run typecheck
vp run build
```

`vp test run` は品物・敵・段階ごとの組み合わせから代表だけを回し、バランスは上下両側に範囲がある目安だけを測る。全件の組み合わせと、一周（`campaign-*`）を除くバランスの目標は `vp run test:full` で回す（重いので必要なときに直列で）。一周を含むバランスの全目標の合否は `vp run cli check` で決める。

画像はGit管理外。元画像は `private/art/originals/`、表示用はR2移行まで `public/tmp/` に置く。

CLIは `vp run cli`、任意のBunスクリプトは `vp exec bun <file>` で実行する。CLIのimportは `@/` の絶対パスで統一する。依存は `pnpm-lock.yaml` で固定し、CIでは `vp install --frozen-lockfile` を使う。

仕様と設計は [[.docs/index|資料の入口]]、構造化した設定は [[concept/lore]]、公開プロンプトは [[concept/prompts]]。資料はWikiリンクを使う。画像本体・原画・ローカルの制作環境は含まれない。

資料を変更したら `vp run check:docs` と `vp run check:concept` で参照・設定・生活設備・配置の整合を確認する。

AI向けのグラフィック確認は `/view?scene=battle&seed=77&at=2000`（入力無効）、動作確認は `/play/town?seed=77`。指定可能な場面は `/view?catalog=1`、詳しい手順は [[.docs/dev-preview]]。
