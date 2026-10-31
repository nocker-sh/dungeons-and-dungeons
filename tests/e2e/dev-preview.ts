import { frameUrl } from "@/development/studio/frame-url"
import { waitForStudio } from "@/scripts/studio-browser"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import type { Page } from "playwright"
import { launch } from "@/tests/e2e/launch"
import { BASE_URL } from "@/tests/e2e/lib"

const output = "/tmp/product-test/dnd-preview"
await mkdir(output, { recursive: true })
const browser = await launch()
const errors: string[] = []
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  ignoreHTTPSErrors: true,
})
page.on("pageerror", (error) => errors.push(error.message))
await page.addInitScript(() =>
  localStorage.setItem("dungeons-and-dungeons/save", "preserve-preview-save")
)
async function open(target: Page, path: string) {
  await target.goto(BASE_URL + path)
  await target.waitForFunction(
    () =>
      window.__devPreview?.ready ||
      window.__devPreview?.error ||
      document.querySelector('[role="alert"]'),
    undefined,
    { timeout: 45000 }
  )
  const failure = await target.evaluate(() => window.__devPreview?.error)
  assert.equal(failure, null)
  assert.equal(await target.evaluate(() => window.__devPreview?.ready), true)
}
try {
  await page.goto(BASE_URL + "/dev/view?catalog=1")
  const catalog = JSON.parse(
    await page.getByLabel("プレビューの指定一覧").innerText()
  )
  assert.ok(
    catalog.scenes.some(
      (scene: { slug: string }) => scene.slug === "guild-quests"
    )
  )
  const url = "/dev/view?scene=town&seed=77&at=2000"
  await open(page, url)
  const first = await page.evaluate(() => window.__devPreview!.inspect())
  assert.ok(first)
  const frame = page.frameLocator('iframe[title="グラフィックの確認"]')
  await frame
    .getByRole("button", { name: "冒険者ギルド", exact: true })
    .click({ force: true })
  await page.keyboard.press("Enter")
  const frozen = await page.evaluate(() => window.__devPreview!.inspect())
  assert.deepEqual(frozen?.state, first?.state)
  assert.deepEqual(frozen?.elements, first?.elements)
  assert.deepEqual(frozen?.animations, first?.animations)
  assert.equal(frozen?.time, 2000)
  const image = await page.screenshot({ path: `${output}/view.png` })
  await open(page, url)
  const repeated = await page.evaluate(() => window.__devPreview!.inspect())
  assert.deepEqual(repeated?.state, first?.state)
  assert.deepEqual(repeated?.elements, first?.elements)
  assert.deepEqual(await page.screenshot(), image)
  console.log("view: 入力無効・状態と配置・PNGの完全一致 OK")
  await open(page, "/dev/view?scene=guild-quests&seed=77")
  assert.ok(
    (
      await page.evaluate(() => window.__devPreview!.inspect())
    )?.operations.some(
      (operation) => operation.label === "クエスト" && operation.success
    )
  )
  console.log("view: メニューの台本 OK")
  await open(page, "/dev/play/town?seed=77&at=2000")
  const play = page.frameLocator('iframe[title="動作の確認"]')
  await play.getByRole("button", { name: "冒険者ギルド", exact: true }).click()
  await play
    .getByRole("button", { name: "受付", exact: true })
    .waitFor({ state: "visible" })
  await page.waitForFunction(
    () => (window.__devPreview?.inspect()?.time ?? 0) > 6500,
    undefined,
    { timeout: 15000 }
  )
  assert.equal(await page.evaluate(() => window.__devPreview!.error), null)
  await page.screenshot({ path: `${output}/play.png` })
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("dungeons-and-dungeons/save")
    ),
    "preserve-preview-save"
  )
  await open(
    page,
    "/dev/view?scene=battle&seed=77&party=hero,rivet,husky&foes=haribote-adult,hiyokobu&hp=100,25,0&width=1280&height=800&guides=1"
  )
  assert.equal(
    await page
      .locator("iframe")
      .evaluate(
        (element) =>
          element.ownerDocument.querySelector<HTMLIFrameElement>("iframe")
            ?.contentWindow?.innerWidth
      ),
    1280
  )
  assert.deepEqual(
    (await page.evaluate(() => window.__devPreview!.inspect()))?.config.hp,
    [100, 25, 0]
  )
  await page.goto(BASE_URL + frameUrl(first.config))
  const legacyReady = await waitForStudio(page)
  assert.equal(legacyReady.error, undefined)
  assert.equal(legacyReady.ready, true)
  const legacy = await page.evaluate(() => window.__devStudio!.advance(2000))
  assert.equal(legacy.time, 2000)
  assert.deepEqual(legacy.errors, [])
  await page.goto(BASE_URL + "/dev/view?scene=missing")
  await page.getByRole("alert").waitFor()
  assert.match(
    await page.evaluate(() => window.__devPreview?.error ?? ""),
    /場面がありません/
  )
  assert.match(await page.getByRole("alert").innerText(), /場面がありません/)
  assert.deepEqual(errors, [])
  console.log(
    "viewの入力無効・PNG再現・台本・実寸、playの操作と継続、保存保護、エラー表示を確認"
  )
} catch (problem) {
  await page.screenshot({ path: `${output}/failure.png` })
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      await page.evaluate(() => ({
        url: location.href,
        text: document.body.innerText,
        error: window.__devPreview?.error,
        stage: window.__devPreview?.stage,
        frameUrl:
          document.querySelector<HTMLIFrameElement>("iframe")?.contentWindow
            ?.location.href,
        frameText:
          document.querySelector<HTMLIFrameElement>("iframe")?.contentDocument
            ?.body.innerText,
        inspection: window.__devPreview?.inspect(),
      })),
      null,
      2
    )
  )
  throw problem
} finally {
  await browser.close()
}
