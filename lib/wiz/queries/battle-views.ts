import { SupplyRules } from "@/lib/wiz/rules/supply-rules"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { StatusKind, Target } from "@/lib/wiz/content/constants"
import { effectSpec } from "@/lib/wiz/rules/item-effect-spec"
import { skillSpec } from "@/lib/wiz/rules/skill-spec"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { ActorRef, GameState } from "@/lib/wiz/state/state-schema"
import { MAGIC_SCHOOL_NAMES, ROLE_NAMES } from "@/lib/wiz/queries/names"
import {
  STATUS_NAMES,
  statusResistanceView,
} from "@/lib/wiz/queries/status-resistance-view"
import type { MemberViews } from "@/lib/wiz/queries/member-views"

/** 戦闘の画面の見え方と、手番の仲間が選べる指示。 */
export class BattleViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly rules: PartyRules,
    private readonly weapons: WeaponRules,
    private readonly members: MemberViews
  ) {}

  battle(state: GameState) {
    if (state.phase.type !== "battle") return null
    const { battle } = state.phase
    const name = (ref: ActorRef) =>
      ref.kind === "member"
        ? (this.members.name(state, ref.id) ?? "")
        : (this.catalog.foe(
            battle.foes.find((foe) => foe.id === ref.id)?.foe ?? ""
          )?.name ?? "")
    /** 顔の絵を引く id。主人公は選んだ外見。 */
    const look = (ref: ActorRef) =>
      ref.kind === "member" ? this.members.look(state, ref.id) : ref.id
    const spd = (ref: ActorRef) => {
      if (ref.kind === "foe")
        return (
          this.catalog.foe(
            battle.foes.find((foe) => foe.id === ref.id)?.foe ?? ""
          )?.spd ?? 0
        )
      const member = state.members.find((entry) => entry.id === ref.id)
      return member ? this.rules.stats(member, state).spd : 0
    }
    const alive = (ref: ActorRef) =>
      ref.kind === "member"
        ? (state.members.find((entry) => entry.id === ref.id)?.hp ?? 0) > 0
        : (battle.foes.find((foe) => foe.id === ref.id)?.hp ?? 0) > 0
    const station = this.catalog.station(
      state.phase.expedition.layer,
      state.phase.expedition.at
    )
    const townQuest = state.phase.townQuest ?? null
    return {
      boss: battle.boss,
      townQuest,
      /** 戦う場所の鍵。依頼の戦いは依頼の場所、探索の戦いは層の id。背景の絵は作品のデータが引く。 */
      place: townQuest
        ? (this.catalog.quest(townQuest)?.encounter?.place ??
          state.phase.expedition.layer)
        : state.phase.expedition.layer,
      /** 層の途中の決まった強敵。 */
      midboss: !battle.boss && station?.event === "midboss",
      turn: battle.turn,
      current: battle.order[battle.turn % battle.order.length],
      order: battle.order.map((ref) => ({
        ref,
        name: name(ref),
        look: look(ref),
        spd: spd(ref),
        alive: alive(ref),
      })),
      guarding: battle.guarding,
      foes: battle.foes.map((foe) => {
        const def = this.catalog.foe(foe.foe)!
        return {
          id: foe.id,
          foe: foe.foe,
          appearanceId: foe.appearanceId,
          name: def.name,
          hp: foe.hp,
          maxHp: foe.maxHp,
          spd: def.spd,
          resistances: Object.entries(def.resist ?? {})
            .filter(([, value]) => value > 0)
            .map(([kind, value]) =>
              statusResistanceView(kind as StatusKind, value)
            ),
          status: foe.status.map((entry) => ({
            ...entry,
            name: STATUS_NAMES[entry.kind],
          })),
        }
      }),
    }
  }

  /** 契約のモードの一覧（契約しない仲間は null）。 */
  pactView(member: GameState["members"][number]) {
    if (!this.rules.equipment.isPact(member)) return null
    const current = this.rules.equipment.modeOf(member)
    return this.rules.equipment.modesOf(member).map((mode) => {
      const good = this.catalog.good(mode.weapon)
      return {
        index: mode.index,
        name: good?.name ?? "",
        desc: good?.desc ?? "",
        roleName: mode.roles.map((role) => ROLE_NAMES[role]).join("・"),
        combatStyle: mode.combatStyle ?? "",
        weaponType: good?.weaponType ?? null,
        /** そのモードで使えるワザの名前。 */
        skills: (good?.skills ?? []).map(
          (id) => this.catalog.skill(id)?.name ?? id
        ),
        /** 選べるようになるレベル。 */
        level: mode.level,
        open: mode.open,
        current: mode.index === current,
        usable: mode.open && mode.index !== current,
      }
    })
  }

  /** 手番の仲間が選べる指示。使えない指示は出さない。target は誰を選ぶ必要があるか。 */
  commands(state: GameState, memberId: string) {
    const member = state.members.find((entry) => entry.id === memberId)
    if (!member) return null
    const fallen = state.party.some(
      (id) => (state.members.find((entry) => entry.id === id)?.hp ?? 0) <= 0
    )
    const party = state.party.flatMap((id) => {
      const member = state.members.find((entry) => entry.id === id)
      return member ? [member] : []
    })
    const view = (id: string) => {
      const skill = this.catalog.skill(id)!
      const spec = skillSpec(skill)
      const left = this.rules.skills.leftOf(member, state, id)
      const allowed = this.rules.skills.canUseSchool(member, state, id)
      const cost = this.rules.sacrificeCost(member, state, id)
      return {
        id: skill.id,
        name: skill.name,
        desc: skill.desc,
        /** 最大の使用回数（武器の強化で増える）。null は無制限。 */
        uses: this.rules.skills.maxUses(member, state, id),
        /** 残りの使用回数。null は無制限。 */
        left,
        kind: skill.kind,
        target: spec.target as Target,
        revive: !!spec.revive,
        /** 味方に使うワザの対象。控えを含めず、隊列の並びで返す。 */
        targets:
          spec.target === "ally" || spec.target === "allies"
            ? party
                .filter((member) =>
                  spec.revive ? member.hp <= 0 : member.hp > 0
                )
                .map((member) => member.id)
            : [],
        /** 防具の耐久を戻す量（戻さないワザは null）。 */
        repair: skill.repair ?? null,
        reach: skill.reach ?? null,
        /** 魔法の流派（流派のないワザは null）。 */
        school: skill.school ?? null,
        schoolName: skill.school ? MAGIC_SCHOOL_NAMES[skill.school] : null,
        /** 合体している悪魔と流派が合い、威力が上がる。 */
        affinity: this.rules.magic.affinityFactor(member, state, id) > 1,
        /** 流派が合わなくて選べない。 */
        blocked: !allowed,
        /** 放つときに払うHP（払わないワザは 0）。 */
        cost,
        weak:
          skill.kind === "hit" &&
          !!skill.reach &&
          this.rules.reachFactor(state, member.id, skill.reach) < 1,
        usable:
          allowed &&
          (left === null || left > 0) &&
          (!spec.revive || fallen) &&
          (cost === 0 || member.hp > cost),
      }
    }
    const weapon = this.rules.equipment.weaponOf(member, state)
    const weaponSkills = this.rules.skills.weaponSkills(member, state)
    const brawl = this.rules.skills.brawl()
    return {
      /** いま戦う武器（個体のレア度・上振れを含む）。 */
      weapon: this.members.weapon(state, member),
      /** 武器に付く3つのワザ。付け替え可能な枠には random の印。 */
      weaponSkills: weaponSkills.map((id, index) => ({
        ...view(id),
        random: !!weapon && this.weapons.isRandomSkill(weapon.good, index, id),
      })),
      blessing: member.blessing
        ? { ...view(member.blessing), random: false }
        : null,
      /** キャラ固有のスキル。 */
      skills: this.rules.magic.skills(member, state).map(view),
      /**
       * ケイヤク（悪魔と契約して戦う仲間だけ）。モードごとの戦い方と、いまのモード・選べるか。
       * 契約しない仲間と、モードが一つだけの仲間（変える先がない）は null。モードを変えると手番を使う。
       */
      pact:
        this.rules.equipment.modesOf(member).length > 1
          ? this.pactView(member)
          : null,
      /** 使える手が尽きたときだけ出る弱い攻撃。 */
      brawl:
        brawl && this.rules.skills.canBrawl(member, state)
          ? {
              name: brawl.name,
              desc: brawl.desc,
              reach: brawl.reach ?? "melee",
              weak:
                this.rules.reachFactor(
                  state,
                  member.id,
                  brawl.reach ?? "melee"
                ) < 1,
            }
          : null,
      items: SupplyRules.available(state, this.catalog).flatMap((entry) => {
        const good = this.catalog.good(entry.good)
        if (good?.kind !== "item" || !good.effect) return []
        const spec = effectSpec(good.effect)
        const toAlly = spec.target === "ally" || spec.target === "allies"
        // 効かない相手（回復しきっている・治す状態がないなど）には使わせない
        const targets = toAlly ? this.rules.itemTargets(state, good.effect) : []
        return [
          {
            id: good.id,
            name: good.name,
            desc: good.desc,
            count: entry.count,
            effect: good.effect.type,
            target: spec.target as Target,
            revive: !!spec.revive,
            /** 効く相手（味方に使う道具だけ）。 */
            targets,
            usable: (!spec.revive || fallen) && (!toAlly || targets.length > 0),
          },
        ]
      }),
    }
  }
}
