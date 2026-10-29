import { referenceTarget } from "@/scripts/concept-check/reference-target"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { object } from "@/scripts/concept-check/object"
import type { ConceptDocuments } from "@/scripts/concept-check/types"

export async function verifyCoverage(
  root: string,
  documents: ConceptDocuments,
  problems: string[]
): Promise<void> {
  let coverage: unknown
  try {
    const databaseCoverage = resolve(
      root,
      "../..",
      "concept/lore/coverage.json"
    )
    coverage = JSON.parse(
      await readFile(
        existsSync(databaseCoverage)
          ? databaseCoverage
          : join(root, "coverage.json"),
        "utf8"
      )
    )
  } catch (error) {
    if (!object(error) || error.code !== "ENOENT")
      problems.push("coverage.json: 検査方針を読めない")
  }
  if (coverage !== undefined) {
    if (!object(coverage) || !Array.isArray(coverage.sources))
      problems.push("coverage.json: sourcesが必要")
    else
      for (const source of coverage.sources) {
        if (
          !object(source) ||
          typeof source.file !== "string" ||
          !["array", "character-groups", "world-tiles"].includes(
            String(source.collection)
          )
        ) {
          problems.push("coverage.json: sourceの形式が不正")
          continue
        }
        let value: unknown
        try {
          value = JSON.parse(
            await readFile(
              resolve(root, "../..", referenceTarget(source.file)),
              "utf8"
            )
          )
        } catch {
          problems.push(`coverage.json: 正本を読めない ${source.file}`)
          continue
        }
        if (source.collection === "world-tiles" && object(value))
          value = value.tiles
        if (!Array.isArray(value)) {
          problems.push(`coverage.json: 配列ではない ${source.file}`)
          continue
        }
        const entries: unknown[] =
          source.collection === "character-groups"
            ? value.flatMap((group) =>
                object(group) && Array.isArray(group.characters)
                  ? group.characters
                  : []
              )
            : value
        if (!entries.length)
          problems.push(`coverage.json: 対象がない ${source.file}`)
        for (const entry of entries) {
          if (!object(entry) || typeof entry.id !== "string") {
            problems.push(`coverage.json: 正本のIDが不正 ${source.file}`)
            continue
          }
          const matches = [...documents.values()].filter((document) => {
            if (document.data.entity_type === "visual-record") return false
            const bindings = [
              document.data.runtime,
              ...(Array.isArray(document.data.bindings)
                ? document.data.bindings
                : []),
            ]
            return bindings.some(
              (binding) =>
                object(binding) &&
                typeof binding.file === "string" &&
                referenceTarget(binding.file) ===
                  referenceTarget(source.file as string) &&
                binding.id === entry.id
            )
          })
          const document =
            documents.get(entry.id) ??
            (matches.length === 1 ? matches[0] : undefined)
          if (matches.length > 1 && !documents.has(entry.id))
            problems.push(
              `${source.file}: 対応する資料が一意でない ${entry.id}`
            )
          if (!document)
            problems.push(`${source.file}: 個別資料がない ${entry.id}`)
          else {
            const bindings = [
              document.data.runtime,
              ...(Array.isArray(document.data.bindings)
                ? document.data.bindings
                : []),
            ]
            if (
              !bindings.some(
                (binding) =>
                  object(binding) &&
                  typeof binding.file === "string" &&
                  referenceTarget(binding.file) ===
                    referenceTarget(source.file as string) &&
                  binding.id === entry.id
              )
            )
              problems.push(
                `${document.file}: 正本との対応がない ${source.file}`
              )
          }
        }
      }
  }
}
