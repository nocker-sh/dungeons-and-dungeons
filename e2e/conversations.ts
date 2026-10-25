import { checkConversationPages } from "./conversations-page"
import { BASE_URL, VIEWPORTS, launch, openPage } from "./lib"
import conversations from "../src/lib/content/data/conversations.json"

await checkConversationPages()

/** 本物の探索の分岐→宝箱→入手の順番。 */
const browser = await launch()
const errors: string[] = []
try {
  const page = await openPage(browser, VIEWPORTS[1], errors)
  await page.goto(`${BASE_URL}/previews/route-chest-branch`)
  await page.getByRole("button", { name: /^拾い物の道/ }).click()
  await page.getByRole("button", { name: "進む", exact: true }).click()
  for (const trigger of ["branch", "chest", "item"]) {
    const dialog = page.locator(`[data-conversation-trigger="${trigger}"]`)
    console.log(`探索の会話を待機: ${trigger}`)
    await dialog.waitFor({ timeout: 30000 })
    const id = await dialog.getAttribute("data-conversation-id")
    const choice = conversations.find((entry) => entry.id === id)?.choice
    await page.waitForTimeout(1600)
    for (let step = 0; step < 12 && (await dialog.count()); step++) {
      // 選択肢のある台本は、セリフの後に最初の答えを選ぶ
      const answer = choice
        ? page
            .getByRole("group", { name: choice.ask })
            .getByRole("button", { name: choice.options[0].label })
        : null
      if (answer && (await answer.count())) {
        await page.waitForTimeout(600)
        await answer.click()
      } else
        await page
          .getByRole("button", { name: "会話を進める", exact: true })
          .click()
      // 立ち絵の退場300msとセリフ枠の退場300msを待つ。
      await page.waitForTimeout(800)
    }
    if (await dialog.count()) throw new Error(`${trigger} の会話が終わらない`)
  }
  await page.getByRole("button", { name: "OK", exact: true }).click()
  await page.getByRole("button", { name: "進む", exact: true }).waitFor()
  await page.close()
  if (errors.length) throw new Error(errors.join("\n"))
  console.log("会話：探索の順次実行を確認")
} finally {
  await browser.close()
}
