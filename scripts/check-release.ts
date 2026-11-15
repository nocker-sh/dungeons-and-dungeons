import { releaseBundleProblems } from "@/scripts/release-bundle-problems"

const problems = releaseBundleProblems("apps/main/dist/client")
if (problems.length) {
  for (const problem of problems) console.error(problem)
  process.exitCode = 1
} else console.info("本番の配布物: 開発用の入口の検査 PASS")
