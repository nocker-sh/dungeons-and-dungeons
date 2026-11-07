import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dataDirectory } from "@/content/data-directory"
import { prepareSource } from "@/content/prepare-source"
import type { sourceData } from "@/content/source-data"
import { contentSource, toGameContent } from "@/content/game-content"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { writeDataFiles } from "@/builder/lib/write-data-files"
import { applyOverride } from "@/builder/lib/apply-override"
import { type CliOptions } from "@/builder/cli/options"

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

/** 上書きを content/data の JSON へ書き戻す。 */
export function commandApply(
  options: CliOptions,
  directory: URL = dataDirectory()
) {
  const DATA = new URL(directory.href)
  if (!DATA.pathname.endsWith("/")) DATA.pathname += "/"
  if (!options.overrides.length) throw new Error("--set か --sets が要る")
  const originals = new Map<string, string>()
  const read = (name: string) => {
    const text = readFileSync(new URL(name, DATA), "utf8")
    originals.set(name, text)
    return JSON.parse(text)
  }
  const settings = read("settings.json") as Record<string, unknown>
  const raw: Record<string, unknown> = { ...settings }
  for (const [key, file] of Object.entries(FILES)) raw[key] = read(file)
  for (const expression of options.overrides) applyOverride(raw, expression)
  new GameCatalog(
    toGameContent({
      ...contentSource,
      ...prepareSource(raw as typeof sourceData),
    })
  )
  const settingsAfter = Object.fromEntries(
    Object.keys(settings).map((key) => [key, raw[key]])
  )
  const outputs = [
    ...Object.entries(FILES).map(([key, name]) => ({ name, value: raw[key] })),
    { name: "settings.json", value: settingsAfter },
  ]
  const changes = outputs.flatMap(({ name, value }) => {
    const before = originals.get(name)!
    return JSON.stringify(value) === JSON.stringify(JSON.parse(before))
      ? []
      : [
          {
            file: fileURLToPath(new URL(name, DATA)),
            before,
            after: JSON.stringify(value, null, 2) + "\n",
          },
        ]
  })
  writeDataFiles(changes)
  console.log(
    `${options.overrides.length}件を書き戻した。vp run cli check で確かめる。`
  )
}
