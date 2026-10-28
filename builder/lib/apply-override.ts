import type { Source } from "@/builder/lib/content"
import { overrideSlots } from "@/builder/lib/override-slots"
import { parseValue } from "@/builder/lib/parse-value"

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
