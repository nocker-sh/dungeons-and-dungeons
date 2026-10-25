import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 760 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "result-wipe",
            duration: 15000,
            width,
            height: 760,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const before = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(4500)
      if (runtime.game!.queries.result(runtime.game!.state)?.kind !== "wipe")
        throw new Error("全滅結果ではない")
      return runtime.game!.save()
    })
    const dialog = page.getByRole("dialog", { name: "全滅の結果", exact: true })
    if (
      await page
        .getByRole("button", { name: "ダンジョン", exact: true })
        .count()
    )
      throw new Error("全滅結果の背後にダンジョンボタンが残る")
    const body = dialog.locator(".result-body")
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    const hint = dialog.getByText(
      "宿でHP（生命力）を回復し、傷んだ防具は鍛冶屋で修理しよう。",
      { exact: true }
    )
    const readable = await hint.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const body = element.closest(".result-body")!.getBoundingClientRect()
      return (
        parseFloat(getComputedStyle(element).fontSize) >= 12 &&
        rect.top >= body.top &&
        rect.bottom <= body.bottom &&
        rect.left >= 0 &&
        rect.right <= innerWidth
      )
    })
    if (!readable) throw new Error("立て直しの案内が読めない")
    if (
      !(await dialog.innerText()).includes(
        "仲間は誰も死んでいない。積んだ経験も消えていない。"
      )
    )
      throw new Error("既存の説明がない")
    await page.screenshot({ path: `/tmp/dnd-wipe-recovery-${width}.png` })
    const viewed = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    if (JSON.stringify(viewed) !== JSON.stringify(before))
      throw new Error("結果の閲覧で保存が変わる")
    await dialog.getByRole("button", { name: "街へ", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(7500)
    )
    const after = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return { result: game.queries.result(game.state), save: game.save() }
    })
    if (after.result) throw new Error("結果を閉じられない")
    await page
      .getByRole("button", { name: "ダンジョン", exact: true })
      .waitFor({ state: "visible" })
    for (const key of ["gold", "bag", "gear", "members"] as const)
      if (
        JSON.stringify(after.save.snapshot[key]) !==
        JSON.stringify(before.snapshot[key])
      )
        throw new Error(`街へ戻ると${key}が変わる`)
    console.log(
      `${width}: 全滅後の回復修理案内・既存説明・閲覧保持・閉じる資産保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
