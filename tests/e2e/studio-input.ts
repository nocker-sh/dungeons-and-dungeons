import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"

const browser = await launch()
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  ignoreHTTPSErrors: true,
})
const errors: string[] = []
page.on("pageerror", (error) => errors.push(error.message))

async function ready(time: number) {
  await page.waitForFunction((time) => {
    const api = document.querySelector("iframe")?.contentWindow?.__devStudio
    return api?.settled && Math.abs(api.inspect().time - time) < 0.00001
  }, time)
  await page.getByRole("button", { name: "再生", exact: true }).waitFor()
}

try {
  await page.goto(`${BASE_URL}/dev/studio/town`)
  await ready(2000)
  const step = page.getByRole("button", { name: "＋1コマ", exact: true })
  const time = page.getByRole("spinbutton", { name: "時刻（ms）", exact: true })
  await step.focus()
  for (const modifier of ["ctrlKey", "metaKey", "altKey"])
    for (const [key, code] of [
      ["ArrowLeft", "ArrowLeft"],
      ["ArrowRight", "ArrowRight"],
      ["Home", "Home"],
      ["End", "End"],
      [" ", "Space"],
    ]) {
      const prevented = await step.evaluate(
        (element, init) => {
          const event = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            ...init,
          })
          element.dispatchEvent(event)
          return event.defaultPrevented
        },
        { key, code, [modifier]: true }
      )
      assert.equal(prevented, false, `${modifier}+${code}を奪わない`)
      assert.equal(await time.inputValue(), "2000")
    }
  for (const kind of ["composition", "handled"] as const) {
    await step.evaluate((element, kind) => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        code: "ArrowRight",
        bubbles: true,
        cancelable: true,
        isComposing: kind === "composition",
      })
      if (kind === "handled") event.preventDefault()
      element.dispatchEvent(event)
    }, kind)
    assert.equal(
      await time.inputValue(),
      "2000",
      `${kind}のキーで時刻を変えない`
    )
  }
  // スライダーやタブ自身のキー操作へ、全体のコマ送りを重ねない。
  const slider = page.getByRole("slider")
  await slider.focus()
  await page.keyboard.press("ArrowRight")
  await ready(2010)
  await page.keyboard.press("ArrowLeft")
  await ready(2000)
  const layout = page.getByRole("tab", { name: "配置", exact: true })
  await layout.focus()
  await page.keyboard.press("ArrowRight")
  const stateTab = page.getByRole("tab", { name: "状態", exact: true })
  assert.ok(
    await stateTab.evaluate((element) => element === document.activeElement)
  )
  assert.equal(await time.inputValue(), "2000")
  // このTabsは手動選択。左右でフォーカスを移し、Spaceで確定する。
  await page.keyboard.press("Space")
  assert.equal(await stateTab.getAttribute("aria-selected"), "true")
  assert.equal(await time.inputValue(), "2000")
  // フォーカスしたボタンのSpaceは、そのボタンを一度だけ押す。
  await step.focus()
  await page.keyboard.press("Space")
  await ready(2000 + 1000 / 60)
  assert.equal(
    await page.getByRole("button", { name: "停止", exact: true }).count(),
    0
  )
  await page.keyboard.press("ArrowRight")
  await ready(2000 + 2000 / 60)
  await page.keyboard.press("Shift+ArrowRight")
  await ready(3000 + 2000 / 60)
  // 入力欄のキーは数値編集へ渡す。
  await time.focus()
  await page.keyboard.press("ArrowLeft")
  assert.equal(await time.inputValue(), "3033")
  // ボタンや入力欄から離れたSpaceは、従来どおり再生・停止する。
  await page
    .locator("body")
    .evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.keyboard.press("Space")
  await page.getByRole("button", { name: "停止", exact: true }).waitFor()
  await page.keyboard.press("Space")
  await page.getByRole("button", { name: "再生", exact: true }).waitFor()
  await page.waitForFunction(
    () => document.querySelector("iframe")?.contentWindow?.__devStudio?.settled
  )
  assert.deepEqual(errors, [])
  console.log(
    "スタジオ: 修飾キー・IME・処理済みキーの保持、スライダー・タブ・ボタンの操作、通常の再生・コマ送り OK"
  )
} finally {
  await browser.close()
}
