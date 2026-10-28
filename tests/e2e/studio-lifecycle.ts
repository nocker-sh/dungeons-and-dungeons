import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { contentSource } from "@/content/game-content"
import { foeImagePaths } from "@/content/foe-image-paths"

type TestWindow = Window & { releaseOldStudio?: () => void }
const browser = await launch()
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  ignoreHTTPSErrors: true,
  serviceWorkers: "block",
})
const errors: string[] = []
page.on("pageerror", (error) => errors.push(error.message))
async function ready(scene: string, time: number) {
  await page.waitForFunction(
    ({ scene, time }) => {
      const api = document.querySelector("iframe")?.contentWindow?.__devStudio
      const state = api?.inspect()
      return (
        api?.settled &&
        state?.config.scene === scene &&
        Math.abs(state.time - time) < 0.00001
      )
    },
    { scene, time }
  )
  await page.getByRole("button", { name: "再生", exact: true }).waitFor()
}
try {
  const foe = contentSource.foes.find((entry) => entry.slug === "kamokutsu")!
  const path = foeImagePaths(foe.id)[0]!
  let blocked = 0
  const matching = (url: URL) => url.pathname === path
  await page.route(matching, async (route) => {
    blocked++
    await route.abort("failed")
  })
  await page.goto(`${BASE_URL}/dev/studio/battle`)
  await page.getByRole("alert").waitFor()
  assert.ok(blocked > 0)
  assert.ok((await page.getByRole("alert").innerText()).includes(path))
  await page.unroute(matching)
  await page
    .getByRole("link", { name: "コンポーネント・演出", exact: true })
    .click()
  await ready("components", 2000)
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "前の場面のエラーを残さない"
  )

  // 実際の描画結果の返却だけを保留し、場面変更より遅れて届かせる。
  await page.evaluate(() => {
    const api = document.querySelector("iframe")!.contentWindow!.__devStudio!
    const advance = api.advance.bind(api)
    api.advance = async (time) => {
      const result = await advance(time)
      await new Promise<void>((resolve) => {
        ;(window as TestWindow).releaseOldStudio = resolve
      })
      return result
    }
  })
  await page
    .getByRole("spinbutton", { name: "時刻（ms）", exact: true })
    .fill("5000")
  await page.waitForFunction(
    () => typeof (window as TestWindow).releaseOldStudio === "function"
  )
  await page.getByRole("link", { name: "街", exact: true }).click()
  await ready("town", 2000)
  await page.evaluate(() => {
    ;(window as TestWindow).releaseOldStudio!()
  })
  await page.waitForTimeout(100)
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "時刻（ms）", exact: true })
      .inputValue(),
    "2000"
  )
  assert.equal(await page.getByRole("alert").count(), 0)
  await page.getByRole("button", { name: "＋1コマ", exact: true }).click()
  await ready("town", 2000 + 1000 / 60)
  await page.getByRole("button", { name: "リセット", exact: true }).click()
  await ready("town", 0)
  assert.deepEqual(errors, [])
  console.log(
    "スタジオ: 起動失敗からの場面変更・古い描画結果の遅延・新しい時計でのコマ送りとリセット OK"
  )
} finally {
  await browser.close()
}
