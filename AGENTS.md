# ダンジョンズ & ダンジョンズ！

端的に、カジュアルに答える。

## ゲームと仕様

- 仲間を育て、3人（前衛2・後衛1）で「進む」「戻る」を選ぶローグライト。仲間は求人で集め、キャラクター合成は作らない。
- 1行動ごとに1つの結果を見せる。収集・育成・探索のテンポを重視し、出撃準備を長くしない。
- 確定要件は `.docs/game-spec.md`、受入条件は `.docs/features.md`。実装済みの仮ルールを確定仕様にしない。
- 演出は `.docs/animation-rules.md`、プレビュー・スタジオは `.docs/dev-studio.md` を参照する。
- 設定・台本・説明文は `.docs/writing-tone.md`、画像生成は `.docs/image-generation.md` に従う。

## データとエンジン

- 名前・紹介文・セリフ・画像参照は `concept/data/`、数値・会話台本は `content/data/` のJSONを正とする。
- 設定の構造化データは `concept/lore/` のJSONを正本とし、資料は `entity` のWikiリンクで参照する。寸法・設備・関係・出典を本文やFront Matterへ複製しない。
- 裏設定・出典・制作意図の説明は `.docs/concept/`。1データ1ファイルとし、形式・Front Matterは `.docs/concept-data.md` に従う。実行用データを複製しない。
- `/dev` は実行用データと育成シミュレーションの確認用。裏設定・制作メモを表示せず、アプリから `.docs` をimportしない。
- `lib/wiz/` はクラスベースのゲームエンジン。React・DOM・localStorage・作品固有データから独立させる。
- 操作は具象ユースケース、表示値と操作可否はQuery。乱数・時計・ID・保存先をDIで差し替える。
- React Contextでエンジンを注入し、`useSyncExternalStore`で購読する。Reactにゲーム状態を複製しない。
- `lib/wiz/core/` は `~/v0-text-world/lib/open-wiz` の複製。元リポジトリは変更しない。複製側を変更したら既存テストを保ち、provenanceの理由・ローカルハッシュを更新する。
- 保存データは境界で検証する。読み込めない保存を自動上書きせず、拒否した操作で資産・報酬を変更しない。

## ファイルと依存の規約

- 作品固有のデータ・実装は `content/`・`concept/`、開発支援は `development/` に置く。`lib/` はエンジンなど再利用するライブラリのために使う。
- 関数・クラス単位のテストは実装と同じフォルダへ `ファイル名.test.ts`（JSXは `.test.tsx`）として置く。横断・結合・データ全体の検証は `tests/`、E2Eは `tests/e2e/` に置く。
- 1ファイルからexportする関数は1つまで。関数ごとに定義ファイルを分ける。
- re-exportは禁止。型を含め、利用側から定義元を直接importする。importした値を別名のexportやラッパーで迂回させない。
- コンポーネントのファイル名はコンポーネント名のkebab-caseにする（`ListView` → `list-view.tsx`）。`index.tsx`は禁止。
- コンポーネントと、オブジェクトを入力に取るフックのpropsは `type Props = ...` で定義する。引数・本体ともpropsを分割代入せず、`props.name` の形で参照する。

## 画面

- 開発画面のUIはshadcn。サイドバーはセクション表示を保つ。
- ゲーム画面は `client/components/canvas/` の部品とstyle属性・motion/reactで描画し、CSSファイルを使わない。Canvas部品は `all: revert` でページ側のCSSから分離する。
- スマホファースト。文字は日本語にし、意味が重複する英語を飾りで添えない。ステータス略語と擬音は例外。
- 画像はユーザー提供または依頼を受けて生成する。未用意なら四角や色付きdivを使う。

## ローカル開発

- 依存の導入は `vp install`、ロックは `pnpm-lock.yaml`。`bun.lock` は使わない。
- CLIはBunを実行環境にし、`vp run cli` または `vp exec bun <file>` から実行する。CLIのimportは `@/` の絶対パスにする。

- Portless名は `dnd`、URLは `https://dnd.localhost`。
- 場面確認は `/previews/{slug}`。`?still` で動きを止める。
- 数値・ワザ・敵・規則を変えたら `vp run cli check`。CLIの操作・測定方法は `builder/README.md`。
- 資料への参照はWikiリンクだけを使う。名前・IDだけの索引、日付別の作業実況、一時画像の一覧は作らない。固有の設定・判断・手順を残し、正本を複製しない。
- `.docs/` は公開する仕様・設計資料としてGit管理する。画像本体はコミットしない。元画像は `private/art/originals/`、R2移行前の表示用画像は `public/tmp/`。

公開資料は非公開ファイルへのリンク・端末固有パス・秘密情報に依存させない。プロンプトは公開可能。生成履歴の指示文と現在の採用・実装状態を混同しない。
