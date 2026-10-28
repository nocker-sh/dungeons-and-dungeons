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
    for (const slug of ["eyedrop", "cleansing-mist"]) {
      const good = goods.find((good) => good.slug === slug)!
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
      await page
        .waitForFunction(
          () => window.__devStudio?.ready || window.__devStudioError,
          undefined,
          { timeout: 60000 }
        )
        .catch((error) => {
          throw new Error(`${error.message} ${errors.join("\n")}`)
        })
      const expected = await page.evaluate(async (good) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const [bound, poisoned] = saved.snapshot.party
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: [
              ...saved.snapshot.bag.filter((entry) => entry.good !== good.id),
              { good: good.id, count: 2 },
            ],
            members: saved.snapshot.members.map((member) => ({
              ...member,
              status:
                member.id === bound
                  ? [
                      { kind: "bind", turns: 2 },
                      { kind: "regen", turns: 4 },
                    ]
                  : member.id === poisoned
                    ? [
                        { kind: "poison", turns: 3 },
                        { kind: "charge", turns: 1 },
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
        const targets = good.slug === "eyedrop" ? [bound] : [bound, poisoned]
        if (JSON.stringify(item.targets) !== JSON.stringify(targets))
          throw new Error("治せる対象が効果と違う")
        return {
          name: item.name,
          bound,
          poisoned,
          save: JSON.stringify(game.save()),
          before: game.state.members.map((member) => ({
            id: member.id,
            hp: member.hp,
            status: member.status.map((entry) => ({ ...entry })),
          })),
        }
      }, good)
      await page
        .getByRole("button", { name: expected.name, exact: true })
        .click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4500)
      })
      const detail = page.getByRole("region", {
        name: "選んだ品の詳細",
        exact: true,
      })
      const text = await detail.innerText()
      if (
        !text.includes(good.desc) ||
        !text.includes(good.stat) ||
        text.includes("足止め")
      )
        throw new Error("治療の説明が戦闘の状態名と違う")
      await detail.evaluate((element) => {
        element.scrollTop = 0
      })
      await page.screenshot({
        path: `/tmp/dnd-cure-labels-${viewport.name}-${slug}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("閲覧で保存が変わる")
      await page.getByRole("button", { name: "使う", exact: true }).click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(5500)
      })
      if (slug === "eyedrop") {
        if ((await page.locator(".card .aim").count()) !== 1)
          throw new Error("目薬で毒の仲間を選べる")
        await page
          .locator(
            `.card .hit[aria-describedby="target-detail-${expected.bound}"]`
          )
          .click()
        await page.evaluate(async () => {
          await window.__devStudio!.advance(6500)
        })
      }
      const after = await page.evaluate((id) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const item = game.queries
          .items(game.state)
          .find((item) => item.id === id)!
        return {
          count: item.count,
          usable: item.usable,
          targets: item.targets,
          members: game.state.members.map((member) => ({
            id: member.id,
            hp: member.hp,
            status: member.status.map((entry) => ({ ...entry })),
          })),
        }
      }, good.id)
      if (after.count !== 1 || after.usable || after.targets.length)
        throw new Error("消費数か治療後の使用可否が違う")
      const wanted = expected.before.map((member) => ({
        ...member,
        status: member.status.filter((entry) =>
          slug === "eyedrop"
            ? !(member.id === expected.bound && entry.kind === "bind")
            : entry.kind !== "bind" && entry.kind !== "poison"
        ),
      }))
      if (JSON.stringify(after.members) !== JSON.stringify(wanted))
        throw new Error("治療対象外の状態やHPを変えた")
      if (await page.locator(".target-dim").count())
        throw new Error("治療後に対象選択が閉じない")
      await page.screenshot({
        path: `/tmp/dnd-cure-use-${viewport.name}-${slug}.png`,
      })
      console.log(
        `${viewport.name}/${slug}: 説明・対象・保存保持・実使用・消費・治療対象外の状態保持`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
