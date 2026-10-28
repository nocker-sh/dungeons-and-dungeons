import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import goods from "@/content/data/goods.json"
import shops from "@/content/data/shops.json"
import skills from "@/content/data/skills.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
const sword = goods.find((entry) => entry.slug === "sword")!
const upgradedName = `${sword.name}+3`
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const rarity of ["N", "R", "SR"] as const) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "smithy-repair",
              duration: 15000,
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(
        async ({ sword, shop, rarity }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: { ...saved.snapshot, gold: 100000 },
          })
          if (issue) throw issue
          for (let index = 0; index < 2; index++)
            if (!Array.isArray(game.send({ type: "buy", shop, good: sword })))
              throw new Error("購入失敗")
          const bought = game.save()
          const upgradedId = bought.snapshot.gear.at(-1)!.id
          const upgraded = game.restore({
            ...bought,
            snapshot: {
              ...bought.snapshot,
              gear: bought.snapshot.gear.map((entry) =>
                entry.id === upgradedId
                  ? { ...entry, plus: 3, weapon: { ...entry.weapon!, rarity } }
                  : entry
              ),
            },
          })
          if (upgraded) throw upgraded
          if (rarity !== "N") {
            const equipped = game.send({
              type: "equip",
              gear: upgradedId,
              member: game.state.party[0],
            })
            if (!Array.isArray(equipped))
              throw new Error("持ち主を設定できない")
          }
          await runtime.advance(3500)
          return {
            names: game.queries
              .smithy(game.state)!
              .inscriptions.filter(
                (entry) =>
                  game.state.gear.find((gear) => gear.id === entry.gear)
                    ?.good === sword
              )
              .map((entry) => entry.name),
            save: JSON.stringify(game.save()),
            owner: game.queries
              .smithy(game.state)!
              .inscriptions.find((entry) => entry.gear === upgradedId)!.owner,
            currentSkill: game.queries
              .smithy(game.state)!
              .inscriptions.find((entry) => entry.gear === upgradedId)!
              .skills[1],
            candidate: game.queries
              .smithy(game.state)!
              .inscriptions.find((entry) => entry.gear === upgradedId)!
              .candidates[0],
            usesBonus: game.queries
              .gear(game.state)
              .find((entry) => entry.gear === upgradedId)!.weapon!.usesBonus,
          }
        },
        {
          rarity,
          sword: sword.id,
          shop: shops.find((entry) => entry.slug === "armory")!.id,
        }
      )
      await page.getByRole("button", { name: /ワザの付け替え/ }).click()
      const dialog = page.getByRole("dialog", { name: "ワザの付け替え" })
      for (const name of expected.names)
        if (!(await dialog.innerText()).includes(name))
          throw new Error("武器名が欠ける")
      const group = dialog.getByRole("group", {
        name: `${upgradedName}・レア度${rarity}・${expected.owner ? `${expected.owner}が装備中` : "未装備"}`,
        exact: true,
      })
      if ((await group.getByRole("button").count()) !== 2)
        throw new Error("武器ごとの変更操作がまとまっていない")
      const row = group
      await row.getByRole("button").first().click()
      if (!(await dialog.innerText()).includes(`${upgradedName}：`))
        throw new Error("選択した強化武器が違う")
      if (
        !(await dialog.innerText()).includes(
          `${expected.currentSkill.name}（${expected.currentSkill.uses}回）→`
        )
      )
        throw new Error("付け替え前の回数が違う")
      if (!(await dialog.innerText()).includes(`レア度：${rarity}`))
        throw new Error("選択した武器のレア度が違う")
      if (
        !(await dialog.innerText()).includes(
          `持ち主：${expected.owner ?? "未装備"}`
        )
      )
        throw new Error("選択後に持ち主が欠ける")
      if (!expected.usesBonus) throw new Error("強化回数の増加がない条件")
      const baseUses = skills.find(
        (entry) => entry.id === expected.candidate.id
      )!.uses
      if (
        expected.candidate.uses !==
        (baseUses === undefined ? null : baseUses + expected.usesBonus)
      )
        throw new Error("候補が強化回数を含まない")
      if (
        !(await dialog.innerText()).includes(
          `${expected.candidate.name}・${expected.candidate.uses}回`
        )
      )
        throw new Error("候補の最大使用回数が違う")
      await dialog.evaluate((element) => {
        element.scrollTop = 0
      })
      await page.screenshot({
        path: `/tmp/dnd-inscription-rarity-${viewport.name}-${rarity}.png`,
      })
      await dialog.getByRole("button", { name: "武器を選び直す" }).click()
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("選択で保存が変わる")
      console.log(
        `${viewport.name}/${rarity}: 強化・レア度込みの候補回数・選択・取消・保存保持`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
