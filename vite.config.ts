import { configDefaults, defineConfig, lazyPlugins } from "vite-plus"
import { voidPlugin } from "void"
import { voidReact } from "@void/react/plugin"
import tailwindcss from "@tailwindcss/vite"
import { devSave } from "./scripts/dev-save"
import { devQuietData } from "./scripts/dev-quiet-data"

const config = defineConfig({
  // 複数の開発サーバーとテストが、別条件で作った依存キャッシュを上書きしない。
  cacheDir: process.env.VITEST
    ? "node_modules/.cache/vite-test"
    : `node_modules/.cache/vite-dev-${process.env.PORT ?? "default"}`,
  // 時計を設置した後にGameAppを遅延読込しても、依存の再最適化で初回表示を中断しない。
  optimizeDeps: {
    // Voidの軽いESM補助はそのまま配信し、遅い発見による再最適化を起こさない。
    exclude: ["void/pages-prefetch"],
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-dom/server",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "motion",
      "motion/react",
      "motion/mini",
      "zod",
      "cn",
      "class-variance-authority",
    ],
  },
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "import"],
    categories: { correctness: "warn" },
    // forEach ではなく for...of で書く（client/components/ui と core は除く）
    rules: { "unicorn/no-array-for-each": "warn" },
    overrides: [
      {
        files: ["lib/wiz/core/**", "client/components/ui/**"],
        rules: { "unicorn/no-array-for-each": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    endOfLine: "lf",
    semi: false,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "es5",
    printWidth: 80,
    sortPackageJson: false,
    sortTailwindcss: {
      stylesheet: "client/styles.css",
      functions: ["cn", "cva"],
    },
    ignorePatterns: ["lib/wiz/core/**"],
  },
  resolve: { tsconfigPaths: true },
  // 複数の作業が同時にテストを回してもマシン（8コア）を使い切らないよう、1回の実行の並列数を抑える
  test: {
    maxWorkers: 3,
    // 別のcheckoutを重複実行しない。本体のテストは既定の探索規則で全件実行する。
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
  },
  server: {
    // 大きいゲームのimportグラフを初回のiframe表示と同時に変換しない。
    warmup: {
      clientFiles: [
        "./pages/dev/view-page.tsx",
        "./pages/dev/preview-frame-page.tsx",
        "./client/components/game/game-app.tsx",
      ],
    },
    host: process.env.HOST || "localhost",
    port: Number(process.env.PORT ?? 0),
    strictPort: true,
    // アプリが読まない置き場は見張らない。原画（private）・書き出し（dist）・設定資料（.docs）などは数が多く、
    // 別の作業で書き換わるたびに開発サーバーが重くなる。public は新しい画像を配信するため見張る
    watch: {
      ignored: [
        "**/private/**",
        "**/dist/**",
        "**/.docs/**",
        "**/.wrangler/**",
        "**/.claude/**",
        "**/tests/**",
        "**/builder/**",
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
    },
  },
  plugins: lazyPlugins(() => [
    // 開発中だけ、保存を /tmp の JSON と共有できる（?save=tmp）。AI が CLI で遊んだ続きを見るため
    devSave(),
    // 開発中だけ、作品データの JSON が書き換わっても開いているゲームを再読み込みしない
    devQuietData(),
    tailwindcss(),
    // ページ・配信は Void。テストは Workers の実行環境に入れると起動しないので外す
    ...(process.env.VITEST ? [] : [voidPlugin(), voidReact()]),
  ]),
})

export default config
