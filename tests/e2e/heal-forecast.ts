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
    await page.evaluate(({ good, healing, targets }) => {
      const game = (window.__devStudio as StudioRuntime).game!
      for (const member of targets) {
        const predicted = healing.find((entry) => entry.id === member)!
        const events = game.send({ type: "use", good, member })
        if (!Array.isArray(events)) throw new Error(JSON.stringify(events))
        const used = events.find((event) => event.type === "used")
        if (
          used?.type !== "used" ||
          used.results[0].heal !== predicted.restored ||
          game.queries.member(game.state, member)!.hp !== predicted.after
        )
          throw new Error("回復予告と実際の結果が違う")
      }
    }, expected)
    console.log(
      `${viewport.name}: 負傷・満タン付近・満タンの回復予告と実際の結果が一致、戦闘不能は対象外`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
