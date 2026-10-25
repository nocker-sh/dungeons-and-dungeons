import type { GameAction } from "@/lib/wiz"
import type { Session } from "./session"

/**
 * 短い書き方を操作にする。slug は id に直す。JSON の操作もそのまま受ける（中の slug も直す）。
 * 例：depart layer0 / advance n2 / attack foe-1 / skill whirl / item potion ada / rest normal
 */
export function parseCommand(session: Session, line: string): GameAction {
  const text = line.trim()
  if (text.startsWith("{")) {
    const raw = JSON.parse(text) as Record<string, unknown>
    const action = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        key !== "type" && typeof value === "string" ? session.id(value) : value,
      ])
    )
    return action as GameAction
  }
  const [verb, ...args] = text.split(/\s+/)
  const id = (index: number, kind?: string) =>
    args[index] === undefined ? undefined : session.id(args[index], kind)
  const need = (index: number, kind?: string) => {
    const value = id(index, kind)
    if (!value) throw new Error(`${verb} には引数 ${index + 1} が要る`)
    return value
  }
  const target = (index: number) => {
    const value = args[index]
    if (!value) return undefined
    return value.startsWith("foe-") ? value : session.id(value)
  }
  switch (verb) {
    case "depart":
      return { type: "depart", layer: need(0, "layers") }
    case "advance":
    case "go": {
      const to =
        args[0] ?? session.queries.route(session.state)?.choices[0] ?? ""
      return { type: "advance", to }
    }
    case "ack":
      return { type: "acknowledge" }
    case "discover":
      return {
        type: "discover",
        choice: need(0),
        skill: id(1, "skills"),
        member: id(2),
      }
    case "inscribe":
      return {
        type: "inscribe",
        gear: args[0],
        slot: Number(args[1]) - 1,
        skill: need(2, "skills"),
      }
    case "retreat":
      return { type: "retreat" }
    case "foe":
      return { type: "foe-turn" }
    case "brawl":
      return { type: "act", command: "brawl", target: target(0) }
    case "guard":
      return { type: "act", command: "guard" }
    case "skill":
      return {
        type: "act",
        command: "skill",
        skill: need(0, "skills"),
        target: target(1),
      }
    case "item":
      return {
        type: "act",
        command: "item",
        good: need(0, "goods"),
        target: target(1),
      }
    case "rest":
      return { type: "rest", room: need(0, "rooms") }
    case "buy":
      return { type: "buy", shop: need(0, "shops"), good: need(1, "goods") }
    case "sell":
      return { type: "sell", good: need(0, "goods") }
    case "sell-gear":
      return { type: "sell", gear: args[0] }
    case "appraise":
      return { type: "appraise", shop: need(0, "shops") }
    case "recruit":
      return { type: "recruit", recruit: need(0, "recruits") }
    case "reroll":
      return { type: "reroll" }
    case "summon":
      return { type: "summon" }
    case "demon":
      return { type: "choose-demon", demon: need(0, "demons") }
    case "fight-quest":
      return { type: "fight-quest", quest: need(0, "quests") }
    case "quest":
      return { type: "accept-quest", quest: need(0, "quests") }
    case "claim":
      return { type: "claim-quest", quest: need(0, "quests") }
    case "equip":
      return { type: "equip", gear: args[0], member: need(1) }
    case "unequip":
      return { type: "unequip", gear: args[0] }
    case "upgrade":
      return { type: "upgrade", gear: args[0] }
    case "reforge":
      return { type: "reforge", gear: args[0], material: args[1] }
    case "dismiss":
      return { type: "dismiss-wipe" }
    case "ending":
      return { type: "see-ending" }
    case "repair":
      return { type: "repair", member: id(0) }
    case "craft":
      return { type: "craft", recipe: need(0, "smithy.recipes") }
    case "swap":
      return { type: "swap", out: need(0), in: need(1) }
    case "rows":
      return { type: "swap-rows", a: need(0), b: need(1) }
    case "use":
      return { type: "use", good: need(0, "goods"), member: id(1) }
    case "chat":
      return { type: "chat", liked: need(0) }
    default:
      throw new Error(`知らない操作: ${verb}`)
  }
}
