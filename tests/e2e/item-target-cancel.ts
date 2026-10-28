import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

const browser = await launch()
const errors: string[] = []
try {
  for (const collision of [false, true])
    for (const viewport of [
      { name: "small", width: 320, height: 760 },
      { name: "phone", width: 390, height: 844 },
      { name: "desktop", width: 1280, height: 900 },
    ]) {
      const page = await openPage(browser, viewport, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "bag",
              duration: 10000,
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(
        async ({ good, collision }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const saved = game.save()
          const gear = [...saved.snapshot.gear]
          if (collision) {
            const weapon = game.queries.good(
              "43e8c836-8d6c-47f5-bd33-e8a1e6aabc67"
            )!
            gear.push({
              id: good.id,
              good: weapon.id,
              owner: null,
              plus: 0,
              progress: 0,
              wear: 0,
              weapon: {
                rarity: "N",
                extraPower: 0,
                skills: [...weapon.skills!],
              },
            })
          }
          const [hurt, nearlyFull, full, dead] = game.state.party
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              gear,
              bag: [
                ...saved.snapshot.bag.filter((entry) => entry.good !== good.id),
                { good: good.id, count: 3 },
              ],
              members: saved.snapshot.members.map((member) => {
                const maxHp = game.queries.member(game.state, member.id)!.maxHp
                return {
                  ...member,
                  hp:
                    member.id === hurt
                      ? 1
                      : member.id === nearlyFull
                        ? maxHp - 5
                        : member.id === dead
                          ? 0
                          : maxHp,
                }
              }),
            },
          })
          if (issue) throw issue
          await runtime.advance(3000)
          const item = game.queries
            .items(game.state)
            .find((item) => item.id === good.id)!
          const healing = item.healing!
          if (
            healing.length !== 3 ||
            healing.some((member) => member.id === dead)
          )
            throw new Error("戦闘不能の回復予告がある")
          if (
            healing.find((member) => member.id === nearlyFull)!.restored !==
              5 ||
            healing.find((member) => member.id === full)!.restored !== 0
          )
            throw new Error("満タン付近の予告が違う")
          return {
            good: good.id,
            name: item.name,
            healing,
            targets: [hurt, nearlyFull],
            save: JSON.stringify(game.save()),
          }
        },
        { good: goods.find((good) => good.slug === "potion")!, collision }
      )
      await page
        .getByRole("button", { name: expected.name, exact: true })
        .click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4000)
      })
      const detail = page.getByRole("region", {
        name: "選んだ品の詳細",
        exact: true,
      })
      const text = await detail.innerText()
      for (const member of expected.healing) {
        const line = `${member.name}：HP（生命力） ${member.hp}/${member.maxHp} → ${member.after}/${member.maxHp}（+${member.restored}）`
        if (!text.includes(line)) throw new Error(`回復予告が違う: ${line}`)
      }
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("閲覧で状態が変化")
      await detail.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await page.screenshot({
        path: `/tmp/dnd-heal-forecast-${viewport.name}.png`,
      })
      for (const [index, target] of expected.targets.entries()) {
        const predicted = expected.healing.find(
          (member) => member.id === target
        )!
        const before = await page.evaluate((good) => {
          const game = (window.__devStudio as StudioRuntime).game!
          const item = game.queries
            .items(game.state)
            .find((item) => item.id === good)!
          return {
            count: item.count,
            targets: item.targets,
            save: JSON.stringify(game.save()),
          }
        }, expected.good)
        await page.getByRole("button", { name: "使う", exact: true }).click()
        await page.evaluate(
          async (time) => {
            await window.__devStudio!.advance(time)
          },
          4500 + index * 1000
        )
        const forecast = page.getByRole("region", {
          name: "道具の効果",
          exact: true,
        })
        assert.equal(await forecast.count(), 1, "薬が装備の対象選択になった")
        const text = await forecast.innerText()
        if (
          !text.includes(
            `HP（生命力） ${predicted.hp}/${predicted.maxHp} → ${predicted.after}/${predicted.maxHp}（+${predicted.restored}）`
          )
        )
          throw new Error("選ぶ直前の回復予告が違う")
        if (
          (await page.locator(".card .aim").count()) !== before.targets.length
        )
          throw new Error("選べる仲間がQueryと違う")
        await page.screenshot({
          path: `/tmp/dnd-item-target-${viewport.name}-${index}.png`,
        })
        {
          await page.keyboard.press(index === 0 ? "Escape" : "Backspace")
          await page.evaluate(
            async (time) => {
              await window.__devStudio!.advance(time)
            },
            4600 + index * 1000
          )
          if (await page.locator(".target-dim").count())
            throw new Error("Escapeで相手選択を取りやめられない")
          if (
            (await page.evaluate(() =>
              JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
            )) !== before.save
          )
            throw new Error("取りやめでHPや道具が変化")
          await page.getByRole("button", { name: "使う", exact: true }).click()
          await page.evaluate(
            async (time) => {
              await window.__devStudio!.advance(time)
            },
            4700 + index * 1000
          )
        }
        const card = page.locator(
          `.card .hit[aria-describedby="target-detail-${target}"]`
        )
        await card.click()
        await page.evaluate(
          async (time) => {
            await window.__devStudio!.advance(time)
          },
          5000 + index * 1000
        )
        const actual = await page.evaluate(
          ({ good, target }) => {
            const game = (window.__devStudio as StudioRuntime).game!
            return {
              save: game.save(),
              hp: game.queries.member(game.state, target)!.hp,
              count: game.queries
                .items(game.state)
                .find((item) => item.id === good)!.count,
            }
          },
          { good: expected.good, target }
        )
        if (actual.hp !== predicted.after || actual.count !== before.count - 1)
          throw new Error("画面から使用した回復・消費が予告と違う")
        const previous = JSON.parse(before.save)
        assert.deepEqual(
          actual.save,
          {
            ...previous,
            snapshot: {
              ...previous.snapshot,
              bag: previous.snapshot.bag.map(
                (entry: { good: string; count: number }) =>
                  entry.good === expected.good
                    ? { ...entry, count: entry.count - 1 }
                    : entry
              ),
              members: previous.snapshot.members.map(
                (member: { id: string; hp: number }) =>
                  member.id === target
                    ? { ...member, hp: predicted.after }
                    : member
              ),
            },
          },
          "薬以外の資産・装備・仲間が変わった"
        )
        if (await page.locator(".target-dim").count())
          throw new Error("相手選択が閉じない")
      }
      if (collision) {
        const equipment = await page.evaluate((id) => {
          const game = (window.__devStudio as StudioRuntime).game!
          const entry = game.queries
            .gear(game.state)
            .find((entry) => entry.gear === id)!
          const member = game.state.party.find((member) =>
            game.queries
              .equipOptions(game.state, member)
              .some((option) => option.gear === id)
          )!
          return { name: entry.name, member, before: game.save() }
        }, expected.good)
        assert.ok(equipment.member)
        await page.getByRole("button", { name: "装備", exact: true }).click()
        await page.evaluate(() => window.__devStudio!.advance(7000))
        await page.locator(".row", { hasText: equipment.name }).click()
        await page.evaluate(() => window.__devStudio!.advance(7500))
        assert.equal(
          await page.getByRole("button", { name: "使う", exact: true }).count(),
          0
        )
        await page
          .getByRole("button", { name: "仲間に装備", exact: true })
          .click()
        await page.evaluate(() => window.__devStudio!.advance(8000))
        assert.equal(
          await page
            .getByRole("region", { name: "装備後の比較", exact: true })
            .count(),
          1
        )
        await page
          .locator(
            `.card .hit[aria-describedby="target-detail-${equipment.member}"]`
          )
          .click()
        await page.evaluate(() => window.__devStudio!.advance(8500))
        const equipped = await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        )
        assert.deepEqual(
          equipped,
          {
            ...equipment.before,
            snapshot: {
              ...equipment.before.snapshot,
              gear: equipment.before.snapshot.gear.map((entry) =>
                entry.id === expected.good
                  ? { ...entry, owner: equipment.member }
                  : entry
              ),
            },
          },
          "武器の装備で同じIDの薬やHPが変わった"
        )
      }
      console.log(
        `${viewport.name}/${collision ? "ID重複あり" : "通常"}: Escape／Backspaceで無料取消、再選択からの使用・HP・消費が一致`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
