import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { parseTuningSpec } from "@/builder/lib/tuning/spec"
import type { TuningSpec } from "@/builder/lib/tuning/types"

/** TS でも JSON でも読める。TS は default か、そのまま export したものを使う。 */
export async function loadTuningSpec(file: string): Promise<TuningSpec> {
  const path = resolve(file)
  if (path.endsWith(".json"))
    return parseTuningSpec(JSON.parse(readFileSync(path, "utf8")))
  const loaded: unknown = await import(pathToFileURL(path).href)
  const module = loaded as { default?: unknown }
  return parseTuningSpec(module.default ?? loaded)
}
