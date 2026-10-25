import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/lib/content/game-content"
import { GameCatalog } from "@/lib/wiz"
import {
  aContent,
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
} from "@/lib/wiz/testing"

const catalog = new GameCatalog(gameContent)

describe("職業ごとの防具", () => {
  it.each([
    ["alda", "mail", true],
    ["mayu", "mail", false],
    ["gald", "steel-armor", true],
    ["jig", "steel-armor", false],
    ["mort", "mail", true],
    ["mort", "steel-armor", true],
    ["mort", "gravekeeper-vest", true],
    ["mort", "root-plate", true],
    ["jig", "mail", false],
    ["jig", "gravekeeper-vest", false],
    ["mayu", "ritual-robe", true],
    ["alda", "ritual-robe", false],
    ["sion", "burial-robe", true],
    ["sion", "bone-runner-coat", true],
    ["jig", "pilgrim-coat", true],
    ["gou", "pilgrim-coat", true],
    ["hero", "ritual-robe", false],
    ["hero", "root-plate", false],
  ] as const)("%s が %s を装備できるかは %s", (member, armor, allowed) => {
    expect(catalog.canEquip(contentId(member), contentId(armor))).toBe(allowed)
  })

  it("共通の旅装は全職業が着られ、通常の仲間はどの層でも上位防具へ進める", () => {
    const members = [
      ...gameContent.party,
      ...gameContent.recruits.map((entry) => entry.member),
    ]
    // 悪魔と契約して戦う仲間（R）は防具を持たない
    for (const member of members.filter((entry) => entry.pact))
      expect(catalog.canEquip(member.id, contentId("coat")), member.name).toBe(
        false
      )
    for (const member of members.filter(
      (entry) => !entry.unique && !entry.hero && !entry.pact
    )) {
      expect(catalog.canEquip(member.id, contentId("coat")), member.name).toBe(
        true
      )
      for (const layer of gameContent.layers) {
        const choices = gameContent.goods.filter(
          (good) =>
            good.kind === "armor" &&
            (good.unlock ?? 0) === layer.no &&
            catalog.canEquip(member.id, good.id)
        )
        expect(choices.length, `${member.name} ${layer.no}層`).toBeGreaterThan(
          0
        )
      }
    }
  })

  it("職業に合わない防具は候補に出ず、直接指定しても資産と装備を変えない", () => {
    // 鎖帷子を着られないマユを控えに雇っておく
    const game = createTestGame({
      state: aState().withGold(10000).withJoined("mayu").build(),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("mail"),
      })
    )
    const gear = game.state.gear.find(
      (entry) => entry.good === contentId("mail")
    )!
    expect(
      game.queries
        .equipOptions(game.state, contentId("mayu"))
        .some((entry) => entry.gear === gear.id)
    ).toBe(false)
    const before = game.state
    expect(
      game.send({ type: "equip", gear: gear.id, member: contentId("mayu") })
    ).toMatchObject({ code: "WRONG_JOB" })
    expect(game.state).toBe(before)
    eventsOrThrow(
      game.send({ type: "equip", gear: gear.id, member: contentId("alda") })
    )
    const worn = game.state
    expect(
      game.send({ type: "equip", gear: gear.id, member: contentId("mayu") })
    ).toMatchObject({ code: "WRONG_JOB" })
    expect(game.state).toBe(worn)
    expect(
      game.queries.member(game.state, contentId("alda"))!.armor!.good
    ).toBe(contentId("mail"))
  })

  it("職業に合わない装備を書き込んだ保存は拒否し、いまの状態は残す", () => {
    const game = createTestGame({ state: aState().withJoined("mayu").build() })
    const save = structuredClone(game.save())
    const corrupted = {
      ...save,
      snapshot: {
        ...save.snapshot,
        gear: save.snapshot.gear.map((entry) =>
          entry.owner === contentId("mayu")
            ? { ...entry, good: contentId("mail") }
            : entry
        ),
      },
    }
    const before = game.state
    expect(game.restore(corrupted)).toMatchObject({ code: "INVALID_SAVE" })
    expect(game.state).toBe(before)
  })

  it("存在しない職業や初期装備の矛盾をデータの境界で拒否する", () => {
    expect(
      () =>
        new GameCatalog(
          aContent()
            .withGood("mail", { allowedJobs: ["未登録の職業"] })
            .build()
        )
    ).toThrow("装備職業")
    expect(
      () =>
        new GameCatalog(
          aContent()
            .withGood("coat", { allowedJobs: ["戦士"] })
            .build()
        )
    ).toThrow("初期装備")
  })
})
