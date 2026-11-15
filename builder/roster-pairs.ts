import { contentSource } from "@/content/game-content"
import { RosterTrials } from "@/builder/lib/roster-trials"

const runs = Number(process.argv[2] ?? 8)
const seed = Number(process.argv[3] ?? 1)
if (!Number.isInteger(runs) || runs < 1) throw new Error("試行数は正の整数")
if (!Number.isInteger(seed) || seed < 1) throw new Error("開始シードは正の整数")
const trials = new RosterTrials()
const members = contentSource.recruits.filter((entry) => !entry.retired)
// プレイヤーは戦わないので、主人公がいた枠には初期の攻撃役マユを入れる（マユを含む組ではリオ）
const fillerOf = (slugs: readonly string[]) =>
  ["mayu", "rio", "gou"].find((slug) => !slugs.includes(slug))!
for (const front of members)
  for (const back of members) {
    if (front.member.id === back.member.id) continue
    console.log(
      JSON.stringify({
        front: front.member.slug,
        back: back.member.slug,
        ...trials.runScenario(
          [
            fillerOf([front.member.slug, back.member.slug]),
            front.member.slug,
            back.member.slug,
          ],
          {
            level: 26,
            reached: 4,
            foes: ["slime-swordsman"],
            boss: true,
            plus: 30,
            seed,
          },
          runs
        ),
      })
    )
  }
