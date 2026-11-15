import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig, lazyPlugins } from "vite-plus"
import { devSave } from "./scripts/dev-save"
import { devQuietData } from "./scripts/dev-quiet-data"
import { isolatedTests } from "./scripts/isolated-tests"

const engineTests = ["lib/**/*.test.{ts,tsx}", "tests/lib/**/*.test.{ts,tsx}"]
const builderTests = [
  "builder/**/*.test.{ts,tsx}",
  "tests/builder/**/*.test.{ts,tsx}",
]

// 変換結果のキャッシュはimportの解決先を含む。各アプリの tsconfig も別名（paths）を持つので、どれかを変えたら別の置き場を使う
const tsconfigDigest = createHash("sha1")
for (const file of [
  "./tsconfig.json",
  "./apps/main/tsconfig.json",
  "./apps/studio/tsconfig.json",
])
  tsconfigDigest.update(readFileSync(new URL(file, import.meta.url)))
const tsconfigHash = tsconfigDigest.digest("hex").slice(0, 12)

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
    ],
  },
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "import"],
    categories: { correctness: "warn" },
    // forEach ではなく for...of で書く（shadcn の ui と core は除く）
    rules: { "unicorn/no-array-for-each": "warn" },
    overrides: [
      {
        files: ["lib/wiz/core/**", "apps/studio/development/ui/**"],
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
      stylesheet: "apps/studio/styles.css",
      functions: ["cn", "cva"],
    },
    ignorePatterns: ["lib/wiz/core/**"],
  },
  resolve: { tsconfigPaths: true },
  // 複数の作業が同時にテストを回してもマシン（8コア）を使い切らないよう、1回の実行の並列数を抑える
  test: {
    maxWorkers: 1,
    // V8 は上限が大きいほどヒープを伸ばしてから回収する。生きているデータは最大でも約420MBなので、
    // 上限を決めて早めに回収させ、1プロセスの記憶を約960MBから約560MBへ抑える（時間は変わらない）
    execArgv: ["--max-old-space-size=768"],
    // 変わっていないファイルの変換を次の実行でも使い、毎回全モジュールを変換し直さない
    fsModuleCache: true,
    fsModuleCachePath: `node_modules/.vitest-cache/${tsconfigHash}`,
    // 別のcheckoutを重複実行しない。本体のテストは既定の探索規則で全件実行する。
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
    // エンジン・builder・それ以外（作品データ・scripts など）のテストは、群ごとに1つのプロセスで続けて動かす。
    // ファイルごとにプロセスを起こして作品データ・zod・定義を読み直す手間が、全体の時間の大半を占めていた。
    // 全部を1つのプロセスに入れると読み込んだテストが積もって記憶が膨らむので、群ごとに新しいプロセスへ替える。
    projects: [
      {
        extends: true,
        test: {
          name: "engine",
          isolate: false,
          include: engineTests,
          exclude: isolatedTests,
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: "builder",
          isolate: false,
          include: builderTests,
          exclude: isolatedTests,
          sequence: { groupOrder: 2 },
        },
      },
      {
        extends: true,
        test: {
          name: "shared",
          isolate: false,
          exclude: [...isolatedTests, ...engineTests, ...builderTests],
          sequence: { groupOrder: 3 },
        },
      },
      {
        extends: true,
        // 画面・jsdom・モック・偽タイマーを使うテストは、1ファイルずつ新しいプロセスで動かす
        test: { name: "isolated", include: isolatedTests },
      },
    ],
  },
  server: {
    // 大きいゲームのimportグラフを初回のiframe表示と同時に変換しない。
    warmup: {
      clientFiles: [
        fileURLToPath(
          new URL(
            "./apps/main/client/components/game/game-app.tsx",
            import.meta.url
          )
        ),
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
  plugins: lazyPlugins(async () => [
    // 開発中だけ、保存を /tmp の JSON と共有できる（?save=tmp）。AI が CLI で遊んだ続きを見るため
    devSave(),
    // 開発中だけ、作品データの JSON が書き換わっても開いているゲームを再読み込みしない
    devQuietData(),
    // ページ・配信は Void、開発画面の見た目は Tailwind。テストは Workers の実行環境に入れると起動せず、CSS も組み立てない。
    // 読み込むだけで1回の実行ごとに約240MB・2秒以上かかるので、テストでは import もしない
    ...(process.env.VITEST
      ? []
      : [
          (await import("@tailwindcss/vite")).default(),
          (await import("void")).voidPlugin(),
          (await import("@void/react/plugin")).voidReact(),
        ]),
  ]),
})

export default config
