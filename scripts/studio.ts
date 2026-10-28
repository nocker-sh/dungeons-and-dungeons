#!/usr/bin/env bun
import { contentSource } from "@/content/game-content"
import { layoutTime } from "@/development/studio/layout-time"
import { chromium, type Page } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { createHash } from "node:crypto"
import { defaultStudioConfig } from "@/development/studio/config"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioConfig } from "@/development/studio/config"
import { waitForStudio } from "@/scripts/studio-browser"
import type { StudioInspection } from "@/client/dev/studio-types"

/** UIと同じiframeを実寸で開き、仮想時計の指定時刻を描画する。 */
const help = `ゲームの画像と検証記録を生成する（開発サーバーが必要）
  vp run studio list
  vp run studio capture --scene battle --party hero,rivet,husky --foes haribote-adult,hiyokobu --at 2000 --out /tmp/battle.png
  vp run studio frames --config /tmp/battle.json --times 0,700,1500,2000,3000 --out /tmp/battle-frames
  vp run studio inspect --scene battle --at 2000 --out /tmp/battle.json

  --size 1280x800  --seed 1  --hp 100,25,0  --duration 6000
  --actions '[{"at":4000,"label":"放つ"}]'
  --config <JSONファイル> / --config-json '<JSON>'
  --base-url https://dnd.localhost
  --guides  配置の枠線を画像に入れる
  --verify  同じ条件を2回描画し、PNGのハッシュの一致を検証

PNGと同名の .inspection.json に状態・配置・アニメーション・エラーを保存する。
framesはcontact-sheet.pngとmanifest.jsonも出力する。`

const command = process.argv[2]
const args = new Map<string, string>()
const flags = new Set(["guides", "verify"])
for (let index = 3; index < process.argv.length; index++) {
  const key = process.argv[index]
  if (!key.startsWith("--")) throw new Error(`引数が不正です: ${key}`)
  const name = key.slice(2)
  if (flags.has(name)) {
    args.set(name, "true")
    continue
  }
  const value = process.argv[++index]
  if (!value || value.startsWith("--"))
    throw new Error(`${key} の値がありません`)
  args.set(name, value)
}
const allowed = new Set([
  "scene",
  "party",
  "foes",
  "at",
  "out",
  "times",
  "size",
  "seed",
  "hp",
  "duration",
  "actions",
  "config",
  "config-json",
  "base-url",
  ...flags,
])
for (const key of args.keys())
  if (!allowed.has(key)) throw new Error(`未知のオプション: --${key}`)
const base = (
  args.get("base-url") ??
  process.env.E2E_BASE_URL ??
  "https://dnd.localhost"
).replace(/\/$/, "")

async function configOf(): Promise<StudioConfig> {
  const input = args.has("config")
    ? JSON.parse(await readFile(args.get("config")!, "utf8"))
    : args.has("config-json")
      ? JSON.parse(args.get("config-json")!)
      : {}
  const patch: Record<string, unknown> = { ...input }
  for (const key of ["scene", "seed", "duration"] as const)
    if (args.has(key))
      patch[key] = key === "scene" ? args.get(key) : Number(args.get(key))
  for (const key of ["party", "foes", "hp"] as const)
    if (args.has(key))
      patch[key] = args
        .get(key)!
        .split(",")
        .map((value) => (key === "hp" ? Number(value) : value))
  if (args.has("actions")) patch.actions = JSON.parse(args.get("actions")!)
  if (args.has("size")) {
    const match = args.get("size")!.match(/^(\d+)x(\d+)$/)
    if (!match) throw new Error("--size は 390x844 の形式です")
    patch.width = Number(match[1])
    patch.height = Number(match[2])
  }
  return parseStudioConfig(patch)
}
async function open(page: Page, config: StudioConfig) {
  await page.goto(base + frameUrl(config), { waitUntil: "domcontentloaded" })
  await waitForStudio(page)
  const failure = await page.evaluate(() => window.__devStudioError)
  if (failure) throw new Error(failure)
  const initialized = await page.evaluate(() => window.__devStudio!.inspect())
  if (JSON.stringify(initialized.config) !== JSON.stringify(config))
    throw new Error("フレームが指定と異なる条件で起動しました")
  if (initialized.errors.length) throw new Error(initialized.errors.join("\n"))
}
async function capture(page: Page, config: StudioConfig, time: number) {
  await open(page, config)
  const inspection = await page.evaluate(async (time) => {
    await window.__devStudio!.advance(time)
    return window.__devStudio!.snapshot()
  }, time)
  if (args.has("guides"))
    await page.evaluate(() => window.__devStudio!.guides(true))
  const image = await page.screenshot({ type: "png", animations: "allow" })
  const result = {
    image,
    inspection,
    sha256: createHash("sha256").update(image).digest("hex"),
  }
  if (inspection.errors.length) {
    const output = resolve(
      args.get("out") ??
        `node_modules/.cache/studio/${config.scene}-${time}.png`
    )
    const path =
      command === "frames"
        ? `${output}/${time}ms.error.png`
        : command === "inspect"
          ? `${output}.error.png`
          : output
    await save(path, result)
    throw new Error(`${inspection.errors.join("\n")}\n画面・状態JSON: ${path}`)
  }
  return result
}

async function save(
  path: string,
  result: { image: Buffer; inspection: StudioInspection; sha256: string }
) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, result.image)
  await writeFile(
    path.replace(/\.png$/i, "") + ".inspection.json",
    JSON.stringify({ ...result.inspection, sha256: result.sha256 }, null, 2) +
      "\n"
  )
}
async function verify(
  page: Page,
  config: StudioConfig,
  time: number,
  result: Awaited<ReturnType<typeof capture>>,
  path: string
) {
  const repeat = await capture(page, config, time)
  if (result.sha256 === repeat.sha256) return
  await save(path, result)
  await save(path.replace(/\.png$/i, "") + ".repeat.png", repeat)
  const { PNG } = await import("pngjs")
  const first = PNG.sync.read(result.image)
  const second = PNG.sync.read(repeat.image)
  const diff = new PNG({ width: first.width, height: first.height })
  let changed = 0
  for (let offset = 0; offset < first.data.length; offset += 4) {
    const different = !first.data
      .subarray(offset, offset + 4)
      .equals(second.data.subarray(offset, offset + 4))
    if (different) changed++
    diff.data[offset] = different ? 255 : first.data[offset] / 4
    diff.data[offset + 1] = different ? 0 : first.data[offset + 1] / 4
    diff.data[offset + 2] = different ? 80 : first.data[offset + 2] / 4
    diff.data[offset + 3] = 255
  }
  const diffPath = path.replace(/\.png$/i, "") + ".diff.png"
  await writeFile(diffPath, PNG.sync.write(diff))
  throw new Error(
    `再現画像が一致しません: ${time}ms・${changed}画素。画像・再描画・差分・状態JSON: ${path}`
  )
}
async function main() {
  if (!command || command === "help" || command === "--help") {
    console.log(help)
    return
  }
  if (!["list", "capture", "frames", "inspect"].includes(command))
    throw new Error(`コマンドがありません: ${command}`)
  const config = await configOf()
  if (command === "list") {
    const catalog = await import("@/development/studio/scenarios")
    console.log(
      JSON.stringify(
        {
          scenes: catalog.studioScenes.map(({ slug, title }) => ({
            slug,
            title,
          })),
          party: catalog.studioMembers.map(({ slug, name }) => ({
            slug,
            name,
          })),
          foes: contentSource.foes.map(({ slug, name }) => ({ slug, name })),
          defaults: defaultStudioConfig,
        },
        null,
        2
      )
    )
    return
  }
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: config.width, height: config.height },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`)
  })
  try {
    if (command === "frames") {
      const times = (args.get("times") ?? "0,700,1500,2000,3000,4000")
        .split(",")
        .map(Number)
      if (
        times.length > 120 ||
        !times.length ||
        times.some(
          (time) => !Number.isFinite(time) || time < 0 || time > config.duration
        )
      )
        throw new Error("--times は0〜長さの範囲のmsを最大120個指定します")
      const directory = resolve(
        args.get("out") ?? "node_modules/.cache/studio/frames"
      )
      const manifest = []
      for (const [index, time] of times.entries()) {
        const result = await capture(page, config, time)
        const filename = `${String(index).padStart(3, "0")}-${time}ms.png`
        if (args.has("verify"))
          await verify(page, config, time, result, `${directory}/${filename}`)
        await save(`${directory}/${filename}`, result)
        manifest.push({ time, file: filename, sha256: result.sha256 })
      }
      if (errors.length) throw new Error(errors.join("\n"))
      await writeFile(
        `${directory}/manifest.json`,
        JSON.stringify({ version: 1, config, frames: manifest }, null, 2) + "\n"
      )
      const { PNG } = await import("pngjs")
      const columns = Math.min(4, manifest.length),
        tileWidth = 320,
        tileHeight = Math.round((tileWidth * config.height) / config.width)
      const sheet = new PNG({
        width: columns * tileWidth,
        height: Math.ceil(manifest.length / columns) * tileHeight,
      })
      for (const [index, entry] of manifest.entries()) {
        const source = PNG.sync.read(
          await readFile(`${directory}/${entry.file}`)
        )
        for (let y = 0; y < tileHeight; y++)
          for (let x = 0; x < tileWidth; x++) {
            const from =
              (Math.min(
                source.height - 1,
                Math.floor((y * source.height) / tileHeight)
              ) *
                source.width +
                Math.min(
                  source.width - 1,
                  Math.floor((x * source.width) / tileWidth)
                )) *
              4
            const to =
              ((Math.floor(index / columns) * tileHeight + y) * sheet.width +
                (index % columns) * tileWidth +
                x) *
              4
            source.data.copy(sheet.data, to, from, from + 4)
          }
      }
      await writeFile(`${directory}/contact-sheet.png`, PNG.sync.write(sheet))
      console.log(
        JSON.stringify(
          { directory, frames: manifest.length, verified: args.has("verify") },
          null,
          2
        )
      )
      return
    }
    const time = Number(args.get("at") ?? layoutTime(config.scene))
    if (!Number.isFinite(time) || time < 0 || time > config.duration)
      throw new Error("--at は0〜長さの範囲のmsです")
    const result = await capture(page, config, time)
    if (args.has("verify")) {
      const path = resolve(
        args.get("out") ??
          `node_modules/.cache/studio/${config.scene}-${time}.png`
      )
      await verify(
        page,
        config,
        time,
        result,
        command === "inspect" ? path + ".png" : path
      )
    }
    if (errors.length) throw new Error(errors.join("\n"))
    if (command === "inspect") {
      const output = JSON.stringify(result.inspection, null, 2) + "\n"
      if (args.has("out")) {
        const path = resolve(args.get("out")!)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, output)
      } else console.log(output)
    } else {
      const path = resolve(
        args.get("out") ??
          `node_modules/.cache/studio/${config.scene}-${time}.png`
      )
      if (!path.endsWith(".png"))
        throw new Error("--out は .png にしてください")
      await save(path, result)
      console.log(
        JSON.stringify(
          {
            image: path,
            time,
            sha256: result.sha256,
            verified: args.has("verify"),
            elements: result.inspection.elements.length,
            animations: result.inspection.animations.length,
          },
          null,
          2
        )
      )
    }
  } finally {
    await browser.close()
  }
}
await main().catch((error) => {
  console.error(String(error))
  process.exitCode = 1
})
