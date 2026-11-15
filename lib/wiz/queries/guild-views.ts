import { questLayers } from "@/lib/wiz/rules/quest-layers"
import { DemonInvocationRules } from "@/lib/wiz/rules/demon-invocation-rules"
import { DemonContractRules } from "@/lib/wiz/rules/demon-contract-rules"
import { DemonBonds } from "@/lib/wiz/rules/demon-bonds"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { Bag } from "@/lib/wiz/rules/bag"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"
import {
  WEAPON_TYPE_NAMES,
  ROLE_NAMES,
  ROLE_NOTES,
  GROWTH_TYPE_NAMES,
  MAGIC_SCHOOL_NAMES,
} from "@/lib/wiz/queries/names"
import type { MemberViews } from "@/lib/wiz/queries/member-views"

/** 依頼一覧の並び順。小さいほど上。 */
const questRank = (quest: {
  status: string
  canAccept: boolean
  canFight: boolean
  battleBlock: string | null
}) =>
  quest.status === "ready"
    ? 0
    : quest.canAccept || quest.canFight
      ? 1
      : quest.status === "done"
        ? 4
        : quest.battleBlock
          ? 3
          : 2

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

  /** 契約した悪魔。レベル・次のレベルまでの経験値・戦闘で呼ぶ悪魔か・流派。 */
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
        /** 戦闘で呼んだときの必殺技。 */
        call: this.rules.demonCall.skillOf(demon.id),
      }
    })
  }

  /** 物語で出会ってから、素材と契約料を払って契約する候補。 */
  demonContracts(state: GameState) {
    const conversations = new ConversationRules(this.catalog)
    const invocations = new DemonInvocationRules(this.catalog)
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
      const canContract = new DemonContractRules(this.catalog).prepare(
        state,
        demon.id
      ).ready
      return [
        {
          id: demon.id,
          name: demon.name,
          met,
          called: invocations.called(state, demon.id),
          paperName: demon.contract.paper
            ? this.catalog.good(demon.contract.paper)!.name
            : null,
          ownedPapers: demon.contract.paper
            ? Bag.count(state.bag, demon.contract.paper)
            : 0,
          canInvoke: invocations.canInvoke(state, demon.id),
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
    const affordable = state.gold >= price
    return {
      price,
      affordable,
      /** 引き直せるか。登録前は契約できないので引き直さない。 */
      enabled: affordable && !state.hero.registrationPending,
    }
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
    // 戦えるかは人数・現在HP・疲労で決まる。依頼ごとに装備やワザの表示を組み立てない。
    const party = state.members.filter((member) =>
      state.party.includes(member.id)
    )
    const partyBlock = state.hero.registrationPending
      ? "ギルドで登録しよう"
      : party.length !== PARTY_SLOTS
        ? "3人の仲間を編成しよう"
        : party.some((member) => member.hp <= 0)
          ? "宿で仲間を回復しよう"
          : party.some(
                (member) =>
                  this.catalog.data.balance.exhaustedAt <= member.fatigue
              )
            ? "宿で疲れを取ろう"
            : null
    return (
      this.catalog.data.quests
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
          const battleBlock =
            partyBlock ??
            (state.reached < (quest.encounter?.reached ?? 0)
              ? `${quest.encounter!.reached - 1}層の突破後に解放`
              : null)
          const locations = questLayers(this.catalog, quest, state.reached).map(
            (layer) => ({ no: layer.no, name: layer.name })
          )
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
        // まだ行けない層の討伐依頼は掲示しない。受けた依頼と街の単発戦闘は残す
        .filter(
          (quest) =>
            !!quest.encounter ||
            quest.status !== "open" ||
            quest.locations.length > 0
        )
        // 今できる依頼（報告・引き受け・戦う）を先に、受注中・鍵付き・達成済みを後に並べる
        .map((quest, order) => ({ quest, order }))
        .sort(
          (a, b) =>
            questRank(a.quest) - questRank(b.quest) || a.order - b.order
        )
        .map((entry) => entry.quest)
    )
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
        /** この探索で得て失った契約石。 */
        stones: state.wipe.stones ?? 0,
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
        stones: 0,
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
      state.party.some(
        (id) =>
          !state.chatted.includes(id) && !this.rules.equipment.isHero({ id })
      )
    )
  }

  /** その仲間と今夜まだ雑談していないか。 */
  canChatWith(state: GameState, member: string) {
    return (
      state.phase.type === "town" &&
      state.nights > 0 &&
      state.party.includes(member) &&
      !this.rules.equipment.isHero({ id: member }) &&
      !state.chatted.includes(member)
    )
  }
}
