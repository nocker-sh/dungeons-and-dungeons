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
        const member = game.state.party.find((id) => {
          const commands = game.queries.commands(game.state, id)!
          return (
            [...commands.weaponSkills, ...commands.skills].filter(
              (skill) => (skill.uses ?? 0) >= 3
            ).length >= 2
          )
        })!
        if (!member) throw new Error("補充対象のワザが不足")
        const commands = game.queries.commands(game.state, member)!
        const skills = [...commands.weaponSkills, ...commands.skills]
          .filter((skill) => (skill.uses ?? 0) >= 3)
          .slice(0, 2)
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: [
              ...saved.snapshot.bag.filter((entry) => entry.good !== good.id),
              { good: good.id, count: 3 },
            ],
            members: saved.snapshot.members.map((entry) => ({
              ...entry,
              used:
                entry.id === member
                  ? [
                      { skill: skills[0].id, count: 1 },
                      { skill: skills[1].id, count: 3 },
                    ]
                  : [],
            })),
          },
        })
        if (issue) throw issue
        await runtime.advance(3000)
        const item = game.queries
          .items(game.state)
          .find((item) => item.id === good.id)!
        return {
          good: good.id,
          itemName: item.name,
          member,
          name: game.queries.member(game.state, member)!.name,
          perSkill: item.refill!.perSkill,
          restored: item.refill!.members.find((entry) => entry.id === member)!
            .restored,
          save: JSON.stringify(game.save()),
        }
      },
      goods.find((good) => good.slug === "ether")!
    )
    await page
      .getByRole("button", { name: expected.itemName, exact: true })
      .click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(4000)
    })
    const detail = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    const text = await detail.innerText()
    if (
      !text.includes(`各ワザの残り +${expected.perSkill}`) ||
      !text.includes(`各ワザの残りを${expected.perSkill}回ずつ戻す。`) ||
      !text.includes(`${expected.name}：合計${expected.restored}回戻る`)
    )
      throw new Error("補充予告が表示されない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("閲覧で状態が変化")
    await page.screenshot({
      path: `/tmp/dnd-refill-forecast-${viewport.name}.png`,
    })
    if (
      !(await page
        .getByRole("button", { name: "使う", exact: true })
        .isVisible())
    )
      throw new Error("補充対象がいるのに使えない")
    const actual = await page.evaluate(({ good, member }) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.send({ type: "use", good, member })
    }, expected)
    const events = actual
    if (!Array.isArray(events)) throw new Error(JSON.stringify(events))
    const used = events.find((event) => event.type === "used")
    if (used?.type !== "used" || used.results[0].refill !== expected.restored)
      throw new Error("補充結果が予告と違う")
    const depleted = await page.evaluate(async ({ good, member }) => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      const result = game.send({ type: "use", good, member })
      if (!Array.isArray(result)) throw new Error(JSON.stringify(result))
      const used = result.find((event) => event.type === "used")
      if (used?.type !== "used" || used.results[0].refill !== 1)
        throw new Error("残り1回の補充が違う")
      await runtime.advance(5000)
      const item = game.queries
        .items(game.state)
        .find((item) => item.id === good)!
      if (item.count !== 1 || item.usable) throw new Error("補充済み判定が違う")
      return JSON.stringify(game.save())
    }, expected)
    if (await page.getByRole("button", { name: "使う", exact: true }).count())
      throw new Error("効果がないのに使う操作が出る")
    if (!(await detail.innerText()).includes("今は効果のある仲間がいない。"))
      throw new Error("使えない理由がない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== depleted
    )
      throw new Error("効果なし表示で状態が変化")
    await detail.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-refill-unavailable-${viewport.name}.png`,
    })
    console.log(
      `${viewport.name}: 補充予告と実際の結果が一致、全員補充済みで使うを隠し理由を表示`
    )

    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
