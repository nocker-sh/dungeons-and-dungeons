import type { Locator } from "playwright"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "town",
            width,
            height: 844,
            duration: 20000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate(() => {
      if (window.__devStudioError) throw new Error(window.__devStudioError)
    })
    // 演出の時計を少しずつ進め、押せるようになるまで待つ（入りの演出の長さに台本を合わせない）
    let now = 0
    const advanceTo = async (time: number) => {
      now = time
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        time
      )
    }
    // 時計を止めている間は動かないので、画面の中にあって押せるときだけ押す
    const pressable = async (target: Locator) => {
      if (!(await target.isVisible()) || !(await target.isEnabled()))
        return false
      const box = await target.boundingBox()
      if (!box) return false
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      return x > 0 && y > 0 && x < width && y < 844
    }
    const advanceUntil = async (name: string) => {
      const target = page.getByRole("button", { name, exact: true })
      for (const until = now + 10000; now < until;)
        if (await pressable(target)) return target
        else await advanceTo(now + 250)
      throw new Error(`${name} が出ない（${now}ms）`)
    }
    // 入りの演出の間は押しても切り替わらないので、次の画面が出るまで押し直す
    const pressUntil = async (name: string, next: string) => {
      const target = page.getByRole("button", { name, exact: true })
      const goal = page.getByRole("button", { name: next, exact: true })
      for (const until = now + 10000; now < until;) {
        if (await goal.isVisible()) return
        if (await pressable(target)) await target.click()
        await advanceTo(now + 250)
      }
      throw new Error(`${name} を押しても ${next} が出ない（${now}ms）`)
    }
    await advanceTo(4500)
    const before = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (
      await page
        .getByRole("button", { name: "近場で戦う", exact: true })
        .count()
    )
      throw new Error("街に独立した戦闘入口が残っている")
    if (
      (await page.evaluate(
        () => (window.__devStudio as StudioRuntime).game!.state.party.length
      )) !== PARTY_SLOTS
    )
      throw new Error(`初期パーティが${PARTY_SLOTS}人でない`)
    await pressUntil("冒険者ギルド", "受付")
    await pressUntil("受付", "クエスト")
    await pressUntil("クエスト", "依頼")
    await page.screenshot({ path: `/tmp/dnd-guild-quests-${width}.png` })
    // 依頼は街の依頼と、遭遇の場所（街なか・街の外）でタブを分ける
    for (const tab of ["依頼", "街なか", "街の外"])
      await page
        .getByRole("button", { name: tab, exact: true })
        .waitFor({ state: "visible" })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== before
    )
      throw new Error("一覧を開くだけで保存を変更")
    await page.getByRole("button", { name: /スタンプダックを3体討伐/ }).click()
    await (await advanceUntil("引き受ける")).click()
    const accepted = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries
        .quests(game.state)
        .find((quest) => quest.name === "スタンプダックを3体討伐")
    })
    if (accepted?.status !== "active")
      throw new Error("通常の討伐依頼を受注できない")
    const gold = await page.evaluate((questId) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const save = JSON.parse(JSON.stringify(game.save()))
      save.snapshot.quests.find(
        (quest: { id: string }) => quest.id === questId
      ).progress = 3
      const error = game.restore(save)
      if (error) throw error
      return game.state.gold
    }, accepted.id)
    await (await advanceUntil("報告する")).click()
    const claimed = await page.evaluate((questId) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return {
        gold: game.state.gold,
        quest: game.state.quests.find((quest) => quest.id === questId),
      }
    }, accepted.id)
    if (!claimed.quest?.claimed || claimed.gold !== gold + accepted.reward.gold)
      throw new Error("通常の討伐依頼の報告・報酬が壊れた")
    await page
      .locator(".listview")
      .getByRole("button", { name: "‹ 戻る", exact: true })
      .click()
    // 一覧が閉じ、受付の「クエスト」へ戻る
    for (const until = now + 10000; await page.locator(".listview").count();)
      if (now < until) await advanceTo(now + 250)
      else throw new Error("戻るで一覧が閉じない")
    await advanceUntil("クエスト")
    console.log(
      `PASS ${width}: ギルドのクエスト・依頼・街なか・街の外タブ・受注/報告・戻る・${PARTY_SLOTS}人・保存保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
