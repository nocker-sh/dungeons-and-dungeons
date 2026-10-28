import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"

type TestWindow = Window & { releaseImport?: () => void }
const browser = await launch()
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  ignoreHTTPSErrors: true,
  serviceWorkers: "block",
})
const errors: string[] = []
page.on("pageerror", (error) => errors.push(error.message))
const file = page.locator('input[type="file"]')
const upload = (name: string, value: unknown) =>
  file.setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value)
    ),
  })
async function ready(scene: string, seed: number, time: number) {
  await page.waitForFunction(
    ({ scene, seed, time }) => {
      const api = document.querySelector("iframe")?.contentWindow?.__devStudio
      const state = api?.inspect()
      return (
        api?.settled &&
        state?.config.scene === scene &&
        state.config.seed === seed &&
        state.time === time
      )
    },
    { scene, seed, time }
  )
}
async function release() {
  await page.evaluate(() => {
    ;(window as TestWindow).releaseImport!()
    delete (window as TestWindow).releaseImport
  })
  await page.waitForTimeout(150)
}
try {
  await page.goto(`${BASE_URL}/dev/studio/town`)
  await ready("town", 1, 2000)
  const original = await page.evaluate(
    () =>
      document.querySelector("iframe")!.contentWindow!.__devStudio!.inspect()
        .config
  )
  await upload("scenario.json", "{")
  await page.getByRole("alert").waitFor()
  console.log("不正JSONのエラーを表示。元の条件の正常なJSONを読み直す")
  await upload("scenario.json", original)
  await page.waitForFunction(() => !document.querySelector('[role="alert"]'))
  assert.equal(await file.inputValue(), "", "同じファイルを修正して選び直せる")
  await ready("town", 1, 2000)

  // ファイル本体はそのまま読み、結果の返却順だけを入れ替える。
  await page.evaluate(() => {
    const readText = (file: File) => Blob.prototype.text.call(file)
    File.prototype.text = async function () {
      const value = await readText(this)
      if (this.name.startsWith("slow"))
        await new Promise<void>((resolve) => {
          ;(window as TestWindow).releaseImport = resolve
        })
      return value
    }
  })
  const earlier = parseStudioConfig({ scene: "battle", seed: 11 })
  const latest = parseStudioConfig({ scene: "town", seed: 22, duration: 1000 })
  await upload("slow.json", earlier)
  await page.waitForFunction(() => !!(window as TestWindow).releaseImport)
  await upload("latest.json", latest)
  await ready("town", 22, 1000)
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "時刻（ms）", exact: true })
      .inputValue(),
    "1000"
  )
  await release()
  assert.ok(page.url().endsWith("/dev/studio/town"))
  await ready("town", 22, 1000)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "シナリオJSON", exact: true }).click()
  const downloaded = await downloading
  assert.deepEqual(
    JSON.parse(await readFile((await downloaded.path())!, "utf8")),
    latest
  )

  await upload("slow.json", earlier)
  await page.waitForFunction(() => !!(window as TestWindow).releaseImport)
  await page
    .getByRole("link", { name: "コンポーネント・演出", exact: true })
    .click()
  await ready("components", 22, 2000)
  await release()
  assert.ok(page.url().endsWith("/dev/studio/components"))
  await ready("components", 22, 2000)

  await upload("slow-bad.json", "{")
  await page.waitForFunction(() => !!(window as TestWindow).releaseImport)
  await page.getByRole("link", { name: "街", exact: true }).click()
  await ready("town", 22, 2000)
  await release()
  assert.equal(await page.getByRole("alert").count(), 0)

  await upload("slow.json", earlier)
  await page.waitForFunction(() => !!(window as TestWindow).releaseImport)
  await page
    .getByRole("spinbutton", { name: "乱数の種", exact: true })
    .fill("33")
  await ready("town", 33, 2000)
  await release()
  await ready("town", 33, 2000)
  assert.ok(page.url().endsWith("/dev/studio/town"))

  const otherScene = parseStudioConfig({
    scene: "components",
    seed: 44,
    width: 1280,
    party: ["hero", "rivet", "husky"],
  })
  await upload("components.json", otherScene)
  await page.waitForURL("**/dev/studio/components")
  await ready("components", 44, 2000)
  assert.deepEqual(
    await page.evaluate(
      () =>
        document.querySelector("iframe")!.contentWindow!.__devStudio!.inspect()
          .config
    ),
    otherScene
  )
  assert.equal(await page.getByRole("alert").count(), 0)
  assert.deepEqual(errors, [])
  console.log(
    "スタジオJSON: 読込失敗後の再選択・最新ファイルの優先・時刻の上限・場面変更後の結果とエラーの破棄 OK"
  )
} catch (problem) {
  console.error({
    url: page.url(),
    alerts: await page.getByRole("alert").allTextContents(),
  })
  throw problem
} finally {
  await browser.close()
}
