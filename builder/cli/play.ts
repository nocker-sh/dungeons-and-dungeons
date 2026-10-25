import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { buildContent } from "../lib/content"
import { parseCommand } from "../lib/commands"
import { battleAction, expeditionAction, townDay } from "../lib/policy"
import { Session } from "../lib/session"
import { SeededRandom } from "../lib/random"
import { look } from "../lib/look"
import { previews } from "@/lib/dev/scenarios"
import { GameDefinition } from "@/lib/wiz"
import { fightToEnd, runExpedition } from "../lib/simulate"
import { describe, formatEvents } from "../lib/text"
import { type CliOptions } from "./options"

/** 一歩ずつ遊ぶ。--save のファイルに続きを残す。 */
/** AI が遊ぶときの保存先。ブラウザ（開発サーバーで ?save=tmp）と同じファイルを使う。 */
export const AI_SAVE = process.env.DND_SAVE ?? "/tmp/dnd/save.json"

/** 場面（/previews の slug）から始めるプレイ。 */
function sessionFromScene(
  built: ReturnType<typeof buildContent>,
  seed: number,
  slug: string
) {
  const preview = previews({ content: built.content }).find(
    (entry) => entry.slug === slug
  )
  if (!preview)
    throw new Error(
      `場面 ${slug} がない（${previews()
        .map((entry) => entry.slug)
        .join(" ")}）`
    )
  const start = preview.start()
  const game = new GameDefinition(built.content).create(
    start.environment,
    start.initialState
  )
  if (start.save) {
    const failed = game.restore(start.save)
    if (failed) throw failed
  }
  // 場面の id と重ならないよう、続きの id は大きい番号から振る
  return new Session(built, seed, {
    rng: new SeededRandom(seed).state,
    serial: 1000,
    save: game.save(),
  })
}

export function commandPlay(options: CliOptions) {
  const built = buildContent(options.overrides)
  const file = options.save
  let session: Session
  if (options.scene)
    session = sessionFromScene(built, options.seed, options.scene)
  else if (file && existsSync(file) && !options.fresh) {
    const saved = JSON.parse(readFileSync(file, "utf8"))
    // ブラウザが書いた保存は乱数の状態を持たないので、種から始める
    const seed = saved.seed ?? options.seed
    session = new Session(built, seed, {
      rng: saved.rng ?? new SeededRandom(seed).state,
      serial: saved.serial ?? 1000,
      save: saved.save,
    })
  } else session = new Session(built, options.seed)
  if (options.level) session.levelTo(options.level)
  const random = session.random.fork(3)
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
    ...(options.script
      ? readFileSync(options.script, "utf8")
          .split("\n")
          .map((line) => line.replace(/#.*/, "").trim())
          .filter(Boolean)
      : []),
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
        { log: output, view: snapshotView(session), save: session.dump() },
        null,
        2
      )
    )
  else {
    output.push(describe(session))
    console.log(output.join("\n"))
  }
  if (file) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({ seed: options.seed, ...session.dump() })
    )
  }
}

/** --json で出す、いまの画面の材料（エンジンの Query の結果そのもの）。 */
function snapshotView(session: Session) {
  const { state, queries } = session
  const battle = queries.battle(state)
  return {
    phase: state.phase.type,
    gold: state.gold,
    party: queries.party(state),
    route: queries.route(state),
    battle,
    commands:
      battle?.current.kind === "member"
        ? queries.commands(state, battle.current.id)
        : null,
    result: queries.result(state),
  }
}

/** AI が遊ぶ入口。保存は既定で AI_SAVE（ブラウザと共有できる）。 */
export function commandAi(options: CliOptions) {
  commandPlay({ ...options, save: options.save ?? AI_SAVE })
}
