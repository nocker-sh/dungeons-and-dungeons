import { repositorySourceProblems } from "@/scripts/repository-source-problems"

const problems = repositorySourceProblems(process.cwd())
if (problems.length) {
  for (const problem of problems) console.error(problem)
  process.exitCode = 1
} else
  console.info(
    "ソース規約: re-export・配置・公開関数数・コンポーネント名・Propsの検査 PASS"
  )
