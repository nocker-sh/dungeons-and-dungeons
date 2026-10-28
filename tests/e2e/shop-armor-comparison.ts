import { armorComparisonText } from "@/client/components/game/armor-comparison-text"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import shops from "@/content/data/shops.json"
import goods from "@/content/data/goods.json"
const shop = shops.find((shop) => shop.slug === "armory")!
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280])
    for (const reached of [0, 1, 2]) {
      const page = await openPage(browser, { width, height: 900 }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "shop-armory",
              duration: 15000,
              width,
              height: 900,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const ids = [
        goods.find(
          (good) =>
            good.slug === ["robe", "burial-robe", "gearweave-robe"][reached]
        )!.id,
        goods.find((good) => good.slug === "coat")!.id,
      ]
      const fixture = await page.evaluate(
        async ({ shop, reached, ids }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const saved = game.save()
          const heroArmor = game.queries
            .gear(game.state)
            .filter(
              (entry) => entry.ownerId === game.state.party[0] && entry.armor
            )
            .map((entry) => entry.gear)
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              reached,
              gear:
                reached === 0
                  ? saved.snapshot.gear.filter(
                      (entry) => !heroArmor.includes(entry.id)
                    )
                  : saved.snapshot.gear,
            },
          })
          if (issue) throw issue
          await runtime.advance(3500)
          const view = game.queries.shop(game.state, shop)!
          const rows = ids.map((id) =>
            view.goods.find((good) => good.id === id)!
          )
          if (!rows[0].appraisalAvailable || rows[1].appraisalAvailable)
            throw new Error("鑑定可能Queryが違う")
          return {
            names: rows.map((row) => row.name),
            comparisons: rows.map((row) =>
              row.equipMembers!.map((member) => ({
                name: `${member.name}（現在：${game.queries.member(game.state, member.id)?.armor?.name ?? "防具なし"}）`,
                comparison: game.queries.armorGoalComparison(
                  game.state,
                  member.id,
                  row.id
                ),
              }))
            ),
            save: JSON.stringify(game.save()),
          }
        },
        { shop: shop.id, reached, ids }
      )
      await page.getByRole("button", { name: "購入", exact: true }).click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5000)
      )
      for (const [index, name] of fixture.names.entries()) {
        await page.getByRole("button", { name, exact: true }).click()
        await page.evaluate(
          (time) => (window.__devStudio as StudioRuntime).advance(time),
          6500 + index * 1000
        )
        const details = page.getByRole("region", {
          name: "選んだ品の詳細",
          exact: true,
        })
        const message = "通常のガラクタの鑑定でも入手できます。"
        if ((await details.innerText()).includes(message) !== (index === 0))
          throw new Error("鑑定案内が候補と違う")
        for (const entry of fixture.comparisons[index]) {
          if (
            !entry.comparison ||
            !(await details.innerText()).includes(
              armorComparisonText(entry.comparison, entry.name)
            )
          )
            throw new Error("購入前の防具比較がQueryと違う")
        }
        if (!index) {
          await details.evaluate((element) => {
            element.scrollTop = Math.max(
              0,
              element.scrollHeight - element.clientHeight - 40
            )
          })
          await page.screenshot({
            path: `/tmp/dnd-shop-armor-comparison-${width}-${reached}.png`,
          })
        }
      }
      const after = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      if (after !== fixture.save) throw new Error("閲覧で保存が変わる")
      console.log(
        `${width}/${reached}: 防具購入前の全対象比較・鑑定案内・閲覧の保存保持`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
