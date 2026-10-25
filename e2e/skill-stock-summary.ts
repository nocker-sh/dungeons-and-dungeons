import layers from "../src/lib/content/data/layers.json"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const mode of ["town", "exploration"] as const) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "stand-find-armor-1",
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
        async ({ mode, layer }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const member = game.state.gear.find(
            (gear) => gear.id === "preview-find-armor"
          )!.owner!
          const commands = game.queries.commands(game.state, member)!
          const skill = [...commands.weaponSkills, ...commands.skills].find(
            (skill) => skill.uses !== null
          )!
          if (!skill) throw new Error("有限回数のワザがない")
          const exhaustedSkills = [...commands.weaponSkills, ...commands.skills]
            .filter(
              (entry, index, entries) =>
                entry.uses !== null &&
                entries.findIndex((candidate) => candidate.id === entry.id) ===
                  index
            )
            .slice(0, mode === "exploration" ? 2 : 1)
          if (exhaustedSkills.length !== (mode === "exploration" ? 2 : 1))
            throw new Error("使い切り検証のワザが不足")
          const saved = game.save()
          const problem = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              phase:
                mode === "exploration"
                  ? {
                      type: "expedition",
                      expedition: {
                        layer,
                        at: "s",
                        visited: ["s"],
                        events: [],
                        pending: null,
                        loot: { gold: 0, goods: [] },
                        cleared: false,
                      },
                    }
                  : saved.snapshot.phase,
              members: saved.snapshot.members.map((entry) =>
                entry.id === member
                  ? {
                      ...entry,
                      used: exhaustedSkills.map((entry) => ({
                        skill: entry.id,
                        count: entry.uses!,
                      })),
                    }
                  : entry
              ),
            },
          })
          if (problem) throw problem
          await runtime.advance(3000)
          const updated = game.queries.commands(game.state, member)!
          const entries = [
            ...updated.weaponSkills,
            ...updated.skills,
            ...(updated.blessing ? [updated.blessing] : []),
          ]
          const exhausted = new Set(
            entries.filter((skill) => skill.left === 0).map((skill) => skill.id)
          ).size
          if (exhausted !== exhaustedSkills.length)
            throw new Error("使い切りの本体判定が想定と違う")
          return {
            member,
            exhausted,
            name: skill.name,
            uses: skill.uses,
            save: JSON.stringify(game.save()),
          }
        },
        { mode, layer: layers[0].id }
      )
      await page
        .getByRole("button", { name: "ワザの残りを見る", exact: true })
        .click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4000)
      })
      const notice = page.getByText(
        `使い切ったワザ：${expected.exhausted}個。休息や素材で補充できる。`,
        { exact: true }
      )
      if (!(await notice.isVisible()))
        throw new Error("使い切りの合計が見えない")
      const noticeBounds = await notice.boundingBox()
      if (
        !noticeBounds ||
        noticeBounds.x < 0 ||
        noticeBounds.x + noticeBounds.width > viewport.width
      )
        throw new Error("使い切り案内が画面外")
      const row = page.getByRole("button", { name: expected.name, exact: true })
      if (!(await row.innerText()).includes(`残り 0/${expected.uses}回`))
        throw new Error("残り回数が違う")
      await row.click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(5000)
      })
      const detail = page.getByRole("region", {
        name: "選んだワザの詳細",
        exact: true,
      })
      if (!(await detail.innerText()).includes("残り回数がない"))
        throw new Error("使い切った案内がない")
      const bounds = await detail.boundingBox()
      if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width)
        throw new Error("詳細が画面外")
      await page.screenshot({
        path: `/tmp/dnd-skill-stock-${mode}-${viewport.name}.png`,
      })
      const after = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      if (after !== expected.save) throw new Error("閲覧でゲーム状態が変わった")
      await page.getByRole("button", { name: "‹ 戻る", exact: true }).click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(7000)
      })
      await page
        .getByRole("button", { name: "ワザの残りを見る", exact: true })
        .waitFor()
      const closed = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      await page.screenshot({
        path: `/tmp/dnd-skill-stock-entry-${mode}-${viewport.name}.png`,
      })
      if (closed !== expected.save)
        throw new Error("戻る操作でゲーム状態が変わった")
      const replenished = await page.evaluate(async (member) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((entry) =>
              entry.id === member ? { ...entry, used: [] } : entry
            ),
          },
        })
        if (issue) throw issue
        await runtime.advance(8000)
        return JSON.stringify(game.save())
      }, expected.member)
      await page
        .getByRole("button", { name: "ワザの残りを見る", exact: true })
        .click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(9000)
      })
      if (await notice.count())
        throw new Error("補充済みなのに使い切りの案内が残る")
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== replenished
      )
        throw new Error("補充済み閲覧で状態が変化")
      console.log(
        `${viewport.name} ${mode}: 使い切り合計と補充後の案内解除、閲覧の状態保持を確認`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
