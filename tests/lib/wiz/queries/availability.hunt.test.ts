import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { Game } from "@/lib/wiz/game/game"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { advanceUntilActor } from "@/lib/wiz/testing/advance-until-actor"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

const idOf = (slug: string) => memberBySlug(slug).id

function gameOf(state: GameState, ids = "probe") {
  return createTestGame({ state, ids: sequentialIds(ids) })
}

function accepted(result: ReturnType<Game["send"]>) {
  return !(result instanceof GameCommandError)
}

/** アルマ（ユニーク）を雇った状態。固有の武器と革の鎧を着けて控えに入る。 */
function withUnique() {
  const game = createTestGame({
    state: aState().withGold(1000).withBoard(["sr-husky", "r-alma"]).build(),
  })
  // ユニーク（SR・固有の武器と固定装備）と、悪魔と契約して戦う仲間（R・装備なし）
  eventsOrThrow(game.send({ type: "recruit", recruit: contentId("sr-husky") }))
  eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-alma") }))
  return game.state
}

describe("操作できるかの表示と、実際の受理（hunt）", () => {
  it("装備の候補に出た物は、その仲間に必ず着けられる", () => {
    const state = withUnique()
    const queries = gameOf(state).queries
    for (const member of state.members) {
      for (const option of queries.equipOptions(state, member.id)) {
        const game = gameOf(state)
        const result = game.send({
          type: "equip",
          gear: option.gear,
          member: member.id,
        })
        expect(accepted(result), `${member.id} ← ${option.gear}`).toBe(true)
      }
    }
  })

  it("装備の候補に出ない物は、送っても着けられない", () => {
    const state = withUnique()
    const queries = gameOf(state).queries
    for (const member of state.members) {
      const options = new Set(
        queries.equipOptions(state, member.id).map((entry) => entry.gear)
      )
      for (const gear of state.gear) {
        if (options.has(gear.id)) continue
        const game = gameOf(state)
        const result = game.send({
          type: "equip",
          gear: gear.id,
          member: member.id,
        })
        expect(accepted(result), `${member.id} ← ${gear.id}`).toBe(false)
      }
    }
  })

  it("ユニークと契約の仲間は装備の候補が空で理由が出て、固有の装備は外せない", () => {
    const state = withUnique()
    const game = gameOf(state)
    const husky = idOf("husky")
    const alma = idOf("alma")
    expect(game.queries.equipOptions(state, husky)).toEqual([])
    expect(game.queries.equipOptions(state, alma)).toEqual([])
    expect(game.queries.gearLock(husky)).toContain("ユニークの仲間")
    expect(game.queries.gearLock(alma)).toContain("悪魔と契約して戦う")
    expect(game.queries.gearLock(idOf("alda"))).toBe(null)
    expect(state.gear.some((entry) => entry.owner === alma)).toBe(false)
    const fixed = state.gear.filter((entry) => entry.owner === husky)
    expect(fixed.length).toBeGreaterThan(0)
    for (const gear of fixed)
      expect(
        (game.send({ type: "unequip", gear: gear.id }) as GameCommandError).code
      ).toBe("FIXED_GEAR")
  })

  it("袋の道具の field と usable は、街で使えるかと一致する", () => {
    const state = aState()
      .withBag([
        { good: contentId("potion"), count: 1 },
        { good: contentId("ether"), count: 1 },
        { good: contentId("antidote"), count: 1 },
        { good: contentId("revive"), count: 1 },
        { good: contentId("bomb"), count: 1 },
        { good: contentId("smoke"), count: 1 },
        { good: contentId("rope"), count: 1 },
        { good: contentId("torch"), count: 1 },
      ])
      .withMember("alda", { hp: 10 })
      .build()
    const items = gameOf(state).queries.items(state)
    expect(items.length).toBe(8)
    for (const item of items) {
      const game = gameOf(state)
      const result = game.send({ type: "use", good: item.id })
      // 蘇生の道具は倒れている仲間がいないと対象がいない
      const reason = result instanceof GameCommandError ? result.code : null
      if (item.revive) {
        expect(item.field, item.id).toBe(true)
        expect(item.usable, item.id).toBe(false)
        expect(reason, item.id).toBe("NO_EFFECT")
        continue
      }
      expect(accepted(result), item.id).toBe(item.field && item.usable)
      if (!item.field) expect(reason, item.id).toBe("UNAVAILABLE")
      // 効く相手がいない道具（使ったワザがない・治す状態がない）は断られ、減らない
      else if (!item.usable) expect(reason, item.id).toBe("NO_EFFECT")
    }
  })

  it("袋の素材は道具の一覧に出ず、道具は素材の一覧に出ない", () => {
    const junkCount = 3
    const state = aState()
      .withItem("potion", 1)
      .withItem("junk", junkCount)
      .build()
    const game = gameOf(state)
    const items = game.queries.items(state).map((entry) => entry.id)
    const materials = game.queries.materials(state).map((entry) => entry.id)
    expect(items).toContain(contentId("potion"))
    expect(materials).toContain(contentId("junk"))
    for (const id of items) expect(materials).not.toContain(id)
    expect(game.queries.junk(state).count).toBe(junkCount)
  })

  it("ワザの残りは、使うとちょうど1だけ減る", () => {
    const game = createTestGame({
      state: aState()
        .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
        .build(),
    })
    const before = game.queries.commands(game.state, idOf("alda"))!
    const skill = before.weaponSkills.find((entry) => entry.usable)!
    expect(skill.left).toBe(skill.uses)
    eventsOrThrow(game.send({ type: "act", command: "skill", skill: skill.id }))
    const after = game.queries
      .commands(game.state, idOf("alda"))!
      .weaponSkills.find((entry) => entry.id === skill.id)!
    expect(after.left).toBe(skill.left! - 1)
    expect(after.uses).toBe(skill.uses)
  })

  it("残りが0のワザは usable でなく、送ると NO_USES で断られる", () => {
    // アルダの素の武器（両手剣）に付くワザ
    const whirl = skillBySlug("whirl")
    const state = aState()
      .withEquipped("alda", "greatsword")
      .withUses("alda", [{ skill: "whirl", count: 99 }])
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const game = gameOf(state)
    const view = game.queries
      .commands(state, idOf("alda"))!
      .weaponSkills.find((entry) => entry.id === whirl.id)!
    expect(view.left).toBe(0)
    expect(view.usable).toBe(false)
    const result = game.send({
      type: "act",
      command: "skill",
      skill: whirl.id,
    })
    expect((result as GameCommandError).code).toBe("NO_USES")
  })

  it("usable なワザはすべて通り、usable でないワザはすべて断られる", () => {
    // 回復役は最初の仲間のモートと、最初の仲間にいないシオンの両方を試す
    const scenes = (healer: "mort" | "sion") => {
      const base =
        healer === "mort"
          ? aState()
          : aState().withJoined("sion", { replacing: "mort" })
      const order = ["alda", healer, "hero", "foe-1"]
      return [
        base.inBattle({ foes: ["kamokutsu"], order }).build(),
        base
          .withMember(healer, { hp: 0 })
          .inBattle({ foes: ["kamokutsu"], order })
          .build(),
      ].map((state) => ({ state, healer }))
    }
    for (const { state, healer } of [...scenes("mort"), ...scenes("sion")])
      for (const memberId of ["alda", healer, "hero"].map(idOf)) {
        const probe = gameOf(state)
        advanceUntilActor(probe, memberId)
        // 倒れている仲間には手番が回らない
        if (probe.queries.battle(probe.state)!.current.id !== memberId) continue
        const view = probe.queries.commands(probe.state, memberId)!
        expect(view.weaponSkills.length).toBe(3)
        for (const skill of [...view.weaponSkills, ...view.skills]) {
          const game = gameOf(probe.state)
          const result = game.send({
            type: "act",
            command: "skill",
            skill: skill.id,
          })
          expect(accepted(result), `${memberId}/${skill.id}`).toBe(skill.usable)
        }
      }
  })

  it("蘇生のワザ・道具が使えるのは、倒れた仲間がいるときだけ", () => {
    // 作品データの気つけ薬にはまだ効果がないので、蘇生の規則を測るためだけに効果を足す
    const content = aContent()
      .withGood("revive", { effect: { type: "revive", hp: 20 } })
      .build()
    const battle = { foes: ["kamokutsu"], order: ["mort", "foe-1"] }
    const revival = skillBySlug("dungeon-blessing-4")
    const withFallen = aState(content)
      .withMember("mort", { blessing: revival.id })
      .withMember("alda", { hp: 0 })
      .withItem("revive", 1)
      .inBattle(battle)
      .build()
    const alive = aState(content)
      .withMember("mort", { blessing: revival.id })
      .withItem("revive", 1)
      .inBattle(battle)
      .build()
    const probeOf = (state: GameState) =>
      createTestGame({ content, state, ids: sequentialIds("probe") })
    for (const [state, fallen] of [
      [withFallen, true],
      [alive, false],
    ] as const) {
      const view = probeOf(state).queries.commands(state, idOf("mort"))!
      const raise = view.blessing!
      expect(raise.revive).toBe(true)
      expect(raise.usable).toBe(fallen)
      const item = view.items.find((entry) => entry.id === contentId("revive"))!
      expect(item.usable).toBe(fallen)
      const game = probeOf(state)
      expect(
        accepted(
          game.send({ type: "act", command: "skill", skill: revival.id })
        )
      ).toBe(fallen)
      const other = probeOf(state)
      expect(
        accepted(
          other.send({
            type: "act",
            command: "item",
            good: contentId("revive"),
          })
        )
      ).toBe(fallen)
    }
  })

  it("「殴る」が出るのは攻撃のワザが尽きたときだけで、出ていないときは殴れない", () => {
    const fresh = aState()
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const freshGame = gameOf(fresh)
    const aldaView = freshGame.queries.commands(fresh, idOf("alda"))!
    expect(aldaView.brawl).toBe(null)
    expect(
      (freshGame.send({ type: "act", command: "brawl" }) as GameCommandError)
        .code
    ).toBe("UNAVAILABLE")
    // アルダが使える攻撃のワザを、残らず使い切った状態にする
    const spent = [...aldaView.weaponSkills, ...aldaView.skills]
      .filter((skill) => skill.kind === "hit")
      .map((skill) => ({ skill: skill.id, count: 99 }))
    const empty = aState()
      .withUses("alda", spent)
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const emptyGame = gameOf(empty)
    const view = emptyGame.queries.commands(empty, idOf("alda"))!
    expect(view.brawl).not.toBe(null)
    expect(
      view.weaponSkills.every((entry) => entry.kind !== "hit" || !entry.usable)
    ).toBe(true)
    expect(accepted(emptyGame.send({ type: "act", command: "brawl" }))).toBe(
      true
    )
  })

  it("武器を強化すると、表示した最大の使用回数どおりに多く使える", () => {
    const alda = idOf("alda")
    const whirl = skillBySlug("whirl")
    const per = realContent().balance.weapon.usesPerPlus
    const state = aState()
      .withGold(500)
      .withItem("bone", 9)
      .withEquipped("alda", "greatsword")
      .build()
    const game = createTestGame({ state })
    const weapon = game.state.gear.find(
      (gear) => gear.owner === alda && gear.good === contentId("greatsword")
    )!
    for (let step = 0; step < per; step++)
      eventsOrThrow(game.send({ type: "upgrade", gear: weapon.id }))
    const battle = {
      ...game.state,
      phase: aState()
        .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
        .build().phase,
    } as GameState
    const probe = gameOf(battle)
    const view = probe.queries
      .commands(battle, alda)!
      .weaponSkills.find((entry) => entry.id === whirl.id)!
    // usesPerPlus の段だけ最大が1増える
    const max = whirl.uses! + 1
    expect(view.uses).toBe(max)
    expect(view.left).toBe(max)
    const capped = gameOf({
      ...battle,
      members: battle.members.map((member) =>
        member.id === alda
          ? { ...member, used: [{ skill: whirl.id, count: max - 1 }] }
          : member
      ),
    } as GameState)
    const left = capped.queries
      .commands(capped.state, alda)!
      .weaponSkills.find((entry) => entry.id === whirl.id)!
    expect(left.left).toBe(1)
    expect(left.usable).toBe(true)
    expect(
      accepted(capped.send({ type: "act", command: "skill", skill: whirl.id }))
    ).toBe(true)
    const after = capped.queries
      .commands(capped.state, alda)!
      .weaponSkills.find((entry) => entry.id === whirl.id)!
    expect(after.left).toBe(0)
    expect(after.usable).toBe(false)
  })

  it("後衛から近接のワザには weak の印が付く", () => {
    const melee = realContent().balance.backRow.melee
    expect(melee).toBeLessThan(1)
    // 並びの右1人が後衛。アルダを3番目に置く
    const state = aState()
      .withParty(["hero", "mort", "alda"])
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    const view = gameOf(state).queries.commands(state, idOf("alda"))!
    for (const skill of view.weaponSkills)
      expect(skill.weak, skill.id).toBe(
        skill.kind === "hit" && skill.reach === "melee"
      )
    // 前衛に置けば弱くならない
    const front = aState()
      .withParty(["alda", "hero", "mort"])
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    for (const skill of gameOf(front).queries.commands(front, idOf("alda"))!
      .weaponSkills)
      expect(skill.weak, skill.id).toBe(false)
  })

  it("出撃できるかの表示は、出撃の受理と一致する", () => {
    const cases = [
      aState().build(),
      aState().withMember("alda", { hp: 0 }).build(),
      aState().withMember("mort", { fatigue: 100 }).build(),
      aState().withMember("mort", { fatigue: 99 }).build(),
    ]
    for (const state of cases) {
      const game = gameOf(state)
      const readiness = game.queries.readiness(state)
      const result = game.send({ type: "depart", layer: contentId("layer0") })
      expect(accepted(result), JSON.stringify(readiness)).toBe(readiness.ready)
    }
  })

  it("控えの仲間の疲れや傷は出撃を止めない", () => {
    const game = createTestGame({
      state: aState().withGold(500).withBoard(["r-jig"]).build(),
    })
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    const state = {
      ...game.state,
      members: game.state.members.map((member) =>
        member.id === idOf("jig") ? { ...member, hp: 0, fatigue: 100 } : member
      ),
    } as GameState
    const probe = gameOf(state)
    expect(probe.queries.readiness(state).ready).toBe(true)
    expect(probe.queries.reserve(state).map((entry) => entry.id)).toEqual([
      idOf("jig"),
    ])
    expect(
      accepted(probe.send({ type: "depart", layer: contentId("layer0") }))
    ).toBe(true)
  })

  it("夜の雑談ができる表示は、雑談の受理と一致する（仲間ひとりにつき一晩に一度）", () => {
    const first = aState().build()
    for (const nights of [0, 1]) {
      const state = aState().withNights(nights, []).build()
      const game = gameOf(state)
      const can = game.queries.canChat(state)
      expect(can).toBe(nights > 0)
      expect(game.queries.canChatWith(state, first.party[0])).toBe(can)
      expect(accepted(game.send({ type: "chat", liked: state.party[0] }))).toBe(
        can
      )
    }
    // 同じ相手とは今夜もう話せないが、まだ話していない仲間とは話せる
    const done = aState().withNights(1, [first.party[0]]).build()
    const game = gameOf(done)
    expect(game.queries.canChatWith(done, done.party[0])).toBe(false)
    expect(accepted(game.send({ type: "chat", liked: done.party[0] }))).toBe(
      false
    )
    expect(game.queries.canChat(done)).toBe(done.party.length > 1)
    if (done.party.length > 1) {
      expect(game.queries.canChatWith(done, done.party[1])).toBe(true)
      expect(accepted(game.send({ type: "chat", liked: done.party[1] }))).toBe(
        true
      )
    }
  })

  it("街の結果の板は、閉じる操作の受理と一致する", () => {
    const wipe = aState()
      .withWipe({
        layer: contentId("layer0"),
        gold: 30,
        goods: [{ good: contentId("junk"), count: 1 }],
      })
      .build()
    const wipeGame = gameOf(wipe)
    expect(wipeGame.queries.result(wipe)?.kind).toBe("wipe")
    expect(accepted(wipeGame.send({ type: "see-ending" }))).toBe(false)
    expect(accepted(wipeGame.send({ type: "dismiss-wipe" }))).toBe(true)
    expect(wipeGame.queries.result(wipeGame.state)).toBe(null)
    const cleared = aState().withCleared(true).build()
    const clearedGame = gameOf(cleared)
    expect(clearedGame.queries.result(cleared)?.kind).toBe("ending")
    expect(accepted(clearedGame.send({ type: "dismiss-wipe" }))).toBe(false)
    expect(accepted(clearedGame.send({ type: "see-ending" }))).toBe(true)
    expect(clearedGame.queries.result(clearedGame.state)).toBe(null)
    expect(accepted(clearedGame.send({ type: "see-ending" }))).toBe(false)
  })

  it("全滅の板を先に見せ、閉じると踏破の板へ進む", () => {
    const state = aState()
      .withCleared(true)
      .withWipe({ layer: contentId("layer0"), gold: 10, goods: [] })
      .build()
    const game = gameOf(state)
    expect(game.queries.result(state)?.kind).toBe("wipe")
    eventsOrThrow(game.send({ type: "dismiss-wipe" }))
    expect(game.queries.result(game.state)?.kind).toBe("ending")
  })

  it("依頼の出現層は実データと到達範囲で決まり、未到達層を伏せる", () => {
    const base = aState().build()
    const all = { ...base, reached: 4, cleared: true }
    const game = gameOf(all)
    const before = JSON.stringify(game.save())
    const quests = game.queries.quests(all)
    const locations = (slug: string) =>
      quests.find((quest) => quest.id === contentId(slug))?.locations
    expect(locations("q-mole")).toEqual([{ no: 0, name: "結晶の洞窟" }])
    expect(locations("q-the-waiting")).toEqual([
      { no: 4, name: "底なしの祭壇" },
    ])
    expect(locations("q-rematch-4")).toEqual([{ no: 4, name: "底なしの祭壇" }])
    const shallow = game.queries.quests(base)
    expect(
      shallow.find((quest) => quest.id === contentId("q-the-waiting"))
        ?.locations
    ).toEqual([])
    expect(
      shallow.find((quest) => quest.id === contentId("q-rematch-4"))
    ).toBeUndefined()
    expect(JSON.stringify(game.save())).toBe(before)
  })

  it("依頼の印は、報告できる依頼があるときだけ立つ", () => {
    const open = aState().build()
    expect(gameOf(open).queries.marks(open).guild).toBe(false)
    const ready = aState().withQuest("q-mole", 3).build()
    const readyGame = gameOf(ready)
    expect(readyGame.queries.marks(ready).guild).toBe(true)
    expect(
      readyGame.queries
        .quests(ready)
        .find((quest) => quest.id === contentId("q-mole"))?.status
    ).toBe("ready")
    expect(
      accepted(
        readyGame.send({ type: "claim-quest", quest: contentId("q-mole") })
      )
    ).toBe(true)
    expect(readyGame.queries.marks(readyGame.state).guild).toBe(false)
    expect(
      readyGame.queries
        .quests(readyGame.state)
        .find((quest) => quest.id === contentId("q-mole"))?.status
    ).toBe("done")
    expect(
      accepted(
        readyGame.send({ type: "claim-quest", quest: contentId("q-mole") })
      )
    ).toBe(false)
  })

  it("依頼の途中は active で、報告できない", () => {
    const state = aState().withQuest("q-mole", 2).build()
    const game = gameOf(state)
    expect(
      game.queries
        .quests(state)
        .find((quest) => quest.id === contentId("q-mole"))?.status
    ).toBe("active")
    expect(game.queries.marks(state).guild).toBe(false)
    expect(
      (
        game.send({
          type: "claim-quest",
          quest: contentId("q-mole"),
        }) as GameCommandError
      ).code
    ).toBe("NOT_READY")
  })

  it("鑑定の印は、ガラクタを持っているときだけ立つ", () => {
    const some = aState().withItem("junk", 1).build()
    expect(gameOf(some).queries.marks(some).shop).toBe(true)
    const none = aState()
      .withBag([{ good: contentId("potion"), count: 1 }])
      .build()
    const game = gameOf(none)
    expect(game.queries.marks(none).shop).toBe(false)
    expect(game.queries.junk(none).count).toBe(0)
    expect(
      (
        game.send({
          type: "appraise",
          shop: contentId("armory"),
        }) as GameCommandError
      ).code
    ).toBe("NO_JUNK")
  })

  it("契約できる悪魔の一覧と、選べるかが一致する", () => {
    const state = aState().build()
    const game = gameOf(state)
    const owned = game.queries.demons(state)
    expect(owned.map((entry) => entry.id)).toEqual([contentId("nui")])
    expect(owned[0].active).toBe(true)
    expect(game.queries.demon(state)?.id).toBe(contentId("nui"))
    expect(
      accepted(game.send({ type: "choose-demon", demon: contentId("nui") }))
    ).toBe(true)
    expect(
      accepted(game.send({ type: "choose-demon", demon: contentId("lox") }))
    ).toBe(false)
  })

  it("旧召喚は石があっても操作可能と表示しない", () => {
    for (const stones of [0, 1]) {
      const state = aState().withStones(stones).build()
      const game = gameOf(state)
      const before = game.state
      expect(game.queries.summon(state).enabled).toBe(false)
      expect((game.send({ type: "summon" }) as GameCommandError).code).toBe(
        "INVALID_ACTION"
      )
      expect(game.state).toBe(before)
    }
  })
})
