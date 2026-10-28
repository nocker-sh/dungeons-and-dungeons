/// <reference types="node" />
/**
 * 公開画像の一覧（concept/data/images.json）と、人の目視確認の記録を扱う。
 *   vp run images sync                    公開画像を一覧へ追加する
 *   vp run images check [--strict]        一覧・参照・確認状況を検査する
 *   vp run images preview <画像>          透過を色付き背景に重ねた確認用PNGを書き出す
 *   vp run images approve <画像> [--note <メモ>]  人が目視で合格にした記録を残す
 *   vp run images reject <画像> --note <理由>     人が目視で差し戻した記録を残す
 * 確認はその時点の画像のハッシュに紐づく。画像を作り直すと「要再確認」に戻る。
 */
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { checkImageIntegrity } from "@/scripts/image-integrity"

const INDEX_FILE = "concept/data/images.json"
const PUBLIC_DIRECTORY = "public"
const IMAGE_DIRECTORY = "public/tmp"
const IMPORT_MANIFEST = "private/art/import-manifest.json"
const OUTPUT_MANIFEST = "private/art/output-manifest.json"
const IMAGE_LEDGER = ".docs/artwork-analysis/image-ledger.json"
const PREVIEW_DIRECTORY = "private/art/review"
const REFERENCE_SOURCES = [
  "pages",
  "client",
  "lib",
  "content",
  "concept",
  "development",
  "tests/lib",
  "tests/client",
  "tests/content",
  "tests/concept",
  "tests/development",
]

const IMAGE_EXTENSIONS = [
  ".webp",
  ".png",
  ".jpg",
  ".jpeg",
  ".avif",
  ".gif",
  ".svg",
  ".ico",
]

type Review = {
  status: "approved" | "rejected"
  sha256: string
  reviewedAt: string
  note: string
}

type ImageEntry = {
  image: string
  original: string | null
  review: Review | null
}

type ImageIndex = { images: ImageEntry[] }

type ReviewState = "合格" | "未確認" | "要再確認" | "差し戻し"

function readIndex(): ImageIndex {
  if (!existsSync(INDEX_FILE)) return { images: [] }
  return JSON.parse(readFileSync(INDEX_FILE, "utf8")) as ImageIndex
}

function writeIndex(index: ImageIndex) {
  index.images.sort((left, right) => left.image.localeCompare(right.image))
  writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`)
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

function publicImages(): string[] {
  return listFiles(IMAGE_DIRECTORY)
    .filter((file) => IMAGE_EXTENSIONS.includes(path.extname(file)))
    .map((file) => `/${path.relative(PUBLIC_DIRECTORY, file)}`)
    .sort()
}

function filePath(image: string) {
  return path.join(PUBLIC_DIRECTORY, image)
}

function hashOf(image: string) {
  return createHash("sha256")
    .update(readFileSync(filePath(image)))
    .digest("hex")
}

/** 元PNGの対応。立ち絵は取り込み表、背景は scenes の同名PNG。 */
function originalOf(image: string): string | null {
  const baseName = path.basename(image, path.extname(image))
  if (image.startsWith("/tmp/scenes/")) {
    const scene = `scenes/${baseName}.png`
    return existsSync(path.join("private/art/originals", scene)) ? scene : null
  }
  if (!existsSync(IMPORT_MANIFEST)) return null
  const rows = JSON.parse(readFileSync(IMPORT_MANIFEST, "utf8")) as {
    name: string
    image: string
  }[]
  return rows.find((row) => row.image === image)?.name ?? null
}

function reviewState(entry: ImageEntry): ReviewState {
  if (!entry.review) return "未確認"
  if (entry.review.sha256 !== hashOf(entry.image)) return "要再確認"
  return entry.review.status === "approved" ? "合格" : "差し戻し"
}

function findEntry(index: ImageIndex, query: string | undefined): ImageEntry {
  if (!query) throw new Error("画像を指定してください")
  const matches = index.images.filter(
    (entry) =>
      entry.image === query ||
      path.basename(entry.image) === query ||
      path.basename(entry.image, path.extname(entry.image)) === query
  )
  if (matches.length !== 1)
    throw new Error(`${query} に一致する画像が${matches.length}件あります`)
  return matches[0]
}

function optionValue(args: string[], name: string) {
  const position = args.indexOf(name)
  return position >= 0 ? (args[position + 1] ?? "") : ""
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function sync() {
  const index = readIndex()
  const known = new Set(index.images.map((entry) => entry.image))
  const added = publicImages().filter((image) => !known.has(image))
  for (const image of added)
    index.images.push({ image, original: originalOf(image), review: null })
  for (const entry of index.images) entry.original ??= originalOf(entry.image)
  writeIndex(index)
  console.log(`追加 ${added.length}件、合計 ${index.images.length}件`)
  for (const image of added) console.log(`  + ${image}`)
}

function referencedImages(): Map<string, string[]> {
  const references = new Map<string, string[]>()
  const pattern =
    /["'`](\/tmp\/[^"'`$]+?\.(?:webp|png|jpe?g|avif|gif|svg|ico))["'`]/g
  const sources = [
    ...REFERENCE_SOURCES.flatMap(listFiles),
    "public/manifest.json",
    "void.config.ts",
  ].filter(
    (file) =>
      /\.(tsx?|json)$/.test(file) &&
      path.resolve(file) !== path.resolve(INDEX_FILE) &&
      !file.startsWith("tests/e2e/")
  )
  for (const file of sources) {
    for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
      references.set(match[1], [...(references.get(match[1]) ?? []), file])
    }
  }
  return references
}

function check(strict: boolean) {
  const index = readIndex()
  const problems: string[] = []
  const indexed = new Set(index.images.map((entry) => entry.image))
  const integrity = checkImageIntegrity({
    images: index.images,
    publicImages: publicImages(),
    imports: existsSync(IMPORT_MANIFEST)
      ? JSON.parse(readFileSync(IMPORT_MANIFEST, "utf8"))
      : [],
    outputs: existsSync(OUTPUT_MANIFEST)
      ? JSON.parse(readFileSync(OUTPUT_MANIFEST, "utf8"))
      : [],
    ledger: existsSync(IMAGE_LEDGER)
      ? JSON.parse(readFileSync(IMAGE_LEDGER, "utf8")).images
      : [],
    fileExists: existsSync,
    hashFile: (file) =>
      createHash("sha256").update(readFileSync(file)).digest("hex"),
  })
  problems.push(...integrity.map((problem) => problem.message))
  for (const image of publicImages())
    if (!indexed.has(image))
      problems.push(`一覧にない画像: ${image}（vp run images sync）`)
  for (const entry of index.images)
    if (!existsSync(filePath(entry.image)))
      problems.push(`ファイルがない: ${entry.image}`)
  for (const [image, files] of referencedImages())
    if (!existsSync(filePath(image)))
      problems.push(
        `参照先がない: ${image}（${[...new Set(files)].join(", ")}）`
      )

  const counts = new Map<ReviewState, ImageEntry[]>()
  for (const entry of index.images.filter((item) =>
    existsSync(filePath(item.image))
  )) {
    const state = reviewState(entry)
    counts.set(state, [...(counts.get(state) ?? []), entry])
  }
  const states: ReviewState[] = ["合格", "未確認", "要再確認", "差し戻し"]
  console.log(
    states
      .map((state) => `${state} ${counts.get(state)?.length ?? 0}件`)
      .join("、")
  )
  for (const state of ["要再確認", "差し戻し"] as const)
    for (const entry of counts.get(state) ?? [])
      console.log(
        `  ${state}: ${entry.image}${entry.review?.note ? `（${entry.review.note}）` : ""}`
      )
  if (strict)
    for (const state of ["未確認", "要再確認", "差し戻し"] as const)
      for (const entry of counts.get(state) ?? [])
        problems.push(`目視確認が済んでいない（${state}）: ${entry.image}`)

  for (const problem of problems) console.error(`NG ${problem}`)
  if (problems.length > 0) process.exit(1)
}

async function preview(query: string | undefined) {
  const entry = findEntry(readIndex(), query)
  const { default: sharp } = await import("sharp")
  mkdirSync(PREVIEW_DIRECTORY, { recursive: true })
  const output = path.join(
    PREVIEW_DIRECTORY,
    `${path.basename(entry.image, path.extname(entry.image))}.png`
  )
  await sharp(filePath(entry.image))
    .flatten({ background: "#ff00ff" })
    .png()
    .toFile(output)
  console.log(
    `${output}（透過部分はマゼンタ。背景の白が残っていないか、服の白が抜けていないかを見る）`
  )
}

function record(
  status: Review["status"],
  query: string | undefined,
  note: string
) {
  if (status === "rejected" && !note)
    throw new Error("差し戻しには --note で理由を書いてください")
  const index = readIndex()
  const entry = findEntry(index, query)
  entry.review = {
    status,
    sha256: hashOf(entry.image),
    reviewedAt: today(),
    note,
  }
  writeIndex(index)
  console.log(`${entry.image}: ${status === "approved" ? "合格" : "差し戻し"}`)
}

const [command, ...args] = process.argv.slice(2)
switch (command) {
  case "sync":
    sync()
    break
  case "check":
    check(args.includes("--strict"))
    break
  case "preview":
    await preview(args[0])
    break
  case "approve":
    record("approved", args[0], optionValue(args, "--note"))
    break
  case "reject":
    record("rejected", args[0], optionValue(args, "--note"))
    break
  default:
    console.log(
      "使い方: vp run images <sync|check [--strict]|preview <画像>|approve <画像> [--note]|reject <画像> --note>"
    )
    process.exit(command ? 1 : 0)
}
