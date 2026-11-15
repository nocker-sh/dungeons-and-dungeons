/**
 * 1ファイルずつ新しいプロセスで動かすテスト（vite.shared.ts の isolated プロジェクト）。
 * jsdom・vi.mock・vi.stubGlobal・偽タイマー・環境変数の差し替え・終了コードの変更、
 * 画面側のモジュール状態（演出の時計・画像の読込キャッシュなど）を使うテストはここに入れる。
 * それ以外は群（エンジン・builder・作品データや scripts など）ごとに1つのプロセスで続けて動かし、
 * 作品データ・zod・検証済みの定義の読込を群ごとに1回で済ませる。
 * モック・グローバルと環境変数の差し替え・偽タイマー・jsdom・画面の描画・演出の時計の書き換え・終了コード・作業ディレクトリの
 * 入れ忘れは `tests/apps/test-isolation.test.ts` が検出する。それ以外のモジュールの共有状態は検出しない。
 */
export const isolatedTests = [
  "apps/**/*.test.{ts,tsx}",
  "tests/client/**/*.test.{ts,tsx}",
  "tests/development/**/*.test.{ts,tsx}",
  // vi.mock("node:fs") と終了コード
  "builder/cli/apply.test.ts",
  "builder/cli/main.test.ts",
  "tests/builder/cli/save-failure.test.ts",
  // vi.mock("node:crypto")
  "tests/scripts/dev-save.test.ts",
]
