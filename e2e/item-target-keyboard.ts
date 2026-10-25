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
        // 3人編成。傷ついた仲間は1本でちょうど満タンになり、2本目では選べなくなる
        const [hurt, nearlyFull, dead] = game.state.party
        const heal = good.effect?.hp
        if (!heal) throw new Error("回復薬の回復量がない")
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
                    ? maxHp - heal
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
          healing.length !== 2 ||
          healing.some((member) => member.id === dead)
        )
          throw new Error("戦闘不能の回復予告がある")
        if (
          healing.find((member) => member.id === nearlyFull)!.restored !== 5 ||
          healing.find((member) => member.id === hurt)!.restored !== heal
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
        return {
          count: item.count,
          targets: item.targets,
          healing: item.healing!,
          party: game.state.party.length,
          save: JSON.stringify(game.save()),
        }
      }, expected.good)
      if (index > 0) {
        // 1本目で満タンになった仲間は、予告が+0で、相手に選べない
        const filled = expected.targets[0]!
        if (
          before.targets.includes(filled) ||
          before.healing.find((member) => member.id === filled)?.restored !== 0
        )
          throw new Error("満タンになった仲間が選べる")
      }
      await page.getByRole("button", { name: "使う", exact: true }).click()
      await page.evaluate(
        async (time) => {
          await window.__devStudio!.advance(time)
        },
        4500 + index * 1000
      )
      if (
        (await page.locator(".card .hit:disabled").count()) !==
        before.party - before.targets.length
      )
        throw new Error("効果のない仲間がキーボード操作で選べる")
      for (let step = 0; step < 4; step++) {
        await page.keyboard.press(step < 2 ? "Tab" : "Shift+Tab")
        const valid = await page.evaluate(() => {
          const element = document.activeElement
          return (
            element instanceof HTMLButtonElement &&
            !element.disabled &&
            (element.matches(".target-cancel") ||
              (element.matches(".card .hit") &&
                element.hasAttribute("aria-describedby")))
          )
        })
        if (!valid) throw new Error("Tabで背面へ操作が漏れる")
      }
      for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
        await page.keyboard.press(key)
        const valid = await page.evaluate(() => {
          const selected = [
            ...document.querySelectorAll<HTMLButtonElement>("button.is-active"),
          ]
          return (
            selected.length === 1 &&
            selected.every(
              (element) =>
                !element.disabled &&
                (element.matches(".target-cancel") ||
                  element.matches(".card .hit"))
            )
          )
        })
        if (!valid) throw new Error("方向キーで背面へ操作が漏れる")
      }
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
      `${viewport.name}: Escape／Backspaceで無料取消、再選択からの使用・HP・消費が一致`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
