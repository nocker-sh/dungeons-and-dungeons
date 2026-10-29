import { referenceTarget } from "@/scripts/concept-check/reference-target"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { object } from "@/scripts/concept-check/object"

export function createRuntimeReader(root: string, problems: string[]) {
  const runtimeFiles = new Map<string, unknown>()
  const findIds = (value: unknown, id: string): unknown[] => {
    if (Array.isArray(value)) return value.flatMap((item) => findIds(item, id))
    if (!object(value)) return []
    return [
      ...(value.id === id ? [value] : []),
      ...Object.values(value).flatMap((item) => findIds(item, id)),
    ]
  }
  const runtimeTarget = async (
    file: string,
    binding: unknown
  ): Promise<unknown> => {
    if (!object(binding) || typeof binding.file !== "string") {
      problems.push(`${file}: runtimeの形式が不正`)
      return
    }
    const path = resolve(root, "../..", referenceTarget(binding.file))
    if (!runtimeFiles.has(path)) {
      try {
        runtimeFiles.set(path, JSON.parse(await readFile(path, "utf8")))
      } catch {
        problems.push(`${file}: 実行用JSONを読めない ${binding.file}`)
        return
      }
    }
    let source = runtimeFiles.get(path)
    if (binding.pointer === "") return source
    if (typeof binding.parent_id === "string") {
      const parents = findIds(source, binding.parent_id)
      if (parents.length !== 1) {
        problems.push(
          `${file}: runtimeの親IDが一意に存在しない ${binding.parent_id}`
        )
        return
      }
      source = parents[0]
    }
    const matches =
      typeof binding.id === "string" ? findIds(source, binding.id) : []
    if (matches.length !== 1)
      problems.push(
        `${file}: runtimeのIDが存在しない・一意でない ${String(binding.id)}`
      )
    return matches.length === 1 ? matches[0] : undefined
  }
  return runtimeTarget
}
