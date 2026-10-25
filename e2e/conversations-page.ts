import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { mkdir } from "node:fs/promises"
import { BASE_URL, VIEWPORTS, launch, openPage } from "./lib"
import conversations from "../src/lib/content/data/conversations.json"

/** タイムラインを確かめる台本。一覧で題が重ならず、3行以上あるもの。 */
const timeline = conversations.find(
  (entry) =>
    entry.id !== conversations[0].id &&
    entry.id !== "alda-chest-01" &&
    entry.lines.length >= 3 &&
    conversations.filter((other) => other.title === entry.title).length === 1
)!

export async function checkConversationPages() {
  const browser = await launch()
  const errors: string[] = []
  const evidence = "/tmp/product-test/visual/dnd-conversations"
  await mkdir(evidence, { recursive: true })
  try {
    for (const viewport of VIEWPORTS) {
      const page = await openPage(browser, viewport, errors)
      page.setDefaultTimeout(20000)
      await page.addInitScript(() => {
        const samples: {
          portraitTop: number
          boxTop: number
          boxHeight: number
          height: number
        }[] = []
        Object.assign(window, { conversationFrames: samples })
        const sample = () => {
          const portraits = document.querySelector(
            "[data-conversation-portraits]"
          )
          const box = document.querySelector('[aria-label="会話を進める"]')
          if (portraits && box) {
            const bounds = box.getBoundingClientRect()
            samples.push({
              portraitTop: portraits.getBoundingClientRect().top,
              boxTop: bounds.top,
              boxHeight: bounds.height,
              height: innerHeight,
            })
          }
          requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      await page.goto(`${BASE_URL}/dev/conversations`, {
        waitUntil: "domcontentloaded",
      })
      const frame = page.frameLocator('iframe[title="会話プレビュー"]')
      const talk = frame.getByRole("button", { name: "会話を進める" })
      await talk.waitFor()
      await page.waitForTimeout(1600)
      await page.screenshot({ path: `${evidence}/${viewport.name}-all.png` })
      if (
        await page
          .locator("details, input[type=checkbox], select, textarea")
          .count()
      )
        throw new Error("条件設定が残っている")
      // 最初の台本を最後まで再生する（選択肢があれば最初の答えを選ぶ）
      const first = conversations[0]
      const finished = page.getByText("再生終了", { exact: true })
      const ready = frame.locator("[data-conversation-ready]")
      const firstAnswer = first.choice
        ? frame
            .getByRole("group", { name: first.choice.ask })
            .getByRole("button", { name: first.choice.options[0].label })
        : null
      const until = Date.now() + 30_000
      while (!(await finished.count())) {
        if (Date.now() > until) throw new Error("最初の台本が再生終了しない")
        // 最後のセリフを押すと窓が閉じ始める（閉じる間の押下は無視される）ので、押せなくなっても続ける
        if (firstAnswer && (await firstAnswer.count()))
          await firstAnswer.click({ timeout: 2000 }).catch(() => {})
        else if (await ready.count())
          await talk.click({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(300)
      }
      const samples = await frame.locator("body").evaluate(
        () =>
          (
            window as unknown as {
              conversationFrames: {
                portraitTop: number
                boxTop: number
                boxHeight: number
                height: number
              }[]
            }
          ).conversationFrames
      )
      if (!samples.some((sample) => sample.portraitTop < 1))
        throw new Error("キャラが登場しない")
      if (
        samples.some(
          (sample) =>
            sample.portraitTop < sample.height - 1 &&
            sample.boxTop > sample.height - sample.boxHeight + 1
        )
      )
        throw new Error("キャラ表示中にセリフ枠が開閉している")
      if (viewport.name === "phone")
        await page.getByRole("button", { name: "データ一覧を開閉" }).click()
      if (
        (await page
          .locator('[data-sidebar="menu-button"][aria-pressed]')
          .count()) !== conversations.length
      )
        throw new Error("全会話を一覧に表示していない")
      await page
        .getByRole("button", { name: "宝箱を前に：アルダ", exact: true })
        .click({ noWaitAfter: true })
      await page.waitForURL("**/dev/conversations/alda-chest-01", {
        waitUntil: "domcontentloaded",
      })
      await page.reload({ waitUntil: "domcontentloaded" })
      await page
        .getByRole("heading", { name: "宝箱を前に：アルダ", level: 1 })
        .waitFor()
      await page.goBack({ waitUntil: "domcontentloaded" })
      await page
        .getByRole("heading", { name: conversations[0].title, level: 1 })
        .waitFor()
      if (viewport.name === "phone")
        await page.getByRole("button", { name: "データ一覧を開閉" }).click()
      await page
        .getByRole("button", { name: timeline.title, exact: true })
        .click({ noWaitAfter: true })
      await page.waitForURL(`**/dev/conversations/${timeline.id}`, {
        waitUntil: "domcontentloaded",
      })
      const lines = page
        .getByRole("region", { name: "セリフのタイムライン" })
        .getByRole("button")
      await lines.nth(1).click()
      await talk.waitFor()
      await page.waitForTimeout(1600)
      if (
        !(await talk.innerText()).includes(
          await lines.nth(1).locator("span").last().innerText()
        )
      )
        throw new Error("タイムライン選択が反映されない")
      await talk.click()
      await page.waitForTimeout(100)
      if ((await lines.nth(2).getAttribute("aria-pressed")) !== "true")
        throw new Error("再生位置が同期しない")
      await page.close()
      console.log(
        `${viewport.name}: 全会話・URL・タイムライン・登退場の順番を確認`
      )
    }
    if (errors.length) throw new Error(errors.join("\n"))
  } finally {
    await browser.close()
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await checkConversationPages()
