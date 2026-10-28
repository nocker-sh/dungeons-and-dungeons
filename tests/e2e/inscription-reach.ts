import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import goods from "@/content/data/goods.json"
import shops from "@/content/data/shops.json"
import skills from "@/content/data/skills.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const weaponSlug of ["sword", "gun"]) {
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
        async ({ sword, shop }) => {
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
                entry.id === upgradedId ? { ...entry, plus: 3 } : entry
              ),
            },
          })
          if (upgraded) throw upgraded
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
            currentReach: game.queries
              .smithy(game.state)!
              .inscriptions.find((entry) => entry.gear === upgradedId)!
              .skills[1].reach,
            currentDescription: game.queries
              .smithy(game.state)!
              .inscriptions.find((entry) => entry.gear === upgradedId)!
              .skills[1].desc,
            weaponName: game.queries
              .smithy(game.state)!
              .inscriptions.find((entry) => entry.gear === upgradedId)!.name,
            candidates: game.queries
              .smithy(game.state)!
              .inscriptions.find((entry) => entry.gear === upgradedId)!
              .candidates,
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
          sword: goods.find((entry) => entry.slug === weaponSlug)!.id,
          shop: shops.find((entry) => entry.slug === "armory")!.id,
        }
      )
      await page.getByRole("button", { name: /ワザの付け替え/ }).click()
      const dialog = page.getByRole("dialog", { name: "ワザの付け替え" })
      for (const name of expected.names)
        if (!(await dialog.innerText()).includes(name))
          throw new Error("武器名が欠ける")
      const upgraded = dialog
        .locator("div")
        .filter({
          hasText: new RegExp(
            `^${expected.weaponName.replace("+", "\\+")}（未装備）$`
          ),
        })
        .last()
      const row = upgraded.locator("..")
      await row.getByRole("button").first().click()
      if (!(await dialog.innerText()).includes(`${expected.weaponName}：`))
        throw new Error("選択した強化武器が違う")
      const currentReach = dialog.locator("[data-inscription-current-reach]")
      if (
        (await dialog
          .locator("[data-inscription-current-description]")
          .innerText()) !== `現在：${expected.currentDescription}`
      )
        throw new Error("現在のワザ説明が違う")
      if (expected.currentReach) {
        if (
          !(await currentReach.innerText()).includes(
            expected.currentReach === "melee" ? "近接" : "遠距離"
          )
        )
          throw new Error("付け替え前の射程が違う")
      } else if (await currentReach.count())
        throw new Error("射程なしの現在ワザに射程を付けた")
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
      for (const candidate of expected.candidates) {
        const button = dialog.getByRole("button", {
          name: new RegExp(candidate.name),
        })
        const label = button.locator("[data-inscription-reach]")
        if (candidate.reach) {
          if (
            (await label.getAttribute("data-inscription-reach")) !==
            candidate.reach
          )
            throw new Error("射程が違う")
          if (
            (await label.innerText()) !==
            (candidate.reach === "melee" ? "近接・" : "遠距離・")
          )
            throw new Error("射程の説明が違う")
        } else if (await label.count())
          throw new Error("射程なしに射程を付けた")
      }
      if (!(await dialog.locator("[data-inscription-reach]").count()))
        throw new Error("射程の候補がない条件")
      await dialog.evaluate((element) => {
        element.scrollTop = 0
      })
      await page.screenshot({
        path: `/tmp/dnd-inscription-reach-${viewport.name}-${weaponSlug}.png`,
      })
      await dialog.getByRole("button", { name: "武器を選び直す" }).click()
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("選択で保存が変わる")
      console.log(`${viewport.name}: 近接/遠距離・射程なし・選択取消・保存保持`)
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
