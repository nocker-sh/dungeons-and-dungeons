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
        const dead = game.state.party[0]
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: [
              ...saved.snapshot.bag.filter((entry) => entry.good !== good.id),
              { good: good.id, count: 2 },
            ],
            members: saved.snapshot.members.map((member) =>
              member.id === dead ? { ...member, hp: 0 } : member
            ),
          },
        })
        if (issue) throw issue
        await runtime.advance(3000)
        const item = game.queries
          .items(game.state)
          .find((item) => item.id === good.id)!
        if (item.healing!.length !== 1) throw new Error("蘇生対象の予告が違う")
        return {
          good: good.id,
          name: item.name,
          member: item.healing![0],
          save: JSON.stringify(game.save()),
        }
      },
      goods.find((good) => good.slug === "revival-incense")!
    )
    await page.getByRole("button", { name: expected.name, exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(4000)
    })
    const detail = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    const member = expected.member
    if (
      !(await detail.innerText()).includes(
        `${member.name}：蘇生後のHP（生命力） 0/${member.maxHp} → ${member.after}/${member.maxHp}（+${member.restored}）`
      )
    )
      throw new Error("蘇生予告が表示されない")
    if (member.after !== Math.min(300, member.maxHp))
      throw new Error("最大HP上限が違う")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("閲覧で状態が変化")
    await page.screenshot({
      path: `/tmp/dnd-revive-forecast-${viewport.name}.png`,
    })
    await page.getByRole("button", { name: "使う", exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(4500)
    })
    const targetDetail = page.getByRole("region", {
      name: "道具の効果",
      exact: true,
    })
    if (
      !(await targetDetail.innerText()).includes(
        `蘇生後のHP（生命力） 0/${member.maxHp} → ${member.after}/${member.maxHp}`
      )
    )
      throw new Error("選ぶ直前の蘇生予告が違う")
    if ((await page.locator(".card .aim").count()) !== 1)
      throw new Error("倒れた仲間だけを選べない")
    await page.screenshot({
      path: `/tmp/dnd-revive-target-${viewport.name}.png`,
    })
    await page
      .locator(`.card .hit[aria-describedby="target-detail-${member.id}"]`)
      .click()
    await page.evaluate(async ({ good, member }) => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      if (game.queries.member(game.state, member.id)!.hp !== member.after)
        throw new Error("画面からの蘇生結果が予告と違う")
      await runtime.advance(5000)
      const item = game.queries
        .items(game.state)
        .find((item) => item.id === good)!
      if (item.count !== 1 || item.usable || item.healing!.length)
        throw new Error("蘇生後の使用可否が違う")
    }, expected)
    if (await page.getByRole("button", { name: "使う", exact: true }).count())
      throw new Error("倒れた仲間がいないのに使う操作が出る")
    if (!(await detail.innerText()).includes("今は効果のある仲間がいない。"))
      throw new Error("使えない理由がない")
    console.log(
      `${viewport.name}: 選ぶ直前の蘇生予告と画面からの蘇生・消費が一致`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
