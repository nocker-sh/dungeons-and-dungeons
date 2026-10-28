import assert from "node:assert/strict"
import { waitForStudio } from "@/scripts/studio-browser"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { chromium, type Page } from "playwright"
import { BASE_URL } from "@/tests/e2e/lib"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioConfig } from "@/development/studio/config"

const directory = "node_modules/.cache/studio/acceptance"
await mkdir(directory, { recursive: true })
const browser = await chromium.launch()
const errors: string[] = []
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true,
})
page.on("pageerror", (error) => errors.push(error.message))
async function capture(
  target: Page,
  config: StudioConfig,
  time: number,
  name: string
) {
  await target.setViewportSize({ width: config.width, height: config.height })
  await target.goto(BASE_URL + frameUrl(config))
  await waitForStudio(target)
  const error = await target.evaluate(() => window.__devStudioError)
  assert.equal(error, undefined)
  const result = await target.evaluate(async (time) => {
    const before = await window.__devStudio!.advance(time)
    const after = await window.__devStudio!.snapshot()
    return { before, after }
  }, time)
  assert.deepEqual(
    result.after.elements,
    result.before.elements,
    "静止画でレイアウト・色・透明度を変えない"
  )
  const inspection = result.after
  assert.deepEqual(inspection.errors, [])
  assert.deepEqual(inspection.config, config)
  const png = await target.screenshot({ path: `${directory}/${name}.png` })
  await writeFile(
    `${directory}/${name}.json`,
    JSON.stringify(inspection, null, 2)
  )
  return { inspection, sha: createHash("sha256").update(png).digest("hex") }
}

try {
  // 本番の保存が壊れていても開発用の戦闘が起動し、上書きしない。
  await page.goto(BASE_URL + "/dev/frame/battle")
  await page.evaluate(() =>
    localStorage.setItem("dungeons-and-dungeons/save", "preserve-this")
  )
  const storage = await page.evaluate(() =>
    JSON.stringify(
      Object.fromEntries(
        Object.keys(localStorage)
          .sort()
          .map((key) => [key, localStorage.getItem(key)])
      )
    )
  )
  const config = parseStudioConfig({
    party: ["hero", "rivet", "husky"],
    foes: ["haribote-adult", "hiyokobu"],
    hp: [100, 25, 0],
    seed: 77,
  })
  const zero = await capture(page, config, 0, "battle-0")
  const first = await capture(page, config, 2000, "battle-2000")
  const repeat = await capture(page, config, 2000, "battle-2000-repeat")
  assert.equal(first.sha, repeat.sha, "同じ時刻の画像")
  assert.notEqual(zero.sha, first.sha, "登場演出が進む")
  const party = first.inspection.party as {
    name: string
    hp: number
    maxHp: number
  }[]
  assert.deepEqual(
    party.map((member) => member.name),
    ["あなた", "リベット", "ハスキー"]
  )
  assert.equal(party[2].hp, 0)
  assert.equal(party[1].hp, Math.round(party[1].maxHp / 4))
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(localStorage)
            .sort()
            .map((key) => [key, localStorage.getItem(key)])
        )
      )
    ),
    storage
  )
  const acted = await capture(
    page,
    parseStudioConfig({ actions: [{ at: 4000, label: "放つ" }] }),
    4500,
    "battle-action"
  )
  assert.deepEqual(acted.inspection.operations, [
    { at: 4000, label: "放つ", success: true },
  ])
  const parts = await capture(
    page,
    parseStudioConfig({
      scene: "components",
      actions: [{ at: 1000, label: "カットイン" }],
    }),
    1600,
    "cut-in"
  )
  assert.ok(parts.inspection.animations.length > 0)
  assert.equal(parts.inspection.operations[0].success, true)
  assert.ok(
    parts.inspection.text.includes("スキル発動！"),
    "800msのカットインが600ms後にも残る"
  )
  assert.ok(
    parts.inspection.animations.some(
      (track) => track.start === 1000 && track.duration === 800
    )
  )
  const finished = await capture(
    page,
    parseStudioConfig({
      scene: "components",
      actions: [{ at: 1000, label: "カットイン" }],
    }),
    2600,
    "cut-in-finished"
  )
  assert.ok(
    !finished.inspection.text.includes("スキル発動！"),
    "カットインが所定の時間で退場する"
  )
  const wide = await capture(
    page,
    parseStudioConfig({ width: 1280, height: 800 }),
    2000,
    "wide"
  )
  assert.equal(wide.inspection.config.width, 1280)

  // 親の縮尺とゲームの実寸、パス遷移、巻き戻し、コマ送り、停止を実際のUIで通す。
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto(BASE_URL + "/dev/studio")
  await page.waitForURL("**/dev/studio/battle")
  const ready = async (time: number) => {
    await page.waitForFunction(
      (time) => {
        const studio =
          document.querySelector("iframe")?.contentWindow?.__devStudio
        return studio?.settled && studio.inspect().time === time
      },
      time,
      { timeout: 45000 }
    )
    await page
      .getByRole("button", { name: "再生", exact: true })
      .waitFor({ state: "visible" })
  }
  await ready(2000)
  assert.equal(
    await page
      .locator("iframe")
      .evaluate(
        (frame) => (frame as HTMLIFrameElement).contentWindow!.innerWidth
      ),
    390
  )
  await page
    .getByRole("spinbutton", { name: "時刻（ms）", exact: true })
    .fill("4000")
  await ready(4000)
  await page
    .getByRole("spinbutton", { name: "時刻（ms）", exact: true })
    .fill("2000")
  await ready(2000)
  await page.getByRole("button", { name: "＋1コマ", exact: true }).click()
  await ready(2000 + 1000 / 60)
  await page.getByRole("button", { name: "再生", exact: true }).click()
  await page.getByRole("button", { name: "停止", exact: true }).click()
  await page.getByRole("button", { name: "横長", exact: true }).click()
  await page.waitForFunction(
    () =>
      document.querySelector("iframe")?.contentWindow?.__devStudio?.ready &&
      document.querySelector("iframe")?.contentWindow?.innerWidth === 1280
  )
  await page
    .getByRole("link", { name: "コンポーネント・演出", exact: true })
    .click()
  await page.waitForURL("**/dev/studio/components")
  await page.waitForFunction(
    () => document.querySelector("iframe")?.contentWindow?.__devStudio?.ready
  )
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent === "検証JSON" && !button.disabled
    )
  )
  const downloaded = page.waitForEvent("download")
  await page.getByRole("button", { name: "シナリオJSON", exact: true }).click()
  const file = await downloaded
  const saved = JSON.parse(await readFile((await file.path())!, "utf8"))
  assert.equal(saved.scene, "components")
  assert.equal(saved.width, 1280)
  const imported = parseStudioConfig({
    ...saved,
    seed: 99,
    party: ["hero", "rivet", "mayu"],
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: "scenario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  await page.waitForFunction(() => {
    const api = document.querySelector("iframe")?.contentWindow?.__devStudio
    return (
      api?.settled &&
      api.inspect().config.seed === 99 &&
      api.inspect().time > 0 &&
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent === "検証JSON" && !button.disabled
      )
    )
  })
  assert.deepEqual(
    await page
      .locator("iframe")
      .evaluate(
        (frame) =>
          (frame as HTMLIFrameElement).contentWindow!.__devStudio!.inspect()
            .config
      ),
    imported
  )
  await page.getByRole("button", { name: "＋1コマ", exact: true }).focus()
  const beforeKey = await page
    .locator("iframe")
    .evaluate(
      (frame) =>
        (frame as HTMLIFrameElement).contentWindow!.__devStudio!.inspect().time
    )
  await page.keyboard.press("ArrowRight")
  await ready(beforeKey + 1000 / 60)
  await page.screenshot({ path: `${directory}/studio.png` })
  assert.deepEqual(errors, [])
  console.log(
    `スタジオの条件・画像再現・操作・保存保護・実寸・タイムラインを確認: ${directory}`
  )
} catch (error) {
  await page.screenshot({ path: `${directory}/failure.png` })
  await writeFile(
    `${directory}/failure.json`,
    JSON.stringify(
      await page.evaluate(() => ({
        url: location.href,
        text: document.body.textContent,
        frame: document
          .querySelector("iframe")
          ?.contentWindow?.__devStudio?.inspect(),
        error:
          document.querySelector("iframe")?.contentWindow?.__devStudioError,
      })),
      null,
      2
    )
  )
  throw error
} finally {
  await browser.close()
}
