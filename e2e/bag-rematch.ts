import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import { PARTY_SLOTS } from "../src/lib/wiz/content/constants"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "bag",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const saved = game.save()
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          reached: 4,
          cleared: true,
          phase: { type: "town" },
        },
      })
      if (issue) throw issue
      const quest = game.queries
        .quests(game.state)
        .find((entry) => entry.status === "open" && entry.requiresBossVictory)!
      if (!Array.isArray(game.send({ type: "accept-quest", quest: quest.id })))
        throw new Error("依頼を受注できない")
      const destination = game.queries.defaultDestination(game.state)!
      if (!Array.isArray(game.send({ type: "depart", layer: destination })))
        throw new Error("出撃できない")
      await runtime.advance(4000)
      return {
        id: quest.id,
        name: quest.name,
        count: quest.count,
        gold: quest.reward.gold,
        save: JSON.stringify(game.save()),
      }
    })
    await page.getByRole("button", { name: "依頼", exact: true }).click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(4500)
    })
    await page.getByRole("button", { name: expected.name, exact: true }).click()
    const targetImage = page
      .getByRole("button", { name: expected.name, exact: true })
      .locator("img")
    await targetImage.waitFor()
    if (
      !(await targetImage.evaluate(
        (image) =>
          (image as HTMLImageElement).complete &&
          (image as HTMLImageElement).naturalWidth > 0
      ))
    )
      throw new Error("再挑戦の対象画像を読み込めない")
    const readableRow = await page
      .getByRole("button", { name: expected.name, exact: true })
      .evaluate((row) => {
        const progress = Array.from(row.querySelectorAll("span")).find(
          (span) =>
            span.childElementCount === 0 &&
            /^0\/\d+$/.test(span.textContent ?? "")
        )
        return (
          Number.parseFloat(getComputedStyle(row).minHeight) >= 44 &&
          !!progress &&
          Number.parseFloat(getComputedStyle(progress).fontSize) >= 11
        )
      })
    if (!readableRow) throw new Error("依頼の行や進捗文字が小さい")
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(5000)
    })
    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    const text = await details.innerText()
    if (
      !text.includes(`再戦勝利 0/${expected.count}・受注中`) ||
      !text.includes(`報酬：金貨 ${expected.gold}G`)
    )
      throw new Error("受注依頼の進捗か報酬が違う")
    if (
      await page.getByRole("button", { name: "報告する", exact: true }).count()
    )
      throw new Error("探索中に報告できる")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("依頼の確認で保存が変化")
    if (!text.includes(`勝利時に${PARTY_SLOTS}人全員が生存`))
      throw new Error("再戦勝利の生存条件が分からない")
    await details.evaluate((element) => {
      element.scrollTop = 0
    })
    await page.screenshot({
      path: `/tmp/dnd-bag-rematch-art-${viewport.name}-progress.png`,
    })
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-bag-rematch-art-${viewport.name}-active.png`,
    })
    const readySave = await page.evaluate(async ({ id, count }) => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      const saved = game.save()
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          quests: saved.snapshot.quests.map((quest) =>
            quest.id === id ? { ...quest, progress: count } : quest
          ),
        },
      })
      if (issue) throw issue
      await runtime.advance(5500)
      return JSON.stringify(game.save())
    }, expected)
    if (
      !(await details.innerText()).includes(
        "街のギルドで報告すると報酬を受け取れます。"
      )
    )
      throw new Error("達成依頼の報告案内がない")
    if (
      !(await details.innerText()).includes(
        `再戦勝利 ${expected.count}/${expected.count}・報告できます`
      )
    )
      throw new Error("達成進捗が違う")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== readySave
    )
      throw new Error("達成依頼の確認で保存が変化")
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-bag-rematch-art-${viewport.name}-ready.png`,
    })
    const claimed = await page.evaluate(async (id) => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      if (!Array.isArray(game.send({ type: "retreat" })))
        throw new Error("帰還できない")
      const before = game.state.gold
      if (!Array.isArray(game.send({ type: "claim-quest", quest: id })))
        throw new Error("報告できない")
      await runtime.advance(6500)
      return {
        gold: game.state.gold - before,
        save: JSON.stringify(game.save()),
      }
    }, expected.id)
    if (claimed.gold !== expected.gold) throw new Error("報告の金貨が違う")
    if (await page.getByRole("button", { name: "依頼", exact: true }).count())
      throw new Error("報告済みの依頼が残る")
    if ((await page.locator(".tabbtn.on").count()) !== 1)
      throw new Error("依頼タブ消去後に選択タブがなくなる")
    if (
      (await page
        .getByRole("button", { name: "アイテム", exact: true })
        .getAttribute("aria-pressed")) !== "true"
    )
      throw new Error("報告後にアイテムタブが選択されない")
    await page.screenshot({
      path: `/tmp/dnd-bag-rematch-art-${viewport.name}-claimed.png`,
    })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== claimed.save
    )
      throw new Error("報告後の表示で保存が変化")
    console.log(
      `${viewport.name}: 実受注・出撃後の依頼進捗・報酬・達成案内・保存保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
