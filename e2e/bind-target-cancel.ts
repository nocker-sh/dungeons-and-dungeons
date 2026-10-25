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
        const [target, dead] = game.state.party
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
              member.id === target
                ? {
                    ...member,
                    status: [
                      { kind: "bind", turns: 3 },
                      { kind: "protect", turns: 1 },
                    ],
                  }
                : member.id === dead
                  ? { ...member, hp: 0, status: [{ kind: "bind", turns: 3 }] }
                  : { ...member, status: [] }
            ),
          },
        })
        if (issue) throw issue
        await runtime.advance(3000)
        const item = game.queries
          .items(game.state)
          .find((item) => item.id === good.id)!
        if (
          item.curing!.length !== 1 ||
          item.curing![0].id !== target ||
          item.curing![0].kinds.join() !== "bind"
        )
          throw new Error("治療予告の対象が違う")
        return {
          good: good.id,
          name: item.name,
          member: item.curing![0],
          dead,
          save: JSON.stringify(game.save()),
        }
      },
      goods.find((good) => good.slug === "eyedrop")!
    )
    await page.getByRole("button", { name: expected.name, exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(4000)
    })
    const detail = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    if (
      !(await detail.innerText()).includes(
        `${expected.member.name}：縛りを治す`
      )
    )
      throw new Error("治療予告が見えない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("閲覧で状態変化")
    await page.getByRole("button", { name: "使う", exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(4500)
    })
    const targetDetail = page.getByRole("region", {
      name: "道具の効果",
      exact: true,
    })
    if (
      !(await targetDetail.innerText()).includes("縛りを治す") ||
      (await page.locator(".card .aim").count()) !== 1
    )
      throw new Error("治療選択の予告が違う")
    await page.screenshot({ path: `/tmp/dnd-bind-target-${viewport.name}.png` })
    for (const [index, key] of ["Escape", "Backspace"].entries()) {
      await page.keyboard.press(key)
      await page.evaluate(
        async (time) => {
          await window.__devStudio!.advance(time)
        },
        4600 + index * 1000
      )
      if (await page.locator(".target-dim").count())
        throw new Error(`${key}で治療を取りやめられない`)
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("取りやめで道具・状態・HPが変わった")
      await page.getByRole("button", { name: "使う", exact: true }).click()
      await page.evaluate(
        async (time) => {
          await window.__devStudio!.advance(time)
        },
        4700 + index * 1000
      )
      if (!(await targetDetail.innerText()).includes("縛りを治す"))
        throw new Error("再選択の治療予告が違う")
    }
    await page.evaluate(async () => {
      await window.__devStudio!.advance(6200)
    })
    await page
      .locator(
        `.card .hit[aria-describedby="target-detail-${expected.member.id}"]`
      )
      .click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(6500)
    })
    await page.evaluate(({ good, member, dead }) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const target = game.state.members.find((entry) => entry.id === member.id)!
      if (
        target.status.some((entry) => entry.kind === "bind") ||
        !target.status.some((entry) => entry.kind === "protect")
      )
        throw new Error("縛り以外の状態も消えた")
      if (
        !game.state.members
          .find((entry) => entry.id === dead)!
          .status.some((entry) => entry.kind === "bind")
      )
        throw new Error("倒れた仲間も治療された")
      const item = game.queries
        .items(game.state)
        .find((item) => item.id === good)!
      if (item.count !== 1 || item.usable || item.curing!.length)
        throw new Error("治療後の使用可否が違う")
    }, expected)
    if (await page.getByRole("button", { name: "使う", exact: true }).count())
      throw new Error("治療済みなのに使える")
    console.log(
      `${viewport.name}: 縛りの治療予告・相手選択・無料取消2種・再選択・実際の治療と消費が一致`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
