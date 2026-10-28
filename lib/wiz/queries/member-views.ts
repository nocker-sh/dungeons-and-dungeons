import { MemberBonds } from "@/lib/wiz/rules/member-bonds"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { StatusKind } from "@/lib/wiz/content/constants"
import { slotOf } from "@/lib/wiz/content/slot-of"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { GameState, Member } from "@/lib/wiz/state/state-schema"
import {
  ROLE_NAMES,
  ROLE_NOTES,
  GROWTH_TYPE_NAMES,
  MAGIC_SCHOOL_NAMES,
  WEAPON_TYPE_NAMES,
} from "@/lib/wiz/queries/names"
import {
  STATUS_NAMES,
  statusResistanceView,
} from "@/lib/wiz/queries/status-resistance-view"
import type { GoodViews } from "@/lib/wiz/queries/good-views"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"

/** 仲間・隊列の見え方。能力は装備の補正を含む。 */
export class MemberViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly rules: PartyRules,
    private readonly weapons: WeaponRules,
    private readonly goods: GoodViews
  ) {}

  /** その仲間の絵を引く id。主人公は選んだ外見、ほかの仲間は自分の id。 */
  look(state: GameState, id: string) {
    return this.catalog.member(id)?.hero ? state.hero.look : id
  }

  member(state: GameState, id: string) {
    const member = state.members.find((entry) => entry.id === id)
    return member ? this.view(state, member) : null
  }

  /** 名前だけ。主人公は遊ぶ人が決めた名前。 */
  name(state: GameState, id: string) {
    const def = this.catalog.member(id)
    if (!def || !state.members.some((entry) => entry.id === id)) return null
    return def.hero ? state.hero.name : def.name
  }

  /** 出撃中の3人。隊列の並び順。 */
  party(state: GameState) {
    return state.party.flatMap((id) => {
      const member = state.members.find((entry) => entry.id === id)
      return member ? [this.view(state, member)] : []
    })
  }

  /** 控えの仲間。 */
  reserve(state: GameState) {
    return state.members
      .filter((member) => !state.party.includes(member.id))
      .map((member) => this.view(state, member))
  }

  private view(state: GameState, member: Member) {
    const def = this.catalog.member(member.id)!
    const stats = this.rules.stats(member, state)
    const gear = this.rules.equipment.gearOf(state, member.id).map((entry) => {
      const good = this.catalog.good(entry.good)!
      return {
        id: entry.id,
        good: good.id,
        name: good.name,
        slot: slotOf(good),
      }
    })
    const hero = !!def.hero
    const roles = this.rules.equipment.rolesOf(member)
    const mode =
      this.rules.equipment.modesOf(member)[this.rules.equipment.modeOf(member)]
    return {
      id: member.id,
      /** 主人公の名前は遊ぶ人が決めた名前。 */
      name: hero ? state.hero.name : def.name,
      /** 絵を引く id。主人公は選んだ外見、ほかの仲間は自分の id。 */
      look: hero ? state.hero.look : member.id,
      outfit: hero ? (state.hero.outfit ?? null) : null,
      job: def.job,
      row: this.rules.rowOf(state, member.id),
      role: roles[0]!,
      roles,
      roleName: roles.map((role) => ROLE_NAMES[role]).join("・"),
      roleNote: roles.map((role) => ROLE_NOTES[role]).join(" "),
      combatStyle: mode?.combatStyle ?? def.combatStyle ?? ROLE_NOTES[def.role],
      exploration: new ExplorationRules(this.catalog).description(
        def.exploration
      ),
      hero,
      lv: member.lv,
      exp: member.exp,
      next: this.rules.growth.expToNext(member.lv),
      levelUpReady:
        !hero && member.exp >= this.rules.growth.expToNext(member.lv),
      hp: member.hp,
      ...stats,
      base: hero ? def.stats : member.stats,
      favorite: def.favorite,
      favoriteName: WEAPON_TYPE_NAMES[def.favorite],
      /** 成長の型（序盤・中盤・終盤の伸び方）。 */
      growthType: this.rules.growth.growthTypeOf(member),
      growthTypeName: GROWTH_TYPE_NAMES[this.rules.growth.growthTypeOf(member)],
      /** 専用の武器を持つ仲間（R・ユニーク）。武器は付け替えられず、鍛え直しで強くする。 */
      unique: this.rules.equipment.isUnique(member),
      /** 防具も変えられない仲間（固定装備）。 */
      fixedArmor: this.rules.equipment.isArmorFixed(member),
      /**
       * 悪魔と契約して戦う仲間（R）のモード。武器も防具も持たず、戦闘中の「ケイヤク」で変える。
       * いまのモードと、レベルで増えるモード。契約しない仲間は null。
       */
      pact: this.rules.equipment.isPact(member)
        ? this.rules.equipment.modesOf(member).map((mode) => ({
            index: mode.index,
            name: this.catalog.good(mode.weapon)?.name ?? "",
            roleName: mode.roles.map((role) => ROLE_NAMES[role]).join("・"),
            combatStyle: mode.combatStyle ?? "",
            level: mode.level,
            open: mode.open,
            current: mode.index === this.rules.equipment.modeOf(member),
          }))
        : null,
      /** 使える魔法の流派。主人公は合体している悪魔の流派。 */
      schools: this.rules.magic.schoolsOf(member, state),
      schoolNames: this.rules.magic
        .schoolsOf(member, state)
        .map((school) => MAGIC_SCHOOL_NAMES[school]),
      /** 合体している悪魔と合う流派（合わなければ null）。そのワザの威力が上がる。 */
      affinity: this.rules.magic.affinityOf(member, state),
      affinityName: (() => {
        const school = this.rules.magic.affinityOf(member, state)
        return school ? MAGIC_SCHOOL_NAMES[school] : null
      })(),
      /** 合体の効果（主人公だけ）。悪魔のレベルで上がる。 */
      fusion: this.fusion(state, member),
      status: member.status.map((entry) => ({
        ...entry,
        name: STATUS_NAMES[entry.kind],
      })),
      fatigue: member.fatigue,
      dirt: member.dirt,
      like: member.like,
      /** 親しさの段（主人公は null）。 */
      bond: hero ? null : new MemberBonds().view(state, member.id),
      gear,
      /** いま戦う武器（装備していなければ素の武器）。 */
      weapon: this.weapon(state, member),
      /** 着けている防具と耐久（着けていなければ null）。 */
      armor: this.armor(state, member),
      inParty: state.party.includes(member.id),
    }
  }

  /**
   * 合体の効果の見え方。主人公以外と、効果のない悪魔は null。
   * 攻撃力は増える割合（%）、耐久は状態異常の効きにくさ（%）で出す。
   */
  fusion(state: GameState, member: Pick<Member, "id">) {
    if (!this.rules.equipment.isHero(member)) return null
    const bonus = this.rules.magic.fusionOf(member, state)
    const resist = Object.entries(bonus.resist).map(([kind, value]) =>
      statusResistanceView(kind as StatusKind, value)
    )
    if (bonus.attack === 1 && !bonus.maxHp && !resist.length) return null
    return {
      /** 攻撃力が増える割合（%）。 */
      attackPercent: Math.round((bonus.attack - 1) * 100),
      maxHp: bonus.maxHp,
      resist,
    }
  }

  /** 着けている防具の見え方。耐久は自然には戻らず、鍛冶屋でお金を払って直す。 */
  armor(state: GameState, member: Pick<Member, "id">) {
    const armor = this.rules.equipment.armorOf(member, state)
    if (!armor) return null
    return {
      gear: armor.gear,
      good: armor.good.id,
      name: armor.plus ? `${armor.good.name}+${armor.plus}` : armor.good.name,
      durability: armor.durability,
      maxDurability: armor.maxDurability,
      /** 減っている耐久。 */
      wear: armor.wear,
      /** 直すのにかかるお金（0 なら満タン）。 */
      gold: this.rules.equipment.repairCost(armor.wear),
    }
  }

  /** いま戦う武器の見え方。攻撃力は個体の上振れ・必要な能力・得意で決まる。 */
  weapon(state: GameState, member: Member) {
    const weapon = this.rules.equipment.weaponOf(member, state)
    if (!weapon) return null
    const stats = this.rules.stats(member, state)
    const need = weapon.good.need ?? { str: 0, tec: 0 }
    return {
      good: weapon.good.id,
      name: weapon.good.name,
      type: weapon.good.weaponType!,
      typeName: WEAPON_TYPE_NAMES[weapon.good.weaponType!],
      /** 武器そのものの攻撃力（強化と個体の上振れを含む）。 */
      power: this.rules.equipment.weaponPower(
        weapon.good,
        weapon.plus,
        weapon.individual.extraPower
      ),
      /** この仲間が使ったときの攻撃力。 */
      attack: this.rules.attackWith(member, state, weapon),
      need,
      /** 足りない分（0 なら足りている）。 */
      short: {
        str: Math.max(0, need.str - stats.str),
        tec: Math.max(0, need.tec - stats.tec),
      },
      met: stats.str >= need.str && stats.tec >= need.tec,
      favorite:
        this.rules.equipment.isPact(member) ||
        this.rules.equipment.favoriteOf(member) === weapon.good.weaponType,
      equipped: weapon.equipped,
      /** 個体のレア度（N・R・SR）。 */
      rarity: weapon.individual.rarity,
      /** 固定値より上振れしている攻撃力。 */
      extraPower: weapon.individual.extraPower,
      /** 装備の個体 id（素の武器は null）。 */
      gear: weapon.gear,
      /** 鍛冶屋の強化（ユニークは鍛え直し）の段。 */
      plus: weapon.plus,
      /** 強化とレア度で増えているワザの使用回数。 */
      usesBonus: weapon.equipped
        ? this.rules.skills.weaponUsesBonus(
            weapon.plus,
            weapon.individual.rarity
          )
        : 0,
      skills: this.goods.skillList(
        weapon.individual.skills,
        weapon.good,
        weapon.equipped
          ? this.rules.skills.weaponUsesBonus(
              weapon.plus,
              weapon.individual.rarity
            )
          : 0
      ),
    }
  }

  /**
   * その仲間がこの武器を持ったときの当たり具合。
   * 装備の比較と、必要な能力が足りないときの注意に使う。
   */
  weaponFit(
    state: GameState,
    memberId: string,
    goodId: string,
    plus = 0,
    extraPower = 0
  ) {
    const member = state.members.find((entry) => entry.id === memberId)
    const good = this.catalog.good(goodId)
    if (!member || good?.kind !== "weapon") return null
    const stats = this.rules.stats(member, state)
    const need = good.need ?? { str: 0, tec: 0 }
    return {
      attack: this.rules.attackWith(member, state, {
        good,
        plus,
        equipped: true,
        gear: null,
        individual: { ...this.weapons.base(good), extraPower },
      }),
      met: stats.str >= need.str && stats.tec >= need.tec,
      short: {
        str: Math.max(0, need.str - stats.str),
        tec: Math.max(0, need.tec - stats.tec),
      },
      favorite: this.rules.equipment.favoriteOf(member) === good.weaponType,
    }
  }

  /** 出撃できるか。できないときは理由（名前の登録前・足りない人数・倒れている者・疲れ切った者）。 */
  readiness(state: GameState) {
    const unregistered = state.hero.registrationPending === true
    const party = this.party(state)
    const short = Math.max(0, PARTY_SLOTS - party.length)
    const down = party
      .filter((member) => member.hp <= 0)
      .map((member) => member.name)
    const tired = party
      .filter(
        (member) => member.fatigue >= this.catalog.data.balance.exhaustedAt
      )
      .map((member) => member.name)
    return {
      ready: !unregistered && !short && !down.length && !tired.length,
      /** ギルドの受付で名前を登録する前。ダンジョンへは行けない。 */
      unregistered,
      /** 3人まで足りない人数。募集で集める。 */
      short,
      slots: PARTY_SLOTS,
      down,
      tired,
    }
  }
}
