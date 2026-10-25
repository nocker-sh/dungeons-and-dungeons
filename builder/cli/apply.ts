import { readFileSync, writeFileSync } from "node:fs"
import { applyOverride } from "../lib/content"
import { type CliOptions } from "./options"

const DATA = new URL("../../src/lib/content/data/", import.meta.url)

const FILES: Record<string, string> = {
  party: "party.json",
  skills: "skills.json",
  goods: "goods.json",
  foes: "foes.json",
  layers: "layers.json",
  demons: "demons.json",
  rooms: "rooms.json",
  shops: "shops.json",
  recruits: "recruits.json",
  quests: "quests.json",
  smithy: "smithy.json",
}

/** 上書きを src/lib/content/data の JSON へ書き戻す。 */
export function commandApply(options: CliOptions) {
  if (!options.overrides.length) throw new Error("--set か --sets が要る")
  const read = (name: string) =>
    JSON.parse(readFileSync(new URL(name, DATA), "utf8"))
  const settings = read("settings.json") as Record<string, unknown>
  const raw: Record<string, unknown> = { ...settings }
  for (const [key, file] of Object.entries(FILES)) raw[key] = read(file)
  for (const expression of options.overrides) applyOverride(raw, expression)
  const write = (name: string, value: unknown) =>
    writeFileSync(new URL(name, DATA), `${JSON.stringify(value, null, 2)}\n`)
  for (const [key, file] of Object.entries(FILES)) write(file, raw[key])
  write(
    "settings.json",
    Object.fromEntries(Object.keys(settings).map((key) => [key, raw[key]]))
  )
  console.log(
    `${options.overrides.length}件を書き戻した。bun builder/cli.ts check で確かめる。`
  )
}
