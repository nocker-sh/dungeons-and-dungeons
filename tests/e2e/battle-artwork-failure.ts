import assert from "node:assert/strict"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillPortraitOf } from "@/content/looks/skill-portrait-of"
import { foeAppearance } from "@/content/foe-appearance"
import { foeAttackImage } from "@/content/foe-attack-image"
import effects from "@/concept/data/effects.json"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { tap } from "@/tests/e2e/tap"
import { talkUntil } from "@/tests/e2e/talk-until"

const browser = await launch()
try {
  for (const width of [390, 1280]) {
    for (const failure of ["member", "foe", "intro"] as const) {
      const initial = aState()
        .inBattle({
          foes: ["kamokutsu"],
          order:
            failure === "foe"
              ? ["foe-1", "hero", "alda", "mort"]
              : ["hero", "foe-1", "alda", "mort"],
        })
        .build()
      assert.equal(initial.phase.type, "battle")
      if (initial.phase.type !== "battle") throw new Error("戦闘状態がない")
      const game = createTestGame({
        state: {
          ...initial,
          ...(failure === "foe"
            ? {
                gear: [],
                members: initial.members.map((member) => ({
                  ...member,
                  hp: member.id === initial.party[0] ? 1 : 0,
                })),
              }
            : {}),
          phase: {
            ...initial.phase,
            battle: {
              ...initial.phase.battle,
              foes: initial.phase.battle.foes.map((foe) => ({ ...foe, hp: 1 })),
            },
          },
        },
      })
      const hero = memberBySlug("hero").id
      const skill = game.queries
        .commands(game.state, hero)!
        .weaponSkills.find((entry) => entry.usable && entry.kind === "hit")!
      assert.ok(skill)
      const save = game.save()
      let path =
        failure === "intro"
          ? effects[0]!.image
          : skillPortraitOf(game.state.contract!, skill.id)
      if (failure === "foe") {
        const foe = game.queries.battle(game.state)!.foes[0]!
        const acted = eventsOrThrow(game.send({ type: "foe-turn" })).find(
          (event) => event.type === "acted"
        )!
        assert.equal(game.state.phase.type, "town", "敵の一撃で敗北する条件")
        path = foeAttackImage(foeAppearance(foe.foe, foe.appearanceId), {
          skill: acted.skill,
        })!
      }
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        ignoreHTTPSErrors: true,
        serviceWorkers: "block",
      })
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      const blocked: string[] = []
      await page.route(
        (url) => url.pathname === path,
        async (route) => {
          blocked.push(route.request().url())
          await route.abort("failed")
        }
      )
      await page.addInitScript((save) => {
        Math.random = () => 0.5
        localStorage.setItem("dungeons-and-dungeons/save", save)
      }, JSON.stringify(save))
      await page.goto(BASE_URL)
      if (failure === "foe") {
        await page.waitForFunction(
          () =>
            JSON.parse(localStorage.getItem("dungeons-and-dungeons/save")!)
              .snapshot.phase.type === "town"
        )
        await tap(page, page.getByRole("button", { name: "街へ", exact: true }))
        const guild = page.getByRole("button", {
          name: "冒険者ギルド",
          exact: true,
        })
        await talkUntil(page, guild, 30000)
        await guild.waitFor()
        const after = await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("dungeons-and-dungeons/save")!)
              .snapshot
        )
        assert.deepEqual(
          after.members.map((member: { hp: number }) => member.hp),
          game.state.members.map((member) => member.hp)
        )
        assert.equal(after.gold, game.state.gold, "敗北の没収を二重実行しない")
      } else {
        const list = page.getByRole("listbox", {
          name: "武器のワザと祝福",
          exact: true,
        })
        await list.waitFor()
        const option = list.getByRole("option", {
          name: new RegExp(skill.name),
        })
        if ((await option.getAttribute("aria-selected")) !== "true")
          await tap(page, option)
        await page.locator('[data-foe-pick][data-action="放つ"]').focus()
        await page.keyboard.press("Enter")
        await page.waitForFunction(
          () =>
            JSON.parse(localStorage.getItem("dungeons-and-dungeons/save")!)
              .snapshot.phase.type === "expedition"
        )
        // 勝利後は先に戦利品を受け取り、その後に道の操作へ戻る。
        await tap(page, page.getByRole("button", { name: "OK", exact: true }))
        const next = page.getByRole("button", { name: "進む", exact: true })
        await talkUntil(page, next, 30000)
        await next.waitFor()
        const used = await page.evaluate(
          ({ hero, skill }) =>
            JSON.parse(localStorage.getItem("dungeons-and-dungeons/save")!)
              .snapshot.members.find(
                (member: { id: string }) => member.id === hero
              )
              .used.find((entry: { skill: string }) => entry.skill === skill)
              ?.count,
          { hero, skill: skill.id }
        )
        assert.equal(
          used,
          (save.snapshot.members
            .find((member) => member.id === hero)!
            .used.find((entry) => entry.skill === skill.id)?.count ?? 0) + 1,
          "画像失敗時もワザの実行は一度だけ"
        )
      }
      assert.ok(blocked.length > 0, `画像の通信失敗を実際に起こす: ${path}`)
      assert.deepEqual(errors, [], "画像の失敗を未処理例外にしない")
      console.log(
        `${width}/${failure}: 画像の通信失敗後も勝敗を表示し、戦闘を抜ける`
      )
      await page.close()
    }
  }
} finally {
  await browser.close()
}
