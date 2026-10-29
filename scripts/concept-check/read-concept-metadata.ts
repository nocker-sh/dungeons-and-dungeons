import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { object } from "@/scripts/concept-check/object"
import { referenceTarget } from "@/scripts/concept-check/reference-target"

/** 資料は正本JSONを参照し、Front Matterへデータを複製しない。 */
export async function readConceptMetadata(
  root: string,
  value: unknown
): Promise<unknown> {
  if (!object(value) || value.entity === undefined) return value
  if (typeof value.entity !== "string") throw new Error("entityの参照が不正")
  return JSON.parse(
    await readFile(
      resolve(root, "../..", referenceTarget(value.entity)),
      "utf8"
    )
  )
}
