import path from "node:path"

type RegistryImage = { image: string; original: string | null }
type ImportImage = { name: string; image?: string; retired?: boolean }
type LedgerImage = {
  file: string
  sha256: string
  original: string | null
  availability?: "present" | "archived" | "missing-history"
  sourceOriginal?: { file: string; sha256: string } | null
  runtimeReferences?: unknown[]
}

export type ImageIntegrityInput = {
  images: RegistryImage[]
  publicImages: string[]
  imports: ImportImage[]
  outputs?: { image: string; retired?: boolean }[]
  ledger: LedgerImage[]
  fileExists: (file: string) => boolean
  hashFile: (file: string) => string
}

export type ImageIntegrityProblem = { code: string; message: string }

/** Human review is deliberately separate from file/provenance integrity. */
export function checkImageIntegrity(input: ImageIntegrityInput) {
  const problems: ImageIntegrityProblem[] = []
  const report = (code: string, message: string) =>
    problems.push({ code, message })
  const registered = new Map<string, RegistryImage>()
  const published = new Set(input.publicImages)
  const originalsDirectory = "private/art/originals"
  const safeOriginal = (original: string) =>
    !path.isAbsolute(original) && !original.split(/[\\/]/).includes("..")
  const originalFile = (original: string) =>
    path.join(originalsDirectory, original)
  const checkedHashes = new Map<string, string>()
  const verifyHash = (file: string, expected: string) => {
    if (!input.fileExists(file)) {
      report("ledger-file-missing", `台帳の現存ファイルがない: ${file}`)
      return
    }
    let actual = checkedHashes.get(file)
    if (actual === undefined) {
      actual = input.hashFile(file)
      checkedHashes.set(file, actual)
    }
    if (actual !== expected)
      report("ledger-hash-mismatch", `台帳のハッシュが異なる: ${file}`)
  }

  for (const entry of input.images) {
    if (registered.has(entry.image))
      report("registry-duplicate", `一覧の画像が重複: ${entry.image}`)
    registered.set(entry.image, entry)
    if (entry.original === null) {
      if (!entry.image.startsWith("/tmp/icons/"))
        report(
          "registry-original-missing",
          `元画像の対応がない: ${entry.image}`
        )
    } else if (
      !safeOriginal(entry.original) ||
      !input.fileExists(originalFile(entry.original))
    ) {
      report(
        "registry-original-missing",
        `元画像がない: ${entry.image} → ${entry.original}`
      )
    }
  }

  const activeImports = new Map<string, ImportImage>()
  for (const entry of input.imports.filter((entry) => !entry.retired)) {
    if (!entry.image) {
      report(
        "import-image-missing",
        `有効な取り込み行に公開先がない: ${entry.name}`
      )
      continue
    }
    if (activeImports.has(entry.image))
      report("import-duplicate", `有効な取り込み先が重複: ${entry.image}`)
    activeImports.set(entry.image, entry)
    if (!published.has(entry.image))
      report(
        "import-public-missing",
        `有効な取り込み先が公開されていない: ${entry.image}`
      )
    const registry = registered.get(entry.image)
    if (!registry)
      report(
        "import-registry-missing",
        `有効な取り込み先が一覧にない: ${entry.image}`
      )
    else if (registry.original !== entry.name)
      report(
        "import-original-mismatch",
        `取り込み表と一覧の元画像が異なる: ${entry.image}`
      )
    if (
      !safeOriginal(entry.name) ||
      !input.fileExists(originalFile(entry.name))
    )
      report("import-original-missing", `有効な取り込み元がない: ${entry.name}`)
  }
  for (const entry of input.images)
    if (entry.original !== null && !activeImports.has(entry.image))
      report(
        "registry-import-missing",
        `一覧に対応する有効な取り込み行がない: ${entry.image}`
      )

  if (input.outputs) {
    const activeOutputs = new Set<string>()
    for (const entry of input.outputs.filter((entry) => !entry.retired)) {
      if (activeOutputs.has(entry.image))
        report("output-duplicate", `有効な出力先が重複: ${entry.image}`)
      activeOutputs.add(entry.image)
      if (!published.has(entry.image))
        report(
          "output-public-missing",
          `有効な出力先が公開されていない: ${entry.image}`
        )
      if (!registered.has(entry.image))
        report(
          "output-registry-missing",
          `有効な出力先が画像一覧にない: ${entry.image}`
        )
    }
    for (const image of published)
      if (!activeOutputs.has(image))
        report(
          "public-output-missing",
          `公開画像の有効な出力行がない: ${image}`
        )
  }

  const presentPublic = new Map<string, LedgerImage>()
  for (const entry of input.ledger) {
    if (
      !["present", "archived", "missing-history"].includes(
        entry.availability ?? ""
      )
    ) {
      report(
        "ledger-availability-missing",
        `台帳の現存・履歴区分がない: ${entry.file}`
      )
      continue
    }
    if (entry.availability === "missing-history") {
      if (input.fileExists(entry.file))
        report(
          "ledger-history-present",
          `不在履歴のファイルが存在する: ${entry.file}`
        )
      if (entry.runtimeReferences?.length)
        report(
          "ledger-history-referenced",
          `不在履歴に実行用参照がある: ${entry.file}`
        )
      continue
    }
    verifyHash(entry.file, entry.sha256)
    if (entry.availability === "archived") continue
    if (!entry.file.startsWith("public/")) continue
    const image = `/${entry.file.slice("public/".length)}`
    if (presentPublic.has(image))
      report("ledger-duplicate", `台帳の現用公開行が重複: ${image}`)
    presentPublic.set(image, entry)
    if (!published.has(image))
      report("ledger-public-missing", `台帳の現用行が公開一覧にない: ${image}`)
    const registry = registered.get(image)
    if (!registry)
      report(
        "ledger-registry-missing",
        `台帳の現用行が画像一覧にない: ${image}`
      )
    else if (entry.original !== registry.original)
      report(
        "ledger-original-mismatch",
        `台帳と画像一覧の元画像が異なる: ${image}`
      )
    if (entry.original !== null) {
      const expectedFile = originalFile(entry.original)
      if (entry.sourceOriginal?.file !== expectedFile)
        report(
          "ledger-source-mismatch",
          `台帳の元画像ファイル対応が異なる: ${image}`
        )
      else verifyHash(expectedFile, entry.sourceOriginal.sha256)
    }
  }
  for (const image of published)
    if (!presentPublic.has(image))
      report(
        "ledger-public-row-missing",
        `公開画像の現用台帳行がない: ${image}`
      )

  return problems
}
