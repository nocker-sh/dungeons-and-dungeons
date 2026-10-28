import { test } from "vite-plus/test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  checkImageIntegrity,
  type ImageIntegrityInput,
} from "@/scripts/image-integrity"

function fixture(run: (input: ImageIntegrityInput) => void) {
  const directory = mkdtempSync(path.join(tmpdir(), "image-integrity-"))
  const hashFile = (file: string) =>
    createHash("sha256")
      .update(readFileSync(path.join(directory, file)))
      .digest("hex")
  for (const [file, body] of [
    ["public/tmp/characters/hero.webp", "public version"],
    ["private/art/originals/hero.png", "preserved original"],
    ["private/archive/old.webp", "archived version"],
    ["public/tmp/icons/icon.svg", "self-authored icon"],
  ]) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    writeFileSync(path.join(directory, file), body)
  }
  const input: ImageIntegrityInput = {
    images: [{ image: "/tmp/characters/hero.webp", original: "hero.png" }],
    publicImages: ["/tmp/characters/hero.webp"],
    imports: [{ image: "/tmp/characters/hero.webp", name: "hero.png" }],
    outputs: [{ image: "/tmp/characters/hero.webp" }],
    ledger: [
      {
        file: "public/tmp/characters/hero.webp",
        original: "hero.png",
        sha256: hashFile("public/tmp/characters/hero.webp"),
        availability: "present",
        sourceOriginal: {
          file: "private/art/originals/hero.png",
          sha256: hashFile("private/art/originals/hero.png"),
        },
      },
    ],
    fileExists: (file) => existsSync(path.join(directory, file)),
    hashFile,
  }
  try {
    run(input)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const codes = (input: ImageIntegrityInput) =>
  checkImageIntegrity(input).map((problem) => problem.code)

test("公開・原画・有効import・現用台帳が一致する", () =>
  fixture((input) => {
    assert.deepEqual(checkImageIntegrity(input), [])
  }))

test("画像一覧と有効importの重複を検出する", () =>
  fixture((input) => {
    input.images.push({ ...input.images[0] })
    input.imports.push({ ...input.imports[0] })
    assert(codes(input).includes("registry-duplicate"))
    assert(codes(input).includes("import-duplicate"))
  }))

test("公開画像があっても原画欠損を検出する", () =>
  fixture((input) => {
    const exists = input.fileExists
    input.fileExists = (file) =>
      file !== "private/art/originals/hero.png" && exists(file)
    assert(codes(input).includes("registry-original-missing"))
    assert(codes(input).includes("import-original-missing"))
  }))

test("retired行は有効import検査から除外し現用対応の代わりにしない", () =>
  fixture((input) => {
    input.imports.push({
      image: "/tmp/old.webp",
      name: "absent.png",
      retired: true,
    })
    assert.deepEqual(checkImageIntegrity(input), [])
    input.imports[0].retired = true
    assert(codes(input).includes("registry-import-missing"))
  }))

test("公開と原画の不正hash、元画像対応の取り違えを検出する", () =>
  fixture((input) => {
    input.ledger[0].sha256 = "stale"
    input.ledger[0].sourceOriginal!.sha256 = "stale-original"
    assert.equal(
      codes(input).filter((code) => code === "ledger-hash-mismatch").length,
      2
    )
    input.imports[0].name = "another.png"
    input.ledger[0].original = "another.png"
    assert(codes(input).includes("import-original-mismatch"))
    assert(codes(input).includes("ledger-original-mismatch"))
    assert(codes(input).includes("ledger-source-mismatch"))
  }))

test("元画像がnullの自前iconはimportとsourceOriginalなしで許容する", () =>
  fixture((input) => {
    input.images.push({ image: "/tmp/icons/icon.svg", original: null })
    input.publicImages.push("/tmp/icons/icon.svg")
    input.outputs!.push({ image: "/tmp/icons/icon.svg" })
    input.ledger.push({
      file: "public/tmp/icons/icon.svg",
      original: null,
      availability: "present",
      sha256: input.hashFile("public/tmp/icons/icon.svg"),
    })
    assert.deepEqual(checkImageIntegrity(input), [])
  }))

test("archivedは実在とhashを検査し、missing-historyは不在で参照なしを要求する", () =>
  fixture((input) => {
    input.ledger.push({
      file: "private/archive/old.webp",
      original: null,
      availability: "archived",
      sha256: input.hashFile("private/archive/old.webp"),
    })
    input.ledger.push({
      file: "private/archive/absent.webp",
      original: null,
      availability: "missing-history",
      sha256: "historical",
      runtimeReferences: [],
    })
    assert.deepEqual(checkImageIntegrity(input), [])
    input.ledger[1].sha256 = "bad"
    assert(codes(input).includes("ledger-hash-mismatch"))
    input.ledger[2].file = "private/archive/old.webp"
    input.ledger[2].runtimeReferences = ["runtime.json"]
    assert(codes(input).includes("ledger-history-present"))
    assert(codes(input).includes("ledger-history-referenced"))
  }))

test("現用台帳行がなければ履歴行で代用しない", () =>
  fixture((input) => {
    input.ledger[0].availability = "archived"
    assert(codes(input).includes("ledger-public-row-missing"))
  }))

test("出力記録の不足・重複・非公開とretired除外を検査する", () =>
  fixture((input) => {
    input.outputs = [{ image: "/tmp/old.webp", retired: true }]
    assert.deepEqual(codes(input), ["public-output-missing"])
    input.outputs = [
      { image: "/tmp/characters/hero.webp" },
      { image: "/tmp/characters/hero.webp" },
      { image: "/tmp/absent.webp" },
    ]
    assert(codes(input).includes("output-duplicate"))
    assert(codes(input).includes("output-public-missing"))
    assert(codes(input).includes("output-registry-missing"))
  }))
