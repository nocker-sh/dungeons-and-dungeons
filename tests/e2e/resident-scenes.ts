/**
 * 住人との会話と、場所に入ったときの場面。
 * 街とギルドを行き来して場面が始まり、終わったら同じ夜に繰り返さないこと、
 * ギルドの「会話」で受付嬢の台本が始まり、続けて話すと未読の別の台本になることを確かめる。
 */
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { press } from "@/tests/e2e/press"
import type { Page } from "playwright"

const browser = await launch()
const errors: string[] = []

/** 再生中の会話を最後まで送る。選択肢は最初の答えを選ぶ。 */
async function playThrough(page: Page) {
  const dialog = page.locator("[data-conversation-id]")
  const id = await dialog.getAttribute("data-conversation-id")
  await page.waitForTimeout(1200)
  for (let step = 0; step < 30 && (await dialog.count()); step++) {
    await page.keyboard.press("Enter")
    await page.waitForTimeout(700)
  }
  if (await dialog.count()) throw new Error(`会話 ${id} が終わらない`)
  return id
}

/**
 * 着いてから場面が始まるまで待つ。始まらなければ null。
 * 着くまでの演出と、必ず流れる場面が残っている間は場所の操作（control）を出さないので、
 * 場面か操作のどちらかが出るまで待ち、操作が出た後も少し場面の始まりを待つ。
 */
async function sceneOnArrival(page: Page, control: string) {
  const scene = page.locator('[data-conversation-trigger="visit"]')
  await scene
    .or(page.locator(`[aria-label="${control}"]`))
    .first()
    .waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1000)
  if (!(await scene.count())) return null
  return playThrough(page)
}

try {
  for (const viewport of VIEWPORTS) {
    const page = await openPage(browser, viewport, errors)
    page.setDefaultTimeout(15000)
    await page.goto(`${BASE_URL}/previews/town-scenes`)
    const played: string[] = []
    let first = await sceneOnArrival(page, "冒険者ギルド")
    // 確率に当たるまで、街とギルドを行き来する
    for (let trip = 0; trip < 8 && !first; trip++) {
      await page.getByRole("button", { name: "冒険者ギルド" }).waitFor()
      await press(page, "冒険者ギルド")
      const atGuild = await sceneOnArrival(page, "受付")
      if (atGuild) played.push(atGuild)
      await press(page, "‹ 戻る")
      first = await sceneOnArrival(page, "冒険者ギルド")
    }
    if (!first && !played.length)
      throw new Error("場所に入ったときの場面が一度も始まらない")
    if (first) played.push(first)
    // 終わった直後に同じ場所の場面が始まり直さない
    await page.waitForTimeout(2500)
    if (await page.locator("[data-conversation-id]").count())
      throw new Error("場面が終わった直後に同じ場所の場面が始まった")

    await page.getByRole("button", { name: "冒険者ギルド" }).waitFor()
    await press(page, "冒険者ギルド")
    const guildScene = await sceneOnArrival(page, "受付")
    if (guildScene) played.push(guildScene)
    await page.getByRole("button", { name: "受付", exact: true }).waitFor()
    await press(page, "受付")
    // 受付にも入ったときの場面（初回の案内など）がある
    const receptionScene = await sceneOnArrival(page, "会話")
    if (receptionScene) played.push(receptionScene)
    await page.getByRole("button", { name: "会話", exact: true }).waitFor()
    await press(page, "会話")
    await page.locator('[data-conversation-trigger="talk"]').waitFor()
    const firstTalk = await playThrough(page)
    await page.getByRole("button", { name: "会話", exact: true }).waitFor()
    await press(page, "会話")
    await page.locator('[data-conversation-trigger="talk"]').waitFor()
    const secondTalk = await playThrough(page)
    if (!firstTalk?.startsWith("milena-") || !secondTalk?.startsWith("milena-"))
      throw new Error(
        `ギルドの会話が受付嬢の台本ではない: ${firstTalk} ${secondTalk}`
      )
    if (firstTalk === secondTalk)
      throw new Error("続けて話しても未読の台本へ進まない")
    await page.screenshot({
      path: `/tmp/dnd-resident-scenes-${viewport.name}.png`,
    })
    console.log(
      `${viewport.name}: 場面 ${played.join(", ")} / 会話 ${firstTalk} → ${secondTalk}`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
