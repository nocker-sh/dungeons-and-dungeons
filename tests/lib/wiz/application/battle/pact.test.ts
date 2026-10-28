import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { recruitBySlug } from "@/lib/wiz/testing/recruit-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import type { Game } from "@/lib/wiz/game/game"
import type { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameContent } from "@/lib/wiz/content/content-schema"

const idOf = (slug: string) => memberBySlug(slug).id

/**
 * モードを変える規則を確かめるための内容。実データの R は1人1モードなので、
 * アルマにほかの R のモードの戦い方を借りて3つ持たせる（Lv1・6・12）。
 */
function contentWithAlmaModes(): GameContent {
  const base = realContent()
  const weaponOf = (slug: string) => memberBySlug(slug).pact!.modes[0]!.weapon
  return {
    ...base,
    recruits: base.recruits.map((entry) =>
      entry.member.id === memberBySlug("alma").id
        ? {
            ...entry,
            member: {
              ...entry.member,
              pact: {
                modes: [
                  {
                    level: 1,
                    weapon: weaponOf("alma"),
                    roles: ["damage", "healer"],
                    combatStyle: "重い一撃と回復で支える。",
                  },
                  {
                    level: 6,
                    weapon: weaponOf("sera"),
                    roles: ["tank", "healer"],
                    combatStyle: "前衛で全体防護を張る。",
                  },
                  {
                    level: 12,
                    weapon: weaponOf("rivet"),
                    roles: ["tank", "damage"],
                    combatStyle: "身を焼く拳で押し崩す。",
                  },
                ],
              },
            },
          }
        : entry
    ),
  }
}
const codeOf = (result: unknown) => (result as GameCommandError).code

/** 悪魔と契約して戦う仲間（R）。武器も防具も持たず、戦闘中の「ケイヤク」でモードを変える。 */
describe("悪魔と契約して戦う仲間（ケイヤク）", () => {
  const alma = idOf("alma")
  const alda = idOf("alda")
  const content = contentWithAlmaModes()
  const modeGoods = content.recruits
    .find((entry) => entry.member.id === alma)!
    .member.pact!.modes.map((mode) =>
      content.goods.find((good) => good.id === mode.weapon)!
    )
  const { plusPerLevel, maxPlus } = realContent().balance.pact

  /** アルマを先頭に入れた3人。lv でモードの開き方が変わる。 */
  function townWithAlma(lv: number) {
    const base = aState().withExtraMember("alma", { lv })
    const rest = base.build().party.slice(0, 2)
    return base.withParty([alma, ...rest]).withGold(5000)
  }
  function battleWithAlma(lv: number) {
    const state = townWithAlma(lv).build()
    const others = state.party.filter((id) => id !== alma)
    return createTestGame({
      content,
      state: townWithAlma(lv)
        .inBattle({ foes: ["kamokutsu"], order: [alma, "foe-1", ...others] })
        .build(),
    })
  }
  const powerAt = (lv: number, mode: number) => {
    const good = modeGoods[mode]!
    const plus = Math.min(maxPlus, Math.floor((lv - 1) * plusPerLevel))
    return Math.round(good.power! + plus * (good.powerPerPlus ?? 1))
  }
  const weaponOf = (game: Game) =>
    game.queries.member(game.state, alma)!.weapon!

  it("募集の R はみな契約のモードを持ち、専用の武器・固定装備を持たない", () => {
    const rare = realContent().recruits.filter(
      (entry) => entry.rank === "R" && !entry.retired
    )
    expect(rare.map((entry) => entry.member.id).sort()).toEqual(
      ["alma", "nem", "rivet", "rize", "sera", "tsumugi"].map(idOf).sort()
    )
    for (const entry of rare) {
      const pact = entry.member.pact
      // 種類を増やすと管理が大変なので、モードは1人1つ（2026-10-15）
      expect(
        pact?.modes.map((mode) => mode.level),
        entry.member.id
      ).toEqual([1])
      expect(entry.member.unique, entry.member.id).toBeFalsy()
      expect(entry.member.weapon, entry.member.id).toBeFalsy()
      expect(entry.member.gear, entry.member.id).toBeFalsy()
      expect(entry.member.fixedArmor, entry.member.id).toBeFalsy()
    }
    // モードが1つなら変える先がないので、戦闘の指示に「ケイヤク」を出さない
    const single = createTestGame({
      state: townWithAlma(12)
        .inBattle({ foes: ["kamokutsu"], order: [alma, "foe-1"] })
        .build(),
    })
    expect(single.queries.commands(single.state, alma)!.pact).toBeNull()
    // SR のハスキーはユニークのまま
    const husky = recruitBySlug("sr-husky").member
    expect(husky.unique).toBe(true)
    expect(husky.pact).toBeFalsy()
  })

  it("[feature:W017] 雇うと装備を持たずに加わり、最初のモードで戦う", () => {
    const game = createTestGame({
      content,
      state: aState().withGold(5000).withBoard(["r-alma"]).build(),
    })
    const gearBefore = game.state.gear
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-alma") }))
    expect(game.state.gear).toEqual(gearBefore)
    expect(game.state.gear.some((gear) => gear.owner === alma)).toBe(false)
    const view = game.queries.member(game.state, alma)!
    expect(view.weapon?.good).toBe(modeGoods[0]!.id)
    expect(view.armor).toBeNull()
    expect(view.pact?.map((mode) => mode.current)).toEqual([true, false, false])
    expect(game.queries.problems(game.state)).toEqual([])
  })

  it("[feature:W017] 契約の仲間は武器も防具も装備できず、拒否で資産が変わらない", () => {
    const game = createTestGame({
      content,
      state: townWithAlma(3).build(),
    })
    const buy = (good: string) => {
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId(good),
        })
      )
      return game.state.gear.at(-1)!
    }
    const greatsword = buy("greatsword")
    const leather = buy("leather")
    const before = game.state
    expect(
      codeOf(game.send({ type: "equip", gear: greatsword.id, member: alma }))
    ).toBe("FIXED_GEAR")
    expect(
      codeOf(game.send({ type: "equip", gear: leather.id, member: alma }))
    ).toBe("FIXED_GEAR")
    expect(game.state).toBe(before)
    expect(game.queries.equipOptions(game.state, alma)).toEqual([])
    expect(game.queries.gearLock(alma)).toContain("悪魔と契約して戦う")
    expect(game.queries.gearLock(alda)).toBeNull()
    // ほかの仲間はふつうに着けられる
    eventsOrThrow(
      game.send({ type: "equip", gear: greatsword.id, member: alda })
    )
  })

  it("[feature:W004] モードはレベルで増え、届かない・同じ・契約でない・ないモードは拒否して状態を変えない", () => {
    const game = battleWithAlma(3)
    expect(
      game.queries
        .commands(game.state, alma)!
        .pact!.map(({ index, level, open, current, usable }) => ({
          index,
          level,
          open,
          current,
          usable,
        }))
    ).toEqual([
      { index: 0, level: 1, open: true, current: true, usable: false },
      { index: 1, level: 6, open: false, current: false, usable: false },
      { index: 2, level: 12, open: false, current: false, usable: false },
    ])
    const before = game.state
    const pact = (mode: number) =>
      codeOf(game.send({ type: "act", command: "pact", mode }))
    expect(pact(1)).toBe("LOCKED")
    expect(pact(2)).toBe("LOCKED")
    expect(pact(0)).toBe("ALREADY")
    expect(pact(3)).toBe("UNKNOWN")
    expect(game.state).toBe(before)
    // Lv6 で2つ目、Lv12 で3つ目が開く
    expect(
      battleWithAlma(6)
        .queries.commands(battleWithAlma(6).state, alma)!
        .pact!.map((mode) => mode.open)
    ).toEqual([true, true, false])
    expect(
      battleWithAlma(12)
        .queries.commands(battleWithAlma(12).state, alma)!
        .pact!.map((mode) => mode.open)
    ).toEqual([true, true, true])
    // 契約でない仲間はケイヤクを持たず、送っても断られる
    const other = createTestGame({
      content,
      state: aState()
        .inBattle({ foes: ["kamokutsu"], order: [alda, "foe-1"] })
        .build(),
    })
    expect(other.queries.commands(other.state, alda)!.pact).toBeNull()
    const otherBefore = other.state
    expect(codeOf(other.send({ type: "act", command: "pact", mode: 0 }))).toBe(
      "UNAVAILABLE"
    )
    expect(other.state).toBe(otherBefore)
  })

  it("[feature:W004] ケイヤクは手番を使い、ワザと攻撃力が替わり、モードは保存・復元で保たれる", () => {
    const game = battleWithAlma(12)
    const before = game.queries.commands(game.state, alma)!
    expect(game.queries.member(game.state, alma)?.roles).toEqual([
      "damage",
      "healer",
    ])
    expect(before.weaponSkills.map((skill) => skill.id)).toEqual(
      modeGoods[0]!.skills
    )
    expect(weaponOf(game).power).toBe(powerAt(12, 0))
    const events = eventsOrThrow(
      game.send({ type: "act", command: "pact", mode: 1 })
    )
    expect(events[0]).toMatchObject({
      type: "acted",
      actor: { kind: "member", id: alma },
      command: "pact",
      mode: 1,
      name: modeGoods[1]!.name,
    })
    // 手番は次（敵）へ進む
    expect(game.queries.battle(game.state)!.current).toMatchObject({
      kind: "foe",
    })
    expect(game.state.members.find((member) => member.id === alma)?.mode).toBe(
      1
    )
    const after = game.queries.commands(game.state, alma)!
    expect(game.queries.member(game.state, alma)?.roles).toEqual([
      "tank",
      "healer",
    ])
    expect(after.pact?.find((mode) => mode.current)?.combatStyle).toContain(
      "全体防護"
    )
    expect(after.weaponSkills.map((skill) => skill.id)).toEqual(
      modeGoods[1]!.skills
    )
    expect(after.pact!.map((mode) => mode.current)).toEqual([
      false,
      true,
      false,
    ])
    expect(weaponOf(game).good).toBe(modeGoods[1]!.id)
    expect(weaponOf(game).type).toBe(modeGoods[1]!.weaponType)
    expect(weaponOf(game).power).toBe(powerAt(12, 1))
    expect(powerAt(12, 1)).not.toBe(powerAt(12, 0))
    // 保存して読み直してもモードは残る
    const restored = battleWithAlma(12)
    expect(restored.restore(game.save())).toBeUndefined()
    expect(
      restored.state.members.find((member) => member.id === alma)?.mode
    ).toBe(1)
    expect(weaponOf(restored)).toEqual(weaponOf(game))
    expect(restored.queries.problems(restored.state)).toEqual([])
  })

  it("[feature:W004] モードの攻撃力はレベルで上がる（pactPlus）", () => {
    const powers = [1, 3, 6, 12, 20].map((lv) => {
      const game = createTestGame({
        content,
        state: townWithAlma(lv).build(),
      })
      expect(weaponOf(game).power, `Lv${lv}`).toBe(powerAt(lv, 0))
      return weaponOf(game).power
    })
    for (let index = 1; index < powers.length; index++)
      expect(powers[index]).toBeGreaterThan(powers[index - 1]!)
    expect(powerAt(1, 0)).toBe(modeGoods[0]!.power)
  })

  it("旧保存で R が着けていた武器・防具は、読み込むと外れて（専用の武器は消え、防具は袋へ）整合性を保つ", () => {
    const game = createTestGame({
      content,
      state: townWithAlma(3).build(),
    })
    const heroSword = modeGoods[0]!
    const leather = goodBySlug("leather")
    // 旧仕様の保存を作る：店で買った個体を、専用の武器と着替えた防具としてアルマに着けておく
    for (const good of ["greatsword", "leather"])
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId(good),
        })
      )
    const [sword, armor] = game.state.gear.slice(-2)
    const saved = JSON.parse(JSON.stringify(game.save()))
    saved.snapshot.gear = saved.snapshot.gear.map(
      (gear: { id: string; weapon?: object }) =>
        gear.id === sword!.id
          ? {
              ...gear,
              good: heroSword.id,
              owner: alma,
              plus: 3,
              weapon: { ...gear.weapon, skills: heroSword.skills },
            }
          : gear.id === armor!.id
            ? { ...gear, owner: alma }
            : gear
    )
    const restored = createTestGame({
      content,
      state: townWithAlma(3).build(),
    })
    expect(restored.restore(saved)).toBeUndefined()
    expect(restored.state.gear.some((gear) => gear.id === sword!.id)).toBe(
      false
    )
    expect(
      restored.state.gear.find((gear) => gear.id === armor!.id)
    ).toMatchObject({ owner: null, good: leather.id })
    expect(restored.state.gear.some((gear) => gear.owner === alma)).toBe(false)
    expect(restored.queries.problems(restored.state)).toEqual([])
    expect(weaponOf(restored).good).toBe(heroSword.id)
    // 移行した保存を読み直しても変わらない
    const again = createTestGame({
      content,
      state: townWithAlma(3).build(),
    })
    expect(again.restore(JSON.parse(JSON.stringify(restored.save())))).toBe(
      undefined
    )
    expect(again.state.gear).toEqual(restored.state.gear)
  })
})
