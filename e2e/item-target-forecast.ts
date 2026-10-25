import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import goods from "../src/lib/content/data/goods.json"

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
      async (good) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const [hurt, nearlyFull, full, dead] = game.state.party
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
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
          healing.find((member) => member.id === nearlyFull)!.restored !== 5 ||
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
      goods.find((good) => good.slug === "potion")!
    )
    await page.getByRole("button", { name: expected.name, exact: true }).click()
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
      const predicted = expected.healing.find((member) => member.id === target)!
      const before = await page.evaluate((good) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const item = game.queries
          .items(game.state)
          .find((item) => item.id === good)!
        return { count: item.count, targets: item.targets }
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
      const text = await forecast.innerText()
      if (
        !text.includes(
          `HP（生命力） ${predicted.hp}/${predicted.maxHp} → ${predicted.after}/${predicted.maxHp}（+${predicted.restored}）`
        )
      )
        throw new Error("選ぶ直前の回復予告が違う")
      if ((await page.locator(".card .aim").count()) !== before.targets.length)
        throw new Error("選べる仲間がQueryと違う")
      await page.screenshot({
        path: `/tmp/dnd-item-target-${viewport.name}-${index}.png`,
      })
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
      if (await page.locator(".target-dim").count())
        throw new Error("相手選択が閉じない")
    }
    console.log(
      `${viewport.name}: 選ぶ直前の効果表示と、画面から2人への使用・HP・消費が一致`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
