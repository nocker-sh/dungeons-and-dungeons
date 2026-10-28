import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { Bag } from "@/lib/wiz/rules/bag"
import { saveIdentity } from "@/lib/wiz/definition/save-identity"

const content = realContent()
const book = content.smithy!.skillBook!
const definition = new GameDefinition(content)
const altar = () =>
  createTestGame({
    state: aState()
      .inExpedition({
        at: "n2",
        visited: ["s", "n1", "n2"],
        pending: { kind: "discovery" },
      })
      .build(),
  })

describe("武器3枠と祝福1枠", () => {
  it.each([0, 1])("祝福の対象にHP%dを表示し、授与しても回復させない", (hp) => {
    const game = createTestGame({
      state: aState()
        .withMember("alda", { hp })
        .inExpedition({
          at: "n2",
          visited: ["s", "n2"],
          pending: { kind: "discovery" },
        })
        .build(),
    })
    const member = contentId("alda")
    const before = game.state
    const view = game.queries.route(before)!.discovery!
    const recipient = view.recipients.find((entry) => entry.id === member)!
    expect(recipient.hp).toBe(hp)
    expect(recipient.maxHp).toBe(game.queries.member(before, member)!.maxHp)
    expect(game.state).toBe(before)
    const choice = view.choices.find((entry) => entry.blessings)!
    const skill = choice.blessings![0].id
    eventsOrThrow(
      game.send({ type: "discover", choice: choice.id, member, skill })
    )
    expect(
      game.state.members.find((entry) => entry.id === member)
    ).toMatchObject({ hp, blessing: skill })
  })
  it("固有・悪魔スキルは祝福を保持したまま別メニューから使える", () => {
    for (const [member, skill] of [
      ["hero", "shears"],
      ["alda", "hold-line"],
      ["mort", "grave-care"],
    ]) {
      const blessing = content.skills.find((entry) => entry.blessing)!
      const state = aState()
        .withMember(member, { hp: 30 })
        .inBattle({ order: [member, "foe-1"] })
        .build()
      const actor = contentId(member)
      const game = createTestGame({
        state: {
          ...state,
          members: state.members.map((entry) =>
            entry.id === actor ? { ...entry, blessing: blessing.id } : entry
          ),
        },
      })
      const commands = game.queries.commands(game.state, actor)!
      expect(commands.weaponSkills).toHaveLength(3)
      expect(commands.blessing?.id).toBe(blessing.id)
      expect(
        commands.skills.some(
          (entry) => entry.id === contentId(skill) && entry.usable
        )
      ).toBe(true)
      eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: contentId(skill),
          target: actor,
        })
      )
      expect(
        game.state.members.find((entry) => entry.id === actor)
      ).toMatchObject({
        blessing: blessing.id,
        used: expect.arrayContaining([{ skill: contentId(skill), count: 1 }]),
      })
    }
  })
  it("戦闘で武器3つと祝福を使い、悪魔スキルは別メニューに残る", () => {
    const skill = content.skills.find(
      (entry) => entry.blessing && entry.kind === "hit"
    )!
    const state = aState()
      .inBattle({ order: ["hero", "foe-1", "alda", "mort"] })
      .build()
    const hero = state.party[0]
    const game = createTestGame({
      state: {
        ...state,
        members: state.members.map((member) =>
          member.id === hero ? { ...member, blessing: skill.id } : member
        ),
      },
    })
    const commands = game.queries.commands(game.state, hero)!
    expect(commands.weaponSkills).toHaveLength(3)
    expect(commands.skills.map((entry) => entry.id)).toEqual(
      definition.catalog.demon(game.state.contract!)!.skills
    )
    expect(commands.blessing?.left).toBe(skill.uses)
    const before = game.state
    expect(
      game.send({ type: "act", command: "skill", skill: contentId("focus") })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
    eventsOrThrow(game.send({ type: "act", command: "skill", skill: skill.id }))
    expect(
      game.state.members.find((member) => member.id === hero)!.used
    ).toContainEqual({ skill: skill.id, count: 1 })
    expect(game.restore(game.save())).toBeUndefined()
    expect(game.queries.commands(game.state, hero)!.blessing?.left).toBe(
      skill.uses! - 1
    )
  })

  it("初期の盾役と回復役の固有スキルを別メニューで使える", () => {
    const game = createTestGame()
    expect(
      game.queries
        .commands(game.state, contentId("alda"))!
        .skills.some(
          (skill) => skill.id === contentId("hold-line") && skill.usable
        )
    ).toBe(true)
    expect(
      game.queries
        .commands(game.state, contentId("mort"))!
        .skills.some((skill) => skill.kind === "heal" && skill.usable)
    ).toBe(true)
  })
  it("すべてのレア度で、固有1つを保持しランダム2つを重複なく付ける", () => {
    const random = seededRandom(123)
    for (const good of definition.catalog.data.goods.filter(
      (entry) => entry.kind === "weapon"
    )) {
      const variants = new Set<string>()
      for (const rarity of ["N", "R", "SR"] as const)
        for (let count = 0; count < 12; count++) {
          const skills = definition.rules.weapons.rollSkills(
            good,
            rarity,
            random
          )
          expect(skills).toHaveLength(3)
          expect(new Set(skills).size).toBe(3)
          expect(skills[0]).toBe(good.skills![0])
          expect(
            skills
              .slice(1)
              .every((skill) =>
                definition.rules.weapons.pool(good).includes(skill)
              )
          ).toBe(true)
          variants.add(skills.join(","))
        }
      expect(variants.size).toBeGreaterThan(1)
    }
  })

  it("[feature:W034] 書で選んだ枠だけ変え、固定枠・重複・祝福への変更は資産を減らさず拒否する", () => {
    const game = createTestGame({
      state: aState()
        .withItem("skill-book", 2)
        .withEquipped("alda", "greatsword")
        .build(),
    })
    const weapon = game.queries
      .smithy(game.state)!
      .inscriptions.find((entry) => entry.candidates.length)!
    const skill = weapon.candidates[0].id
    const before = game.state
    for (const action of [
      { type: "inscribe", gear: weapon.gear, slot: 0, skill },
      {
        type: "inscribe",
        gear: weapon.gear,
        slot: 1,
        skill: weapon.skills[0].id,
      },
      {
        type: "inscribe",
        gear: weapon.gear,
        slot: 1,
        skill: content.skills.find((entry) => entry.blessing)!.id,
      },
    ]) {
      expect(game.sendUnknown(action)).toBeInstanceOf(GameCommandError)
      expect(game.state).toBe(before)
    }
    eventsOrThrow(
      game.send({ type: "inscribe", gear: weapon.gear, slot: 2, skill })
    )
    expect(
      game.state.gear.find((entry) => entry.id === weapon.gear)!.weapon!.skills
    ).toEqual([weapon.skills[0].id, weapon.skills[1].id, skill])
    expect(Bag.count(game.state.bag, book)).toBe(1)
    expect(game.restore(game.save())).toBeUndefined()
  })

  it("[feature:W033] 祝福は渡す仲間を選び、既存の1枠を上書きする。無効な対象と二重獲得を拒否する", () => {
    const game = altar()
    const choice = game.queries
      .route(game.state)!
      .discovery!.choices.find((entry) => entry.blessings)!
    const skill = choice.blessings![0].id
    const member = contentId("alda")
    const before = game.state
    expect(
      game.send({
        type: "discover",
        choice: choice.id,
        skill,
        member: "unknown",
      })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
    eventsOrThrow(
      game.send({ type: "discover", choice: choice.id, skill, member })
    )
    expect(
      game.state.members.find((entry) => entry.id === member)!.blessing
    ).toBe(skill)
    expect(game.queries.commands(game.state, member)!.blessing?.id).toBe(skill)
    const after = game.state
    expect(
      game.send({ type: "discover", choice: choice.id, skill, member })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(after)
    expect(game.restore(game.save())).toBeUndefined()
    const next = createTestGame({
      state: { ...game.state, phase: before.phase },
    })
    const replacement = choice.blessings![1].id
    eventsOrThrow(
      next.send({
        type: "discover",
        choice: choice.id,
        skill: replacement,
        member,
      })
    )
    expect(
      next.state.members.find((entry) => entry.id === member)!.blessing
    ).toBe(replacement)
    eventsOrThrow(next.send({ type: "retreat" }))
    expect(next.state.members.every((entry) => !entry.blessing)).toBe(true)
  })

  it("書を選ぶと祝福は得ず、帰還後に持ち帰れる", () => {
    const game = altar()
    const before = Bag.count(game.state.bag, book)
    eventsOrThrow(game.send({ type: "discover", choice: "book" }))
    expect(Bag.count(game.state.bag, book)).toBe(before + 1)
    expect(game.state.members.every((member) => !member.blessing)).toBe(true)
    eventsOrThrow(game.send({ type: "retreat" }))
    expect(Bag.count(game.state.bag, book)).toBe(before + 1)
  })

  it("旧4枠の保存を3枠へ移行し、不正な保存では現在の状態を保持する", () => {
    const game = createTestGame({
      state: aState().withEquipped("alda", "greatsword").build(),
    })
    const saved = JSON.parse(JSON.stringify(game.save()))
    saved.contentVersion = saveIdentity(undefined, "dungeons-state-9")
    for (const gear of saved.snapshot.gear)
      if (gear.weapon) {
        const missing = content.skills.find(
          (skill) => !gear.weapon.skills.includes(skill.id)
        )!.id
        gear.weapon.skills.splice(1, 0, missing)
      }
    expect(game.restore(saved)).toBeUndefined()
    expect(
      game.state.gear
        .filter((entry) => entry.weapon)
        .every((entry) => entry.weapon!.skills.length === 3)
    ).toBe(true)
    const before = game.state
    saved.snapshot.gear.find(
      (entry: { weapon: unknown }) => entry.weapon
    ).weapon.skills[1] = "invalid-skill"
    expect(game.restore(saved)).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
  })
})
