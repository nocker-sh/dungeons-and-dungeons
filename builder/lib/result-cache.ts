/**
 * check / report の結果の使い回し。測った値は、作品データ・エンジン・builder のソースと
 * 上書き・回数・種が同じなら変わらない（乱数は種で決まる）ので、前回の値を返す。
 * どれか一つでも書き換わると指紋が変わり、測り直す。
 */
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"

const FILE = "node_modules/.cache/builder/results.json"
/** 結果に効くソースの置き場。テストは除く。 */
const SOURCES = [
  "src/lib/wiz",
  "src/lib/content",
  "src/lib/concept/data",
  "builder",
]
const KEEP = 400

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return name === "node_modules" || name === "tunings" ? [] : files(path)
    return /\.(ts|json)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : []
  })
}

/** 作品データとソースの指紋。 */
export function sourceFingerprint() {
  const hash = createHash("sha1")
  for (const path of SOURCES.flatMap(files).sort()) {
    hash.update(path)
    hash.update(readFileSync(path))
  }
  return hash.digest("hex")
}

type Store = Record<string, number | null>

export class ResultCache {
  readonly #store: Store
  readonly #fingerprint: string
  #dirty = false

  constructor() {
    this.#fingerprint = sourceFingerprint()
    try {
      this.#store = JSON.parse(readFileSync(FILE, "utf8")) as Store
    } catch {
      this.#store = {}
    }
  }

  #key(parts: unknown) {
    return `${this.#fingerprint}:${JSON.stringify(parts)}`
  }

  /** 前回の値。JSON に書けない無限大は null で持つ。 */
  get(parts: unknown): number | undefined {
    const value = this.#store[this.#key(parts)]
    if (value === undefined) return undefined
    return value === null ? Number.POSITIVE_INFINITY : value
  }

  set(parts: unknown, value: number) {
    this.#store[this.#key(parts)] = Number.isFinite(value) ? value : null
    this.#dirty = true
  }

  save() {
    if (!this.#dirty) return
    const entries = Object.entries(this.#store).slice(-KEEP)
    mkdirSync(dirname(FILE), { recursive: true })
    writeFileSync(FILE, JSON.stringify(Object.fromEntries(entries)))
  }
}
