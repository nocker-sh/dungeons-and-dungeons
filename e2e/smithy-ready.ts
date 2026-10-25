import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import smithy from "../src/lib/content/data/smithy.json"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const mode of ["upgrade", "craft"] as const)
      for (const condition of ["ready"] as const) {
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
        const cost = mode === "upgrade" ? smithy.upgrades[0] : smithy.recipes[0]
        if (!cost.gold || !cost.materials.length)
          throw new Error("不足検証の費用がない")
        const saved = await page.evaluate(
          async ({ cost, mode }) => {
            const runtime = window.__devStudio as StudioRuntime
            await runtime.advance(2500)
            const game = runtime.game!
            const saved = game.save()
            const issue = game.restore({
              ...saved,
              snapshot: {
                ...saved.snapshot,
                gold: cost.gold + 7,
                bag: cost.materials.map((entry) => ({
                  good: entry.good,
                  count: entry.count + 2,
                })),
              },
            })
            if (issue) throw issue
            await runtime.advance(3500)
            const view = game.queries.smithy(game.state)!
            const entry =
              mode === "upgrade" ? view.upgrades[0] : view.recipes[0]
            if (!entry.ready || entry.missingGold || entry.missingMaterials)
              throw new Error("準備済みQueryが違う")
            return {
              save: JSON.stringify(game.save()),
              label:
                mode === "upgrade"
                  ? `${view.upgrades[0].next!.name}にする`
                  : "作る",
              gear: view.upgrades[0].gear,
            }
          },
          { cost, mode }
        )
        await page
          .getByRole("button", {
            name: mode === "upgrade" ? "強化" : "生産",
            exact: true,
          })
          .click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(5000)
        )
        await page.locator(".listview .slot-item.row").first().click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(6500)
        )
        const action = page.getByRole("button", {
          name: saved.label,
          exact: true,
        })
        await action.waitFor({ state: "visible" })
        await action.click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(7500)
        )
        const notice = page.getByRole("status")
        const expectedNotice =
          mode === "upgrade"
            ? `${saved.label.replace(/にする$/, "")}に強化しました。`
            : "木こりの斧を作りました。バッグから装備できます。"
        if ((await notice.textContent()) !== expectedNotice)
          throw new Error("鍛冶屋の成功通知が違う")
        await page.screenshot({
          path: `/tmp/dnd-smithy-ready-${viewport.name}-${mode}-${condition}.png`,
        })
        const after = await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )
        const beforeSave = JSON.parse(saved.save)
        const afterSave = JSON.parse(after)
        if (afterSave.snapshot.gold !== 7)
          throw new Error("必要な金貨以外を消費")
        const expectedBag = beforeSave.snapshot.bag.map(
          (entry: { good: string; count: number }) => ({
            ...entry,
            count:
              entry.count -
              cost.materials.find((material) => material.good === entry.good)!
                .count,
          })
        )
        if (
          JSON.stringify(afterSave.snapshot.bag) !== JSON.stringify(expectedBag)
        )
          throw new Error("材料消費が違う")
        if (
          JSON.stringify(afterSave.snapshot.members) !==
          JSON.stringify(beforeSave.snapshot.members)
        )
          throw new Error("仲間が変わる")
        if (mode === "upgrade") {
          const expectedGear = beforeSave.snapshot.gear.map(
            (entry: { id: string; plus: number }) =>
              entry.id === saved.gear
                ? { ...entry, plus: entry.plus + 1 }
                : entry
          )
          if (
            JSON.stringify(afterSave.snapshot.gear) !==
            JSON.stringify(expectedGear)
          )
            throw new Error("選択外の装備を強化")
        } else {
          if (
            JSON.stringify(afterSave.snapshot.gear.slice(0, -1)) !==
            JSON.stringify(beforeSave.snapshot.gear)
          )
            throw new Error("既存装備が変わる")
          const created = afterSave.snapshot.gear.at(-1)
          if (
            !created ||
            created.good !== smithy.recipes[0].good ||
            created.owner !== null ||
            created.plus !== 0
          )
            throw new Error("生産品が違う")
        }
        await page.getByRole("button", { name: /足りない/ }).click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(8500)
        )
        if (await page.getByRole("status").count())
          throw new Error("拒否後に成功通知が残る")
        const rejected = await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )
        if (rejected !== after) throw new Error("再実行拒否で保存が変わる")
        await page
          .locator(".listview")
          .getByRole("button", { name: "‹ 戻る", exact: true })
          .click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(10000)
        )
        await page
          .getByRole("button", {
            name: mode === "upgrade" ? "強化" : "生産",
            exact: true,
          })
          .click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(11500)
        )
        if (await page.getByRole("status").count())
          throw new Error("開き直した画面に成功通知が残る")
        const reopened = await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )
        if (reopened !== after) throw new Error("開き直しで保存が変わる")
        console.log(
          `${viewport.name}/${mode}/${condition}: 準備済み・実成功・必要分だけ消費・仲間と他装備保持`
        )
        await page.close()
      }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
