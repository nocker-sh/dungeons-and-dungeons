import { existsSync, readFileSync } from "node:fs"
import { replaceTextFile } from "@/lib/files/replace-text-file"
import { buildContent } from "@/builder/lib/build-content"
import { parseCommand } from "@/builder/lib/commands"
import { battleAction } from "@/builder/lib/policy/battle"
import { expeditionAction } from "@/builder/lib/policy/expedition"
import { townDay } from "@/builder/lib/policy/town"
import { Session } from "@/builder/lib/session"
import { SeededRandom } from "@/builder/lib/random"
import { look } from "@/builder/lib/look"
import { fightToEnd } from "@/builder/lib/simulation/fight-to-end"
import { runExpedition } from "@/builder/lib/simulation/expedition"
import { describe } from "@/builder/lib/describe"
import { formatEvents } from "@/builder/lib/format-events"
import type { CliOptions } from "@/builder/cli/options"
import { readLineFile } from "@/builder/cli/line-file"
import { sessionFromScene } from "@/builder/cli/session-from-scene"
import { snapshotView } from "@/builder/cli/snapshot-view"

export function commandPlay(options: CliOptions) {
  const built = buildContent(options.overrides)
  const file = options.save
  let seed = options.seed
  let session: Session
  let policyRng: number | undefined
  if (options.scene) session = sessionFromScene(built, seed, options.scene)
  else if (file && existsSync(file) && !options.fresh) {
    const saved = JSON.parse(readFileSync(file, "utf8"))
    if (saved.policyRng !== undefined) {
      if (
        !Number.isInteger(saved.policyRng) ||
        saved.policyRng < 0 ||
        saved.policyRng > 0xffffffff
      )
        throw new Error("自動方策の乱数記録を読み込めません")
      policyRng = saved.policyRng
    }
    // ブラウザが書いた保存は乱数の状態を持たないので、種から始める
    seed = saved.seed ?? seed
    session = new Session(built, seed, {
      rng: saved.rng ?? new SeededRandom(seed).state,
      serial: saved.serial ?? 1000,
      save: saved.save,
    })
  } else session = new Session(built, seed)
  if (options.level) session.levelTo(options.level)
  const random =
    policyRng === undefined
      ? session.random.fork(3)
      : new SeededRandom(policyRng)
  const run = (line: string): string[] => {
    const text = line.trim()
    if (!text || text === "state") return []
    if (text === "look" || text.startsWith("look "))
      return look(session, text.split(/\s+/).slice(1))
    if (text === "auto" || text === "auto-battle" || text === "auto-run") {
      const outputPath: string[] = []
      const step = () => {
        const action =
          session.state.phase.type === "battle"
            ? battleAction(session, options.style, random)
            : expeditionAction(session, options.plan, random)
        outputPath.push(`> ${JSON.stringify(action)}`)
        outputPath.push(...formatEvents(session, session.must(action)))
      }
      if (text === "auto") step()
      else if (text === "auto-battle") {
        const result = fightToEnd(session, options.style)
        outputPath.push(
          `戦闘 ${result.won ? "勝ち" : "負け"} ラウンド${result.rounds}`
        )
      } else {
        while (session.state.phase.type !== "town") step()
      }
      return outputPath
    }
    if (text === "auto-day") {
      const day = townDay(session, {
        potions: options.potions,
        upgrade: true,
        summon: true,
        shop: options.shop,
      })
      const result = runExpedition(
        session,
        day.layer,
        options.plan,
        options.style
      )
      return [
        `街：鑑定${day.appraised.length}回（${day.appraised.join(",") || "なし"}）修理${day.repairGold}G 買い物${day.spentGold}G`,
        `一日：${session.slug(day.layer)} ${JSON.stringify(result)}`,
      ]
    }
    const action = parseCommand(session, text)
    const result = session.send(action)
    if (!Array.isArray(result))
      return [
        `拒否: ${(result as { code?: string }).code} ${JSON.stringify(action)}`,
      ]
    return formatEvents(session, result)
  }
  const lines = [
    ...options.positional.slice(1),
    ...(options.script ? readLineFile(options.script) : []),
  ]
  const output: string[] = []
  for (const line of lines) {
    output.push(`$ ${line}`)
    try {
      output.push(...run(line))
    } catch (error) {
      output.push(`エラー: ${(error as Error).message}`)
    }
  }
  if (options.json)
    console.log(
      JSON.stringify(
        {
          log: output,
          view: snapshotView(session),
          save: session.dump(),
          policyRng: random.state,
        },
        null,
        2
      )
    )
  else {
    output.push(describe(session))
    console.log(output.join("\n"))
  }
  if (file) {
    replaceTextFile(
      file,
      JSON.stringify({ seed, ...session.dump(), policyRng: random.state })
    )
  }
}
