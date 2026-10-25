/// <reference types="node" />
/**
 * 見た目の撮り比べ。/previews の全場面をスマホとPCで撮り、基準と比べる。
 *   bun e2e/visual.ts base            いまの見た目を基準にする（.visual/base）
 *   bun e2e/visual.ts check           撮り直して基準と比べる（node_modules/.cache/visual/next と差分画像 …/next/diff）
 *   bun e2e/visual.ts check --max 2   差がこの割合（%）を超える場面があれば失敗（既定 2）
 */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import { VIEWPORTS, launch, openPage, openPreview, previewSlugs } from "./lib"

// 開発サーバーが変更として拾わない場所に置く（リポジトリ直下だと書くたびに再読み込みされる）
const ROOT = "node_modules/.cache/visual"
const [mode = "check", ...rest] = process.argv.slice(2)
const maxIndex = rest.indexOf("--max")
const limit = maxIndex >= 0 ? Number(rest[maxIndex + 1]) : 2

async function capture(dir: string) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const browser = await launch()
  const slugs = await previewSlugs(browser)
  const errors: string[] = []
  await Promise.all(
    VIEWPORTS.map(async (viewport) => {
      const page = await openPage(browser, viewport, errors)
      for (const slug of slugs) {
        await openPreview(page, slug)
        await page.screenshot({ path: `${dir}/${slug}-${viewport.name}.png` })
      }
      await page.close()
    })
  )
  await browser.close()
  return errors
}

function compare(base: string, next: string) {
  mkdirSync(`${next}/diff`, { recursive: true })
  const rows: { file: string; percent: number }[] = []
  for (const file of readdirSync(base).filter((name) =>
    name.endsWith(".png")
  )) {
    const a = PNG.sync.read(readFileSync(`${base}/${file}`))
    let percent = 100
    try {
      const b = PNG.sync.read(readFileSync(`${next}/${file}`))
      const out = new PNG({ width: a.width, height: a.height })
      const changed = pixelmatch(a.data, b.data, out.data, a.width, a.height, {
        threshold: 0.15,
      })
      writeFileSync(`${next}/diff/${file}`, PNG.sync.write(out))
      percent = (changed / (a.width * a.height)) * 100
    } catch {
      // 基準にない・大きさが違う場面は 100% の差として扱う
    }
    rows.push({ file, percent })
  }
  return rows.sort((x, y) => y.percent - x.percent)
}

if (mode === "base") {
  const errors = await capture(`${ROOT}/base`)
  console.log(`基準を撮った: ${ROOT}/base`)
  if (errors.length) console.log(errors.join("\n"))
} else {
  const errors = await capture(`${ROOT}/next`)
  const rows = compare(`${ROOT}/base`, `${ROOT}/next`)
  for (const row of rows)
    console.log(
      `${row.percent > limit ? "NG" : "ok"} ${row.percent.toFixed(2).padStart(6)}%  ${row.file}`
    )
  if (errors.length) console.log(`画面のエラー:\n${errors.join("\n")}`)
  if (errors.length || rows.some((row) => row.percent > limit))
    process.exitCode = 1
}
