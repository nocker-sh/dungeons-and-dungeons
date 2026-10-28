import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"

describe("武器の攻撃力", () => {
  const catalog = new GameCatalog(realContent())
  const rules = new PartyRules(catalog)
  const alda = memberBySlug("alda")
  const greatsword = goodBySlug("greatsword")
  const gun = goodBySlug("gun")
  /** アルダに鉄の両手剣を持たせ、筋力だけを変えた場面。 */
  const stateWith = (stats: Partial<GameState["members"][number]["stats"]>) =>
    aState()
      .withEquipped("alda", "greatsword")
      .withMember("alda", {
        stats: { ...alda.stats, ...stats },
      })
      .build()
  const attackOf = (state: GameState) =>
    rules.attack(
      state.members.find((member) => member.id === alda.id)!,
      state
    )

  it("固定武器の成長倍率は強化分だけに掛かり、通常武器と上振れを変えない", () => {
    const fixed = { ...greatsword, power: 28, powerPerPlus: 1.7 }
    expect(rules.equipment.weaponPower(fixed, 0)).toBe(28)
    expect(rules.equipment.weaponPower(fixed, 8)).toBe(42)
    expect(rules.equipment.weaponPower(fixed, 30)).toBe(79)
    expect(rules.equipment.weaponPower(fixed, 30, 5)).toBe(84)
    expect(rules.equipment.weaponPower(greatsword, 8, 5)).toBe(
      greatsword.power! + 13
    )
    const state = stateWith({ str: 100, tec: 100 })
    const member = state.members.find((entry) => entry.id === alda.id)!
    const weapon = rules.equipment.weaponOf(member, state)!
    expect(
      rules.attackWith(member, state, { ...weapon, good: fixed, plus: 30 })
    ).toBe(79)
  })

  it("必要な筋力に届かないと攻撃力が下がり、上回っても増えない", () => {
    const power = greatsword.power!
    const need = greatsword.need!.str
    const short = need - 2
    expect(attackOf(stateWith({ str: short }))).toBe(
      Math.round(power * (short / need))
    )
    expect(attackOf(stateWith({ str: need }))).toBe(power)
    expect(attackOf(stateWith({ str: need * 2 }))).toBe(power)
  })

  it("足りない分は balance.weapon.needFloor より下がらない", () => {
    const floor = realContent().balance.weapon.needFloor
    expect(attackOf(stateWith({ str: 1 }))).toBe(
      Math.round(greatsword.power! * floor)
    )
  })

  it("得意でない武器種は balance.weapon.other の分だけ弱い", () => {
    // アルダ（両手剣が得意）に魔法銃を持たせる
    const withGun = aState().withEquipped("alda", "gun").build()
    const equipped = withGun.members.find((member) => member.id === alda.id)!
    const { favorite, other } = realContent().balance.weapon
    const requirement = rules.equipment.requirementFactor(
      rules.stats(equipped, withGun),
      gun.need!
    )
    expect(rules.attack(equipped, withGun)).toBe(
      Math.round(gun.power! * requirement * other)
    )
    // 得意な武器種なら倍率が上がる
    expect(other).toBeLessThan(favorite)
  })

  it("武器を装備していない仲間は、得意な武器種に合わせた素の武器で戦う", () => {
    const state = aState().build()
    const hero = memberBySlug("hero")
    const weapon = rules.equipment.weaponOf({ id: hero.id }, state)
    expect(weapon?.good.id).toBe(hero.defaultWeapon)
    expect(weapon?.equipped).toBe(false)
    // 素の武器は持ち物にならない
    expect(
      state.gear.some((gear) => gear.good === contentId("old-dagger"))
    ).toBe(false)
  })
})
