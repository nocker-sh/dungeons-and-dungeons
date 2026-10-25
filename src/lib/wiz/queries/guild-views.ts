import { DemonBonds } from "@/lib/wiz/rules/demon-bonds"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import {
  PARTY_SLOTS,
  type GameCatalog,
  type MagicSchool,
  type StatusKind,
} from "@/lib/wiz/content"
import { Bag, type PartyRules } from "@/lib/wiz/rules"
import type { GameState } from "@/lib/wiz/state"
import {
  WEAPON_TYPE_NAMES,
  ROLE_NAMES,
  ROLE_NOTES,
  GROWTH_TYPE_NAMES,
  MAGIC_SCHOOL_NAMES,
  statusResistanceView,
} from "@/lib/wiz/queries/names"
import type { MemberViews } from "@/lib/wiz/queries/member-views"

/** 酒場・秘密の部屋・街の印の見え方：募集・依頼・召喚・悪魔・結果の板。 */
export class GuildViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly rules: PartyRules,
    private readonly members: MemberViews
  ) {}

  /** 合体している悪魔。まだ契約していなければ null。 */
  demon(state: GameState) {
    const demon = state.contract ? this.catalog.demon(state.contract) : null
    if (!demon) return null
    return {
      ...demon,
      lv: state.demons.find((entry) => entry.id === demon.id)?.lv ?? 1,
      skills: demon.skills.map((id) => this.catalog.skill(id)!),
      schoolName: demon.school ? MAGIC_SCHOOL_NAMES[demon.school] : null,
    }
  }

  /**
   * 契約した悪魔。レベル・次のレベルまでの経験値・合体中か・流派と、
   * その悪魔で合体したときの効果と、流派が合う出撃中の仲間の名前。
   */
  demons(state: GameState) {
    const rules = this.catalog.data.summon
    return state.demons.map((owned) => {
      const demon = this.catalog.demon(owned.id)!
      return {
        ...demon,
        bond: new DemonBonds(this.catalog).view(state, demon.id),
        canTalk:
          new ConversationRules(this.catalog).available(state, "talk", {
            resident: demon.id,
          }).length > 0,
        lv: owned.lv,
        exp: owned.exp,
        next: owned.lv >= rules.maxLevel ? null : rules.levelExp,
        active: owned.id === state.contract,
        /** 魔法の流派（決まっていなければ null）。 */
        school: demon.school ?? null,
        schoolName: demon.school ? MAGIC_SCHOOL_NAMES[demon.school] : null,
        /** この悪魔と合体したときの効果（レベルの分を掛けた値）。 */
        fusion: this.fusionOf(demon.id, owned.lv),
        /** 流派が合う出撃中の仲間の名前。 */
        affinity: this.matching(state, demon.school ?? null),
      }
    })
  }

  /** 物語で出会ってから、素材と契約料を払って契約する候補。 */
  demonContracts(state: GameState) {
    const conversations = new ConversationRules(this.catalog)
    return this.catalog.data.demons.flatMap((demon) => {
      if (
        !demon.contract ||
        state.demons.some((entry) => entry.id === demon.id)
      )
        return []
      const encounter = this.catalog.data.conversations?.find(
        (entry) => entry.id === demon.contract!.encounter
      )
      if (!encounter) return []
      const met = state.conversation?.seen.includes(encounter.id) ?? false
      const materials = demon.contract.materials.map((entry) => ({
        ...entry,
        name: this.catalog.good(entry.good)!.name,
        owned: Bag.count(state.bag, entry.good),
      }))
      const canMeet =
        conversations.canStart(state, "talk", { resident: demon.id }) &&
        conversations.reasons(state, "talk", encounter, { resident: demon.id })
          .length === 0
      const canContract =
        met &&
        state.phase.type === "town" &&
        !state.hero.registrationPending &&
        !state.wipe &&
        !state.conversation?.active &&
        state.gold >= demon.contract.gold &&
        state.stones >= (demon.contract.stones ?? 0) &&
        materials.every((entry) => entry.owned >= entry.count)
      return [
        {
          id: demon.id,
          name: demon.name,
          met,
          called:
            met ||
            (state.conversation?.flags?.includes(`demon-called:${demon.id}`) ??
              false),
          paperName: demon.contract.paper
            ? this.catalog.good(demon.contract.paper)!.name
            : null,
          ownedPapers: demon.contract.paper
            ? Bag.count(state.bag, demon.contract.paper)
            : 0,
          canInvoke: (() => {
            const conversation = state.conversation ?? {
              seen: [],
              last: null,
              active: null,
            }
            const called =
              met || conversation.flags?.includes(`demon-called:${demon.id}`)
            if (
              demon.contract.paper &&
              !called &&
              !Bag.count(state.bag, demon.contract.paper)
            )
              return false
            const next = {
              ...state,
              conversation: {
                ...conversation,
                flags: [
                  ...(conversation.flags ?? []),
                  `demon-called:${demon.id}`,
                ],
              },
            }
            return (
              conversations.canStart(next, "talk", { resident: demon.id }) &&
              conversations.reasons(next, "talk", encounter, {
                resident: demon.id,
              }).length === 0
            )
          })(),
          canMeet,
          canContract,
          gold: demon.contract.gold,
          stones: demon.contract.stones ?? 0,
          ownedStones: state.stones,
          materials,
          unlock: encounter.minimumReached,
          bond: new DemonBonds(this.catalog).view(state, demon.id),
        },
      ]
    })
  }

  /** その悪魔のレベルでの合体の効果。効果がなければ null。 */
  private fusionOf(demonId: string, lv: number) {
    const fusion = this.catalog.demon(demonId)?.fusion
    if (!fusion) return null
    const resist = Object.entries(fusion.resist ?? {}).map(([kind, value]) =>
      statusResistanceView(kind as StatusKind, Math.min(1, value * lv))
    )
    const attackPercent = Math.round((fusion.attack ?? 0) * lv * 100)
    const maxHp = (fusion.maxHp ?? 0) * lv
    if (!attackPercent && !maxHp && !resist.length) return null
    return { attackPercent, maxHp, resist }
  }

  /** その流派を使える出撃中の仲間の名前。 */
  private matching(state: GameState, school: MagicSchool | null) {
    if (!school) return [] as string[]
    return state.party.flatMap((id) => {
      const member = state.members.find((entry) => entry.id === id)
      if (!member) return []
      if (this.rules.equipment.isHero(member)) return []
      return this.rules.magic.schoolsOf(member, state).includes(school)
        ? [this.catalog.member(id)?.name ?? id]
        : []
    })
  }

  demonDef(id: string) {
    return this.catalog.demon(id)
  }

  /** 募集の枠。引き直すまで残る。契約済みの者は hired。 */
  recruits(state: GameState) {
    // 出撃の3人がそろっていなければ、契約した仲間はそのまま隊列へ入る
    const joins = state.party.length < PARTY_SLOTS
    return state.board.flatMap((id) => {
      const recruit = this.catalog.recruit(id)
      if (!recruit || recruit.retired) return []
      const hired =
        state.recruited.includes(recruit.id) ||
        state.members.some((member) => member.id === recruit.member.id)
      return [
        {
          id: recruit.id,
          member: recruit.member.id,
          name: recruit.member.name,
          job: recruit.member.job,
          roleName: ROLE_NAMES[recruit.member.role],
          roleNote:
            recruit.member.combatStyle ?? ROLE_NOTES[recruit.member.role],
          lv: recruit.member.lv,
          rank: recruit.rank ?? null,
          /** 専用の武器を持つ仲間（R・ユニーク）。武器は付け替えられない。 */
          unique: !!recruit.member.unique,
          /** 防具も変えられない仲間（固定装備）。 */
          fixedArmor: !!recruit.member.unique && !!recruit.member.fixedArmor,
          /** 成長の型（序盤・中盤・終盤の伸び方）。 */
          growthTypeName:
            GROWTH_TYPE_NAMES[recruit.member.growthType ?? "normal"],
          /** 使える魔法の流派の名前（使えなければ空）。 */
          schoolNames: (recruit.member.schools ?? []).map(
            (school) => MAGIC_SCHOOL_NAMES[school]
          ),
          price: recruit.price,
          hired,
          /** 契約するとすぐ隊列に入る（3人そろっていない）。 */
          joins,
          affordable: state.gold >= recruit.price,
        },
      ]
    })
  }

  /** 募集の引き直し。 */
  reroll(state: GameState) {
    const price = this.catalog.data.recruiting.reroll
    return { price, affordable: state.gold >= price }
  }

  /** 旧クライアント向けの互換Query。ガチャ操作は常に不可。 */
  summon(state: GameState) {
    return {
      enabled: false,
      stones: state.stones,
      failure: this.catalog.data.summon.failure.map((entry) => ({
        name: this.catalog.good(entry.good)?.name ?? entry.good,
        count: entry.count,
      })),
    }
  }

  quests(state: GameState) {
    return this.catalog.data.quests
      .filter((quest) => !quest.requiresCleared || state.cleared)
      .map((quest) => {
        const progress = state.quests.find((entry) => entry.id === quest.id)
        const status = !progress
          ? "open"
          : progress.claimed
            ? "done"
            : progress.progress >= quest.count
              ? "ready"
              : "active"
        const party = this.members.party(state)
        const battleBlock =
          party.length !== PARTY_SLOTS
            ? "3人の仲間を編成しよう"
            : party.some((member) => member.hp <= 0)
              ? "宿で仲間を回復しよう"
              : party.some(
                    (member) =>
                      this.catalog.data.balance.exhaustedAt <= member.fatigue
                  )
                ? "宿で疲れを取ろう"
                : state.reached < (quest.encounter?.reached ?? 0)
                  ? `${quest.encounter!.reached - 1}層の突破後に解放`
                  : null
        const locations = this.catalog.data.layers
          .filter((_layer, index) => index <= state.reached)
          .filter((layer) =>
            quest.requiresBossVictory
              ? layer.boss === quest.foe
              : layer.boss === quest.foe ||
                layer.foes.includes(quest.foe) ||
                layer.stations.some((station) =>
                  station.foes?.includes(quest.foe)
                ) ||
                (layer.treasure.mimic?.foe === quest.foe &&
                  layer.treasure.mimic.chance > 0)
          )
          .map((layer) => ({ no: layer.no, name: layer.name }))
        return {
          ...quest,
          progress: progress?.progress ?? 0,
          status,
          canAccept: !quest.encounter && status === "open",
          canFight:
            !!quest.encounter &&
            state.phase.type === "town" &&
            !state.conversation?.active &&
            !state.wipe &&
            status !== "done" &&
            status !== "ready" &&
            !battleBlock,
          battleBlock,
          enemyNames: (quest.encounter?.foes ?? []).map(
            (id) => this.catalog.foe(id)!.name
          ),
          locations,
        } as const
      })
  }

  /** 街の施設に付ける印：報告できる依頼・鑑定できるガラクタ・休むべき仲間。 */
  marks(state: GameState) {
    return {
      guild: this.quests(state).some((quest) => quest.status === "ready"),
      shop: Bag.count(state.bag, this.catalog.data.junk) > 0,
      inn: this.members
        .party(state)
        .some((member) => member.hp < member.maxHp || member.fatigue >= 50),
    }
  }

  /**
   * 街で出す結果の板。全滅で失った物と、踏破（エンディング）のどちらか。
   * 全滅を先に見せ、閉じると踏破の場面へ進む。
   */
  result(state: GameState) {
    if (state.phase.type !== "town") return null
    if (state.wipe) {
      const layer = this.catalog.layer(state.wipe.layer)
      return {
        kind: "wipe" as const,
        layerName: layer?.name ?? "",
        gold: state.wipe.gold,
        goods: [
          ...state.wipe.goods.map((entry) => ({
            good: entry.good,
            name: this.catalog.good(entry.good)?.name ?? entry.good,
            count: entry.count,
          })),
          ...(state.wipe.unidentifiedWeapons ?? []).map((entry) => {
            const type = this.catalog.good(entry.good)?.weaponType
            return {
              good: entry.good,
              name: `だれかの${type ? WEAPON_TYPE_NAMES[type] : "武器"}（未鑑定）`,
              count: entry.count,
            }
          }),
        ],
        /** 全滅しても持ち帰れたガラクタ。 */
        kept: (state.wipe.kept ?? []).map((entry) => ({
          good: entry.good,
          name: this.catalog.good(entry.good)?.name ?? entry.good,
          count: entry.count,
        })),
      }
    }
    if (state.cleared && !state.endingSeen) {
      const last = this.catalog.data.layers[this.catalog.data.layers.length - 1]
      return {
        kind: "ending" as const,
        layerName: last.name,
        gold: 0,
        goods: [] as { good: string; name: string; count: number }[],
        kept: [] as { good: string; name: string; count: number }[],
      }
    }
    return null
  }

  /** 今夜まだ雑談していない仲間がいるか。 */
  canChat(state: GameState) {
    return (
      state.phase.type === "town" &&
      state.nights > 0 &&
      state.party.some((id) => !state.chatted.includes(id))
    )
  }

  /** その仲間と今夜まだ雑談していないか。 */
  canChatWith(state: GameState, member: string) {
    return (
      state.phase.type === "town" &&
      state.nights > 0 &&
      state.party.includes(member) &&
      !state.chatted.includes(member)
    )
  }
}
