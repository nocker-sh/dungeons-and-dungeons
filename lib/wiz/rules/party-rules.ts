import type { Effect } from "@/lib/wiz/content/content-schema"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { Reach, Row } from "@/lib/wiz/content/constants"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { GameState, Member } from "@/lib/wiz/state/state-schema"
import type { StatBlock } from "@/lib/wiz/state/stat-block"
import { WeaponRules, type EquippedWeapon } from "@/lib/wiz/rules/weapon-rules"
import { PartyEquipment } from "./party/equipment"
import { PartyMagic } from "./party/magic"
import { PartyGrowth } from "./party/growth"
import { PartySkills } from "./party/skills"

/** 仲間の能力の合算と、複数の規則にまたがる計算。個別の規則は各クラスから使う。 */
export class PartyRules {
  readonly equipment: PartyEquipment
  readonly magic: PartyMagic
  readonly growth: PartyGrowth
  readonly skills: PartySkills
  constructor(
    private readonly catalog: GameCatalog,
    weapons = new WeaponRules(catalog)
  ) {
    this.equipment = new PartyEquipment(catalog, weapons)
    this.magic = new PartyMagic(catalog)
    this.growth = new PartyGrowth(catalog)
    this.skills = new PartySkills(catalog, this.equipment, this.magic)
  }
  static readonly FRONT_SLOTS = 2

  /** 装備の補正と、主人公なら合体の効果を足した能力。 */
  stats(
    member: Member,
    state: Pick<GameState, "gear" | "demons" | "contract">
  ): StatBlock {
    const bonus = {
      maxHp: this.magic.fusionOf(member, state).maxHp,
      str: 0,
      tec: 0,
      spd: 0,
    }
    for (const gear of this.equipment.gearOf(state, member.id)) {
      const good = this.catalog.good(gear.good)
      if (this.equipment.isHero(member)) continue
      const gained = this.equipment.gearBonus(good?.bonus, gear.plus)
      bonus.maxHp += gained.maxHp
      bonus.str += gained.str
      bonus.tec += gained.tec
      bonus.spd += gained.spd
    }
    const base = this.equipment.isHero(member)
      ? this.catalog.member(member.id)!.stats
      : member.stats
    return {
      maxHp: Math.max(1, base.maxHp + bonus.maxHp),
      str: Math.max(0, base.str + bonus.str),
      tec: Math.max(0, base.tec + bonus.tec),
      spd: Math.max(0, base.spd + bonus.spd),
    }
  }

  /** 出撃メンバーの位置で前衛・後衛が決まる。控えは null。 */
  rowOf(state: Pick<GameState, "party">, id: string): Row | null {
    const index = state.party.indexOf(id)
    if (index < 0) return null
    return index < PartyRules.FRONT_SLOTS ? "front" : "back"
  }

  /** その武器を持ったときの攻撃力 = 武器の攻撃力 × 条件の倍率 × 得意の倍率。 */
  attackWith(
    member: Member,
    state: Pick<GameState, "gear" | "demons" | "contract">,
    weapon: EquippedWeapon
  ) {
    const stats = this.stats(member, state)
    const power = this.equipment.weaponPower(
      weapon.good,
      weapon.plus,
      weapon.individual.extraPower
    )
    const need = weapon.good.need ?? { str: 0, tec: 0 }
    return Math.max(
      1,
      Math.round(
        power *
          this.equipment.requirementFactor(stats, need) *
          this.equipment.favoriteFactor(member, weapon.good.weaponType) *
          this.magic.fusionOf(member, state).attack
      )
    )
  }

  /** いま戦うときの攻撃力。 */
  attack(
    member: Member,
    state: Pick<GameState, "gear" | "demons" | "contract">
  ) {
    const weapon = this.equipment.weaponOf(member, state)
    return weapon ? this.attackWith(member, state, weapon) : 1
  }

  /** 届き方による威力の倍率。後衛から近接で攻撃すると下がる。 */
  reachFactor(state: Pick<GameState, "party">, memberId: string, reach: Reach) {
    return this.rowOf(state, memberId) === "back" && reach === "melee"
      ? this.catalog.data.balance.backRow.melee
      : 1
  }

  /** 自分を削って放つワザで払うHP。払えるHPがないときは選べない。 */
  sacrificeCost(
    member: Member,
    state: Pick<GameState, "gear" | "demons" | "contract">,
    skillId: string
  ) {
    const share = this.catalog.skill(skillId)?.sacrifice
    if (!share) return 0
    return Math.max(1, Math.floor(this.stats(member, state).maxHp * share))
  }

  /**
   * その道具がこの仲間に効くか。効かない相手に使うと道具が無駄になるので選ばせない。
   * 回復＝HPが減っている、使用回数の戻し＝使ったワザがある、治療＝その状態がある、蘇生＝倒れている。
   */
  itemAffects(
    member: Member,
    state: Pick<GameState, "gear" | "demons" | "contract">,
    effect: WizDeepReadonly<Effect>
  ) {
    switch (effect.type) {
      case "heal":
        return member.hp > 0 && member.hp < this.stats(member, state).maxHp
      case "revive":
        return member.hp <= 0
      case "refill":
        return member.hp > 0 && member.used.some((entry) => entry.count > 0)
      case "cure":
        return (
          member.hp > 0 &&
          member.status.some((entry) => effect.kinds.includes(entry.kind))
        )
      default:
        return member.hp > 0
    }
  }

  /** その道具が効く出撃メンバーの id（隊列の並び）。 */
  itemTargets(
    state: Pick<
      GameState,
      "members" | "party" | "gear" | "demons" | "contract"
    >,
    effect: WizDeepReadonly<Effect>
  ) {
    return state.party.flatMap((id) => {
      const member = state.members.find((entry) => entry.id === id)
      return member && this.itemAffects(member, state, effect) ? [id] : []
    })
  }
}
