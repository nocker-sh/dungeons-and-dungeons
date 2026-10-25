import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { studioScenes } from "../src/lib/dev/studio/scenarios"
import {
  frameUrl,
  parseStudioConfig,
  viewportPresets,
} from "../src/lib/dev/studio/config"
import { layoutTime } from "../src/lib/dev/studio/patterns"
import { BASE_URL, launch } from "./lib"
import { PARTY_SLOTS } from "../src/lib/wiz/content/constants"

const directory = "node_modules/.cache/studio/layouts"
await mkdir(directory, { recursive: true })
const browser = await launch()
const failures: unknown[] = []
try {
  const requestedScenes = process.env.LAYOUT_SCENES?.split(",")
  const requestedViewports = process.env.LAYOUT_VIEWPORTS?.split(",")
  for (const viewport of viewportPresets.filter(
    (entry) => !requestedViewports || requestedViewports.includes(entry.name)
  )) {
    const page = await browser.newPage({ viewport, ignoreHTTPSErrors: true })
    for (const scene of studioScenes.filter(
      (entry) => !requestedScenes || requestedScenes.includes(entry.slug)
    )) {
      const config = parseStudioConfig({
        scene: scene.slug,
        width: viewport.width,
        height: viewport.height,
      })
      const errors: string[] = []
      const onError = (error: Error) => errors.push(error.message)
      page.on("pageerror", onError)
      try {
        await page.goto(BASE_URL + frameUrl(config))
        await page.waitForFunction(
          () => window.__devStudio?.ready || window.__devStudioError
        )
        const bootError = await page.evaluate(() => window.__devStudioError)
        assert.equal(bootError, undefined)
        const inspection = await page.evaluate(
          async (time) => window.__devStudio!.advance(time),
          layoutTime(scene.slug)
        )
        await page.screenshot({
          path: `${directory}/${scene.slug}-${viewport.name}.png`,
        })
        await writeFile(
          `${directory}/${scene.slug}-${viewport.name}.json`,
          JSON.stringify(inspection, null, 2)
        )
        assert.deepEqual(errors, [])
        assert.deepEqual(inspection.errors, [])
        assert.ok(inspection.operations.every((entry) => entry.success))
        assert.equal(
          inspection.party && (inspection.party as unknown[]).length,
          PARTY_SLOTS
        )
        console.log(`${viewport.name} ${scene.slug} OK`)
      } catch (error) {
        failures.push({
          viewport: viewport.name,
          scene: scene.slug,
          error: String(error),
        })
        console.log(`${viewport.name} ${scene.slug} ${String(error)}`)
      } finally {
        page.off("pageerror", onError)
      }
    }
    await page.close()
  }
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    ignoreHTTPSErrors: true,
  })
  console.log("一覧：起動")
  await page.goto(BASE_URL + "/dev/layouts")
  await page.waitForFunction(
    () =>
      document.querySelectorAll('iframe[data-layout-ready="true"]').length ===
      6,
    undefined,
    { timeout: 45000 }
  )
  assert.equal(await page.getByRole("alert").count(), 0)
  await page.screenshot({ path: `${directory}/gallery.png`, fullPage: true })
  console.log("一覧：絞り込み")
  await page.getByRole("textbox", { name: "場面を絞り込む" }).fill("ギルド：")
  await page.waitForFunction(
    () =>
      document.querySelectorAll('iframe[data-layout-ready="true"]').length ===
      3,
    undefined,
    { timeout: 45000 }
  )
  console.log("一覧：横長")
  await page.getByRole("button", { name: "横長", exact: true }).click()
  await page.waitForFunction(
    () =>
      document.querySelectorAll('iframe[data-layout-ready="true"]').length ===
      3,
    undefined,
    { timeout: 45000 }
  )
  assert.equal(await page.getByRole("alert").count(), 0)
  await page.screenshot({
    path: `${directory}/gallery-guild.png`,
    fullPage: true,
  })
  await page
    .getByRole("link", { name: "ギルド：クエスト", exact: true })
    .last()
    .click()
  await page.waitForURL("**/dev/studio/guild-quests")
  await page.waitForFunction(() => {
    const frame = document.querySelector(
      'iframe[title="ゲームプレビュー"]'
    ) as HTMLIFrameElement | null
    const api = frame?.contentWindow?.__devStudio
    return api?.ready && api.settled && api.inspect().time === 4000
  })
  const opened = await page
    .locator('iframe[title="ゲームプレビュー"]')
    .evaluate((frame) =>
      (frame as HTMLIFrameElement).contentWindow!.__devStudio!.inspect()
    )
  assert.equal(opened.config.scene, "guild-quests")
  assert.ok(opened.text.includes("クエスト"))
  assert.deepEqual(opened.operations, [
    { at: 2000, label: "クエスト", success: true },
  ])
  await writeFile(
    `${directory}/failures.json`,
    JSON.stringify(failures, null, 2)
  )
  assert.deepEqual(failures, [])
  console.log(`指定した場面・寸法と一覧を確認: ${directory}`)
} catch (problem) {
  const page = browser
    .contexts()
    .flatMap((context) => context.pages())
    .at(-1)
  if (page) {
    await page.screenshot({ path: `${directory}/failure.png`, fullPage: true })
    await writeFile(
      `${directory}/failure.json`,
      JSON.stringify(
        await page.locator("iframe").evaluateAll((frames) =>
          frames.map((frame) => {
            const view = (frame as HTMLIFrameElement).contentWindow
            return {
              scene: frame.getAttribute("title"),
              ready: frame.dataset.layoutReady,
              gameReady: view?.__devStudio?.ready,
              settled: view?.__devStudio?.settled,
              time: view?.__devStudio?.inspect().time,
              error: view?.__devStudioError,
              errors: view?.__devStudio?.inspect().errors,
            }
          })
        ),
        null,
        2
      )
    )
  }
  throw problem
} finally {
  await browser.close()
}
