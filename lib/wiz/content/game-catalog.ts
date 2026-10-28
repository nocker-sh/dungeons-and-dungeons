import { expandRoute } from "@/lib/wiz/content/route-tree"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WeaponType } from "@/lib/wiz/content/constants"
import {
  contentSchema,
  type DemonDef,
  type FoeDef,
  type GoodDef,
  type LayerDef,
  type MemberDef,
  type QuestDef,
  type ReadonlyContent,
  type RecruitDef,
  type RoomDef,
  type ShopDef,
  type SkillDef,
} from "@/lib/wiz/content/content-schema"
import { ContentError } from "@/lib/wiz/content/content-error"
import { byId } from "@/lib/wiz/content/by-id"
import { verifyContent } from "@/lib/wiz/content/content-verification"

/** 入力を複製・検証し、全階層を凍結した定義だけをプレイ間で共有する。 */
export class GameCatalog {
  readonly data: ReadonlyContent
  readonly #skills: Map<string, WizDeepReadonly<SkillDef>>
  readonly #goods: Map<string, WizDeepReadonly<GoodDef>>
  readonly #foes: Map<string, WizDeepReadonly<FoeDef>>
  readonly #layers: Map<string, WizDeepReadonly<LayerDef>>
  readonly #demons: Map<string, WizDeepReadonly<DemonDef>>
  readonly #rooms: Map<string, WizDeepReadonly<RoomDef>>
  readonly #shops: Map<string, WizDeepReadonly<ShopDef>>
  readonly #recruits: Map<string, WizDeepReadonly<RecruitDef>>
  readonly #quests: Map<string, WizDeepReadonly<QuestDef>>
  readonly #members: Map<string, WizDeepReadonly<MemberDef>>

  constructor(input: unknown) {
    const parsed = contentSchema.safeParse(input)
    if (!parsed.success)
      throw new ContentError(
        parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        )
      )
    const data = parsed.data as ReadonlyContent
    const problems: string[] = []
    this.data = data
    this.#skills = byId(data.skills, "ワザ", problems)
    this.#goods = byId(data.goods, "品物", problems)
    this.#foes = byId(data.foes, "敵", problems)
    this.#layers = byId(data.layers, "層", problems)
    this.#demons = byId(data.demons, "悪魔", problems)
    this.#rooms = byId(data.rooms, "部屋", problems)
    this.#shops = byId(data.shops, "店", problems)
    this.#recruits = byId(data.recruits, "募集", problems)
    this.#quests = byId(data.quests, "依頼", problems)
    this.#members = byId(
      [...data.party, ...data.recruits.map((entry) => entry.member)],
      "仲間",
      problems
    )
    verifyContent(this, problems)
    if (problems.length) throw new ContentError(problems)
    // 検証した道のりを、合流しない木に広げて使う（分岐は合流せずに分かれ続ける）
    const expanded = { ...data, layers: data.layers.map(expandRoute) }
    GameCatalog.#freeze(expanded)
    this.data = expanded as ReadonlyContent
    this.#layers = byId(expanded.layers, "層", problems)
    Object.freeze(this)
  }

  skill(id: string) {
    return this.#skills.get(id)
  }
  good(id: string) {
    return this.#goods.get(id)
  }
  foe(id: string) {
    return this.#foes.get(id)
  }
  layer(id: string) {
    return this.#layers.get(id)
  }
  demon(id: string) {
    return this.#demons.get(id)
  }
  room(id: string) {
    return this.#rooms.get(id)
  }
  shop(id: string) {
    return this.#shops.get(id)
  }
  /**
   * その店の鑑定候補。到達した層で見つかる品物だけにする。
   * 武器・防具は段（鑑定限定は appraiseFrom、店の品は unlock）が
   * 到達した層の一つ前から一つ先までのものに絞る。保持の重みを指定した収集品は、古い段になっても候補に残る。
   */
  appraisalPool(shopId: string, reached: number) {
    return (this.shop(shopId)?.appraise ?? []).filter((id) => {
      const good = this.good(id)
      if (!good) return false
      if ((good.appraiseFrom ?? 0) > reached) return false
      const tier = this.appraisalTier(id)
      if (tier > reached + 1) return false
      const gear = good.kind === "weapon" || good.kind === "armor"
      return (
        !gear ||
        tier >= reached - 1 ||
        good.appraisalRetentionWeight !== undefined
      )
    })
  }
  /** 敵が落とす武器の候補。どこかの店の鑑定候補にある武器（段の絞り方も鑑定と同じ）。 */
  weaponDropPool(reached: number) {
    const ids = new Set<string>()
    for (const shop of this.data.shops)
      for (const id of this.appraisalPool(shop.id, reached))
        if (this.good(id)?.kind === "weapon") ids.add(id)
    return [...ids]
  }
  /** 鑑定での段。鑑定限定の品は見つかる層、店の品は並ぶ層。 */
  appraisalTier(id: string) {
    const good = this.good(id)
    return good?.appraiseFrom ?? good?.unlock ?? 0
  }
  /** 鑑定の重み。新しい段は ahead、古い収集品は指定した保持の重み。 */
  appraisalWeight(id: string, reached: number) {
    const good = this.good(id)
    if (
      this.appraisalTier(id) < reached - 1 &&
      good?.appraisalRetentionWeight !== undefined
    )
      return good.appraisalRetentionWeight
    const weight = good?.appraisalWeight ?? 1
    return this.appraisalTier(id) > reached
      ? weight * this.data.balance.appraisal.ahead
      : weight
  }
  recruit(id: string) {
    return this.#recruits.get(id)
  }
  /** 武器種ごとの、ランダムなワザの候補。 */
  weaponPool(type: WeaponType) {
    return this.data.weaponSkills[type] ?? []
  }
  recipe(id: string) {
    return this.data.smithy?.recipes.find((entry) => entry.id === id)
  }
  quest(id: string) {
    return this.#quests.get(id)
  }
  /** 仲間の定義（最初の3人と募集の冒険者）。 */
  member(id: string) {
    return this.#members.get(id)
  }
  /** 品物の職業条件を満たすか。所有・場面・固有装備のロックは操作側で確認する。 */
  canEquip(memberId: string, goodId: string) {
    const member = this.member(memberId)
    const good = this.good(goodId)
    if (!member || !good || (good.kind !== "weapon" && good.kind !== "armor"))
      return false
    if (member.hero && good.kind === "armor") return false
    // 悪魔と契約して戦う仲間（R）は武器も防具も持たない
    if (member.pact) return false
    return !good.allowedJobs || good.allowedJobs.includes(member.job)
  }
  /**
   * その仲間の、その種類（武器・防具）の装備が変えられないか。
   * 専用の武器を持つ仲間（`unique`）は武器、固定装備の仲間（`fixedArmor`）は防具も。
   */
  isSlotFixed(memberId: string, kind: string | undefined) {
    const member = this.member(memberId)
    if (member?.pact) return kind === "weapon" || kind === "armor"
    if (!member?.unique) return false
    if (kind === "weapon") return true
    return kind === "armor" && !!member.fixedArmor
  }
  station(layerId: string, stationId: string) {
    return this.layer(layerId)?.stations.find((entry) => entry.id === stationId)
  }
  layerIndex(layerId: string) {
    return this.data.layers.findIndex((entry) => entry.id === layerId)
  }

  /** zodが複製したJSONデータだけを凍結する。引き表も同じ参照を保持する。 */
  static #freeze(value: unknown): void {
    if (typeof value !== "object" || value === null) return
    for (const child of Object.values(value)) GameCatalog.#freeze(child)
    Object.freeze(value)
  }
}
