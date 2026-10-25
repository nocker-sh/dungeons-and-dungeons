import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import goods from "../src/lib/content/data/goods.json"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
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
            scene: "shop-armory-junk",
            duration: 20000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate(
      async (weapon) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const saved = game.save()
        const oldWeapons = new Set(
          game.queries
            .gear(game.state)
            .filter((gear) => gear.kind === "weapon")
            .map((gear) => gear.gear)
        )
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gold: 10000,
            members: saved.snapshot.members.map((member) => ({
              ...member,
              lv: 5,
            })),
            gear: [
              ...saved.snapshot.gear.map((gear) =>
                oldWeapons.has(gear.id) ? { ...gear, owner: null } : gear
              ),
              ...saved.snapshot.party.map((owner) => ({
                id: `strong-${owner}`,
                good: weapon.id,
                owner,
                plus: 0,
                wear: 0,
                progress: 0,
                weapon: {
                  rarity: "N" as const,
                  extraPower: 0,
                  skills: [...weapon.skills!],
                },
              })),
            ],
          },
        })
        if (issue) throw new Error(String(issue.cause))
      },
      goods.find((good) => good.slug === "seal-axe")!
    )
    await page.getByRole("button", { name: "鑑定", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4000)
    )
    await page.getByRole("button", { name: /まとめて鑑定/ }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    await page
      .getByRole("button", { name: "全部鑑定する", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(10000)
    )
    const dialog = page.getByRole("dialog", { name: "鑑定の結果", exact: true })
    if (
      !(await dialog.innerText()).includes(
        "今の編成では攻撃力が上がる仲間はいません"
      )
    )
      throw new Error("鑑定で上昇なしの説明が出ない")
    const result = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const gear = game.queries
        .gear(game.state)
        .filter(
          (entry) =>
            entry.weapon && !entry.ownerId && !entry.gear.startsWith("strong-")
        )
      const found = gear.find(
        (entry) => !game.queries.upgrades(game.state, entry.gear).length
      )!
      if (!found) throw new Error("上昇なしの実際の武器がない")
      return { name: found.name, save: JSON.stringify(game.save()) }
    })
    await page.screenshot({
      path: `/tmp/dnd-appraisal-no-upgrade-${viewport.name}.png`,
    })
    await dialog
      .getByRole("button", { name: "押して一覧へ", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(12000)
    )
    await page
      .getByRole("button", { name: result.name, exact: true })
      .last()
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(13000)
    )
    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    if (
      !(await details.innerText()).includes(
        "今の編成では攻撃力が上がる仲間はいません"
      )
    )
      throw new Error("一覧で上昇なしの説明が出ない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== result.save
    )
      throw new Error("結果を読む操作で保存が変わる")
    console.log(`${viewport.name}: 鑑定結果の上昇なし表示と一覧復帰`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
