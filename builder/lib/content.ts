import { contentSource, toGameContent } from "@/lib/content/game-content"
import type { GameContent } from "@/lib/wiz"

/** 書き換えられる作品データ（slug 付き）。 */
export type Source = Record<string, unknown>
type Entry = Record<string, unknown> & { id?: string; slug?: string }

/** id を持つ一覧。`<一覧>.<slug>.<項目>` で指せる。 */
export const COLLECTIONS = [
  "party",
  "skills",
  "goods",
  "foes",
  "layers",
  "demons",
  "rooms",
  "shops",
  "recruits",
  "quests",
  "smithy.recipes",
] as const

export function cloneSource(): Source {
  return structuredClone(contentSource)
}

function get(root: unknown, path: readonly string[]): unknown {
  let value = root
  for (const key of path) {
    if (value === null || typeof value !== "object") return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** 一覧の中身。 */
export function collection(source: Source, name: string): Entry[] {
  const list = get(source, name.split("."))
  return Array.isArray(list) ? (list as Entry[]) : []
}

/** id → slug（全一覧と入れ子の仲間）。 */
export function slugIndex(source: Source) {
  const slugs = new Map<string, string>()
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (!value || typeof value !== "object") return
    const entry = value as Entry
    if (typeof entry.id === "string" && typeof entry.slug === "string")
      slugs.set(entry.id, entry.slug)
    for (const item of Object.values(entry)) walk(item)
  }
  walk(source)
  return slugs
}

/** slug（または id）から id。見つからなければ undefined。 */
export function idOf(source: Source, key: string, kind?: string) {
  const names = kind ? [kind] : COLLECTIONS
  for (const name of names)
    for (const entry of collection(source, name)) {
      if (entry.id === key || entry.slug === key) return entry.id
      const member = entry.member as Entry | undefined
      if (member && (member.id === key || member.slug === key)) return member.id
    }
  return undefined
}

function parseValue(source: Source, raw: string): unknown {
  // "@slug" は id に置き換える（参照の書き換え用）
  const resolve = (value: unknown): unknown => {
    if (typeof value === "string" && value.startsWith("@")) {
      const id = idOf(source, value.slice(1))
      if (!id) throw new Error(`slug が見つからない: ${value}`)
      return id
    }
    if (Array.isArray(value)) return value.map(resolve)
    return value
  }
  try {
    return resolve(JSON.parse(raw))
  } catch {
    return resolve(raw)
  }
}

/** 上書きが書き換える場所。`*` なら複数になる。 */
export type OverrideSlot = { parent: Record<string, unknown>; key: string }

/** 上書きのパスが指す場所。見つからなければ投げる。 */
export function overrideSlots(
  source: Source,
  pathText: string
): OverrideSlot[] {
  const path = pathText.trim().split(".")
  const listName = COLLECTIONS.find((name) => pathText.startsWith(`${name}.`))
  const slots: OverrideSlot[] = []
  const reach = (root: unknown, rest: readonly string[]) => {
    const parent = get(root, rest.slice(0, -1))
    if (!parent || typeof parent !== "object")
      throw new Error(`項目が見つからない: ${pathText}`)
    slots.push({
      parent: parent as Record<string, unknown>,
      key: rest[rest.length - 1],
    })
  }
  if (listName) {
    const depth = listName.split(".").length
    const key = path[depth]
    const rest = path.slice(depth + 1)
    const entries = collection(source, listName).filter(
      (entry) =>
        key === "*" ||
        entry.id === key ||
        entry.slug === key ||
        (entry.member as Entry | undefined)?.slug === key
    )
    if (!entries.length) throw new Error(`${listName} に ${key} がない`)
    for (const entry of entries) reach(entry, rest)
  } else reach(source, path)
  return slots
}

/**
 * 数値の上書き。例：
 *   foes.hiyokobu.atk=9        敵の攻撃を9に
 *   foes.*.hp*=1.2               全ての敵のHPを1.2倍（端数は四捨五入）
 *   party.ada.stats.atk+=2        仲間の攻撃を+2
 *   skills.whirl.power=1.8
 *   balance.expBase=30           一覧でないものは先頭から辿る
 *   layers.layer0.foes=["@kamokutsu","@kamokutsu"]   参照は @slug
 */
export function applyOverride(source: Source, expression: string) {
  const match = expression.match(/^(.+?)(\*=|\+=|-=|=)(.*)$/)
  if (!match) throw new Error(`上書きの書き方が違う: ${expression}`)
  const [, pathText, op, raw] = match
  const targets = overrideSlots(source, pathText)
  const value = parseValue(source, raw)
  for (const { parent, key } of targets) {
    const current = parent[key]
    if (op === "=") parent[key] = value
    else {
      if (typeof current !== "number" || typeof value !== "number")
        throw new Error(`${pathText} は数値でない`)
      const next =
        op === "*="
          ? current * value
          : op === "+="
            ? current + value
            : current - value
      parent[key] = Number.isInteger(current) ? Math.round(next) : next
    }
  }
}

export type Built = {
  source: Source
  content: GameContent
  slugs: Map<string, string>
}

/** 上書きを当てた作品データ。 */
export function buildContent(overrides: readonly string[] = []): Built {
  const source = cloneSource()
  for (const expression of overrides) applyOverride(source, expression)
  return { source, content: toGameContent(source), slugs: slugIndex(source) }
}
