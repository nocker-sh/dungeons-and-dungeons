import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { waitForStudio } from "@/scripts/studio-browser"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import shops from "@/content/data/shops.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

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
            scene: "shop-armory",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await waitForStudio(page)
    const expected = await page.evaluate(
      async (shop) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const info = game.queries.shop(game.state, shop)!
        const equipment = ["weapon", "armor"].map((kind) =>
          info.goods.find((good) => good.kind === kind)!
        )
        if (equipment.some((good) => !good))
          throw new Error("武器と防具がそろわない")
        return {
          goods: equipment.map((good) => ({
            name: good.name,
            targets: good.equipMembers!.map((member) => member.name).join("・"),
          })),
          save: JSON.stringify(game.save()),
        }
      },
      shops.find((shop) => shop.slug === "armory")!.id
    )
    await page.getByRole("button", { name: "購入", exact: true }).click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(4000)
    })
    for (const good of expected.goods) {
      await page.getByRole("button", { name: good.name, exact: true }).click()
      await page.evaluate(
        async (time) => {
          await (window.__devStudio as StudioRuntime).advance(time)
        },
        5000 + expected.goods.indexOf(good) * 1000
      )
      const details = page.getByRole("region", {
        name: "選んだ品の詳細",
        exact: true,
      })
      const notice = good.targets
        ? `装備できる仲間：${good.targets}`
        : "今の編成に、この品を装備できる仲間はいません。"
      if (!(await details.innerText()).includes(notice))
        throw new Error("購入前の装備対象がQueryと違う")
      await details.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await page.screenshot({
        path: `/tmp/dnd-shop-targets-${viewport.name}-${expected.goods.indexOf(good)}.png`,
      })
    }
    const after = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (after !== expected.save) throw new Error("購入前の確認で資産が変化")
    const unavailable = await page.evaluate(
      async (shop) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            party: [saved.snapshot.party[0]],
            hero: { ...saved.snapshot.hero, name: "コハク" },
          },
        })
        if (issue) throw issue
        const goods = game.queries.shop(game.state, shop)!.goods
        const armor = goods.find(
          (good) => good.kind === "armor" && good.equipMembers?.length === 0
        )
        const weapon = goods.find(
          (good) =>
            good.kind === "weapon" &&
            good.equipMembers?.some((member) => member.name === "コハク")
        )
        if (!armor || !weapon)
          throw new Error("対象なしと登録名の検証前提がない")
        await runtime.advance(7000)
        return {
          armor: armor.name,
          weapon: weapon.name,
          save: JSON.stringify(game.save()),
        }
      },
      shops.find((shop) => shop.slug === "armory")!.id
    )
    await page
      .getByRole("button", { name: unavailable.weapon, exact: true })
      .click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(7500)
    })
    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    if (!(await details.innerText()).includes("装備できる仲間：コハク"))
      throw new Error("登録名が対象へ反映されない")
    await page
      .getByRole("button", { name: unavailable.armor, exact: true })
      .click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(8000)
    })
    if (
      !(await details.innerText()).includes(
        "今の編成に、この品を装備できる仲間はいません。"
      )
    )
      throw new Error("対象なしの説明がない")
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-shop-targets-unavailable-${viewport.name}.png`,
    })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== unavailable.save
    )
      throw new Error("対象なしの確認で資産が変化")
    console.log(
      `${viewport.name}: 武器・防具の購入前の装備対象と保存保持を確認`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
