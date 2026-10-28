import { verifyLivingLinks } from "@/scripts/concept-check/living-links"
import { verifyLocations } from "@/scripts/concept-check/locations"
import { verifyMetadata } from "@/scripts/concept-check/metadata"
import { pathToFileURL } from "node:url"
import { readdir, readFile } from "node:fs/promises"
import { resolve, join, relative, dirname } from "node:path"
import { object } from "@/scripts/concept-check/object"
import type { ConceptDocuments } from "@/scripts/concept-check/types"
import { createRuntimeReader } from "@/scripts/concept-check/create-runtime-reader"
import { verifyCoverage } from "@/scripts/concept-check/verify-coverage"
import { verifySpatialDocument } from "@/scripts/concept-check/spatial"

declare const Bun: { YAML: { parse(source: string): unknown } }

export async function checkConcept(root: string): Promise<string[]> {
  const problems: string[] = []
  const documents: ConceptDocuments = new Map()
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
        const source = await readFile(file, "utf8")
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
        const label = relative(root, file)
        if (!match) {
          problems.push(`${label}: Front Matterがない`)
          continue
        }
        let data: unknown
        try {
          data = Bun.YAML.parse(match[1])
        } catch {
          problems.push(`${label}: YAMLを解析できない`)
          continue
        }
        if (!object(data) || typeof data.id !== "string" || !data.id.trim()) {
          problems.push(`${label}: idがない`)
          continue
        }
        if (
          !verifyMetadata(label, data, source.slice(match[0].length), problems)
        )
          continue
        if (documents.has(data.id)) problems.push(`${label}: id重複 ${data.id}`)
        else documents.set(data.id, { file: label, data })
      }
    }
  }
  await visit(root)
  const requireTarget = (file: string, target: unknown, field: string) => {
    if (typeof target !== "string" || !documents.has(target)) {
      problems.push(`${file}: ${field}の参照先がない ${String(target)}`)
      return undefined
    }
    return documents.get(target)?.data
  }
  const runtimeTarget = createRuntimeReader(root, problems)
  for (const { file, data } of documents.values()) {
    const runtime =
      data.runtime !== undefined && data.runtime !== null
        ? await runtimeTarget(file, data.runtime)
        : undefined
    if (
      object(data.livelihood) &&
      data.livelihood.canonical_profile !== undefined
    )
      await runtimeTarget(
        `${file}: livelihood.canonical_profile`,
        data.livelihood.canonical_profile
      )
    if (
      object(runtime) &&
      Array.isArray(runtime.stations) &&
      object(data.topology) &&
      Array.isArray(data.topology.nodes)
    ) {
      const expected = runtime.stations
        .filter(object)
        .map((station) => `${String(runtime.id)}:station:${String(station.id)}`)
        .sort()
      const actual = data.topology.nodes.map(String).sort()
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        problems.push(`${file}: 地図の地点一覧が正本と一致しない`)
    }
    if (
      object(runtime) &&
      Array.isArray(runtime.next) &&
      object(data.runtime) &&
      typeof data.runtime.parent_id === "string"
    ) {
      const parentId = data.runtime.parent_id
      const expected = runtime.next
        .map((id) => `${parentId}:station:${String(id)}`)
        .sort()
      const actual = (Array.isArray(data.relations) ? data.relations : [])
        .filter((relation) => object(relation) && relation.type === "route_to")
        .map((relation) => (object(relation) ? String(relation.target) : ""))
        .sort()
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        problems.push(`${file}: 進行先が正本と一致しない`)
    }
    if (Array.isArray(data.bindings))
      for (const binding of data.bindings) await runtimeTarget(file, binding)
    if (Array.isArray(data.related))
      for (const relation of data.related) {
        if (!object(relation)) {
          problems.push(`${file}: relatedの形式が不正`)
          continue
        }
        const target = requireTarget(file, relation.id, "related")
        const document =
          typeof relation.id === "string"
            ? documents.get(relation.id)
            : undefined
        if (
          target &&
          document &&
          (typeof relation.document !== "string" ||
            resolve(root, dirname(file), relation.document) !==
              resolve(root, document.file))
        )
          problems.push(
            `${file}: relatedのIDとファイルが一致しない ${String(relation.id)}`
          )
      }
    if (object(data.topology) && Array.isArray(data.topology.nodes)) {
      for (const node of data.topology.nodes)
        requireTarget(file, node, "topology.nodes")
    }
    if (Array.isArray(data.relations))
      for (const relation of data.relations) {
        if (object(relation)) requireTarget(file, relation.target, "relations")
      }
    if (data.schema_version !== 2) continue
    if (object(data.location)) {
      requireTarget(file, data.location.parent, "location.parent")
      requireTarget(file, data.location.map, "location.map")
    }
    verifySpatialDocument(file, data, requireTarget, problems)
  }
  verifyLocations(documents, problems)
  verifyLivingLinks(documents, problems)
  await verifyCoverage(root, documents, problems)
  return problems
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const root = resolve(process.argv[2] ?? ".docs/concept")
  const problems = await checkConcept(root)
  for (const problem of problems) console.error(problem)
  if (problems.length) process.exitCode = 1
  else console.log("設定資料: ID・生活設備・室内配置の検査 PASS")
}
